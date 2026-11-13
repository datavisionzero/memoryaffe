package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const tid = "12345678-1234-4123-8123-123456789abc"

func invoke(t *testing.T, h http.HandlerFunc, args ...string) (int, string) {
	t.Helper()
	s := httptest.NewServer(h)
	defer s.Close()
	t.Setenv("MEMORYAFFE_SERVER", s.URL)
	t.Setenv("MEMORYAFFE_TOKEN", "secret-token")
	var out, err bytes.Buffer
	n := run(append([]string{"--json", "--allow-local-http"}, args...), strings.NewReader(""), &out, &err)
	return n, out.String() + err.String()
}
func TestOperations(t *testing.T) {
	cases := []struct {
		a    []string
		m, p string
	}{{[]string{"vault", "list", "--cursor", "a+b"}, "GET", "/api/v1/vaults"}, {[]string{"tag", "list", "--vault", tid}, "GET", "/api/v1/vaults/" + tid + "/tags"}, {[]string{"tag", "create", "--vault", tid, "--name", "Tag"}, "POST", "/api/v1/vaults/" + tid + "/tags"}, {[]string{"memory", "search", "--all-vaults"}, "POST", "/api/v1/memories/search"}, {[]string{"memory", "get", tid}, "GET", "/api/v1/memories/" + tid}, {[]string{"memory", "create", "--vault", tid, "--title", "T", "--stdin"}, "POST", "/api/v1/memories"}, {[]string{"memory", "update", tid, "--revision", "9007199254740993", "--clear-summary", "--clear-tags"}, "PATCH", "/api/v1/memories/" + tid}, {[]string{"memory", "delete", tid, "--revision", "2"}, "DELETE", "/api/v1/memories/" + tid}}
	for _, c := range cases {
		t.Run(strings.Join(c.a[:2], "_"), func(t *testing.T) {
			n, out := invoke(t, func(w http.ResponseWriter, r *http.Request) {
				if r.Method != c.m || r.URL.Path != c.p {
					t.Errorf("%s %s", r.Method, r.URL.Path)
				}
				if r.Header.Get("Authorization") != "Bearer secret-token" {
					t.Error("auth")
				}
				if c.m == "PATCH" || c.m == "DELETE" || c.a[1] == "create" {
					if !idPattern.MatchString(r.Header.Get("Idempotency-Key")) {
						t.Error("UUID fehlt")
					}
				}
				if c.m == "DELETE" && r.URL.Query().Get("expectedRevision") != "2" {
					t.Error("revision")
				}
				fmt.Fprint(w, `{"items":[],"nextCursor":"abc"}`)
			}, c.a...)
			if n != 0 || !strings.Contains(out, `"nextCursor":"abc"`) {
				t.Fatalf("%d %s", n, out)
			}
		})
	}
}
func TestBytes(t *testing.T) {
	for _, s := range []string{"", "# Grüße\nα😀\n", "# CRLF\r\nText\r\n"} {
		for _, file := range []bool{false, true} {
			args := []string{"memory", "create", "--vault", tid, "--title", "T"}
			if file {
				p := filepath.Join(t.TempDir(), "m.md")
				os.WriteFile(p, []byte(s), 0600)
				args = append(args, "--file", p)
			} else {
				args = append(args, "--stdin")
			}
			o, _ := parse(args)
			_, _, b, _, e := operation(o, strings.NewReader(s))
			if e != nil || b["markdown"] != s {
				t.Fatalf("%q %v", b, e)
			}
		}
	}
	o, _ := parse([]string{"memory", "create", "--vault", tid, "--title", "T", "--stdin"})
	for _, s := range []string{"\xff", "\x00"} {
		if _, _, _, _, e := operation(o, strings.NewReader(s)); e == nil {
			t.Error("invalid UTF8/NUL accepted")
		}
	}
}
func TestValidation(t *testing.T) {
	for _, a := range [][]string{{}, {"memory", "create"}, {"memory", "update", tid}, {"memory", "search"}, {"memory", "search", "--vault", tid, "--all-vaults"}, {"vault", "list", "--token", "secret"}, {"vault", "list", "--page-size", "101"}, {"memory", "get", "../x"}} {
		var out, err bytes.Buffer
		if n := run(append([]string{"--json"}, a...), strings.NewReader(""), &out, &err); n != 2 {
			t.Errorf("%v => %d", a, n)
		}
	}
}
func TestRetriesExitRedaction(t *testing.T) {
	old := pause
	pause = func(time.Duration) {}
	defer func() { pause = old }()
	for _, s := range []int{400, 401, 403, 404, 409, 410, 413, 429, 500, 503} {
		count := 0
		key := ""
		n, out := invoke(t, func(w http.ResponseWriter, r *http.Request) {
			count++
			k := r.Header.Get("Idempotency-Key")
			if key != "" && key != k {
				t.Error("key changed")
			}
			key = k
			w.WriteHeader(s)
			fmt.Fprint(w, `{"code":"error","message":"secret-token","requestId":"r"}`)
		}, "memory", "delete", tid, "--revision", "1")
		want := 1
		if s == 429 || s == 503 {
			want = 3
		}
		if n != statusExit(s) || count != want || strings.Contains(out, "secret-token") || !json.Valid([]byte(out)) {
			t.Errorf("status=%d exit=%d count=%d %s", s, n, count, out)
		}
	}
}
func TestTLSRedirect(t *testing.T) {
	old := pause
	pause = func(time.Duration) {}
	defer func() { pause = old }()
	s := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, `{}`) }))
	defer s.Close()
	t.Setenv("MEMORYAFFE_SERVER", s.URL)
	t.Setenv("MEMORYAFFE_TOKEN", "secret")
	var out, err bytes.Buffer
	if n := run([]string{"vault", "list"}, strings.NewReader(""), &out, &err); n != 8 {
		t.Errorf("TLS=%d", n)
	}
	leaked := false
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { leaked = true }))
	defer target.Close()
	n, _ := invoke(t, func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, target.URL, 302) }, "vault", "list")
	if leaked || n == 0 {
		t.Error("redirect followed")
	}
	o, _ := parse(nil)
	if _, _, e := makeClient("http://example.com", o); e == nil {
		t.Error("HTTP allowed")
	}
}
func TestProfileSafety(t *testing.T) {
	root := t.TempDir()
	t.Setenv("LOCALAPPDATA", root)
	t.Setenv("XDG_CONFIG_HOME", root)
	c := config{Default: "t", Profiles: map[string]profile{"t": {Server: "https://localhost", Token: "hidden-token"}}}
	if e := saveConfig(c); e != nil {
		t.Fatal(e)
	}
	if _, e := loadConfig(); e != nil {
		t.Fatal(e)
	}
	var out, err bytes.Buffer
	if n := run([]string{"--json", "profile", "list"}, strings.NewReader(""), &out, &err); n != 0 || strings.Contains(out.String(), "hidden-token") {
		t.Fatalf("%d %s %s", n, out.String(), err.String())
	}
}

func TestExplicitKeyRetryAfterAndEnvironment(t *testing.T) {
	old := pause
	pause = func(time.Duration) { t.Error("Retry-After >30 darf nicht warten") }
	defer func() { pause = old }()
	count := 0
	n, _ := invoke(t, func(w http.ResponseWriter, r *http.Request) {
		count++
		if r.Header.Get("Idempotency-Key") != "manual:key" {
			t.Error("explicit key")
		}
		w.Header().Set("Retry-After", "31")
		w.WriteHeader(429)
		fmt.Fprint(w, `{"code":"rate_limited","message":"wait","requestId":"r"}`)
	}, "memory", "delete", tid, "--revision", "1", "--idempotency-key", "manual:key")
	if n != 7 || count != 1 {
		t.Errorf("exit=%d count=%d", n, count)
	}
	t.Setenv("MEMORYAFFE_SERVER", "https://env.example")
	t.Setenv("MEMORYAFFE_TOKEN", "env-token")
	o, _ := parse(nil)
	p, e := resolveProfile(o)
	if e != nil || p.Server != "https://env.example" || p.Token != "env-token" {
		t.Fatal("environment resolution", e)
	}
}
