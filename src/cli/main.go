package main

import (
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var pause = time.Sleep

const version = "0.1.0"

type options struct {
	v map[string][]string
	a []string
}

func (o options) get(k string) string {
	if len(o.v[k]) > 0 {
		return o.v[k][0]
	}
	return ""
}
func (o options) has(k string) bool { _, ok := o.v[k]; return ok }
func parse(args []string) (options, error) {
	o := options{v: map[string][]string{}}
	bo := strings.Fields("json help version stdin all-vaults clear-tags clear-summary interactive allow-local-http")
	va := strings.Fields("profile ca-file vault page-size cursor name query tag tag-match sort title file summary revision idempotency-key")
	contains := func(a []string, k string) bool {
		for _, s := range a {
			if s == k {
				return true
			}
		}
		return false
	}
	for i := 0; i < len(args); i++ {
		s := args[i]
		if !strings.HasPrefix(s, "--") {
			o.a = append(o.a, s)
			continue
		}
		k, v, eq := strings.Cut(s[2:], "=")
		if contains(bo, k) {
			if eq {
				return o, errors.New("Schalter ohne Wert verwenden")
			}
			v = "true"
		} else if contains(va, k) {
			if !eq {
				i++
				if i == len(args) || strings.HasPrefix(args[i], "--") {
					return o, fmt.Errorf("Wert für --%s fehlt", k)
				}
				v = args[i]
			}
		} else {
			return o, fmt.Errorf("unbekannte Option --%s", k)
		}
		if k != "tag" && o.has(k) {
			return o, fmt.Errorf("Option --%s doppelt", k)
		}
		o.v[k] = append(o.v[k], v)
	}
	return o, nil
}
func main() { os.Exit(run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr)) }
func fail(o options, out, errout io.Writer, code, msg string, n int) int {
	if o.has("json") {
		json.NewEncoder(out).Encode(map[string]string{"code": code, "message": msg, "requestId": "cli"})
	} else {
		fmt.Fprintln(errout, msg)
	}
	return n
}
func run(args []string, in io.Reader, out, errout io.Writer) int {
	o, e := parse(args)
	bad := func(msg string) int { return fail(o, out, errout, "validation_failed", msg, 2) }
	if e != nil {
		return bad(e.Error())
	}
	if o.has("help") {
		fmt.Fprintln(out, help)
		return 0
	}
	if o.has("version") {
		fmt.Fprintln(out, version)
		return 0
	}
	if len(o.a) > 0 && o.a[0] == "profile" {
		return profileCommand(o, in, out, errout)
	}
	method, path, body, write, e := operation(o, in)
	if e != nil {
		return bad(e.Error())
	}
	p, e := resolveProfile(o)
	if e != nil {
		return bad(e.Error())
	}
	if p.Token == "" {
		return fail(o, out, errout, "authentication_required", "Agententoken fehlt (MEMORYAFFE_TOKEN oder Profil).", 3)
	}
	client, base, e := makeClient(p.Server, o)
	if e != nil {
		return bad(e.Error())
	}
	key := o.get("idempotency-key")
	if write && key == "" {
		b := make([]byte, 16)
		if _, e = rand.Read(b); e != nil {
			return fail(o, out, errout, "internal_error", "Zufallsquelle nicht verfügbar", 1)
		}
		b[6] = (b[6] & 15) | 64
		b[8] = (b[8] & 63) | 128
		key = fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:])
	}
	if key != "" && !regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,128}$`).MatchString(key) {
		return bad("Ungültiger Idempotency-Key")
	}
	data, _ := json.Marshal(body)
	if body == nil {
		data = nil
	}
	for attempt := 0; attempt < 3; attempt++ {
		req, _ := http.NewRequest(method, base+path, bytes.NewReader(data))
		req.Header.Set("Authorization", "Bearer "+p.Token)
		req.Header.Set("Accept", "application/json")
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		if write {
			req.Header.Set("Idempotency-Key", key)
		}
		resp, e := client.Do(req)
		var payload []byte
		if e == nil {
			payload, e = io.ReadAll(io.LimitReader(resp.Body, 8*1024*1024+1))
			resp.Body.Close()
			if len(payload) > 8*1024*1024 {
				e = errors.New("Antwort zu groß")
			}
		}
		retry := e != nil || (resp != nil && (resp.StatusCode == 429 || resp.StatusCode == 503))
		if retry && attempt < 2 {
			delay := []time.Duration{250 * time.Millisecond, time.Second}[attempt]
			if resp != nil {
				h := resp.Header.Get("Retry-After")
				if h != "" {
					n, pe := strconv.Atoi(h)
					var d time.Duration
					if pe == nil {
						d = time.Duration(n) * time.Second
					} else if when, pe := http.ParseTime(h); pe == nil {
						d = time.Until(when)
					}
					if d > 30*time.Second {
						code := "temporarily_unavailable"
						if resp.StatusCode == 429 {
							code = "rate_limited"
						}
						return fail(o, out, errout, code, "Später wiederholen: Retry-After über 30 Sekunden.", statusExit(resp.StatusCode))
					}
					if d > delay {
						delay = d
					}
				}
			}
			var jitter [1]byte
			rand.Read(jitter[:])
			pause(delay + time.Duration(jitter[0])*time.Millisecond/4)
			continue
		}
		if e != nil {
			return fail(o, out, errout, "temporarily_unavailable", "Netzwerk- oder TLS-Fehler; Adresse und Zertifikate prüfen.", 8)
		}
		if !json.Valid(payload) {
			return fail(o, out, errout, "internal_error", "Server lieferte kein gültiges JSON.", 1)
		}
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if o.has("json") {
				fmt.Fprintln(out, string(payload))
			} else {
				var b bytes.Buffer
				json.Indent(&b, payload, "", "  ")
				fmt.Fprintln(out, b.String())
			}
			return 0
		}
		payload = bytes.ReplaceAll(payload, []byte(p.Token), []byte("[REDACTED]"))
		if o.has("json") {
			fmt.Fprintln(out, string(payload))
		} else {
			var v APIError
			json.Unmarshal(payload, &v)
			fmt.Fprintf(errout, "%s: %s (Anfrage %s)\n", v.Code, v.Message, v.RequestID)
		}
		return statusExit(resp.StatusCode)
	}
	return 8
}
func statusExit(s int) int {
	switch s {
	case 400, 410, 413:
		return 2
	case 401:
		return 3
	case 403:
		return 4
	case 404:
		return 5
	case 409:
		return 6
	case 429:
		return 7
	case 503:
		return 8
	}
	return 1
}
func makeClient(server string, o options) (*http.Client, string, error) {
	u, e := url.Parse(server)
	if e != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return nil, "", errors.New("Absolute Server-URL ohne Zugangsdaten/Query/Fragment erforderlich")
	}
	ip := net.ParseIP(u.Hostname())
	local := u.Hostname() == "localhost" || (ip != nil && ip.IsLoopback())
	if u.Scheme != "https" && !(u.Scheme == "http" && local && o.has("allow-local-http")) {
		return nil, "", errors.New("HTTPS erforderlich; localhost-Entwicklung nur mit --allow-local-http")
	}
	cfg := &tls.Config{MinVersion: tls.VersionTLS12}
	if o.has("ca-file") {
		b, e := os.ReadFile(o.get("ca-file"))
		if e != nil {
			return nil, "", errors.New("CA-Datei nicht lesbar")
		}
		roots, e := x509.SystemCertPool()
		if e != nil {
			roots = x509.NewCertPool()
		}
		if !roots.AppendCertsFromPEM(b) {
			return nil, "", errors.New("CA-Datei enthält kein Zertifikat")
		}
		cfg.RootCAs = roots
	}
	tr := http.DefaultTransport.(*http.Transport).Clone()
	tr.DialContext = (&net.Dialer{Timeout: 10 * time.Second}).DialContext
	tr.TLSClientConfig = cfg
	return &http.Client{Transport: tr, Timeout: 30 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}, strings.TrimRight(server, "/"), nil
}

const help = `memoryaffe [--json] [--profile NAME] [--ca-file PATH] COMMAND
profile configure --interactive | list | use NAME | remove NAME
doctor
vault list [--page-size N] [--cursor TEXT]
tag list --vault ID | tag create --vault ID --name TEXT
memory search (--vault ID | --all-vaults) [--query TEXT] [--tag ID] [--tag-match all|any] [--sort relevance|updatedAt]
memory get ID
memory create --vault ID --title TEXT (--file PATH | --stdin) [--summary TEXT] [--tag ID]
memory update ID --revision REV [--title TEXT] [--file PATH | --stdin] [--summary TEXT | --clear-summary] [--tag ID | --clear-tags]
memory delete ID --revision REV
Schreiben: --idempotency-key KEY. Listen/Suche: --page-size N --cursor TEXT.
Token: MEMORYAFFE_TOKEN. Server: MEMORYAFFE_SERVER. Entwicklung: --allow-local-http.`

func humanOutput(out io.Writer, payload []byte) {
	var v map[string]any
	if json.Unmarshal(payload, &v) != nil {
		fmt.Fprintln(out, string(payload))
		return
	}
	line := func(m map[string]any) {
		for _, k := range []string{"id", "name", "title", "revision", "updatedAt"} {
			if s, ok := m[k].(string); ok {
				fmt.Fprintf(out, "%s: %s  ", k, s)
			}
		}
		fmt.Fprintln(out)
	}
	if items, ok := v["items"].([]any); ok {
		for _, item := range items {
			if m, ok := item.(map[string]any); ok {
				line(m)
			}
		}
		if len(items) == 0 {
			fmt.Fprintln(out, "Keine Einträge.")
		}
		if cursor, ok := v["nextCursor"].(string); ok {
			fmt.Fprintln(out, "Cursor:", cursor)
		}
		return
	}
	line(v)
	if s, ok := v["summary"].(string); ok {
		fmt.Fprintln(out, s)
	}
	if s, ok := v["markdown"].(string); ok {
		fmt.Fprint(out, s)
		if !strings.HasSuffix(s, "\n") {
			fmt.Fprintln(out)
		}
	}
}
