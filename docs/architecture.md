# Architecture

How Maximus is put together: which processes run, how a chat turn moves through
them, how the background agent works, and what ends up on disk. It covers the
code on `main`.

Security boundaries and the threat model are in [security.md](security.md).
Code identifiers are Swedish. This document glosses them where it helps.

---

## 1. Components and processes

```
 ┌─ Tauri shell (Rust, src-tauri/src/main.rs) ───────────────────────────────┐
 │  makes a 32-byte session key, starts the server, owns the window           │
 │                                                                            │
 │  webview ── http://127.0.0.1:3261/?n=<key>  →  cookie "maximus" ──┐        │
 └───────────────────────────────────────────────────────────────────┼────────┘
                                                                     ▼
 ┌─ Node server (server.mjs + lib/*.mjs, bundled Node 22) ───────────────────┐
 │  HTTP + SSE, all state, the agent heartbeat, encryption, the ledger        │
 └──┬───────────────┬────────────────────┬──────────────────┬─────────────────┘
    │ UNIX socket   │ child processes    │ Playwright       │ HTTPS (opt-in)
    │ 0600          │                    │ Chromium         │
    ▼               ▼                    ▼                  ▼
 llama-server    whisper-cli         web search,        cloud model
 (via a model    maximus-ocr         page fetch         (masked), update
 scheduler, if   maximus-kalender    (masked queries)   manifest
 installed)      maximus-paminnelser
                 maximus-skriv, -pdf, -diktera
```

| Part | Language | Where | How it's reached |
|---|---|---|---|
| Shell | Rust, Tauri 2 | `src-tauri/` | — |
| Server | Node ≥ 22. Runtime deps: `playwright`, `docx`, `pptxgenjs` | `server.mjs`, `lib/` (116 modules) | `127.0.0.1:3261` plus a key or cookie |
| UI | Vanilla JS, no build step | `public/` (`index.html`, `app.js`, `style.css`) | Served by the server from memory |
| Model | llama.cpp `llama-server`, prebuilt and bundled | `src-tauri/resources/bin` | UNIX socket `<data>/modell.sock`, mode 0600, no TCP port |
| Speech | whisper.cpp `whisper-cli` for files and meetings. Apple SpeechAnalyzer (`maximus-diktera`) for live dictation on macOS 26 | `verktyg/`, built by `scripts/hamta-verktyg.mjs` | Child process |
| Swift helpers | Swift | `verktyg/*.swift` | Child process, found through `hitta()` in `lib/plattform.mjs` |
| Web | Playwright Chromium | `lib/webb.mjs` | Outgoing HTTPS |

### Startup

1. **Data directory.** The shell picks it as `MAXIMUS_DATA`, otherwise
   `~/Library/Application Support/Maximus`. On Windows it is `%APPDATA%\Maximus`.
   The server resolves it the same way (`datakatalog()` in `lib/plattform.mjs`);
   on Linux that means `$XDG_DATA_HOME` or `~/.local/share/maximus`.
2. **Port.** `MAXIMUS_PORT`, default `3261`. The server binds to `127.0.0.1`.
3. **Session key.** The shell reads 32 random bytes and hex-encodes them.
   - If something already answers on the port (background mode, see below),
     the shell reuses that server and reads the key from `<data>/nyckel`.
   - Otherwise it spawns `resources/node resources/backend/server.mjs --tyst` with:
     - `MAXIMUS_NYCKEL`
     - `MAXIMUS_PORT`
     - `MAXIMUS_DATA`
     - `MAXIMUS_RESURSER` (where the bundled binaries live)
     - `MAXIMUS_FORALDER` (the shell's pid)
     - `MAXIMUS_APP`

   The server's stdout and stderr are appended to `<data>/server.log`.
4. **Key file.** The server writes the key to `<data>/nyckel` with mode 0600.
5. **Window.** The shell waits for the port (up to 15 s) and then opens a
   1280×900 window on `http://127.0.0.1:<port>/?n=<key>`.
6. **Key exchange.** A `GET /` with the right `n` gets a `302 /` that strips
   the key from the URL. It also sets a cookie:
   `maximus=<token>; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`.
   - The token is a separate random value, not the key.
   - Valid tokens are kept in `<data>/sessioner.token`, at most 50.
7. **Model.** The server starts `llama-server` on the UNIX socket
   (`sakerstallModell()` in `lib/modell.mjs`).
   - If an [optional model scheduler](#optional-model-scheduler) is installed,
     the server is started through it, with the model, its memory need and a
     maximum hold time, so the memory is accounted for.
   - Desktop defaults: `--parallel 3` with three slots, `--ctx-size` of 3 × 32768,
     a q8_0 KV cache, `--jinja`, and `--cache-reuse 256` when the binary supports it.
   - Model files live in `<data>/modeller/`. A file that already sits in
     `~/models` is reused instead of downloaded again.

Request guards, in order:

1. `Sec-Fetch-Site` that is not `same-origin` or `none` → 403.
2. No key, header (`x-maximus-nyckel`) or valid cookie → 403.
3. GET while the app is locked → 423 (a few startup routes are exempt).
4. Any non-GET request must be a `POST` with `x-maximus-local: 1` → otherwise 403.

Static responses carry a strict CSP (`default-src 'none'; script-src 'self'; …`).

### Shutdown and background modes

Closing the window ends the app.
- The shell sends `POST /api/stang` (with the key header) and waits up to 3 s
  for the port to go quiet.
- The server locks, stops the model and exits.
- The server also checks every 2 s that `MAXIMUS_FORALDER` is still alive, and
  shuts itself down if the shell is gone.

`lib/bakgrund.mjs` adds two opt-in modes. Both are macOS LaunchAgents with the
label `ai.aurolabs.maximus.<mode>.<hash of data dir>`.

| Mode (`LAGEN`) | What runs |
|---|---|
| `oppen` (default) | Only while the app is open |
| `inloggning` | The app opens at login, with the window visible or hidden (`--dold`) |
| `bakgrund` | launchd runs `node server.mjs --tyst` without a window and restarts it on failure. The window attaches to that server and leaves it running on close. |

### Optional model scheduler

Maximus can use an optional local model scheduler: a program on `PATH` that
hands out memory to model processes. When it's there, Maximus starts its
model through it, and `lib/kapacitet.mjs` asks it whether the machine can
hold a chat model and an agent model at the same time. Without it, Maximus
guesses from OS memory, and the UI labels the result as a guess.

---

## 2. A chat turn

```
 app.js                         server.mjs                          lib/
 ──────                         ──────────                          ────
 POST /api/sessioner/:id/skicka ─▶ build turn, push, save
                               ◀── 202 {turId}
 EventSource                       async:
 /api/sessioner/:id/handelser ◀─── steg: minns / soker / planerar …
                                    │ web needed?  ──────────────▶  uppslag.avgorWebb
                                    │   rules first, model if unsure
                                    │   yes → classify → (ask) ────▶ anonymSokfraga
                                    │        → grindaSokfraga ─────▶ failclosed.utatGrind
                                    │        → webb.sok (Playwright) ─▶ ledger row
                                    │ tools?  ───────────────────▶  slinga (≤ 6 steps)
                                    │ answer  ───────────────────▶  kedja.lokaltSvar
                                    │                                 └ lokal.svaraLokalt
                                    │                                   (slot 0, or cloud)
                               ◀─── text {bit} … text {bit}
                               ◀─── klar {tur}   (with kvitto, sources)
```

**1. Send.**
- The client calls `POST /api/sessioner/:id/skicka` with
  `{fraga, webb: 'auto'|true|false, djup}`.
- The server builds the turn, saves it and answers **202** with the turn id
  right away. The rest runs detached.
- `POST …/stopp` aborts the turn through an `AbortController`.

**2. Stream.**
- Output goes to Server-Sent Events on a separate GET,
  `/api/sessioner/:id/handelser`.
- Every message is `data: <json>` with a `typ` field. There are no named events.
  - Progress: `steg`, `kalla`, `webbgrind`, `text {turId, bit}`, `klar {tur}`.
  - Proposals: `forslag`, `handling`, `uppdragsforslag`.
- A `: puls` comment goes out every 15 s.
- A global stream at `/api/handelser` carries list changes and notifications.

**3. Masking.**
- **The local model always sees the original text.** The route hard-codes
  `lokalt = true`.
- The session's treatment setting (`behandling` in `lib/behandling.mjs`) has
  three values: Original, Masked (Maskerat) and Anonymised (Anonymiserat). It
  only controls the copy-out text you take with you, produced by
  `POST /api/forbered`.
- Masking is enforced wherever text leaves the machine:
  - **Web queries.** `anonymSokfraga` runs first, then `grindaSokfraga` =
    `utatGrind` in `lib/failclosed.mjs`, directly before transport. Tool
    arguments go through `grindaArgument`, which **throws** if anything
    identifying survives.
  - **Cloud model calls** (section 5).
  - **Connections** (Kopplingar).
- Masking is rules first: ID numbers, phone numbers, addresses, account
  numbers and case numbers (`lib/maskering.mjs`, `lib/kedja.mjs`). A local
  "gate" model call can fill in names the rules miss (`lib/grind.mjs`).
- The per-session map (`karta`) gives the same person the same placeholder,
  for example `[NAMN A]`, across turns.

**4. Web decision** (`lib/uppslag.mjs`).
1. `forbjuderSok` checks whether the user said not to search.
2. Questions about the user's own mail or calendar go to tools, not the web.
3. `avgorWebb` runs the regex rules in `behovsWebb`. Only when they return
   "unsure" does the model decide, with a 24-token budget on the `beslut`
   slot. Any failure counts as no.
4. Information classed as sensitive (levels 2–3, `lib/klassning.mjs`) needs your
   yes. The UI shows a `webbgrind` prompt and waits up to 180 s; a timeout
   counts as no.

`slaUpp` searches for up to three rounds. It tries Brave, Ecosia, Startpage,
DuckDuckGo, Mojeek and Bing in order, in a fresh browser context, with private
IPs blocked (SSRF guard). Fetched text is cleaned of instruction-like lines
(`rensaPakallande`). It is then wrapped between fences that carry a random
nonce per fetch (`byggUnderlag` / `byggBilaga`), so a page can't close the
fence itself.

**5. Tools loop.**

A turn runs with tools when it's in the agent conversation, or when
`lib/verktygsfraga.mjs` detects that it's about your own sources: mail,
calendar, reminders, notes, messages, calls or a folder.

`slinga()` (`lib/slinga.mjs`) runs the loop:
- At most **6 steps**.
- It parses OpenAI-style `tool_calls`, with a fallback to JSON in code fences.
- It blocks identical repeated calls.
- Each result is capped at 3000 characters.
- `arligtSvar` corrects any claim of an action that didn't happen.

The tools are listed in `lib/verktyg.mjs`. They include web search, read page,
mail, calendar, free slots, reminders, notes, Safari page, messages, folder,
read file, calculate, Shortcuts, plus one tool per action.

The five **actions** are reminder, meeting, mail draft, note and Shortcut
(`lib/handlingar.mjs`).
- Each has a lever: `fraga` (ask, the default), `far` (allowed) or `aldrig` (never).
- A proposed action waits for Yes/No. The calendar and reminder ones can be undone.
- Every executed action writes a ledger row.
- Maximus never sends anything unless you press Send. Suggested replies
  are text; the Send button in the reply box is the only way out. It is no
  action and no tool, so the agent and the model cannot reach it. After a
  10-second undo window (in memory only), Mail replies to the original and
  sends.

**6. Answer.**
- `kedja.lokaltSvar` → `lokal.svaraLokalt(…, {plats: 'samtal'})` streams from
  llama-server.
- `lib/lokal.mjs` sends a fixed `id_slot` for each kind of work:

  | Slot | Used by |
  |---|---|
  | 0 | chat (`samtal`) |
  | 1 | quick decisions (`beslut`) |
  | 2 | after-work (`efterat`) and the agent (`agent`) |

- The system prompt is kept static, so the KV cache prefix survives between
  turns. The date and the conversation summary go into the user message
  instead. A system prompt that changes every turn throws the cache away.
- Long conversations are trimmed from the oldest end and summarised
  (`lib/minne.mjs`, `lib/aterkall.mjs`).

**7. Receipt (kvitto).**
- Each turn carries `tur.kvitto`, a list of `{tid, aktor, vad, ms, lokalt}`
  entries.
- The actors are: Rules, Local model, This computer, Memory, Web, Agent. The
  Local model entry includes the KV-cache hit, e.g. "read N new tokens — X of Y
  were cached".
- The UI shows it under each answer as "What happened" (Vad som hände). It is
  also part of the PDF export.
- The kvitto is per turn and shows what happened locally. The ledger is
  separate and records only what left the machine.

---

## 3. The agent heartbeat

The agent is one stateless function per run, `slag()` in `lib/agent.mjs`. It
takes the profile and new items and returns JSON. The only state kept between
runs is the per-source watermark (vattenmärke).

```
   setInterval(tick, tempo)         vaktaHandelser every 30 s
            │                              │ fs.watch on folders,
            │                              │ mtime of Messages / call DBs
            ▼                              ▼
       slaHjarta() ── for each mission (uppdrag) that is due ──┐
                                                               ▼
           chat busy? ── yes ──▶ skip, leave watermark, try next run
               │ no
               ▼
           read sources since watermark ── nothing new ──▶ log "nothing", advance
               │ new items
               ▼
           triage batch (≤ 30 items, slot 2) → {behall: [...], undan: [...]}
               │                                   │
               ▼                                   ▼
           finds (fynd, weight 1–3)           set aside (undanlagt) with reason
               │
               ├─▶ fyndsamtal: post into the Foundation session or "Agenten"
               ├─▶ notify (SSE; macOS notification if no window; phone if weight 3)
               └─▶ weight 3 → maybe investigate (arbete), ≤ 1 per run
```

**Tempo (takt).** Set under Settings → Agent (Agenten) → Work (Arbete). Defined
as `TEMPON` in `lib/arbete.mjs`.

| Tempo | Sweep every | Investigations / hour | On battery |
|---|---|---|---|
| Calm (`lugn`) | 15 min | 1 | Every third sweep |
| Normal (`normal`, default) | 5 min | 3 | Every third sweep |
| Full throttle (`full`, "Full gas") | 1 min | 12 | Full speed |

- The battery throttle can be turned off (`agentBatteri: 'samma'`).
- A catch-up run fires 30 s after start.
- A sleep detector triggers a catch-up run after a wake.

**Each mission has its own pace.**
- The sweep only asks what is due (`Uppdrag.farKoras`).
- A mission's `takt` comes from its instruction text first. For example,
  "every hour" means 60 and "every Monday" means 10080.
- Otherwise the source type decides (`lib/uppdrag.mjs`):

  | Source type | Default | Floor |
  |---|---|---|
  | Local | 15 min | 5 min |
  | Web (`sida`, `amne`, `sok`) | 180 min | 30 min |

- Three errors in a row pause a mission, and the reason is kept.

**Event watcher** (`lib/handelser.mjs`, `vaktaHandelser` in `server.mjs`).
- Only for missions that opted in.
- It polls every 30 s.
- Signals that trigger an immediate check:
  - `fs.watch` on folder sources;
  - a change in the mtime of the Messages and call-history databases.
- Mail and Calendar have no signal. They are polled, with a minimum interval
  per source (`MINSTA`). For example, mail every 120 s, web every 30 min.
- A hard 30 s floor applies even when a signal fires.

**Queueing and chat priority.**
- The chat always wins. If a chat turn is running, the agent skips the mission
  for that run. It doesn't advance the watermark, so the items wait for the
  next run.
- Only a manual "Run now" overrides a running chat.

**Triage** (`triagePrompt` / `lasTriage`).
- Up to `SATS = 30` items go into one call. The profile comes first, so it
  stays in the KV cache.
- Items are fenced as untrusted material.
- Each item gets one of:
  - kept (`behall`), with weight 1–3 (3 = must see today), work/private and a reason;
  - set aside (`undan`), with a reason.
- Anything the model doesn't mention is **kept** at weight 1 and marked as not
  assessed (`obedomd`). Nothing disappears silently.
- A truncated reply is salvaged item by item.
- If more than 30 items arrived, the unweighed ones are removed from the
  watermark, so they come back next run.

**Trace (spår).** Every run writes a row per mission, including "nothing
new", to `agentspar.json`, capped at 200 rows. Identical consecutive rows are
collapsed with a counter. Readable at `GET /api/agent/spar` and through the
agent's `vad_hande` tool.

**Finds → Foundation sessions** (`lib/grunden.mjs`).

The Foundation (Grunden) is a set of "holy" (`helig`) sessions:
- one **You** (Du) session for your profile;
- one per app you've granted access to: mail, calendar, reminders, notes, messages.

`POST /api/grund` sets one up:
1. It creates the session.
2. It runs a 4-step scan of the app.
3. It parses OVERVIEW / IMPORTANT / HOW OFTEN / RAISE.
4. It creates a recurring mission at the suggested pace. Default paces:

   | App | Pace |
   |---|---|
   | Mail | 30 min |
   | Messages | 60 min |
   | Calendar | 240 min |
   | Reminders | 240 min |
   | Notes | 1440 min |

How finds are posted (`fyndsamtal()` in `server.mjs`):
- Finds from a Foundation mission go into that app's session. Other finds go
  into the single "Agenten" session.
- The post is an agent turn: a rule-written list of the finds, then a summary
  of at most four sentences. Finds that tried to steer the model are left out
  of the summary.
- Holy sessions can't be archived or deleted one by one, only through Delete
  all.

**Investigations** (`lib/arbete.mjs`).
- Weight-3 finds that were assessed, carry no injection, and haven't been
  handled yet can get one investigation per run, within the tempo budget.
- Each investigation runs in its own isolated session, with web off and at
  most three agent ↔ assistant rounds.

**Notifications.**
- Always: an SSE `notis` to open windows.
- With no window open: a macOS notification.
- For weight-3 finds: also a phone ping, via an iCloud Reminders list or iMessage.
- All of these can be turned off under Settings → Agent → Notifications
  (Notiser).

---

## 4. Storage

Everything lives in the data directory. Model weights are in `<data>/modeller/`.

| Path | What |
|---|---|
| `nyckel` | The per-start session key (0600) |
| `sessioner.token` | Valid cookie tokens |
| `las.json` | Password salt and check value. Never encrypted. |
| `locket.json` | Quick-unlock PIN (Locket) |
| `installningar.json` | Settings |
| `sessioner/<uuid>.json` | One file per session |
| `fynd.json` | `{fynd, undanlagt}`: finds and set-aside items, newest 500 of each |
| `uppdrag.json`, `agentspar.json` | Missions, agent trace |
| `du.json`, `projekt.json`, `handlingar.json`, `bevakning.json`, `frister.json`, … | Profile, projects, actions, watches, deadlines |
| `liggare/YYYY-MM-DD.json` | The ledger, one file per day |
| `modell.sock` | The model socket (0600) |
| `server.log` | Server output |

**Encryption** (`lib/krypto.mjs`, `lib/maximus.mjs`).
- Once you set a password, every JSON file is written as an envelope:
  `MAXIMUS1\0` ‖ 12-byte nonce ‖ 16-byte GCM tag ‖ AES-256-GCM ciphertext.
- The key is derived with scrypt from your password:
  - N = 2^17, r = 8, p = 1;
  - 16-byte salt;
  - the password is NFKC-normalised first.
- Writes go to a temp file and are then renamed, serialised per path, with
  mode 0600.
- A corrupt file is renamed to `*.skadad-<time>` and never overwritten.
- If you set no password, files are plaintext. The UI says so.
- "Remember password" stores the master key in the macOS keychain. The service
  name is `ai.aurolabs.maximus3.<hash of data dir>`.

**Session protection.**

| Mode | Meaning |
|---|---|
| Open | Encrypted with the master key, like everything else |
| Locked (`last`) | The code is a UI gate only. The password still opens it. |
| Sealed (`forseglad`) | Body encrypted with a key derived from master key **and** code. Without the code there is no way in, not even for Maximus. Only a few header fields stay outside (title, timestamps). |

**Locket** (`lib/locket.mjs`).
- A 6-digit PIN that unwraps the master key, using scrypt with N = 2^16.
- It is weaker than the password, by design.
- After 10 wrong tries the wrapped key is deleted, and only the password works.

**Ledger** (liggaren).
- **What gets a row:** every outbound event. That covers web search, page fetch,
  cloud call, connection call, executed action, and update check or download.
- **Row contents:** time, recipient, path, character count, duration, and
  exactly what was sent and received.
- **Turning it off:** it can be disabled in settings. While it's off, nothing
  is recorded.
- **Day files:** each day file is `{k: 1, forra: <sha256 of previous day's
  plaintext>, forraDag, rader: [...]}`. That makes the days a hash chain
  (`lib/liggarkedja.mjs`). `granska` reports missing links, deleted days and
  changed days.
- **Sealed sessions:** rows from a sealed session keep their content in an
  envelope encrypted with the session key.
- **Not in the ledger:** local model answers. They never leave the machine.

---

## 5. Cloud model routing (`lib/lokal.mjs` + `lib/moln.mjs`)

The cloud model is opt-in, under Settings → Model (Modellen) → In the cloud
(I molnet).

Providers (`LEVERANTORER`):
- Berget AI (Sweden)
- OpenAI
- Anthropic
- Google Gemini (OpenAI-compatible endpoint)
- OpenRouter (OAuth with PKCE, marked experimental)

API keys live in the macOS keychain: service `ai.aurolabs.maximus.moln`,
account = provider. They are never stored in a file.

The setting `installningar.moln = {pa, leverantor, modell, maskering}`. Saving
it runs a live test call, and Maximus turns the cloud off again if the test fails.

**Routing.**
- When the setting is on and a key exists, `svaraLokaltNu` and `verktygsanrop`
  in `lib/lokal.mjs` call `tillMolnet` instead of llama-server.
- That covers every model call made through those two functions: the answer,
  the web decision, summaries and the agent loop.
- Two calls always stay local: the masking gate model (`lib/grind.mjs`) and the
  anonymising rewrite. The rule is that whatever sees the original never goes out.

**Masking before the cloud** (`maskeraMeddelanden`). It uses the cloud
setting's own level, not the session's treatment.

| Level | What it masks |
|---|---|
| `strikt` (default) | Everything `utatGrind` masks, plus unknown names, cities and workplaces |
| `personuppgifter` | Personal data only (`utatGrind`) |

- The profile part of the prompt is always masked at the strict level.
- Images are dropped.
- The answer is unmasked on the machine while it streams.
- Tool arguments are unmasked only for local tools. Outbound tools keep the
  placeholders.

**Ledger and preview.**
- Each cloud call writes a ledger row (`vag: 'moln'`) with the number of masked
  values.
- `POST /api/moln/forhandsgranska` shows exactly what would be sent, without
  sending anything.

---

## 6. Updates

Off until you say yes (`installningar.uppdateringar === true`). Two steps:

1. **Check.** The server fetches the manifest at
   `https://aurolabs.ai/maximus/uppdatering.json` (`lib/uppdatering.mjs`; the
   URL can be overridden with `MAXIMUS_UPPDATERINGAR`).
   - The request carries only the version and platform: no id.
   - It is written to the ledger, including failures.
2. **Install.** When you accept, the UI calls the Tauri updater plugin
   (`plugin:updater|check`, then `download_and_install`).
   - The plugin reads `latest.json` from
     `https://github.com/aurolabsai/maximus/releases/latest/download/latest.json`.
   - It verifies the minisign signature against the public key in
     `src-tauri/tauri.conf.json` and refuses anything unsigned.
   - Your data stays where it is.

The app is signed for updates but not yet notarised by Apple. Until it is,
macOS treats each update as a new app and asks again for Calendar and Reminders
access.
