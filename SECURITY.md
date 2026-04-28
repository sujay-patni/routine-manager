# Security Policy

Routine Manager is a self-hosted personal app. Please do not publish a deployment that contains real Notion data unless it is protected by your hosting provider and a strong `APP_PASSPHRASE`.

## Reporting a Vulnerability

If you find a security issue, please do not open a public issue with exploit details. Instead, contact the maintainer privately or open a minimal GitHub issue asking for a secure contact path.

Useful details include:

- A short description of the issue.
- Steps to reproduce.
- The affected route, component, or environment variable.
- Whether the issue exposes Notion data, authentication cookies, or secrets.

## Secret Handling

Never commit:

- `.env.local`
- Notion integration tokens
- Notion database IDs from a private workspace
- `APP_PASSPHRASE`
- `COOKIE_SECRET`
- Local assistant/tool configuration
