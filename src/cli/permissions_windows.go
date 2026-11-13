//go:build windows

package main

import (
	"encoding/base64"
	"encoding/binary"
	"errors"
	"os/exec"
	"strings"
	"unicode/utf16"
)

func ownerSID() (string, error) {
	b, e := exec.Command("whoami", "/user", "/fo", "csv", "/nh").Output()
	if e != nil {
		return "", e
	}
	s := strings.TrimSpace(string(b))
	i := strings.Index(s, "S-1-")
	if i < 0 {
		return "", errors.New("Benutzer-SID fehlt")
	}
	return strings.Trim(strings.TrimSpace(s[i:]), "\""), nil
}
func securePrivate(path string, dir bool) error {
	sid, e := ownerSID()
	if e != nil {
		return e
	}
	grant := "*" + sid + ":F"
	if dir {
		grant = "*" + sid + ":(OI)(CI)F"
	}
	return exec.Command("icacls", path, "/inheritance:r", "/grant:r", grant).Run()
}
func verifyPrivate(path string) error {
	sid, e := ownerSID()
	if e != nil {
		return e
	}
	quote := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }
	script := `$ErrorActionPreference='Stop'; $acl=[System.IO.File]::GetAccessControl(` + quote(path) + `); if(-not $acl.AreAccessRulesProtected){exit 1}; foreach($r in $acl.Access){if($r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne ` + quote(sid) + `){exit 2}}`
	chars := utf16.Encode([]rune(script))
	b := make([]byte, len(chars)*2)
	for i, c := range chars {
		binary.LittleEndian.PutUint16(b[i*2:], c)
	}
	e = exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-EncodedCommand", base64.StdEncoding.EncodeToString(b)).Run()
	if e != nil {
		return errors.New("Unsichere Profil-ACL; ausschließlich Eigentümerzugriff erforderlich")
	}
	return nil
}
