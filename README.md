# Maximus

**Your AI, on your Mac — with an agent that never speaks for you.**

[![Maximus — watch the film](docs/media/maximus-film.jpg)](docs/media/maximus-film-en.mp4)

*The film (1.5 min): recorded from the real app, with made-up material. [In Swedish](docs/media/maximus-film-sv.mp4).*

Maximus is a macOS app that runs an AI model on your own Mac, with an agent that reads your Mail, Calendar, Notes, Messages, Reminders and LinkedIn feed, works out what matters to you, and proposes actions — a reminder, a meeting, a mail draft, a reply to a mail — that wait for your yes. It's private and safe by design: everything runs locally with no account and no telemetry, nothing is sent unless you press Send, the agent never posts or deletes anything in your name, and anything that leaves the machine has names and personal details masked first and is written to a log you can check and export. It's for privacy-conscious professionals on Apple Silicon Macs who want an AI assistant to keep watch over their inbox, calendar and feed without handing their data or their voice to the cloud.

### Other useful features

- **Meeting recording and transcription on the Mac.** KB-Whisper (a Swedish speech model) or Whisper for English writes the transcript, Maximus writes the summary — what was decided, who does what, what's left — and the audio is never kept. *Who cares:* anyone in confidential meetings — consultants, managers, HR, lawyers — who can't upload a recording to a cloud transcription service.
- **Law watches and deadlines.** Any answer based on a Swedish law becomes a watch: you're told when that section changes or a new ruling cites it, and only the law reference leaves the computer, never your case. When the law sets a time limit, it offers to track it. *Who cares:* lawyers, HR, compliance staff and small-business owners, for whom a missed change or deadline costs real money.
- **Masked copy-out and anonymization.** Write with real names and ID numbers, then copy out a masked or fully anonymized version that's safe to paste anywhere. *Who cares:* public-sector, healthcare and social-services staff who handle personal data but still want to use AI tools.
- **A sensitivity check before web searches.** Every question is rated 0 to 3. At level 2 you see the exact masked search terms first; at level 3 (protected identities, threats) it needs a deliberate click. *Who cares:* social services, police, journalists and anyone working with protected identities.
- **Documents in your own templates.** Answers become Word, PDF, PowerPoint and Excel files, and it can build a presentation, a document, a deep dive or a decision-record PDF. *Who cares:* consultants and officials who produce reports and decision records for a living.
- **A phone channel with no app.** Alerts arrive through an iCloud Reminders list; you reply by ticking the item or writing in its note. Anything typed on the phone is treated as untrusted, so nothing happens until you approve it at the computer. *Who cares:* people away from their desk who don't want another app on their phone.
- **Mail replies that go out only when you press Send.** The agent suggests a reply to mail that asks you something, you edit it in a reply box, and Send goes through Mail as a real reply in the same thread, with ten seconds to undo. The agent and the model can never press Send. *Who cares:* anyone who wants help writing without giving up control of what goes out under their name.

### New in `main`, arriving with 1.0.2

These are merged and tested, but not yet in the app you download: they ship as **1.0.2 (beta)** once Apple notarization is done. Everything here is still beta. The full list is in the [changelog](docs/andringar.md).

- **Several mail accounts and calendars, each with a label.** Pick any number of accounts, mailboxes and calendars, and label each *Private*, *Work* or something of your own ("the board"). The label decides whether a finding is work or private, instead of the model guessing. A reply always goes from the account the mail came to.
- **A digest of the news and your LinkedIn feed.** Instead of one finding per article, the agent writes a short digest per round, grouped by topic, with *why it matters to you* and the sources underneath. Only items aimed at you (your name, your company, a contact, something you're waiting for) become findings of their own. News never goes to your phone.
- **The material, not a summary of it.** When the agent brings something up, it attaches a card for each item: title, source, an excerpt, **Show all** for the whole original, and **Open in Mail** (or the file or the page). Ask a follow-up and the assistant reads the same original, not a 1,500-character clip.
- **The agent as a colleague.** From what it found in your mail, calendar, messages and LinkedIn, it suggests what you could do — reply, schedule, get in touch, follow up — with the reason and the material. A suggestion is a draft: nothing is sent unless you press Send, and Maximus never contacts anyone in your name. Now and then it knocks (*"Knock-knock"*) with a short question to keep your profile current — only when you're at the computer, never while resting, in a conversation or a meeting, at most once a day by default, and never to your phone.
- **`/me` (`/du` in Swedish): what Maximus knows about you.** A summary of everything it holds about you, with where each fact came from (LinkedIn, your CV, you, a conversation). Correct it in plain words — *"I've left X"*, *"add that I'm on the board of Y"*, *"forget everything about Z"* — and you see exactly what changes, before and after, and nothing is saved without your yes. "Forget" also removes Z from the agent's own stores.
- **Masking choice only where it matters.** *Masked / Anonymized / Original* in the composer now shows only when a cloud model answers. With the local model the button says *Local*: the question doesn't leave the computer. You can also just ask: *"mask this text: …"*, *"anonymize the attachment"*, *"mask your last answer"*. It's done locally, and you get the text, how many details were replaced and the map.
- **A Swedish name model as the masking's second layer.** After the rules, a small token classifier, [nym-pii-multilingual-small](https://huggingface.co/Wismut/nym-pii-multilingual-small) (MIT, about 150 MB), catches what has no format: unusual names, addresses, and at Strict also places and workplaces. It only adds placeholders, never removes one. It's downloaded from a locked revision and checked by size and sha256; a file that doesn't match is deleted, and then the rules apply alone. Off under Settings → Protection → What is hidden.
- **Missing macOS permission, with a button.** When macOS says no to a source, the task says which permission is missing and offers **Give Maximus access to …**, which opens the right pane in System Settings and runs the task again.
- **Smaller things.** The app tells you when it runs straight from the disk image and can't update itself; release notes show as readable text in your language; one notification per agent round instead of one per task; a new graphite, white and lilac app icon.

### Built Swedish-first

Four parts are tuned for Swedish. The masking finds names, places and workplaces with Swedish word lists (English uses its own lists from US public records — names, not a translation). The local model, Gemma 4, was chosen because it wrote the best Swedish of the open models tested. The default speech model for Swedish, KB-Whisper, is trained on Swedish. And the law watches follow Swedish laws and court rulings. The interface itself is fully in Swedish and English.

> Swedish and English. Maximus follows your Mac's language; change it under Settings → Appearance and input.

## How it works

```
 you ─┬─ chat / files / recordings ──► local model (llama.cpp, Gemma 4 sized to your memory)
      │                                     │
      └─ agent ── reads (with your yes) ────┤  Mail · Calendar · Notes · Messages
                                            │  Reminders · a folder · LinkedIn in Safari
                                            ▼
                               fail-closed masking gate  ──►  ledger ("Sent")
                                            │
                     only if you turned it on ▼
             web search · cloud model (masked) · phone ping · update check
```

- **The gate** replaces names, ID numbers, addresses, places and workplaces with placeholders before anything leaves; answers are restored on the machine.
- **The agent** runs on a schedule you set (Calm / Normal / Full throttle), sets aside what doesn't concern you with a reason, and proposes actions — a reminder, a meeting, a mail draft — that wait for your yes.
- **Foundation:** one session per app the agent reads, so findings land where they belong.

## Install

**Fastest — one line in Terminal, no warning:**

```bash
curl -fsSL https://raw.githubusercontent.com/aurolabsai/maximus/main/install.sh | sh
```

It fetches the latest release from GitHub, checks it against GitHub's sha256 checksum, puts Maximus in Applications and opens it. Files fetched this way aren't marked as downloaded, so macOS doesn't stop the first launch. Read [`install.sh`](install.sh) first if you like; it's about 75 lines. Running it again updates in place, and your data stays where it is.

**Or with the disk image:**

1. Download the latest `Maximus_…_aarch64.dmg` from [Releases](https://github.com/aurolabsai/maximus/releases/latest).
2. Open it and drag **Maximus** to **Applications**.
3. **First launch — one manual step for now.** Apple notarization is on its way (our Apple Developer enrollment is being processed). Until it's done, macOS stops the first launch with a warning that only offers **Done**. That's expected:
   1. Open Maximus once. When the warning appears, click **Done**.
   2. Open **System Settings → Privacy & Security** and scroll down to **Security**. You'll see *"Maximus was blocked to protect your Mac."*
   3. Click **Open Anyway**, confirm with your password or Touch ID, then **Open**.

   You only do this once; after that Maximus opens normally. (On macOS 14 and earlier: right-click Maximus → **Open** → **Open**.) The next release will be notarized and open without any of this.
4. **Run it from Applications, not from the disk image.** An app opened straight from the DMG can't update itself. From 1.0.2, Maximus tells you when that happens and offers to open Applications.

The model downloads on first start and is sized to your memory: Gemma 4 E2B below 16 GB, E4B at 16 GB, 12B (6.5 GB) at 24 GB or more. Updates arrive inside the app and are verified against a signing key before they install.

Requires macOS 12 or later on Apple Silicon. 16 GB of memory works; 24 GB or more runs the 12B model comfortably.

Or build it yourself:

```bash
git clone https://github.com/aurolabsai/maximus.git && cd maximus
npm install
node scripts/hamta-llama.mjs        # llama-server for this machine
node scripts/hamta-verktyg.mjs      # the Swift helpers (Calendar, Reminders, OCR …)
npx tauri build --bundles app,dmg
```

Requires Node ≥ 22, Rust (stable) and Xcode command line tools.

## Use

- **Ask** anything in the composer. Drop in PDFs, Word, spreadsheets, images or audio — it's read locally.
- **Record** a meeting (`⌘⇧R` or `/record`); it's transcribed on the machine and summarised. Audio is never kept.
- **Give the agent a task** in plain language: *"keep an eye on AI news in my inbox and surface what touches my role"*. It asks when to run.
- **Settings** has seven tabs: You, Agent, Protection, Model, Connections, Your data, About.
- **Help** (`…` → Help) answers from your own settings, and every topic has **Show me**.

## What it covers

Everything below is in the app today, except rows marked *(1.0.2)*: those are in `main` and arrive with the next release. Inside Maximus, `…` → **Everything Maximus can do** lists the same, with **How?** on every row.

**Ask and write**
- Answers with numbered sources, each graded: authority, public, media, company, forum, encyclopedia. Deep search and deep dive for the questions that need more.
- Three voices: *Professional*, *Clear* (for someone new to the subject) and *Cocky*.
- When the model needs to know more, you get one field per question under the answer.
- A **plan** under any answer that mentions a date: prepare me, gather in a project, remind me, add to calendar.
- Checklists you can tick, notes pinned to passages, quotes into the next question.
- **Decision brief as PDF**: material, deadlines, sources and their level, what left the computer — and a section on what could *not* be substantiated.
- Word, PowerPoint, PDF, Excel and Markdown out, in your own `.potx`/`.dotx` templates.

**Documents, meetings and dictation**
- Every document gets three views: **Original**, **Masked** and **Anonymized**, where the local model also blurs amounts, dates and unusual details. Copy or export any of them.
- Meetings and audio files are transcribed live, line by line, then punctuated and summarised.
- Dictation into the composer, sent after a pause or when you say "send".

**Your Mac's own apps**
- `/mail` shows your latest mail; open one and it becomes material. **Write reply** opens a reply box; it goes out only when you press **Send** (or opens in Mail, if you prefer).
- `/calendar` shows the next seven days, including Google and Exchange calendars in Apple Calendar.
- *(1.0.2)* Several mail accounts (and mailboxes per account) and several calendars, each labelled *Private*, *Work* or your own words. Conversations and `/finds` filter by label.
- Notes, Messages, Reminders and the call log, read only, with your permission per source.

**The agent**
- Give it a task in plain language — *"keep track of the AI news in my inbox and pick out what concerns my role"* — and choose how often. A yes runs it at once.
- It reads only what's new, raises what concerns you and sets the rest aside with a reason.
- **Foundation:** one session per app it reads, so findings land where they belong.
- **News for you**, from the web and the newsletters in your inbox, weighed against your profile.
- Actions it may propose: a reminder, a meeting, a mail draft, a note, a Shortcut you built. Each per action: ask every time, allowed, or never.
- Pace: Calm, Normal or Full throttle. Runs while Maximus is open, or in the background if you choose.
- **To your phone:** a line via iCloud Reminders or iMessage. Tick it off, or write in the note to answer.
- *(1.0.2)* **Digest** of news and the LinkedIn feed per round: what happened, grouped by topic, why it matters to you, sources underneath. Each paragraph is checked against its sources; what doesn't hold is dropped.
- *(1.0.2)* **Cards with the material**: every finding the agent brings up carries a card with an excerpt, **Show all** and **Open in Mail / the file / the page**, and follow-up questions read the same original.
- *(1.0.2)* **Suggestions with reasons** (reply, schedule, get in touch, follow up) under Agent, each a draft you take, change or decline — and declining with a reason steers the next ones. **Knock-knock**: a short question now and then, only when you're at the computer. Both under Settings → Agent → Actions.
- *(1.0.2)* When macOS hasn't given permission for a source, the task row says which one, with a button to the right pane in System Settings.

**Law and deadlines** (Swedish sources)
- Deadlines read from the statute itself, counted from the date you set, with days left.
- Every legal provision an answer relied on is watched: if the section changes or a new ruling cites it, you're told. Only the section number goes to lagen.nu.
- Connections to lagen.nu, Domstolsverket, Riksdagen, SCB, Kolada and IVO, open data with no login.

**Protection**
- Every question is classified 0–3 on the machine; level 2 and up needs your approval before anything is looked up.
- *(1.0.2)* Masking in two layers: rules first, then a local name model ([nym-pii](https://huggingface.co/Wismut/nym-pii-multilingual-small), MIT) for names, addresses, places and workplaces that have no format. Everything that leaves the computer waits for it.
- *(1.0.2)* The *Masked / Anonymized* choice shows only when a cloud model answers; with the local model, ask for it in words (*"mask this"*, *"anonymize the attachment"*) and it's done on the Mac.
- *(1.0.2)* `/me` shows what Maximus knows about you and where each fact came from; correct, add or forget in plain words, applied only after your yes.
- Pages and files that try to instruct the model are filtered, and get no powers either way.
- Password with AES-256-GCM at rest, a six-digit cover code for when you step away, sealed conversations with their own code, and a rest mode that hides the screen.
- Share a conversation as an encrypted `.maximus` file; the code travels separately.
- **Sent:** every call that left the machine — time, recipient, what went and what came back. Hash-chained, exportable as CSV, JSON or text, and it can't be emptied.

**Models**
- Local: Gemma 4 by default (it wrote the best Swedish of the open models we tested), or Qwen, Llama and Mistral.
- Cloud, optional and masked: Berget AI (Sweden), OpenAI, Anthropic, Google Gemini with an API key; OpenRouter login is experimental.

## Reference

| Command | Swedish | What it does |
|---|---|---|
| `/help` | | Everything Maximus can do |
| `/tour` | `/rundtur` | The five-step tour |
| `/me` | `/du` | What Maximus knows about you; correct it in plain words *(1.0.2)* |
| `/mail` | `/post` | Your latest mail; open one as a conversation |
| `/calendar` | `/kalender` | The next seven days |
| `/watch` | `/bevakning` | Deadlines and watched legal provisions |
| `/tasks [text]` | `/uppdrag` | Your tasks, or a new one |
| `/agent` | | How the agent works |
| `/finds` | `/fynd` | What the agent found and set aside, and why; filter by label *(1.0.2)* |
| `/record` | `/spela` | Record a meeting |
| `/presentation`, `/document` | `/dokument` | A sourced deck or document, step by step |
| `/deepdive` | `/djupdykning` | A deep dive before a meeting |
| `/clear` | `/rensa` | Start over (asks first; the ledger stays) |
| `/settings` | `/installningar` | Settings |

Both languages work whatever the interface language.

```text
⌘N new · ⌘⇧R record · ⌘[ ⌘] back/forward (or two-finger swipe) · ⌘+ ⌘− ⌘0 size · Esc close
```

Developer: `npm start` runs the server alone; `npm test` runs the unit tests; browser tests run against `sh scripts/provserver.sh start` with `node test/<name>.mjs <key>`.

## Storage

Everything lives in `~/Library/Application Support/Maximus`: sessions, findings, settings and the ledger, encrypted at rest with AES-256-GCM (key from scrypt) when you set a password. API keys for cloud models live in the macOS keychain, never in a file.

## Privacy

Leaves the machine **only when you turned it on**, and every time is written to the ledger (**Sent**):

- a web search, when a question needs it — masked;
- your question to a cloud model, if you chose one — masked, restored locally;
- pages the agent reads for you (LinkedIn in Safari, pages you point at, news);
- a phone ping — the headline and one line, never the material;
- an update check — the version number.

No telemetry. No account. No sign-in.

## Limits (honest)

- **macOS only** for the desktop app. Mail, Calendar, Notes, Messages and Reminders go through Apple's apps.
- **Not notarized yet** — the first-launch warning above. Until it is, macOS treats each update as a new app and asks again for Calendar and Reminders access. Next release will be signed and notarized.
- **Two languages: Swedish and English.** Masking reads both, with Swedish name lists (SCB) and English ones (US SSA first names, US Census surnames). The English lists are new and US-weighted: British, Irish and other English-speaking names are caught by the capitalisation rule rather than by a list. Check **Sent** before trusting it with English names.
- **The local model is Gemma 4, sized to your Mac** — E2B under 16 GB, E4B at 16 GB, 12B at 24 GB or more; Settings → Model shows the others that fit. We chose Gemma for its Swedish: it wrote the best Swedish of the open models we tested. It is slower than a frontier model and can be wrong — answers say so under the composer. The agent's judgement on what matters is good, not perfect.
- **Masking is a gate, not a guarantee.** It's fail-closed and tested, but a determined re-identification from context is still possible. Read what leaves in **Sent**.
- **Cloud models use an API key** (OpenAI, Anthropic, Google Gemini, Berget). The one exception is OpenRouter's browser login, which is experimental and untested against the live service.

## Uninstall

Quit Maximus, then:

```bash
rm -rf /Applications/Maximus.app
rm -rf ~/Library/Application\ Support/Maximus      # sessions, models, ledger — your data
for l in berget openai anthropic google openrouter; do
  security delete-generic-password -s ai.aurolabs.maximus.moln -a $l 2>/dev/null   # cloud keys, if any
done
for p in ~/Library/LaunchAgents/ai.aurolabs.maximus.*.plist; do     # background agent, if you turned it on
  [ -e "$p" ] && launchctl unload "$p" && rm "$p"
done
```

A remembered password also sits in the keychain under the service named after your data folder; Keychain Access → search "maximus" shows it.

## Docs

- [What it does](docs/functionality.md) · [FAQ](docs/faq.md) · [Changelog (Ändringar)](docs/andringar.md)
- [Under the hood](docs/under-the-hood.md): engines, encryption, signatures
- [Security and privacy](docs/security.md) · [Reporting a vulnerability](SECURITY.md)
- [Architecture](docs/architecture.md) · [Development](docs/development.md) · [Contributing](CONTRIBUTING.md)

## What's in the repo

```text
server.mjs        the local server — every route
lib/              agent, masking gate, models, mail/calendar/notes readers, ledger
public/           the interface (vanilla JS, no build step)
src-tauri/        the macOS shell (Tauri 2)
verktyg/          Swift helpers for EventKit, OCR, dictation
test/             unit tests (*.test.mjs) and browser tests
docs/             what it does, security, architecture, development, FAQ, changelog
```

See [NOTICE](NOTICE) for third-party software and model licenses.

Apache-2.0 © Aurolabs AB · Your AI, on your Mac — with an agent that never speaks for you.
