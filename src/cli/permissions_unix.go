//go:build !windows

package main

import (
	"errors"
	"os"
)

func securePrivate(path string, dir bool) error {
	mode := os.FileMode(0600)
	if dir {
		mode = 0700
	}
	return os.Chmod(path, mode)
}
func verifyPrivate(path string) error {
	s, e := os.Lstat(path)
	if e != nil {
		return e
	}
	if s.Mode()&os.ModeSymlink != 0 || s.Mode().Perm()&0077 != 0 {
		return errors.New("Unsichere Profilrechte; nur Eigentümer darf zugreifen")
	}
	return nil
}
