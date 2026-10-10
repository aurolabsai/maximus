# Development

How to build Maximus from source, run it, test it, and ship a release. For how
the parts fit together, read [architecture.md](architecture.md) first.

## Requirements

- macOS 12 or later on Apple Silicon. The desktop app, the Swift helpers and
  the Apple-app readers are macOS only.
- Node ≥ 22.
- Rust (stable), for the Tauri shell.
- Xcode command line tools, which provide `swiftc` and `codesign`.
- `cmake`, to build `whisper-cli`.
- Optional: a local model scheduler on `PATH` (see
  [architecture.md](architecture.md#optional-model-scheduler)). Maximus starts
  its model through it when it's there.

## Build from source

```bash
git clone https://github.com/aurolabsai/maximus.git && cd maximus
npm install
node scripts/hamta-llama.mjs        # llama-server → src-tauri/llama/<target>/
node scripts/hamta-verktyg.mjs      # Swift helpers + whisper-cli → src-tauri/verktyg-bin/<target>/
npx tauri build --bundles app,dmg
```

The two `hamta` ("fetch") scripts:

- **`scripts/hamta-llama.mjs`** downloads a pinned prebuilt llama.cpp release
  (`b11179`) from ggml-org. Each archive is checked against a sha256. It keeps
  only `llama-server` and its libraries.
- **`scripts/hamta-verktyg.mjs`**:
  - compiles `verktyg/*.swift` with `swiftc` into `maximus-ocr`,
    `maximus-kalender`, `maximus-paminnelser`, `maximus-skriv`, `maximus-pdf`
    and `maximus-diktera` (the last targets macOS 26);
  - builds `whisper-cli` from whisper.cpp v1.9.4 source, statically, with Metal;
  - checks with `otool -L` that nothing links outside the system.

You rarely run them by hand. `tauri build` runs
`scripts/klargor-skrivbord.mjs` first (`beforeBuildCommand`), and that script
runs both `hamta` scripts if their output is missing. It also:

- copies `server.mjs`, `package.json`, `lib/`, `public/`, `data/`, `lagar/`,
  `verktyg/` and the production `node_modules` into
  `src-tauri/resources/backend`;
- downloads a Node 22 runtime, checked against `SHASUMS256`, into
  `src-tauri/resources/node`;
- copies the binaries into `src-tauri/resources/bin`.

All of these output directories are gitignored.

The npm scripts that matter for development:

| Script | Runs |
|---|---|
| `npm start` | `node server.mjs`, the server alone on port 3261. Open the URL it prints. |
| `npm test` | `node --test test/*.test.mjs` |
| `npm run skrivbord` | `tauri build` |
| `npm run skrivbord:dev` | `tauri dev` |
| `npm run slapp` | `node scripts/slapp.mjs`, the update manifest (see [Releasing](#releasing)) |
| `npm run signera` | `node scripts/signera.mjs`, a signed and notarised build (needs an Apple Developer ID) |
| `npm run skarpt` | `node scripts/skarpt.mjs`, a release-readiness checklist that changes nothing |

## Running it while you work

There are three ways to run Maximus. None of them touches your real data
unless you ask it to.

| Command | What it does | Port · data |
|---|---|---|
| `sh scripts/kor-appen.sh` | Builds a debug `.app`, signs it, (re)starts it | 3262 · `/tmp/maximus-visning` |
| `sh scripts/synka-appen.sh` | Copies `lib/ public/ verktyg/ data/ lagar/ server.mjs` into the built `.app` without rebuilding, re-signs, restarts | 3262 · `/tmp/maximus-visning` |
| `sh scripts/provserver.sh start` | An isolated server for tests. Prints `PORT=`, `NYCKEL=` (key), `URL=`. `stop` shuts it down and deletes its data. | 3299 · `/tmp/maximus-prov` |

`sh scripts/nollstall.sh` ("reset") stops the debug app and moves its data
aside with a timestamp. It does the same for the app's WebKit data, then
starts the app from onboarding. It deletes nothing.
`sh scripts/nollstall.sh --tillbaka <backup>` restores a backup. macOS
permissions and keychain entries are left alone.

**Why build a real `.app`.** macOS asks for Calendar and Reminders access only
from an app bundle with an `Info.plist` and a stable identity. A bare debug
binary started from a terminal is silently denied.

**Signing.**
- `kor-appen.sh` signs with the certificate "Maximus lokal signering" if one is
  in your keychain, and ad hoc otherwise.
- With a stable certificate, macOS remembers the permissions between builds.
- `synka-appen.sh` requires that certificate. It test-signs a scratch file
  first, so a locked keychain can't leave a half-signed app behind.

All of these honour `MAXIMUS_PORT` and `MAXIMUS_DATA`.

**The server caches `public/` in memory at start.** UI changes don't appear
until you restart the server, even in a plain browser.

## Tests

### Unit and text-rule tests

```bash
npm test                                   # the whole suite (101 files)
node --test test/<name>.test.mjs           # one file
```

- No model is needed.
- `test/ssrf.test.mjs` and `test/natgransen.test.mjs` need DNS (they resolve
  `example.com`). A red result in a sandbox without network is not a code bug.

### Browser tests

Plain `test/<name>.mjs` files (without `.test`) drive the real UI with
Playwright. They run against the isolated test server, never against your own
Maximus:

```bash
sh scripts/provserver.sh start           # → PORT=3299, NYCKEL=<key>
node test/hem.mjs <key>                  # most take the key as the first argument
sh scripts/provserver.sh stop
```

- `test/hjalpare.mjs` has the shared helpers, for example
  `oppna(nyckel, {bredd, hojd})` and `forbiStarten`.
- Some browser tests need a running local model. Those are slow.

### Text-rule tests you must respect

These tests read the source as text. They fail on things a linter wouldn't catch.

| Test | Rule |
|---|---|
| `test/skalan.test.mjs` | **No `px` in `public/style.css` above 1.5.** Hairlines (1px, 1.5px) are fine. Everything else is `rem`, because the app scale lives in the root font size (`--appskala`), and `zoom` is forbidden. Only the condition of an `@media` query is exempt; rules inside it are still checked. |
| `test/yta.test.mjs` | **Every function called in `public/app.js` must be defined** (declared, imported, a parameter, or on the built-in whitelist). Every `$('#id')` must exist in `index.html`. Swedish word boundaries use `\p{L}` lookarounds, not `\b`: JavaScript's `\b` is ASCII-only, so it treats å, ä and ö as boundaries. |
| `test/sandgrans.test.mjs` | **The boundary where data leaves the machine** (sandgräns = sandbox border). Web queries must pass `grindaSokfraga` right before `sok(` in `lib/uppslag.mjs`, and `await sok(` may appear only once. `grindaArgument` in `lib/failclosed.mjs` must call `granska(` and rethrow. The server must prepare masked content itself and never trust the client's (`kropp.lokalt`, `kropp.forberedd` are forbidden). `lib/frontier.mjs` must not exist. |
| `test/rutor.test.mjs` | No CSS rule may set `display` on a `<dialog>` unless the selector has `[open]`, `:modal` or `::backdrop`. Otherwise a closed dialog covers the page and eats clicks. |
| `test/marke.test.mjs` | Every copy of the logo paths matches `public/marke.svg`. |
| `test/statiska.test.mjs` | `public/` is served by reading the directory, not from a hand-kept file list. Every module imported by `app.js` must exist. |

A test is done when it has been **run**, not when it's written. If a test
depends on a starting state, set that state inside the test.

## Code conventions

- **Swedish identifiers and comments.** The domain is Swedish public
  administration (`frist`, `handläggare`). A half-English codebase is one where
  you guess. This document is English; the code isn't.
- **Comments explain why, never what.** When a bug cost time, the comment
  records it with a date (and a measurement if there is one), so the same bug
  isn't built in again. For example:
  ```js
  // 2026-10-06: rsync ran while the keychain was locked: the code went in,
  // the signature didn't, and macOS asked for Calendar again and again.
  ```
- **Short functions, one file per responsibility.** Classes only where there
  is state (`Maximus`, `Koppling`, …).
- **No build step for the UI.** `public/` is plain HTML, CSS and ES modules,
  served as they are. No framework, no bundler, no inline styles: the CSP is
  `style-src 'self'`. Set styles through CSSOM, not `style=` attributes.
- **Rules before the model.** Where a rule can decide, it decides. Examples
  are masking, crisis detection, information classification and the web
  decision. The model fills in; it doesn't rule.
- **One source of truth.** Never keep a hand-written list next to the
  structure it describes. Read the directory and derive from the data. This
  bug shape has bitten twelve times.
- **Tests never touch the user's Maximus.** Use `provserver.sh`.
- **Never start a model around the model scheduler** when it's installed. Stop servers with
  the scripts, not `pkill`, so the model is shut down cleanly.
- **Foreign text is material, never instructions.** Mail, web pages and
  documents go through the fences in `lib/uppslag.mjs`.

## Releasing

Releases go to [GitHub Releases](https://github.com/aurolabsai/maximus/releases).
The in-app updater reads
`https://github.com/aurolabsai/maximus/releases/latest/download/latest.json`
and verifies each file's minisign signature against the public key in
`src-tauri/tauri.conf.json`.

1. **Bump the version by hand** in both `package.json` and
   `src-tauri/tauri.conf.json`. Write the release notes in `data/slapp.md`
   (2000 characters at most).
2. **Create the signing key, once:**
   ```bash
   npx tauri signer generate -w ~/.maximus/slapp.key
   ```
   Its public key must be the `pubkey` in both Tauri configs.
3. **Build with updater artifacts:**
   ```bash
   export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.maximus/slapp.key)"
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=…
   npx tauri build --config src-tauri/tauri.slapp.conf.json
   ```
   `tauri.slapp.conf.json` turns on `createUpdaterArtifacts`, which produces
   `.app.tar.gz` plus `.sig`.
4. **Write the manifest:** `npm run slapp`.
   - It reads the `.sig` files under `src-tauri/target/release/bundle`.
   - It refuses to run if the build, the signatures or the public key are missing.
   - It writes `tmp/latest.json`, with URLs under
     `https://github.com/aurolabsai/maximus/releases/download/v<version>/`.
     Override the base with `MAXIMUS_SLAPP_BAS`.
5. **Upload it yourself.** `slapp.mjs` doesn't upload. It prints a hint:
   ```bash
   gh release create v<version> <dmg> <app.tar.gz> <sig> tmp/latest.json
   ```

Notarisation isn't part of this flow yet. `npm run signera` builds with a
Developer ID and notarises, given the `APPLE_*` environment variables, and
`npm run skarpt` checks that everything for a notarised release is in place.

Two things about the update check:
- Before offering an update, the running app also checks a version manifest at
  `https://github.com/aurolabsai/maximus/releases/latest/download/latest.json` (from 1.0.2; 1.0.0–1.0.1 asked `aurolabs.ai/maximus/uppdatering.json`). You can override that URL with
  `MAXIMUS_UPPDATERINGAR`.
- The check is opt-in and written to the ledger. See
  [architecture.md](architecture.md#6-updates).

## Internationalisation

The interface ships in Swedish and English.

**Files.**

| File | Purpose |
|---|---|
| `lib/sprakstod.mjs` | Server side. Picks the language and looks up texts. |
| `public/sprakstod.js` | Client side. `laddaSprak()` and `t()`. |
| `public/sprak/<code>.json` | The text catalogues, e.g. `sv.json`, `en.json` |

**Catalogue format.**
- Each `public/sprak/<code>.json` is a flat object with one key per text, for
  example `"agent.fynd": "…"`.
- Placeholders are written `{name}`.
- A plural is an object, `{ "en": "…", "flera": "…" }`. Here `en` is Swedish
  for "one", not the language code.
- Lookup order: the chosen language, then Swedish, then the key itself.
- `test/sprakstod.test.mjs` checks that every English key also exists in
  Swedish, with the same placeholders.

**Choosing the language.** The user's setting comes first, unless it is `auto`.
Otherwise Maximus uses the computer's preferred languages (`AppleLanguages` on
macOS, `$LANG` elsewhere). `narmast()` then picks the nearest language that
exists:

1. an exact match (`en-GB`);
2. the base language (`en`);
3. a close relative: Norwegian (`nb`, `nn`, `no`), Danish, Faroese and
   Icelandic go to Swedish;
4. otherwise English if it exists, else Swedish.

Server texts (prompts, agent lines, errors) live in `lib/texter/<code>/*.json`
and are looked up with `tx()`. Masking does not translate: English uses its own
name lists (`data/engelska-*.txt`, built by `scripts/engelska-listor.mjs` from
US SSA, US Census and Moby, all public domain).

To add a language: add `public/sprak/<code>.json` and `lib/texter/<code>/`,
keep keys and placeholders in parity with Swedish (the tests check it), and
add name lists if masking should understand it.

Note: `lib/sprak.mjs` on `main` is not about interface language. It rewrites
the app's example prompts to fit your profile.
