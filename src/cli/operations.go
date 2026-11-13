package main

import (
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

var idPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

func operation(o options, in io.Reader) (method, path string, b map[string]any, write bool, err error) {
	q := url.Values{}
	b = map[string]any{}
	bad := func(s string) (string, string, map[string]any, bool, error) { return "", "", nil, false, errors.New(s) }
	if len(o.a) == 0 {
		return bad("Befehl fehlt; --help zeigt Hilfe")
	}
	cmd := strings.Join(o.a[:min(2, len(o.a))], " ")
	allowed := ""
	switch cmd {
	case "doctor", "vault list":
		allowed = "page-size cursor"
	case "tag list", "tag create":
		if o.get("vault") == "" {
			return bad("--vault fehlt")
		}
		allowed = "vault page-size cursor"
		if cmd == "tag create" {
			write = true
			allowed = "vault name idempotency-key"
			if !o.has("name") {
				return bad("--name fehlt")
			}
			b["name"] = o.get("name")
		}
	case "memory search":
		allowed = "vault all-vaults query tag tag-match sort page-size cursor"
		if o.has("vault") == o.has("all-vaults") {
			return bad("Genau --vault oder --all-vaults erforderlich")
		}
		if o.has("vault") {
			b["vaultId"] = o.get("vault")
		} else {
			b["allVaults"] = true
		}
		for _, pair := range [][2]string{{"query", "query"}, {"tag-match", "tagMatch"}, {"sort", "sort"}, {"cursor", "cursor"}} {
			if o.has(pair[0]) {
				b[pair[1]] = o.get(pair[0])
			}
		}
		if o.has("tag-match") && o.get("tag-match") != "all" && o.get("tag-match") != "any" {
			return bad("--tag-match muss all oder any sein")
		}
		if o.has("sort") && o.get("sort") != "relevance" && o.get("sort") != "updatedAt" {
			return bad("Ungültige Sortierung")
		}
	case "memory get", "memory update", "memory delete":
		if len(o.a) != 3 || !idPattern.MatchString(o.a[2]) {
			return bad("Gültige Memory-UUID erforderlich")
		}
		if cmd != "memory get" {
			write = true
			allowed = "revision idempotency-key"
			if !regexp.MustCompile(`^[1-9][0-9]*$`).MatchString(o.get("revision")) {
				return bad("--revision muss positive dezimale Zeichenfolge sein")
			}
			if cmd == "memory update" {
				b["expectedRevision"] = o.get("revision")
				allowed += " title file stdin summary clear-summary tag clear-tags"
			} else {
				q.Set("expectedRevision", o.get("revision"))
			}
		}
	case "memory create":
		write = true
		allowed = "vault title file stdin summary tag idempotency-key"
		if !o.has("vault") || !o.has("title") || (!o.has("file") && !o.has("stdin")) {
			return bad("--vault, --title und --file oder --stdin erforderlich")
		}
		b["vaultId"] = o.get("vault")
	default:
		return bad("Unbekannter Befehl; --help zeigt Hilfe")
	}
	want := 2
	if cmd == "doctor" {
		want = 1
	}
	if strings.HasPrefix(cmd, "memory ") && cmd != "memory create" && cmd != "memory search" {
		want = 3
	}
	if len(o.a) != want {
		return bad("Unerwartete Positionsargumente")
	}
	for k := range o.v {
		if !strings.Contains(" profile ca-file json allow-local-http ", " "+k+" ") && !strings.Contains(" "+allowed+" ", " "+k+" ") {
			return bad(fmt.Sprintf("--%s ist für diesen Befehl nicht erlaubt", k))
		}
	}
	if o.has("vault") && !idPattern.MatchString(o.get("vault")) {
		return bad("Ungültige Vault-UUID")
	}
	if o.has("file") && o.has("stdin") || o.has("summary") && o.has("clear-summary") || o.has("tag") && o.has("clear-tags") {
		return bad("Widersprüchliche Eingabeoptionen")
	}
	if o.has("page-size") {
		n, e := strconv.Atoi(o.get("page-size"))
		if e != nil || n < 1 || n > 100 {
			return bad("--page-size muss 1 bis 100 sein")
		}
		if cmd == "memory search" {
			b["pageSize"] = n
		} else {
			q.Set("pageSize", strconv.Itoa(n))
		}
	}
	if o.has("cursor") {
		v := o.get("cursor")
		if len(v) == 0 || len(v) > 8192 {
			return bad("Ungültiger Cursor")
		}
		for _, c := range v {
			if c < 1 || c > 127 {
				return bad("Cursor muss ASCII sein")
			}
		}
		if cmd != "memory search" {
			q.Set("cursor", v)
		}
	}
	if o.has("tag") {
		tags := o.v["tag"]
		limit := 50
		if cmd == "memory search" {
			limit = 100
		}
		if len(tags) > limit {
			return bad("Zu viele Tags")
		}
		seen := map[string]bool{}
		for _, id := range tags {
			if !idPattern.MatchString(id) || seen[strings.ToLower(id)] {
				return bad("Ungültige oder doppelte Tag-UUID")
			}
			seen[strings.ToLower(id)] = true
		}
		b["tagIds"] = tags
	}
	if o.has("clear-tags") {
		b["tagIds"] = []string{}
	}
	for _, k := range []string{"title", "summary"} {
		if o.has(k) {
			b[k] = o.get(k)
		}
	}
	if o.has("clear-summary") {
		b["summary"] = nil
	}
	if o.has("file") || o.has("stdin") {
		var r io.Reader = in
		if o.has("file") {
			f, e := os.Open(o.get("file"))
			if e != nil {
				return bad("Markdown-Datei nicht lesbar")
			}
			defer f.Close()
			r = f
		}
		data, e := io.ReadAll(io.LimitReader(r, 1048577))
		if e != nil {
			return bad("Markdown nicht lesbar")
		}
		if len(data) > 1048576 || !utf8.Valid(data) || bytesNull(data) {
			return bad("Markdown muss gültiges UTF-8 ohne NUL sein (maximal 1 MiB)")
		}
		b["markdown"] = string(data)
	}
	for k, v := range b {
		if s, ok := v.(string); ok {
			if !utf8.ValidString(s) || strings.ContainsRune(s, 0) {
				return bad("Ungültiger Text")
			}
			limit := 0
			switch k {
			case "title":
				limit = 200
				if strings.TrimSpace(s) == "" {
					return bad("Titel darf nicht leer sein")
				}
			case "summary":
				limit = 1000
			case "name":
				limit = 50
				if strings.TrimSpace(s) == "" {
					return bad("Tagname darf nicht leer sein")
				}
			case "query":
				limit = 4096
			}
			if limit > 0 && utf8.RuneCountInString(s) > limit {
				return bad("Text überschreitet Größenlimit")
			}
		}
	}
	// Routes and HTTP verbs are generated from the agent OpenAPI contract.
	binding := map[string]string{"doctor": "list_vaults", "vault list": "list_vaults", "tag list": "list_tags", "tag create": "create_tag", "memory search": "search_memories", "memory get": "get_memory", "memory create": "create_memory", "memory update": "update_memory", "memory delete": "delete_memory"}[cmd]
	spec := agentOperations[binding]
	method = spec.Method
	id := ""
	if len(o.a) == 3 {
		id = o.a[2]
	}
	path = strings.NewReplacer("{vaultId}", url.PathEscape(o.get("vault")), "{id}", url.PathEscape(id)).Replace(spec.Path)
	if len(q) > 0 {
		path += "?" + q.Encode()
	}
	if method == "GET" || method == "DELETE" {
		b = nil
	}
	return
}
func bytesNull(b []byte) bool {
	for _, v := range b {
		if v == 0 {
			return true
		}
	}
	return false
}
