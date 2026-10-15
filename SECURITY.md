# Security policy

The full security and privacy model is in [docs/security.md](docs/security.md). It covers the threat model, everything that can leave the machine, the masking gate, encryption, and the limits.

## Supported versions

Only the **latest release** gets security fixes. Update through About (Om Maximus) → New versions, or from [Releases](https://github.com/aurolabsai/maximus/releases/latest).

## Reporting a vulnerability

Open a **private GitHub security advisory** at [github.com/aurolabsai/maximus/security/advisories/new](https://github.com/aurolabsai/maximus/security/advisories/new). Don't file a public issue.

Please include:

- the Maximus version and macOS version
- the steps to reproduce, what happened, and what you expected
- a minimal proof of concept, if you have one

For masking bypasses, use synthetic data. Never send real personal data.

## In scope

- **Data leaving the machine** in a way [docs/security.md §2](docs/security.md#2-exactly-what-can-leave-the-machine) doesn't describe, or without the setting it names
- **Masking gate bypasses**: an identifier that gets past `utatGrind`, `grindaArgument` or the cloud gate at the level that should catch it
- **The local API**: reaching the server or the model from a web page, or from another user account, without the key, cookie or pairing code
- **Encryption at rest, sealed sessions, the lid code, and the keychain handling**, beyond the limits the doc already states
- **The ledger**: an outbound call that isn't recorded, or a chain break that `granska()` misses
- **The agent**: an action carried out without your yes, or fetched or phone text gaining authority it shouldn't have
- **The updater**: installing an update that isn't validly signed

## Out of scope

- Limits the doc already states: malware running as you, re-identification from context, a model giving a wrong answer, prompt-injection phrasings the filter doesn't recognise as long as they gain no authority, offline brute force of the six-digit lid code against a copied folder, and a ledger rewritten by someone who holds the master key
- What third parties do with data you chose to send them, such as a cloud model provider, a search engine, or Apple
- Missing notarization. This is already known.
