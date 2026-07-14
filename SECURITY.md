# Security Policy

## Supported Versions

We actively patch security vulnerabilities in the latest stable releases. 

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

## Reporting a Vulnerability

We take the security of Dev Dropbox seriously. If you find a security vulnerability, please do not report it in a public GitHub issue. Instead, follow these steps:

1.  Email security findings to [security@devdropbox.org](mailto:security@devdropbox.org) (or contact the maintainer directly).
2.  Include detailed steps to reproduce the vulnerability, along with system specs and a proof of concept.
3.  Give us up to 30 days to review the findings and release a patch before disclosing the vulnerability publicly.

## Credential Safety

Dev Dropbox stores your GitHub tokens locally in your home directory config folder (`~/.config/dev-dropbox/config.json`). We do not upload your tokens or SSH keys to any third-party analytics or server. Access is limited solely to direct API calls between the background daemon on localhost and GitHub's servers.
