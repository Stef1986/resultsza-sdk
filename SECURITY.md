# Security Policy

## Reporting a vulnerability

If you discover a security issue in this SDK - or in the ResultsZA API it talks to - please report it privately. **Do not open a public GitHub issue** for security problems.

Email **info@resultsza.co.za** with:

- a description of the issue and its potential impact,
- steps to reproduce (proof-of-concept if possible),
- any suggested remediation.

We aim to acknowledge reports within a few business days and will keep you updated on progress toward a fix. Please give us a reasonable opportunity to address the issue before any public disclosure.

## Scope

In scope:

- The SDK code in this repository (client, webhook verification, examples).
- Handling of API keys and webhook secrets by this SDK.

Out of scope for this repository (report to the address above, but note these are handled outside the SDK):

- The ResultsZA API service, portal, and infrastructure.
- Third-party dependencies (report upstream; we track advisories via Dependabot).

## Handling secrets

This SDK is designed so that secrets never enter the repository or your logs:

- API keys are read from arguments or environment variables, never hardcoded.
- The client redacts the API key from any URL or exception message.
- Webhook signatures are verified with a constant-time comparison over the raw request bytes.

If you find a case where a key or secret could be leaked by this SDK, treat it as a security issue and report it using the process above.

## For SDK users

- Never commit real API keys or webhook secrets. Use environment variables and keep `.env` out of version control (this repo ships a `.gitignore` and a gitleaks pre-commit hook to help).
- Rotate any key that may have been exposed - for example, one pasted into a chat, a log, or a screenshot.
