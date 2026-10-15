# Under the hood

What runs on your Mac when Maximus runs, and exactly how your data is
encrypted, signed and hashed. Every row names the file where it happens, so you
can check it yourself.

## Engines

| Part | Engine | Version | License | Where it runs | In the code |
|---|---|---|---|---|---|
| Desktop shell | Tauri 2 (Rust) + WKWebView | Tauri 2.x | Apache-2.0 / MIT | Native app | `src-tauri/` |
| Local server | Node.js, bundled | 22.23.3 (pinned, sha256-checked) | MIT | Local process, `127.0.0.1` only | `server.mjs`, `lib/` |
| Language model runtime | llama.cpp `llama-server`, Metal on Apple Silicon | build b11179 (pinned, sha256-checked) | MIT | Local process, UNIX socket with mode 0600 | `scripts/hamta-llama.mjs`, `lib/modell.mjs` |
| Language model | Google Gemma 4, picked by memory: E2B below 16 GB, E4B at 16 GB, 12B at 24 GB+ (Q4 quantised GGUF). Qwen 3, Llama 3.1/3.2 and Mistral can be chosen instead. | — | Gemma Terms of Use / Apache-2.0 / Llama Community License | On your Mac | `lib/modeller.mjs` |
| Name model (masking, second layer) | `Wismut/nym-pii-multilingual-small` (int8 ONNX) via `onnxruntime-node` and `@huggingface/tokenizers`; on by default, can be turned off | onnxruntime-node 1.30, tokenizers 0.2; model pinned by revision + sha256 | MIT | On your Mac | `lib/namnmodell.mjs` |
| Image understanding | The model's own vision projector (mmproj), optional download | pinned revision + sha256 | Same as the model | On your Mac | `lib/modeller.mjs` |
| Transcription (files, meetings) | whisper.cpp `whisper-cli` with KB-Whisper large (Swedish, KBLab) or Whisper large-v3-turbo | whisper.cpp v1.9.4; models pinned by revision + sha256 | MIT / Apache-2.0 | On your Mac | `scripts/hamta-verktyg.mjs`, `lib/dokument.mjs` |
| Live dictation | Apple SpeechAnalyzer (DictationTranscriber), on-device | macOS 26 | Apple | On your Mac | `verktyg/diktera.swift` |
| Text in images (OCR) | Apple Vision (`VNRecognizeTextRequest`) | macOS | Apple | On your Mac | `verktyg/ocr.swift` |
| PDF text | Apple PDFKit | macOS | Apple | On your Mac | `verktyg/pdftext.swift` |
| Calendar and Reminders | Apple EventKit (read; write only after your yes) | macOS | Apple | On your Mac | `verktyg/kalender.swift`, `paminnelser.swift`, `skriv.swift` |
| Mail and Notes | AppleScript via Mail and Notes (read only) | macOS | Apple | On your Mac | `lib/post.mjs`, `lib/anteckningar.mjs` |
| Messages and call list | `sqlite3 -readonly` on `chat.db` / CallHistory | macOS | — | On your Mac | `lib/meddelanden.mjs` |
| Web search and page reading | Playwright-driven Chromium behind a local guard proxy | Playwright 1.63 | Apache-2.0 | On your Mac; requests go out | `lib/webb.mjs` |
| Documents out | `docx` (Word), `pptxgenjs` (PowerPoint), built-in PDF/Excel/Markdown writers | docx 9.8, pptxgenjs 4.0 | MIT | On your Mac | `lib/leverans.mjs` |
| Cloud model (optional) | Any OpenAI-compatible endpoint: Berget AI, OpenAI, Anthropic, Google Gemini, OpenRouter (experimental) | — | Provider terms | The provider's servers, masked | `lib/moln.mjs`, `lib/lokal.mjs` |

Nothing above phones home. The model, the transcriber, OCR and PDF reading never
touch the network.

## Encryption at rest

Turned on when you set a password (Settings → Protection → Lock). Without a
password, files are stored in plain form in your user folder.

| What | Algorithm and parameters | In the code |
|---|---|---|
| Key from your password | **scrypt**, N = 2¹⁷, r = 8, p = 1, 32-byte key, 16-byte random salt per data folder. Password normalised with NFKC. About 150 MB of memory and ~0.5 s per attempt on an M1. | `lib/krypto.mjs` |
| Every file Maximus writes | **AES-256-GCM** (authenticated). Fresh random 12-byte nonce per write, 16-byte tag. Envelope: `MAXIMUS1\0` ‖ nonce ‖ tag ‖ ciphertext. A changed byte fails to decrypt instead of producing garbage. | `lib/krypto.mjs` (`forsegla`, `oppna`) |
| Master key | 32 random bytes. Wrapped by the password key. Optionally kept in the **macOS keychain** ("Remember password"), written through `security -i` on stdin so it never appears in the process list. | `lib/maximus.mjs` |
| Sealed session | Own key: **scrypt**(master key + session code), same parameters. Forget the code and the session is gone — Maximus cannot open it either. | `lib/krypto.mjs` (`sessionsnyckel`) |
| Lock code (6 digits) | **scrypt**, N = 2¹⁶, r = 8, p = 1 makes every guess expensive, and after 10 wrong attempts the code stops working. | `lib/locket.mjs` |
| Cloud API keys | **macOS keychain**, service `ai.aurolabs.maximus.moln`, written via stdin. Never in a file. | `lib/moln.mjs` |
| Shared session file (`.maximus`) | **scrypt** from the share code + **AES-256-GCM**, same envelope. The code travels separately from the file. Imported sessions are stripped to a safe set of fields and re-masked. | `lib/dela.mjs` |

Only `node:crypto` is used for this — no third-party crypto library.

## Integrity and signatures

| What | Mechanism | In the code |
|---|---|---|
| The ledger ("Sent") | **SHA-256 hash chain**: each day file carries the hash of the previous day; the chain head can be exported and written down so the history cannot be rewritten quietly. | `lib/liggare.mjs`, `lib/liggarkedja.mjs` |
| App updates | **minisign (Ed25519)** signature on every update, checked against the public key built into the app before anything installs. | `src-tauri/tauri.conf.json`, `scripts/slapp.mjs` |
| Masking rule packages | **Ed25519** signature, verified against a separate built-in key. | `lib/regelpaket.mjs` |
| Downloads (models, runtimes) | **SHA-256** of every file against a pinned value, plus exact size; a mismatch deletes the file. | `lib/modeller.mjs`, `scripts/` |
| App ↔ local server | **HMAC-SHA256** challenge: before the window sends its key, the server must prove it knows it. Keys compared in constant time. Only `Host: 127.0.0.1:<port>` / `localhost:<port>` is accepted. | `src-tauri/src/main.rs`, `server.mjs`, `lib/skydd.mjs` |
| OpenRouter login | OAuth with **PKCE (S256)** and a single-use state that expires in 10 minutes. | `lib/moln.mjs` |

## In transit

Everything that leaves goes over **HTTPS (TLS)** with the system's certificate
checks: web search, page reads, cloud models, downloads, update checks. Before
it leaves, text passes the masking gate — see [security.md](security.md).

## What the encryption does not do

- It does not protect against malware already running as you while Maximus is
  unlocked.
- It does not protect against someone who knows your password.
- Without a password, nothing on disk is encrypted. Set one.
