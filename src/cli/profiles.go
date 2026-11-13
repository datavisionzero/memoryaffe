package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"golang.org/x/term"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

type profile struct {
	Server string `json:"server"`
	Token  string `json:"token,omitempty"`
}
type config struct {
	Default  string             `json:"default"`
	Profiles map[string]profile `json:"profiles"`
}

func configPath() (string, error) {
	var root string
	switch runtime.GOOS {
	case "windows":
		root = os.Getenv("LOCALAPPDATA")
	case "darwin":
		home, e := os.UserHomeDir()
		if e != nil {
			return "", e
		}
		root = filepath.Join(home, "Library", "Application Support")
	default:
		root = os.Getenv("XDG_CONFIG_HOME")
		if root == "" {
			home, e := os.UserHomeDir()
			if e != nil {
				return "", e
			}
			root = filepath.Join(home, ".config")
		}
	}
	if root == "" || !filepath.IsAbs(root) {
		return "", errors.New("Absolutes Benutzer-Konfigurationsverzeichnis fehlt")
	}
	return filepath.Join(root, "memoryaffe", "profiles.json"), nil
}
func loadConfig() (config, error) {
	c := config{Profiles: map[string]profile{}}
	p, e := configPath()
	if e != nil {
		return c, e
	}
	b, e := os.ReadFile(p)
	if os.IsNotExist(e) {
		return c, nil
	}
	if e != nil {
		return c, errors.New("Profilkonfiguration nicht lesbar")
	}
	if e = verifyPrivate(p); e != nil {
		return c, e
	}
	if json.Unmarshal(b, &c) != nil {
		return c, errors.New("Ungültige Profilkonfiguration")
	}
	if c.Profiles == nil {
		c.Profiles = map[string]profile{}
	}
	return c, nil
}
func resolveProfile(o options) (profile, error) {
	if !o.has("profile") && os.Getenv("MEMORYAFFE_SERVER") != "" && os.Getenv("MEMORYAFFE_TOKEN") != "" {
		return profile{Server: os.Getenv("MEMORYAFFE_SERVER"), Token: os.Getenv("MEMORYAFFE_TOKEN")}, nil
	}
	c, e := loadConfig()
	if e != nil {
		return profile{}, e
	}
	name := o.get("profile")
	if name == "" {
		name = c.Default
	}
	p, ok := c.Profiles[name]
	if o.has("profile") && !ok {
		return p, errors.New("Profil nicht gefunden")
	}
	if s := os.Getenv("MEMORYAFFE_SERVER"); s != "" {
		p.Server = s
	}
	if t := os.Getenv("MEMORYAFFE_TOKEN"); t != "" {
		p.Token = t
	}
	return p, nil
}
func saveConfig(c config) error {
	path, e := configPath()
	if e != nil {
		return e
	}
	dir := filepath.Dir(path)
	if e = os.MkdirAll(dir, 0700); e != nil {
		return e
	}
	if e = securePrivate(dir, true); e != nil {
		return e
	}
	f, e := os.CreateTemp(dir, "profiles-*")
	if e != nil {
		return e
	}
	tmp := f.Name()
	defer os.Remove(tmp)
	if e = securePrivate(tmp, false); e != nil {
		f.Close()
		return e
	}
	e = json.NewEncoder(f).Encode(c)
	if e == nil {
		e = f.Sync()
	}
	ce := f.Close()
	if e != nil {
		return e
	}
	if ce != nil {
		return ce
	}
	if e = os.Rename(tmp, path); e != nil {
		return e
	}
	return verifyPrivate(path)
}
func profileCommand(o options, in io.Reader, out, errout io.Writer) int {
	bad := func(s string) int { return fail(o, out, errout, "validation_failed", s, 2) }
	if len(o.a) < 2 {
		return bad("Profilbefehl fehlt")
	}
	for k := range o.v {
		if k != "json" && k != "interactive" {
			return bad("Ungültige Option für Profilbefehl")
		}
	}
	c, e := loadConfig()
	if e != nil {
		return bad(e.Error())
	}
	switch o.a[1] {
	case "list":
		if len(o.a) != 2 || o.has("interactive") {
			return bad("Ungültige Argumente")
		}
		items := []map[string]any{}
		for name, p := range c.Profiles {
			items = append(items, map[string]any{"name": name, "server": p.Server, "default": name == c.Default})
		}
		json.NewEncoder(out).Encode(items)
		return 0
	case "use", "remove":
		if len(o.a) != 3 || o.has("interactive") {
			return bad("Profilname fehlt")
		}
		name := o.a[2]
		if _, ok := c.Profiles[name]; !ok {
			return bad("Profil nicht gefunden")
		}
		if o.a[1] == "use" {
			c.Default = name
		} else {
			delete(c.Profiles, name)
			if c.Default == name {
				c.Default = ""
			}
		}
	case "configure":
		if len(o.a) != 2 || !o.has("interactive") {
			return bad("Konfiguration erfordert ausdrücklich --interactive")
		}
		f, ok := in.(*os.File)
		if !ok || !term.IsTerminal(int(f.Fd())) {
			return bad("Interaktive Konfiguration erfordert ein Terminal")
		}
		reader := bufio.NewReader(in)
		ask := func(label string) (string, error) {
			fmt.Fprint(errout, label)
			s, e := reader.ReadString('\n')
			return strings.TrimSpace(s), e
		}
		name, e := ask("Profilname: ")
		if e != nil || name == "" {
			return bad("Profilname fehlt")
		}
		server, e := ask("HTTPS-Server: ")
		if e != nil {
			return bad("Server fehlt")
		}
		check := options{v: map[string][]string{}}
		if _, _, e = makeClient(server, check); e != nil {
			return bad(e.Error())
		}
		fmt.Fprint(errout, "Agententoken (verdeckt): ")
		token, e := term.ReadPassword(int(f.Fd()))
		fmt.Fprintln(errout)
		if e != nil {
			return bad("Tokenabfrage fehlgeschlagen")
		}
		save, e := ask("Token lokal speichern? [ja/NEIN]: ")
		if e != nil {
			return bad("Speicherentscheidung fehlt")
		}
		p := profile{Server: server}
		if save == "ja" {
			p.Token = string(token)
		}
		for i := range token {
			token[i] = 0
		}
		c.Profiles[name] = p
		if c.Default == "" {
			c.Default = name
		}
	default:
		return bad("Unbekannter Profilbefehl")
	}
	if e = saveConfig(c); e != nil {
		return fail(o, out, errout, "internal_error", "Profil konnte nicht mit sicheren Dateirechten gespeichert werden.", 1)
	}
	json.NewEncoder(out).Encode(map[string]bool{"saved": true})
	return 0
}
