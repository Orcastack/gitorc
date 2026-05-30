# Security Mount

This directory is mounted read-only into the Go service containers as `/run/secrets`.

Expected files when signing or live directory enforcement are enabled:

- `orca-signing-private.pem`
- `orca-signing-public.pem`
- `ldap-bind-password.txt`

Do not commit real keys or passwords into this directory.