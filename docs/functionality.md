# What Maximus does

The complete user guide. Maximus is a local AI workspace for macOS: a language model runs on your Mac, and an agent reads what you give it access to and tells you when something matters. It is free and open source (Apache-2.0). There are no license keys, no accounts and no payments.

The interface is in Swedish and English. This guide uses the English labels, with the Swedish one in parentheses the first time, e.g. **Settings → Agent (Agenten) → Sources (Källor)**.

This guide describes `main`. Parts marked **(1.0.2)** are merged and tested but not yet in the released app (1.0.1); they ship with 1.0.2 once Apple notarization is done. What changed when is in the [changelog](andringar.md).

Two roles, one app:

- **The assistant** answers when you write. It works while you wait, in the conversation you are in.
- **The agent** works when you are not looking. It reads what you allowed, follows tasks you gave it, and writes back when it finds something.

What can leave the computer is only what you turned on, and every time it happens it is written to the ledger, **Sent (Skickat)**:

| What leaves | When | How |
|---|---|---|
| A web search | Web search is not Off and the question needs it | The search query is masked |
| Your question to a cloud model | Only if you turned a cloud model on | Masked; the answer is restored on the Mac |
| Pages the agent reads for you | LinkedIn in Safari, pages you pointed at, news | Each fetch is logged |
| A phone notification | Only if you chose a phone channel | Headline and one line, never the material |
| An update check | If New versions (Nya versioner) is on | Version number and platform |

---

## Contents

1. [First start and onboarding](#1-first-start-and-onboarding)
2. [The layout](#2-the-layout)
3. [Home](#3-home-hem)
4. [Chatting](#4-chatting)
5. [Files and recordings](#5-files-and-recordings)
6. [Documents out](#6-documents-out)
7. [Projects, the session list and the archive](#7-projects-the-session-list-and-the-archive)
8. [Mail, calendar, deadlines and law watches](#8-mail-calendar-deadlines-and-law-watches)
9. [Foundation (Grunden)](#9-foundation-grunden)
10. [The agent](#10-the-agent)
11. [The phone channel](#11-the-phone-channel)
12. [News](#12-news)
13. [You and LinkedIn](#13-you-and-linkedin-du)
14. [Models: local and cloud](#14-models-local-and-cloud)
15. [Masking](#15-masking)
16. [Protection](#16-protection)
17. [The ledger (Sent)](#17-the-ledger-sent--skickat)
18. [Slash commands](#18-slash-commands)
19. [Keyboard shortcuts and gestures](#19-keyboard-shortcuts-and-gestures)
20. [Settings, tab by tab](#20-settings-tab-by-tab)
21. [Help](#21-help)
22. [What Maximus does not do](#22-what-maximus-does-not-do)

---

## 1. First start and onboarding

### 1.1 Before the chat: terms and models

The first launch shows a start surface. It comes before the chat because there is no model yet to talk with.

1. **Terms.** You tick "I have read and accept the terms" (Jag har läst och godkänner villkoren). Continue (Fortsätt) stays disabled until you do. The terms are versioned, and if the version changes you are asked again.
2. **Models (Modellerna).** Maximus suggests models from your Mac's memory and free disk ("Calculated from this computer's memory: X GB…"). It shows two cards:
   - "The model that thinks" (Modellen som tänker) is the language model.
   - "The model that hears" (Modellen som hör) transcribes audio.
   - Each card gives its size and why it was picked.
   - **Rather a cloud model?** (Hellre en molnmodell?) lets you pick a provider and paste an API key. The large local model is then not downloaded. On a Mac that is too weak, this option opens by itself.
   - **Choose your own** (Välj egen) shows the whole catalogue. You can also use your own `.gguf` file (at least 1 GB), any listening model or none, and your own whisper.cpp `.bin`.
3. **Loading the models** (Laddar in modellerna). Two progress bars show "X of Y GB · time left". On an error you get "Try again" (Försök igen). The app starts even if the listening model failed.

Automatic choice: Maximus picks the largest *tested* model that fits in memory, and it also needs to fit on disk.

| Your Mac | Default language model |
|---|---|
| 24 GB memory or more | Gemma 4 12B (6.5 GB) |
| 16 GB | Gemma 4 E4B (4.8 GB) |
| Less | Gemma 4 E2B (3.1 GB) |

The listening model is KB-Whisper large (1.1 GB) by default. Whisper large-v3-turbo (530 MB) is chosen on Macs with under 16 GB memory or too little disk.

### 1.2 The first conversation

After the models, Maximus writes first, in a chat. The steps run in this order:

| # | Step | What happens |
|---|---|---|
| 1 | **Who are you?** | Give your **LinkedIn**, your **CV** or a **link**, or write one sentence about your work. Buttons: "Attach CV or LinkedIn export" (Bifoga cv eller LinkedIn-export) takes `.zip .pdf .docx .doc .odt .rtf .txt .md`. "Read my profile in Safari" (Läs min profil i Safari) opens `linkedin.com/in/me` in Safari itself; if you are not logged in, it waits for you. The local model reads the material and shows **Who / Does / Wants / Interested in**. You answer "That's right" (Stämmer) or "Not quite — I'll write it myself". A yes saves the profile and creates **You (Du)** under Foundation. |
| 2 | **Follow along** | "May I follow what happens around you, **continuously**?" A yes covers what LinkedIn sends you, your likes and comments when you re-import the export, and the feed when it is open in Safari. It covers LinkedIn tabs only, never any tab. Answers: "Yes, follow" or "Not now". |
| 3 | **Voice** | Professional (Professionell), Clear (Tydlig) or Cocky (Kaxig), each shown with an example line. The voice changes the tone, not what Maximus does. |
| 4 | **What leaves the computer** | Your own text shown masked, live, at the cloud masking level. Then: "Do you want to connect an external model?" If yes, you pick OpenAI, Anthropic, Google, Berget, or "OpenRouter — log in (experimental)", or skip. The first four take a key, which goes into the macOS keychain; you get three tries, and the provider must answer a test call. OpenRouter opens a browser login. |
| 5 | **Permissions** | One at a time, each with what a yes means: E-mail, Calendar, Notes (one folder), Messages (needs Full Disk Access), Reminders, and To the phone. The call list and a folder are *not* asked here; turn them on later under Settings → Agent. Questions you already answered are skipped if you closed the window halfway. |
| 6 | **Foundation** | Every app you allowed gets its own session under **Foundation** in the side panel. There the agent scans the app, says what it sees and how often it will look. |
| 7 | **First review** | If you allowed mail, calendar, reminders or notes: "Shall I go through what you gave me and suggest where we start?" A yes makes the agent read recent mail, calendar and reminders and post an overview. It then offers task suggestions one at a time, each with "Set up" (Sätt upp) or "Skip" (Hoppa över). |
| 8 | **Tour** | "Want to see what I can do?" Five steps, with examples made from your profile: ask about your own data, deep dive, presentation and document, tasks for the agent, and voice and meetings. At the end you can put one example in the composer; it is not sent until you press send. The tour is available again as `/rundtur`. |

The conversation is then saved as "Welcome to Maximus" (Välkommen till Maximus) and opened. If you already have a profile, the onboarding is skipped.

### 1.3 Later starts

- With a password that is not remembered, you meet the lock screen first. It shows the six-digit code if one is set, otherwise the password.
- Otherwise the app opens at rest if "Open at rest" (Öppna i vilan) is on, which is the default. Press Space, Enter or click to come in.
- Every start lands on an empty Home, never on the last conversation.
- Shortly after the first start, Maximus asks once whether it may tell you about new versions.

---

## 2. The layout

- **The rail (listen)** on the far left, from top to bottom:
  - Home (Hem)
  - Agent (Agenten)
  - Tasks (Uppdrag), with a dot for unseen tasks
  - Conversations and projects (Samtal och projekt)
  - Settings (Inställningar)
  - The maximus mark at the bottom. Click it to rest.
- **The side panel** slides out from the rail on hover. You can pin it with "Pin the panel" (Fäst panelen) and drag its edge to change its width. It contains:
  - The **··· app menu**: Everything Maximus can do (Allt Maximus kan), Help (Hjälp), Settings, Sent (Skickat), and Import (Importera).
  - The **power lamp** for the local model.
  - The **+ menu**: New conversation (⌘N), Record a meeting (⌘⇧R), New project.
  - The session list with the tabs **Ongoing (Pågående)** and **Archive (Arkiv)**.
- **The top bar** of a session holds:
  - The title. Click it to rename.
  - Write reply (Skriv svar), only in sessions opened from a mail.
  - Rename.
  - Share as encrypted file.
  - Decision record as PDF (Beslutsunderlag som PDF).
  - The session's files, shown only when there are any.
  - **Everything Maximus can do**, top right.
- **The composer** at the bottom holds:
  - The text box.
  - Attach (+), deep search (magnifier) and the microphone.
  - The mode button.
  - Send. It turns into a stop square while an answer is being written.

Above the composer it always says: "An AI model answers, and it can be wrong. Always check the answers."

---

## 3. Home (Hem)

Home is where you land. Get there with the Home button in the rail, or press **Esc** from a conversation, task view or command result. Esc does not leave while you have text in the composer, and it closes open menus and dialogs first.

Home shows a rotating deck of suggestion cards, and two carousel cards. Each carousel shows one row at a time, advances every 7 seconds, pauses on hover and has dot navigation.

| Card | Content |
|---|---|
| **News (Nyheter)** | News weighed against your profile, with your interest topics in the header. Each row shows an image, headline, source, time and why it was picked. The heaviest items come first, at most 12. If news is off, the card offers "Turn on news" (Slå på nyheter); if it is empty, "Check now" (Kolla nu). **Click a row** to open a new conversation with the article attached. The composer is pre-filled with "What does this mean for me, and what should I do about it?", and nothing is sent until you press send. A newsletter from your inbox opens as an e-mail. |
| **Agent · latest moves** (Agenten · senaste dragen) | What the agent recently **found** (Hittade), **investigated** (Undersökte) or **got stuck on** (Fastnade), newest first, at most 12. Click a move to open its session or task. |

---

## 4. Chatting

Write as you actually would: names, ID numbers, amounts, everything. The local model reads the original, because it runs on your Mac.

### 4.1 The mode button: three choices per conversation

The button next to send opens a menu with three groups. The button shows the treatment, a **Web** badge when web search is not Off, and the memory mode.

**What you get to take with you** (Vad du får att ta med dig). This is the *treatment*. It controls what you get to copy out of Maximus, not what the local model sees.

**(1.0.2)** The treatment is shown and applies only when a **cloud model** answers. With the local model, nothing leaves the computer for it to protect: the button says **Local** (Lokalt) and the menu has a status line, "Local · nothing leaves the computer", or "Local · only masked search queries leave the computer" when web search is on. Switching between local and cloud redraws the button at once, also mid-conversation; saved conversations keep their choice for when a cloud model answers. Search queries, page fetches and tool calls are masked as before, whatever the treatment. To get a masked text with the local model, ask for it (see [4.9](#49-asking-for-a-mask)).

| Option | What it means |
|---|---|
| **Original** | Your text as written. Nothing to copy out, because there is no mask. |
| **Masked** (Maskerat), the default | Names, ID numbers, addresses, phone and account numbers are replaced with placeholders such as "Person A" or "[PERSONNUMMER A]". The same value always gets the same label within a conversation, and the map back stays on your Mac. |
| **Anonymized** (Anonymiserat) | Masked, and also rewritten so that details that identify someone without a name become vaguer: amounts, dates, unusual details. If the rewrite fails, the card says so. |

**Web search** (Webbsök):

| Option | What it means |
|---|---|
| **Off** (Av) | Nothing leaves the computer, and the footer under the composer says so. |
| **Auto** | Maximus looks something up only when the question needs a fact the model cannot have, such as a rate, a specific company or a link. Rules decide first, and the local model decides the doubtful cases. General "how does X work" questions never go out, and neither do personal questions or questions about your own material. |
| **On** (På) | Search when useful. |

**Memory** (Minne), set per conversation:

| Option | What it means |
|---|---|
| **Isolated** (Isolerat), the default | Knows only what is written in this conversation. |
| **Remember me** (Minns mig) | Brings in what matches the question from your other "Remember me" conversations, and shows which ones in the steps. |
| **Forget after** (Glöm efteråt) | The conversation is deleted when you leave it. |

Your profile always applies, whatever the memory mode.

- **Scope.** Treatment and web search are saved on the conversation and also become the default for the next one. Memory is per conversation only.
- **Footer.** The line under the composer tells you the state in plain words:
  - "Nothing leaves the computer."
  - "The answer is written here. If the question needs a lookup, a masked search query goes out — you see it in the steps."
  - When a cloud model answers: "<name> answers. The question goes out masked, the answer is restored here…"

### 4.2 Saying no to a search in words

If you write "don't search" (sök inte), "answer without searching" or "no web search", nothing is looked up. This holds even when web search is On and when deep search is on. The step says so, and the ledger gets no row. The exception is "don't search *only* X but also Y", which asks for a broader search.

### 4.3 The sensitivity gate

Before a web search goes out, the question is classified from 0 to 3:

| Level | Name | What happens |
|---|---|---|
| 0 | Open (Öppen) | The search goes out directly |
| 1 | Internal (Intern) | The search goes out directly |
| 2 | Sensitive (Känslig) | A card shows the exact masked search terms. Choose "Don't search" (Sök inte) or "Approve — Enter" (Godkänn — Enter) |
| 3 | Protected (Skyddad): protected identity, threats, security | The button reads "Approve anyway" (Godkänn ändå). Enter does not approve; it needs a deliberate click |

Esc declines. The level is inherited within a conversation, so a harmless-sounding follow-up to a sensitive case is still gated. The level is only set when a search would go out. A question answered locally is not classified.

### 4.4 Deep search

The magnifier button turns on deep search **for the next question only**. Maximus then runs several rounds on the web, and each round searches the gaps left by the one before. How far it goes is set in Settings → You → Answers → Deep search:

| Setting | Default | Range |
|---|---|---|
| Rounds (Varv) | 3 | 1–6 |
| Sources (Källor) | 12 | 4–30 |
| Time (Tid) | 180 s | 60–900 s |

Every search query is masked and written to the ledger.

### 4.5 Sources and citation check

Web sources are numbered and labelled with a credibility tier: authority, public, media, company or forum. The answer cites them as [1], [2]. With **Check the citations** (Kontrollera källhänvisningarna) on, which is the default, Maximus checks after each answer that what stands at [1], [2] is actually in the source, and says so when it is not.

Text in fetched pages that is written for the model rather than the reader, such as "ignore previous instructions" or role tags, is stripped, and the answer says how many lines were removed. This filter reduces risk; it is not a boundary. The boundary is that a fetched page gets no powers: it cannot make Maximus send, open or call anything. The same fence applies to attachments. If *you* tell Maximus to follow a plan in a file, it does; if the *file* tells the model to change role, the answer says the file tried.

### 4.6 On your own question (hover)

- **Copy the question** (Kopiera frågan).
- **Masked version to take with you** (Maskerad version att ta med). This opens the masked text with a copy button, and lists what does *not* follow when you copy: attachments, your rules and earlier turns.
- **Edit and rerun** (Redigera och kör om). Enter reruns with the change; Esc cancels.

### 4.7 On an answer

- **Copy the answer**, **Make a file of the answer** (see [Documents out](#6-documents-out)), and **Rerun the question**.
- **Selecting text** opens a menu with two choices:
  - **Quote** (Citera) puts the passage in your next question.
  - **Note** (Notering) lets you write a note. The note appears under the answer with the passage it belongs to, and a small number marks the passage in the text. If the answer later changes, the note stays, together with the text it once referred to.
- **Checklists.** `- [ ]` items become real tick boxes. A tick is saved with its time, and the answer text is never rewritten. Ticks follow the item's *text*, so a reworded item counts as a new item.
- **Questions back.** If the answer ends with questions to you, you get one field per question under the latest answer. Each field has its own attach button. "Send the answers" (Skicka svaren) sends what you filled in; blanks are sent as unanswered. "Hide" (Dölj) closes the panel.
- **The Plan** (Planen). If an answer says something happens on a date, Maximus lays out a plan: what happens, how far away it is, what must be ready and what it needs to know. It then asks "What should I do? Choose one or more." The choices are:
  - Prepare me (Förbered mig)
  - Gather in a project (Samla i ett projekt)
  - Remind me (Påminn mig), which adds a deadline under `/bevakning`
  - Add to calendar (Lägg i kalendern), which opens a calendar file you approve yourself; Maximus never writes to your calendar
  - Not now (Inte nu)

  The date must actually appear in the text, or no plan is made.
- **Follow-up suggestions.** Two or three next steps, written as prompts. Click one to send it.

### 4.8 Stop, queue, naming

- Press the stop square while an answer is being written. What was already written stays.
- Scroll up during an answer and auto-scroll lets go. An arrow takes you back down.
- The model names the conversation after its first answer. A name you typed yourself is never changed.
- Typing `--` gives an en dash and `->` gives an arrow.

---

### 4.9 Asking for a mask

**(1.0.2)** Ask in the conversation, in Swedish or English:

- *"Mask this text: …"* (Maskera den här texten)
- *"Anonymize the attachment"* (Anonymisera bilagan)
- *"Mask and anonymize your last answer"*

Maximus recognises the request with rules, picks the text (what you pasted, the attachment, or the last answer), and does it on your Mac with the same masking as everything else (rules, then the [name model](#15-masking)); anonymizing is a rewrite by the local model, even when a cloud model is on. The result is a card: the text with **Copy the text**, the number replaced per kind, **the map** of what each placeholder stands for (shown on request; it stays on the Mac and does not come along when you copy), and export for an attachment. If nothing was found, the card says so. No web, no cloud, no row in Sent, because nothing left.

The **Anonymize** button on a document card is also always local.

## 5. Files and recordings

### 5.1 What you can drop in

Drag files into the window, or use **+** next to the composer.

| Type | Extensions | How it is read, all on your Mac |
|---|---|---|
| PDF | `.pdf` | macOS PDFKit, with `pdftotext` as fallback. A PDF with almost no text counts as a scan and is read with Apple Vision OCR ("pdf (read as image)"). |
| Word and text | `.doc .docx .rtf .odt .txt .md .json` | macOS `textutil` for Word, RTF and ODT. The rest are read as plain text. |
| Spreadsheets | `.xlsx .xlsm .ods .csv .tsv` | Read as tables. **Maximus computes** sum, mean, median, min and max per numeric column and sends those figures with the question, so the model interprets numbers rather than producing them. Non-numeric cells are counted and reported, so you can see that a sum covers 48 rows, not 50. Swedish numbers (`1 234,50 kr`) and dates (`2026-01-15`) are understood. CSV with `;`, `,`, tab or `\|` separators all work. |
| Images | `.png .jpg .jpeg .heic .tiff` | OCR by default: the model gets the text. With **Let the model see images** (Låt modellen se bilder) and the vision part downloaded, the model sees the image itself, which helps with diagrams and screenshots. |
| Audio and video | `.m4a .mp3 .wav .aiff .aif .aac .caf .mp4 .mov .flac .ogg .opus .webm` | Transcribed by whisper on the Mac. |
| Shared session | `.maximus` | Not an attachment. Opens the encrypted-share import. |

Limits: 40 MB for documents, 500 MB for audio. The original file is not kept, only its text, which is encrypted when you have a password.

### 5.2 The file card

Each file becomes a card in the conversation with three views: **Original**, **Masked** (Maskerad) and **Anonymized** (Anonymiserad).

- The anonymized view is a rewrite by the local model, which you watch as it works. You are offered it with "Do you also want to anonymize?…"
- Buttons: Collapse (Fäll ihop), Copy, Text, and **Export PDF** (Exportera PDF).
- **Enlarge** (the magnifier at the top of the card) opens the material in the full window. You get one column to read, scroll and select in, the same three views, a character count and copy. Notes you make there show both there and in the conversation.

### 5.3 Transcription

While audio is transcribed you see the text arrive line by line with timestamps. When it is done the card collapses and a **Sentences** (Meningar) step follows. The local model adds punctuation and paragraphs, and every chunk is checked: same words, only punctuation. If the words changed, the rule-based version is kept.

### 5.4 Auto-summary and the question queue

- **Empty conversation.** Dropping a file into an empty conversation makes Maximus summarise it straight away: what it was about, what was decided, what is left. Meeting transcripts are always summarised, and the conversation is named from the answer.
- **The queue.** A question about a file that is still being read waits above the composer ("Goes as soon as X is read") and sends itself when the file is ready. **Undo** (Ångra) puts it back in the box. If a file failed to read, **Send anyway** (Skicka ändå) appears.

### 5.5 Dictation vs. meeting recording

These are two different things.

| | Dictation | Meeting recording |
|---|---|---|
| Start | The **microphone** button by the composer | **⌘⇧R**, `/spela`, or + → Record a meeting (Spela in ett möte) |
| What it does | Writes what you say into the composer, live, using Apple's on-device dictation | Records a meeting, transcribes it in 5-minute parts while it runs, and summarises it at the end |
| Controls | Say **"skicka"** last to send, **"avbryt"** or Esc to cancel. Settings → You → Appearance & input → "Dictation sends after" 2, 3 (default) or 5 seconds of silence, or "Only when I say 'skicka'" | A bar shows time and input level, and warns after 10 s of silence ("The microphone hears nothing"). **Pause** (Pausa) / Resume, **Discard** (Kasta), which asks once, and **Stop and transcribe** (Stoppa och skriv ut). The microphone button also stops a running meeting. |
| Kept | The text you send | The transcript, as a document in the conversation. **The audio is never saved**; it lives in memory only. |

A recording belongs to the conversation it started in, even if you move to another one while it runs.

---

## 6. Documents out

### 6.1 Make a file of an answer

Under any answer, choose **Make a file of the answer** (Gör en fil av svaret). The file is built from the text on screen, using the draft block if there is one, with no new model call.

| Format | Note in the menu |
|---|---|
| Word | Editable by the recipient |
| PDF | Ready to hand over |
| Excel | The tables, with live sums |
| PowerPoint | The headings become slides |
| Markdown | Plain text with structure |

The file belongs to the conversation and is encrypted like it. You find it behind the files button in the top bar ("N files in this case"). Opening a file writes it to Downloads and opens it in its app.

### 6.2 `/presentation` and `/dokument`

A guided flow for something you hand over:

1. What should the presentation or document achieve?
2. Who receives it?
3. Length: Short / Medium / Long. That means 5, 8 or 12 slides, or 3, 5 or 8 sections.
4. You approve the outline: Write it, Change …, or Cancel.
5. Sections are written with sources in the background, and the whole is reviewed.

| Output | Contents |
|---|---|
| `/presentation` | PowerPoint with speaker notes and a sources slide |
| `/dokument` | Word with a table of contents and sources as footnotes |

The web is used only when the routing decides the material can take it, and every lookup is logged.

### 6.3 Templates

Settings → You → Answers → Templates (Mallar):

| Template | Accepts | What carries over |
|---|---|---|
| Presentations | `.potx` or `.pptx` | Fonts, colours, slide format, background, logo |
| Documents | `.dotx` or `.docx` | The whole style sheet |

Without a template, Maximus's own look is used. The template is read on your Mac.

### 6.4 `/djupdykning`: deep dive

`/djupdykning <what and why>` prepares you for a meeting or event. It works in phases: sources, people, the situation (each claim with a source), a file on each person, A and B lists, how to approach them, pitches, and a three-step plan. It then runs a fact check. If the conversation holds a file whose name contains "säkert att säga" or "safe to say", claims are checked against it, and conflicts go under a "Don't say" (Säg INTE) section.

The output is a Word file, "Brief — <topic>". It runs in the background and takes a while. If it fails, "Continue where it fell" (Fortsätt där det föll) resumes it. Public people found in public sources are searched by name.

### 6.5 Decision record (Beslutsunderlag)

Open it from the top-bar icon or the session's row menu: **Decision record as PDF**. The PDF holds:

- the questions and answers;
- sources with their tier;
- deadlines;
- what left the computer;
- a section **What could not be substantiated** (Det som inte gick att styrka): citations not supported by their source, numbers the model computed itself, and sources that were discarded.

---

## 7. Projects, the session list and the archive

- **Projects.** Create one with + → New project, or move a conversation into one with the row menu → Move to project (Flytta till projekt) → New project.
  - **Conversations in a project read each other.** A question pulls in what matches it from sibling conversations, up to 12,000 characters. This is handled like an attachment and named in the steps.
  - Locked conversations and "Forget after" conversations are left out.
  - Project menu: Rename, Set a goal / Change the goal, and Delete project. Deleting a project keeps its conversations.
- **Row menu on a conversation:**
  - Rename
  - Pin to top / Unpin
  - Lock with code / Remove lock
  - Share encrypted (Dela krypterat)
  - Decision record as PDF
  - Move to project
  - Archive (Arkivera) / Back to ongoing
  - Delete (Ta bort). This cannot be undone.
- **Multi-select.** Shift-click selects a range and ⌘-click picks one at a time. A bar then offers Archive, Project and Delete.
- **Archive.** The agent can move finished conversations there; see [Work](#105-tempo-and-work). The reason is shown in the Archive, and anything you take back is never touched again.

---

## 8. Mail, calendar, deadlines and law watches

| Command | What it does | Limits |
|---|---|---|
| `/post` (`/mail`) | The latest 10 subject lines from the mailbox you chose. The first time, it asks for permission and which account. "Open N" (Öppna N) opens a mail as a conversation. | Reads only. Bodies are read only when you open a mail. A mail with a suggested reply is marked. Never deletes, moves or marks as read; sends only a reply you sent with **Send** (Skicka). |
| `/kalender` (`/calendar`) | Meetings for the next 7 days, from Apple Calendar, including Google and Exchange accounts added there. "Open N" opens a meeting as a conversation: title, time, place, attendees, notes. | Never creates, moves, deletes or answers an invitation. |

An opened mail or meeting is an **attachment**, treated like a dropped document: masked when you take the masked version, and classified before any search goes out.

**Replying to a mail.** In a conversation opened from a mail, the top bar says who it came from and offers **Write reply** (Skriv svar). That opens the reply box: recipient, subject (Re: …), the text (editable), and the Mail signature that will be added (chosen from Mail's signatures; none if you have none). **Shorter** (Kortare), **More formal** (Mer formellt) and **Friendlier** (Vänligare) rewrite the text on the local model. If the agent has a **Suggested reply** (Förslag på svar) for the mail, the box starts with it.

**Send** (Skicka) is a button only you can press. The first time, Maximus asks: send directly from Maximus from now on, or open the draft in Mail as before? The choice is saved as the action **Send reply** (Skicka svar) under Settings → Agent → Actions, with **Ask every time** (Fråga varje gång), **Allowed** (Tillåtet) and **Open in Mail** (Öppna i Mail). Even Allowed needs your press. After the press the line **Sending in 10 s · Undo** (Skickas om 10 s · Ångra) shows. Undo means nothing is sent and the text stays. The countdown lives only in memory, so quitting Maximus during it sends nothing. Then Mail makes a real reply to the original (same thread, In-Reply-To, the right account; **(1.0.2)** always the account the mail came to, and Maximus checks that the sender is one of that account's addresses before Mail sends), sets exactly the text you saw and the signature, and sends it. The ledger gets a **Sent** row with recipient, subject, time and text. If Mail or the network fails, Maximus shows the error, nothing is called sent, and the text stays. **Maximus never sends anything unless you press Send.**

**Deadlines** (Frister). When the law text an answer relies on contains a time limit, such as "within three weeks of…", Maximus offers to **Watch** (Bevaka) it.

- The deadline is read from the law, not from the answer.
- You set the start date yourself, because only you know when you were notified.
- Working days skip Saturdays and Sundays. Public holidays are **not** accounted for.

**Law watches.** Every answer that rests on a legal provision becomes a watch automatically. When the section changes, or a new ruling cites it, it shows under `/bevakning` with the cases it touches. Only the provision reference leaves the computer, never your question or case. You can turn this off under Settings → Agent → Sources → Watch law changes; that row appears once a law has been used.

`/bevakning` shows deadlines with days left and watched provisions with what is new. It offers **Check now** (Kolla nu) and **Share the watches** (Dela bevakningarna). Sharing makes an encrypted `.maximus` file that carries the provisions, never your cases.

---

## 9. Foundation (Grunden)

Foundation is one session per app the agent reads:

- **You** (Du), the profile
- **Inbox** (Inkorgen)
- **Calendar** (Kalendern)
- **Notes** (Anteckningarna)
- **Messages** (Meddelandena)
- **Reminders** (Påminnelserna)

Each session is created when you allow that app.

- **First scan.** The first scan in each session gives an overview, what matters to you, and how often the agent will look. The default rates are: Inbox every 30 min, Messages every 60 min, Calendar and Reminders every 4 h, Notes once a day.
- **Later findings.** What the agent finds in an app is written into that app's session. Everything else goes to **Agent** (Agenten).
- **Unread.** A dot marks unread findings.
- **Deleting.** Foundation sessions cannot be deleted one by one. They go only with **Clear all** (Rensa allt).

---

## 10. The agent

The agent reads what you allowed, ranks it, sets aside what does not concern you **with a reason**, and tells you when something matters. **It reads, and does only what you said yes to.** It never sends messages, and an e-mail goes out only when you press Send. It never edits an existing note, reminder or meeting, and never deletes anything it did not create itself.

Text the agent reads (a mail, a page) is **foreign text**. If a mail tells the agent to ignore its instructions, it does not.

### 10.1 Sources

Settings → Agent → Sources. Everything is off until you turn it on.

| Source | What it reads | Needs |
|---|---|---|
| Read your e-mail | One account and one mailbox (INBOX by default), the 60 latest messages. **(1.0.2)** Any number of accounts, mailboxes per account, each with a label | Mail automation permission |
| Read your calendar | Upcoming meetings in all calendars. **(1.0.2)** The calendars you tick, each with a label | Calendar permission |
| Read your notes | One folder you choose, the 50 latest notes | Notes automation permission |
| Read your messages | The 60 latest incoming iMessages and SMS | **Full Disk Access** |
| Read your reminders | Open ones, plus those ticked off in the last 7 days | Reminders permission |
| Read the call list | Who called, when, and whether you missed it; never content | **Full Disk Access** |
| Read a folder | The most recently changed files, with their text; it never writes there | Files and Folders permission |
| Read LinkedIn in Safari | The front Safari tab only; never clicks, types or sends | "Allow JavaScript from Apple Events" in Safari |
| Read web pages you point at | Pages you name; each fetch is logged | — |
| News for you | News for the Home card; see [News](#12-news) | — |
| Watch law changes | Shown once a law has been used in an answer | — |

**Labels (1.0.2).** Each mail account and each calendar can carry a label (etikett): **Private** (Privat), **Work** (Jobb), a custom one (e.g. "the board"), or none. The default is guessed from the account's name and address when it is obvious (iCloud → Private). Everything from a labelled source counts as that label: the work account's mail is work. Only without a label does the model guess per item, and it sees the label in its prompt. A task's **Work or private** filter accepts custom labels too. A meeting proposal is suggested for a calendar with the same label as the material it came from. The conversation list and `/fynd` filter by label (`/fynd` → **Only <label>**).

**Missing permission (1.0.2).** If macOS says no to a source, also when only one of several accounts was refused, the task row says *"<source>: macOS hasn't given Maximus permission. Click to grant it."* The task offers **Give Maximus access to <source>** (Ge Maximus lov till …), which opens the right pane in System Settings, resumes the task and runs it at once. You get one notification the first time, instead of three silent errors and a pause.

### 10.2 Tasks (Uppdrag)

**Creating a task.** Say it the way you would to a colleague: *"Keep an eye on AI news in my inbox and surface what touches my role."* Maximus recognises a task, says what the agent would look for and how it ranks, and shows the task card before anything runs: what it reads, what it looks for and what it weighs against. Then it asks how often:

| If you mentioned… | Buttons |
|---|---|
| an event ("when Henrik mails") | Yes, when something new arrives · Every hour · Just once, now · No |
| a schedule ("weekdays 08:00") | Yes, <schedule> · Every hour · Just once, now · No |
| nothing | Every hour · Once a day · Just once, now · No |
| a one-off search ("go through my inbox and find the Telia invoice") | Yes, go through now · No |

If permission for the source is missing, you are asked for it first. **A yes runs immediately.** The first pass reports what it read, what it raised and what it set aside.

Other ways to create a task:

- **`/uppdrag <text>`.** A URL in the text becomes a page the agent reads. It asks for page permission, then fetches the page once as a test.
- **A topic with no source** becomes a web topic. The agent finds the sources itself.
- **A question ending in "… in the background"** (i bakgrunden) runs as a one-off search now, with a notification when it is done.
- **The agent suggests one itself.** In a "Remember me" conversation, a topic you asked about in another conversation triggers: "Tell you when something new comes about X?" A no stops that suggestion for the topic.

**Schedules and intervals the agent understands:**

| You write | Means |
|---|---|
| "every quarter hour" / "half hour" / "every hour" | Every 15 / 30 / 60 minutes |
| "every morning", "daily" | Once a day |
| "every week", "Monday", "Friday" | Once a week |
| "weekdays", "Mon–Fri", "weekend", "every day", named weekdays | Days |
| "08:00", "at 8", "8 and 15" | Times |
| "morning" / "afternoon" / "evening" | 08:00 / 15:00 / 18:00 |
| "when X mails", "as soon as", "every time", "ends up in Downloads" | Event trigger |
| "from <sender/domain>", "subject contains …" | Filters |

A schedule overrides the interval. Without either, local sources are checked every 15 minutes and web sources every 3 hours.

**Event triggers** are checked every 30 seconds. Each source has a minimum gap:

| Source | Minimum gap |
|---|---|
| Mail | 2 min |
| Calendar, reminders, notes | 5 min |
| Folder | Changes are picked up at once; otherwise 5 min |
| Messages and the call list | Changes are picked up at once; otherwise 10 min |
| Pages and topics | 30 min |
| Web searches | 60 min |

**Each item is weighed once.** The agent remembers what it has seen per task and source, and weighs only new or changed items, at most 30 per round. The rest wait for the next round. A moved meeting counts as new.

**Tasks in the rail.** **Tasks** (Uppdrag) lists every task with its state:

- **waiting** (väntar), queued for the next look;
- **next** (nästa), when it runs;
- **finds** (fynd);
- **paused** (pausad), by you or automatically **after 3 errors in a row**, with the reason shown.

A pulsing row is reading right now. The box in that view is for new tasks only.

**Task view controls** (some appear only when relevant):

| Control | Does |
|---|---|
| Run now (Kör nu) | Runs once, also when paused (it stays paused) |
| Show the N I set aside | The set-aside items, with reasons |
| Change how often (Ändra hur ofta) | When something new arrives / Only on schedule, Weekdays 08:00 and 15:00, Every morning 08:00, Every hour, Every 15 minutes, Custom times …, Keep |
| Investigate the most important (Undersök det viktigaste) | Starts an investigation now, ignoring the hourly budget |
| Choose sources (Välj källor) | Which sources the task reads |
| Work or private (Jobb eller privat) | Only work / Only private / Both |
| Only from / only about … | A filter; later "Change the filter", and "Read everything again" |
| Open the task's conversation | The thread where results are written |
| Keep watching — only new | Continue a finished task, with new items only |
| Pause / Resume, Delete, Done | Delete asks first; findings are kept under `/fynd` |

**Pause until a date.** Write it in the Agent conversation, e.g. "pause everything until Monday". A date that is today or already past is moved a week ahead. The task resumes by itself.

**A task has a thread.** Results are written into the task's own conversation, round after round, with the task and your instruction at the top. You can ask further or request a draft right there.

### 10.3 Triage

Every round, the model either **raises** an item (lyfter fram) with a weight and a reason, or **sets it aside** (lägger åt sidan) with a reason.

| Weight | Meaning |
|---|---|
| 3 | Must see today |
| 2 | Worth knowing |
| 1 | Barely |

- **Items the model did not mention are kept**, marked "Not assessed — kept to be safe."
- **Setting aside never means hiding.** Set-aside items stay, with their reasons, in the task view and under `/fynd`. You can also ask the Agent conversation ("what happened last night?").
- **Where findings land.** Raised findings land in the app's Foundation session when the task belongs to Foundation, otherwise in **Agent**, the conversation at the top of the side panel. Findings with a link, image and price become cards.
- **Notifications.** "Notify when the agent finds something" is on by default. It shows in the window when Maximus is in front, otherwise in macOS Notification Center. **(1.0.2)** One notification per round, naming the tasks with something new, not one per task. Investigations and suggestions show only in the window, never on the phone.
- **The material (1.0.2).** Each finding carries a reference to its original: the mail (with account and mailbox), the calendar event, the note, the file, the message or the address. When the agent opens a conversation about its findings, the turn carries a **card** per finding: title, source, an excerpt, **Show all** (Visa hela) for the whole original, and **Open in Mail** / **Open the file** / **Open the page**. The heading says "the assistant reads the same thing": follow-up questions get the same cards, and the assistant can read the rest of a long original in pieces instead of guessing from a 1,500-character clip. Originals are read locally, three at a time and at most fifteen seconds in all; anything not read in time is read at the follow-up. An original whose text tries to steer the model is shown by its title only: "The text tried to steer the model and was not read."

### 10.4 Investigations

With **May start working on its own** (Får börja arbeta själv) on, which is the default, the agent investigates a weight-3 finding after a round.

- **What it creates.** A conversation "Investigation: <title>" (Undersökning) with web search off. It runs up to 3 rounds of questions and ends with a conclusion and a confidence level. A link is posted in Agent.
- **When it runs.**
  - One per round, and never while you are typing.
  - Never on unassessed items, items containing an injection attempt, your own notes, or the first Foundation scan.
  - On battery only at Full gas.
- **Budget.** The hourly budget follows the tempo.

### 10.5 Tempo and work

Settings → Agent → Work (Arbete):

| Tempo | Looks every | Investigations per hour | On battery |
|---|---|---|---|
| Calm (Lugn) | 15 min | 1 | No investigations |
| **Normal** (default) | 5 min | 3 | No investigations |
| Full gas | 1 min | 12 | Investigates on battery too |

Between rounds the model rests and the GPU winds down.

- **On battery** (På batteri): "Sparser" (Glesare, the default) looks every third time; "As usual" (Som vanligt) looks every time.
- **The conversation comes first.** If only one model fits in memory, the agent stands back while you chat. When it skips a round it says why.
- **When the agent runs** (När agenten kör):

  | Option | Behaviour |
  |---|---|
  | Only while Maximus is open (default) | Closing the window stops everything. Missed tasks catch up when you reopen, and after sleep. |
  | Open Maximus when the computer starts | Installs a macOS LaunchAgent that opens the app at login, with the option "Start with the window hidden" |
  | In the background, also when Maximus is closed | A macOS LaunchAgent runs the server without a window and restarts it if it crashes. With a password, it runs only once Maximus is unlocked or the password is remembered in the keychain. |

- **Put finished conversations in the archive** (Lägga klara samtal i arkivet), on by default. It runs at most every 6 hours:
  - investigations and one-off searches go after 7 days untouched;
  - threads of deleted tasks after 3 days;
  - your own conversations after 30 days untouched.

  It never touches pinned, project, locked, sealed or running conversations, the Agent conversation, or anything you restored.

### 10.6 Actions (Handlingar)

The agent can **propose** to do things. A proposal appears in the conversation with **Yes** and **No**, and nothing happens before your yes. Settings → Agent → Actions sets each action type to **Ask every time** (Fråga varje gång, the default), **Allowed** (Får göra) or **Never** (Aldrig).

| Action | Undoable |
|---|---|
| Create reminders | Yes |
| Add meetings | Yes |
| Put mail drafts in Drafts | — |
| Write notes (in the folder you chose) | — |
| Run Shortcuts (ones you built) | — |

The agent only ever drafts or suggests e-mail. A reply goes out only when you press **Send** (Skicka) in the reply box; **Send reply** (Skicka svar) sets whether Send sends directly, asks every time, or opens the draft in Mail. Messages are never sent.

**Write a daily overview in the notes** appears once Notes reading is on. Despite the name, it is not once a day: after any round with new findings, it writes a *new* note "MAXIMUS <date time>" listing up to 20 unread findings. It never edits an existing note.

### 10.7 Suggestions and knock-knock (1.0.2)

The agent as a colleague. Settings → Agent → Actions has two switches, both on by default when the agent is on.

**Suggestions with reasons** (Förslag med skäl). After a round, at most every third hour, the local model reads what the agent found in the last two days (with the cards and labels) and your calendar two days back and forward, and suggests what you could do:

| Kind | Taking it |
|---|---|
| **Reply** (Svara) | **Open the reply**: the reply box, from the account the mail came to. You press Send. |
| **Schedule** (Boka) | **Prepare the meeting**: a meeting proposal for the calendar with the same label as the material. Nothing is saved before your yes. |
| **Get in touch** (Hör av dig) | **Copy the draft**. Must be about someone in the material. A "get in touch" with the person who wrote a mail becomes a reply from the right account. |
| **Follow up** (Följ upp) | About a mail: a reply from the account it came to. Otherwise **Copy the draft**. |

The model picks what; rules do the rest. A suggestion without a reason or material is never shown. A mail the agent already wrote a suggested reply for gets no second one. Material that tried to steer the model carries no suggestion. Each suggestion shows its reason and the cards. Decline with **Not relevant**, **Already done** or **Don't ask about <topic>**; that is remembered and steers the next suggestions. Nothing is sent.

**Knock-knock** (Knack-knack). Now and then the agent opens a short conversation: a question written by rules from what Maximus knows about you — a gap in your profile, a new sender that keeps turning up, something you stopped writing about, an old fact, how something is going. It only knocks when you are active at the computer (touched in the last two minutes), the window is not resting, and no conversation, dictation or meeting is going on. At most once every 1, 2, 3, 7 or 14 days (default: once a day), and never to the phone or Notification Center. Answer in your own words; whatever should change in [`/du`](#131-du-me-what-maximus-knows-about-you) is shown before and after and saved only after your yes, then at most two follow-up questions. **Not now**, **Never ask about this** and **Turn off knock-knock** are on every knock.

### 10.8 Where you see the agent

| Place | What |
|---|---|
| **Agent** (top of the side panel) | The running conversation: everything it did, with yesterday and older folded. You talk to it here, e.g. "run the inbox now" or "what happened last night?" |
| **Tasks** | Every task, its state and its view |
| **Home** | Agent · latest moves |
| `/agent` | How it works: how often it looks, what it reads, which tasks use it, what it never does |
| `/fynd` | Everything it found, what it set aside with reasons, and the last round. "Look now" (Titta efter nu) runs a round |
| `/uppdrag` | The task list, with "Change N" → Pause / Resume / Delete |

---

## 11. The phone channel

Settings → Agent → Notifications (Säger till) → To the phone (Till telefonen):

| Option | How it reaches you |
|---|---|
| Off (Av) | Maximus tells you on the computer only |
| Reminder via iCloud (Påminnelse via iCloud) | A reminder in a list called **Maximus**, with an alarm. iCloud syncs it to your iPhone. No app or account is needed. |
| iMessage | Sent from your own account to the number or e-mail under "Where" (Vart) |

**When it sends.** Only for a new weight-3 finding, and only when the Mac has been idle for 10 minutes or more. Limits are **4 per hour and 12 per 24 hours**.

**What it sends.** "Maximus · <title> — <one line>", up to 280 characters. It never sends the underlying material. **Send a test** (Skicka ett prov) skips the idle check and the limits. Maximus deletes its own reminders after 24 hours.

**Replying from the phone** works with the Reminders channel only. The list is read every time the agent looks.

- **Tick the reminder off.** Marks it as read in Maximus.
- **Write in the reminder's note.** Arrives as "From the phone: …" in the conversation the reminder came from, or in Agent if that conversation is sealed.
- **Add your own reminder to the Maximus list**, also with Siri ("Hey Siri, add … to Maximus"). Becomes a message to Agent.

Restrictions on text from the phone:

- It gets **no web search, no page fetch or Safari, and no task creation or steering**.
- Actions run only after a yes **at the computer**, even if set to Allowed.
- The answer stays on the Mac, because the list may be shared. The phone only learns that the answer is in Maximus.

---

## 12. News

Turn it on with Settings → Agent → Sources → News for you, or from the card on Home. It works from **What interests you** in your profile, or from what you work on if that is empty, up to 5 topics.

- **Finding sources.** The agent looks up sources itself, preferring authorities to forums and using RSS where it exists, up to 8 sources. If it reads your inbox, newsletters count too.
- **Ranking.** Each item is weighed against your profile, and the heaviest come first.
- **What counts.** Only things that happened: decisions, launches, reports, deals, role changes. Product pages, guides and ads are dropped.
- **Refresh.** Every 3 hours.
- **What leaves.** Only the topic words, masked. Each fetch is logged.
- **Where it shows.** On Home, and in a News session.
- **News is public.** When you bring a news item into a conversation, it is cited unmasked. **(1.0.2)** The card says "Public source · <host>", and you are not asked whether to anonymize it. Your own questions in the same conversation follow your setting as before.

**The digest (1.0.2).** News and the LinkedIn feed become one **digest** (sammanställning) per round instead of one finding per item: a few paragraphs grouped by topic, each with *why it matters to you* from your profile, and the sources in a box underneath. Every paragraph is checked against its sources, and a paragraph that doesn't hold is dropped. Only items aimed at you — your name, your company, a contact, a decision you're waiting for — are lifted out as findings of their own. News gets weight 2 at most and never reaches the phone unless it is aimed at you.

---

## 13. You and LinkedIn (Du)

Your profile is built from what you already have. Set it up under Settings → You → Profile (Profil) or in onboarding.

- **What you can import:**
  - **LinkedIn export.** Order it on LinkedIn: Me → Settings → Data privacy → Get a copy of your data. Read in with "Read LinkedIn export or CV" (Läs in LinkedIn-export eller cv). Maximus uses your profile, positions, education, skills, your own posts, reactions and comments.
  - **A CV.** `.pdf .docx .doc .odt .rtf .txt .md`, up to 200 MB.
  - **Your profile page in Safari** (Läs profilen i Safari). Maximus opens it for you.
  - **A link** pasted in onboarding. LinkedIn links open in Safari; other links are fetched and logged.
- **What it produces.** The local model proposes four fields, which you check and save: **Who you are, What you work on, What you want to achieve, What interests you**. **Suggest from my conversations** (Föreslå ur mina samtal) proposes the same fields from your conversation titles.
- **Keeping it current.**
  - **LinkedIn feed** (LinkedIn-flödet): when the agent may read LinkedIn in Safari, or you said yes to following along, it reads your feed or recent activity every 2 hours. It only reads; it never clicks or scrolls.
  - 30 days after your last import, you get a reminder to import the export again.
- **What it never does.** Maximus **never writes, likes or contacts anyone in your name**. Your own posts count as yours.
- **Privacy.** The profile stays on the Mac and never goes along with a search. With a cloud model it is always masked at the strict level.

### 13.1 `/du` (`/me`): what Maximus knows about you

**(1.0.2)** `/du`, `/me` or `/you` opens a summary of everything Maximus holds about you, fact by fact, grouped: who you are, what you work on, what interests you, what the agent watches for you and why, what you added, and conversations you let it remember. Each fact says where it came from: LinkedIn, your CV, the profile page in Safari, a link you gave, you, a task in your words, or a conversation. The list is built by rules, not by the model.

**Correcting it.** Write as in a chat: *"I've left X"*, *"add that I'm on the board of Y"*, *"I'm not interested in Z any more"*, *"forget everything about Z"*. "Forget" is a rule; other corrections are read by the local model and then checked strictly (a new fact that carries nothing of what you wrote is dropped, and a date you didn't write is not invented: an end date becomes the current month, a start date is left out). Maximus shows a table of exactly what is added, changed and removed, before and after, with **Yes, change it**. Nothing changes without that yes, and the yes applies to exactly what you were shown: if anything changed in between, it is refused and you see a fresh preview.

**What "forget" removes.** Z goes from your profile, what you added, and the LinkedIn/CV import, and also from the agent's own stores: findings, set-aside items, the colleague's memory (suggestions, answers, "don't ask about", questions), suggested replies, actions, the trace and the phone lines. The preview says how many items in which store. Your conversations are not touched. Sent gets a local row with the counts and ids, never the text.

**After.** The You line in Foundation is rewritten, and the next answer and the agent's next round use the new profile. A knock-knock answer goes through the same preview and yes.

---

## 14. Models: local and cloud

### 14.1 Local model

Settings → Model (Modellen) → On this computer (På datorn).

- **Choosing.** "Fits this computer" (Passar den här datorn) lists three models. More are under "More models (N)": Gemma 4 variants up to 31B, Qwen3 4B–32B, Llama 3.2 3B and 3.1 8B, Mistral Nemo 12B and Small 24B. Some are marked untested in Maximus. Only models tested on Maximus's judgement bench are picked automatically.
- **"Right now"** (Just nu) shows the running model, with Start / Turn off.
- **The power lamp** (side panel). Pause / Turn off while running, Resume / Turn off while paused, Start when off. A paused model stays in memory and answers again at once. Rest (vila) also pauses the model.
- **The browser that looks things up** (Webbläsaren som slår upp). Web search uses your installed Chrome or Edge in the background. If neither is installed, Maximus offers to download a headless browser of about 100 MB. It tries these engines in order: Brave, Ecosia, Startpage, DuckDuckGo, Mojeek, Bing.
- **Image and sound** (Bild och ljud):
  - **The model that transcribes** shows the whisper model and offers a download if it is missing.
  - **Let the model see images** → "Download the image part" (Hämta bilddelen). The screen text says about 175 MB, which is true for the 12B model; for the smaller models it is about 1 GB. The line under the button shows the real size.

### 14.2 Cloud model

Settings → Model → In the cloud (I molnet). It is also offered in onboarding and on the first-start model screen.

| Provider | Default model | Sign-in |
|---|---|---|
| Berget AI (Sweden) | Gemma 4 31B (also Mistral Small 3.2, Qwen 3.8, GLM 5.3 Flash, Kimi K3) | API key |
| OpenAI | gpt-4.1 | API key |
| Anthropic | claude-sonnet-5-5 | API key |
| Google Gemini | gemini-flash-latest | API key (AI Studio) |
| OpenRouter | openrouter/auto | Browser login. **Experimental, not tested against the live service.** |

- **Keys** live in the macOS keychain, never in a file. "Forget the key" (Glöm nyckeln) removes it. Anthropic and Google do not allow consumer-account sign-in in third-party apps, so they need a key.
- **"Answer with the cloud model"** (Svara med molnmodellen) switches it on. Each question is **masked first**, and placeholders in the answer are restored on your Mac, even while it streams.
- **What goes out to the cloud** (Det som går ut till molnet) has two levels and a live preview of "What you write" and "What goes out":

  | Level | Hides |
  |---|---|
  | **Strict** (Strikt), default | Names, numbers, addresses, places and workplaces |
  | **Personal data** (Personuppgifter) | Names, ID numbers, phone, e-mail, addresses; companies and places stay |

- **Ledger.** Every call is a row in Sent: "Cloud model: <name>", the number of messages (not their text), characters, how many items were masked, and seconds.
- **Status elsewhere.** Settings → Protection → Web → Cloud model shows on or off, and "Change" (Ändra) jumps here.

---

## 15. Masking

Masking is done on your Mac. It applies to everything that leaves (searches, cloud calls) and to the masked text you copy out.

- **Rules** find personal identity numbers, coordination numbers, organisation numbers, phone numbers, addresses, postcode with town, account numbers, case numbers and e-mail.
- **The name model (1.0.2)** is the second layer, after the rules: [nym-pii-multilingual-small](https://huggingface.co/Wismut/nym-pii-multilingual-small), a small token classifier (int8 ONNX, MIT licence, about 150 MB) run on your Mac with onnxruntime. It reads what has no format: unusual names, street addresses and ID-like strings, and at the Strict level also places and workplaces, never countries. Its finds are rounded to whole words and get the same kind of placeholder as the rules'. It only adds; it never removes a placeholder. It is downloaded with the language model at first start, from a locked revision, and every file is checked by size and sha256 before it loads; a file that doesn't match is deleted. A short text takes about 15 ms; a long document is read once in the background, paragraph by paragraph. If it is missing, off, or won't load (or the machine is not a Mac), the rules apply alone, and the log says so. Everything that leaves the computer waits for it to finish reading.
- **The local model** fills in names and anything the rules miss.
- **Labels** stay consistent: the same value gets the same label within a conversation, and the map back exists only on your Mac.

Settings → Protection (Skydd) → What is hidden (Vad som döljs):

- **Packages:**

  | Package | What it adds |
  |---|---|
  | **Standard** | The default; suits most people |
  | **Authority** (Myndighet) | Adds case numbers and links |
  | **Procurement** (Upphandling) | Adds amounts, drops places |
  | **Cybersecurity** (Cybersäkerhet) | IPs, servers, paths, keys, links, organisations |
  | **Everything** (Allt) | Everything |

- **Swedish/multilingual name model** (1.0.2): on by default. The row shows its state: on (name, licence, size), not downloaded (with **Download the name model**), or removed after a checksum mismatch. Off means the rules alone.
- **Show exactly what is hidden** (Visa exakt vad som döljs) lists 16 types you can switch on and off. Personal identity and organisation numbers cannot be turned off. Any change shows as "Custom mix" (Egen blandning).
- **Rules for the masking** (Regler för maskeringen) is not a place to write rules. It shows which signed pattern pack is in use. Only signed packs are applied.
- **Text you take with you is shown as** (Text du tar med dig visas som) is the default treatment: Original, Masked (default) or Anonymized. **(1.0.2)** It applies when a cloud model answers; with the local model, ask for a mask in the conversation ([4.9](#49-asking-for-a-mask)).

Masking is a gate, not a guarantee. Someone determined can still re-identify a person from context. Maximus shows you the mask; you decide what is sensitive.

---

## 16. Protection

### 16.1 Password

Settings → Protection → Lock (Lås) → **Password for Maximus** (Lösenord för Maximus).

- **What it does.** The password is at least 8 characters. It encrypts at rest (AES-256-GCM) your conversations, answers, files, settings and the ledger, and setting it re-encrypts existing data. Once a password is set, the button becomes "Lock now".
- **Forgetting it.** **A forgotten password cannot be recovered.**
- **Remembering it.** "Remember the password on this computer" stores it in the macOS keychain so you need not type it. Setting a lock code turns this off.

### 16.2 Lock code

**Lock when you step away** (Lås när du går ifrån) → Set code. The code is six digits; six identical digits and straight runs are refused.

- **What locking does.** Locking (Locket) removes the master key from memory, empties the sessions out of the app, stops running work, and leaves the data encrypted on disk. The screen shows only the mark and the word maximus.
- **The code wraps the master key.** It does not derive it, so the password always opens too.
- **Close Maximus after** (Stäng Maximus efter): 5, 15 (default) or 30 minutes, 1, 4 or 8 hours, or never automatically.
- **Ten wrong attempts in a row** close the code path, and then only the password works.
- **Reserve question.** Optional, and you write it yourself. The lock screen then offers "Can't remember the code". It makes Maximus exactly as safe as the answer is hard to guess.
- **What it protects against.** The code protects against a person at your keyboard. It does **not** protect a copied data folder: six digits are a million guesses, and they can be tried offline. **Your password protects a copy.**

### 16.3 Rest (vila)

Rest dims everything and leaves the mark in the middle of the screen.

- **Going to rest:**
  - click the maximus mark at the bottom of the rail;
  - press **Esc twice** quickly;
  - or let the timer **Rest after** (Vila efter) run out: 1, 2, 5 (default), 10, 15 or 30 minutes, or never. The timer waits while you record or while an answer is being written.
- **Coming back.** Space, Enter or a click, then your password if you have one.
- **With a password, rest really locks**: the key leaves memory. Without one, it only hides.
- **Open at rest** (Öppna i vilan) starts Maximus in rest.

**Closing the window closes Maximus.** The server stops, the key leaves memory, and the model releases its memory. A crash or force-quit ends the same way. The exception is the background mode in [Work](#105-tempo-and-work).

**Log out everywhere** (Logga ut överallt) revokes every open browser session to the local server. Use it if a link to Maximus ended up in the wrong place.

### 16.4 Locked and sealed conversations

Row menu → **Lock with code** (Lås med kod). The code is at least 4 characters, and in both modes the title is hidden in the list.

| Mode | Meaning |
|---|---|
| **Locked** (Låst) | A gate in the interface. If you forget the code, your password still opens it. |
| **Sealed** (Förseglad) | The key is built from your password **and** the code. **Forget the code and the conversation is gone for good.** Not even Maximus can open it. |

Locked conversations are never read by project cross-reading.

### 16.5 Sharing a conversation

Row menu → **Share encrypted** (Dela krypterat) makes a `.maximus` file.

- **The code.** Maximus suggests a code and shows it once; it is never saved. A code you choose yourself must be at least 12 characters.
- **Sending.** In the app, **Share…** (Dela…) opens the macOS share sheet: Mail, Messages, AirDrop and the rest. "Save the file" (Spara filen) is also there. Send the file and the code by different routes.
- **Receiving.** The recipient uses ··· → **Import** (Importera), or drags the file in, and types the code. The sender is visible without the code; title and content are not.

---

## 17. The ledger (Sent / Skickat)

Open it from ··· → Sent, or Settings → Your data → Open Sent.

- **What it records.** Every payload that left the computer, in order: time, recipient, route, characters sent, seconds, error, the exact payload, and the reply. Expand a row to see the payload.
- **What it cannot record.** Copying the masked text into another program is your step, in your program. Maximus cannot see it or log it.
- **Turning it off.** **Record what is sent** (Bokför det som skickas). Off means nothing is written at all.
- **Export.** CSV (`;`-separated and formula-safe), JSON, or plain text. The export is unencrypted on purpose, so you can show it to a manager, auditor or client.
- **The chain** (Kedjan). Each day file carries the hash of the previous day, and the status shows whether the chain holds. You can copy the chain head; write it down somewhere off the machine.
- **Pruning** (Gallring). "Keep entries for" N days (0 = keep all), with "Save as default" and "Prune now". Pruning breaks the chain backwards and is itself logged.
- **Sealed conversations.** Their rows show, but the content needs the conversation's code.
- **Deleting.** The ledger cannot be emptied from the app, and Clear all keeps it.

---

## 18. Slash commands

Type `/` in the composer to fold out the list. Arrow keys choose, Enter or Tab runs, and Esc closes. A fully typed command runs as written. Every command also has an English name that works in both languages: `/me`, `/mail`, `/calendar`, `/watch`, `/tasks`, `/finds`, `/record`, `/document`, `/deepdive`, `/tour`, `/clear`, `/settings`. The table uses the Swedish names.

| Command | What it does | What it costs |
|---|---|---|
| `/help` | Everything Maximus can do, in four tables: Commands, Ask and material, What protects you, Order and watching | Nothing; no model runs |
| `/rundtur` | The five-step tour with examples from your profile; the example you pick lands in the composer unsent | Nothing; no model runs |
| `/du` (`/me`) **(1.0.2)** | What Maximus knows about you, and where each fact came from; correct it in plain words | The local model reads your correction; nothing changes without your yes |
| `/post` | Latest subject lines in your mailbox; an opened mail becomes a conversation | Reads only; asks permission the first time |
| `/kalender` | Meetings for the next 7 days; an opened meeting becomes a conversation | Reads only; never changes anything |
| `/bevakning` | Deadlines and watched legal provisions, with what is new | Only the provision reference leaves when checked |
| `/uppdrag [text]` | Without text: your tasks. With text: a new task | Run by the agent on your Mac |
| `/agent` | How the agent works: schedule, sources, tasks, what it never does | Nothing |
| `/fynd` | Everything found, what was set aside and why, the last round; "Look now" runs a round | Reading a page fetches it, and that is logged |
| `/spela` | Record a meeting (same as ⌘⇧R) | On the Mac; audio not kept |
| `/presentation` | Guided PowerPoint with speaker notes and sources | Web only if the routing allows; every lookup logged |
| `/dokument` | Guided Word document with TOC and footnotes | Same as above |
| `/djupdykning <what and why>` | Deep dive before a meeting or event; Word brief | Takes a while; runs in the background |
| `/rensa` | Deletes all conversations, projects, tasks, findings and deadlines; asks first | Cannot be undone; the ledger stays |
| `/installningar` | Opens Settings | Nothing |

---

## 19. Keyboard shortcuts and gestures

| Keys | Does |
|---|---|
| ⌘N | New conversation (in Help: new help question) |
| ⌘⇧R | Record a meeting |
| ⌘+ / ⌘− / ⌘0 | Whole app larger / smaller / default (80–160 %) |
| ⌘[ / ⌘] | Back / forward, like a browser; back goes all the way to Home |
| Two-finger horizontal swipe, mouse side buttons | Back / forward |
| Esc | Closes the topmost menu or dialog; otherwise goes Home. Cancels dictation. |
| Esc twice (quickly) | Rest |
| Enter / Shift+Enter | Send / new line |
| Enter (sensitivity gate, level 2) | Approve the search; level 3 needs a click |
| Space or Enter (at rest) | Come back in |
| Shift-click / ⌘-click in the list | Select a range / pick individual conversations |
| ← / → on the panel edge | Change panel width; Enter resets |

---

## 20. Settings, tab by tab

Settings has seven tabs. Each tab's sections also appear in the side panel as jump links. "Everything here stays on this computer."

### You (Du)

| Section | Row | What it does |
|---|---|---|
| Profile | What should I call you? | Your first name or nickname |
| | Read LinkedIn export or CV / Read the profile in Safari | Builds a profile proposal |
| | Who you are · What you work on · What you want to achieve · What interests you | The profile, max 400 characters each. "Suggest from my conversations", Save |
| | LinkedIn feed | Whether the feed is read; "Change" |
| Answers (Svaren) | Voice (Rösten) | Professional (default) / Clear / Cocky. Changes tone only, and applies to new conversations |
| | Your rules for the answers | Guidelines applied to every answer, up to 4000 characters |
| | Templates | Presentation (`.potx`/`.pptx`) and document (`.dotx`/`.docx`) templates, with Remove |
| | Deep search (the magnifier) | Rounds, sources, time |
| | Check the citations | On by default |
| Appearance & input (Utseende och inmatning) | Colours (Färger) | Lunar Lilac (default), Graphite (Grafit), Tangent. Light or dark follows macOS |
| | Size of text and buttons | 80–160 %, same as ⌘+ / ⌘− |
| | Dictation sends after | 2 / 3 / 5 s of silence, or only on "skicka" |

### Agent (Agenten)

| Section | Row | What it does |
|---|---|---|
| Sources (Källor) | Read your e-mail (+ which accounts and mailboxes, each with a label **(1.0.2)**) | See [Sources](#101-sources) |
| | Read your calendar (+ which calendars, each with a label **(1.0.2)**) · notes (+ which folder) · messages · reminders · call list · a folder | |
| | Read LinkedIn in Safari · Read web pages you point at · News for you | |
| | Watch law changes | Shown once a law has been used |
| Work (Arbete) | Tempo | Calm / Normal / Full gas |
| | May start working on its own | Investigations; on by default |
| | Put finished conversations in the archive | On by default |
| | On battery | Sparser / As usual |
| | When the agent runs | Only while open / Open at login (+ start hidden) / In the background |
| | The tasks | "Open Tasks" |
| Actions (Handlingar) | Create reminders · Add meetings · Put mail drafts in Drafts · Write notes · Run Shortcuts | Ask every time / Allowed / Never |
| | Suggestions with reasons **(1.0.2)** | On / off. See [Suggestions and knock-knock](#107-suggestions-and-knock-knock-102) |
| | Knock-knock **(1.0.2)** | On / off, and at most once every 1, 2, 3, 7 or 14 days |
| | Write a daily overview in the notes | Shown when Notes reading is on |
| Notifications (Säger till) | Notify when the agent finds something | Window or Notification Center |
| | To the phone (+ Where, Send a test) | Off / Reminder via iCloud / iMessage |
| | Overviews are shown as | Original / Masked (default) / Anonymized |

### Protection (Skydd)

| Section | Row | What it does |
|---|---|---|
| Lock (Lås) | Password for Maximus | Set password / Lock now |
| | Lock when you step away | Six-digit code; "Close Maximus after" |
| | Log out everywhere | Revokes all open sessions to the local server |
| | Rest after | 1–30 min or never |
| | Open at rest | Start in rest |
| | Remember the password on this computer | Keychain |
| What is hidden (Vad som döljs) | Packages, Swedish/multilingual name model **(1.0.2)**, Show exactly what is hidden, Rules for the masking | See [Masking](#15-masking) |
| | Text you take with you is shown as | Default treatment |
| Web (Webben) | Search the web | Off / Auto / On |
| | Hide who is searching (Dölj vem som söker) | Direct / Proxy (SOCKS5 or HTTP address, e.g. a VPN provider's) / Tor (a local Tor on 127.0.0.1:9050). "Test the route" shows the IP and country searches appear from. Applies to web searches only. |
| | Cloud model | Status; "Change" |

### Model (Modellen)

| Section | Row | What it does |
|---|---|---|
| On this computer | Models list, Right now, The browser that looks things up | See [Local model](#141-local-model) |
| In the cloud | Provider, Model, Account (OpenRouter login) or API key, Answer with the cloud model, What goes out to the cloud | See [Cloud model](#142-cloud-model) |
| Image & sound | The model that transcribes; Let the model see images | |

### Connections (Kopplingar)

| Item | What it is |
|---|---|
| **Works directly**: lagen.nu, Domstolsverket, Riksdagen, SCB, Kolada, IVO | Open Swedish data sources, always on, no login: the Swedish legal corpus, the latest court rulings, parliament, Statistics Sweden, municipal key figures, and lex Sarah/Maria statistics |
| **To connect**: Files, Notion, Browser, Remote connection | Connect / Disconnect. Files asks for a folder. Notion needs a token. Remote connection is a remote MCP server with OAuth; services such as Fortnox or Bolagsverket go through it. |
| Mask in ChatGPT and Claude (browser extension) | A pairing code (Copy, New code). Maximus does the masking itself, and the code can only mask text. |

### Your data (Dina data)

| Row | What it does |
|---|---|
| Sent | Opens the ledger |
| Delete old conversations automatically | "Keep conversations for" N days, with "Save as default" / "Prune now". Pinned conversations are exempt. |
| Start over (Börja om från början) → **Clear all** (Rensa allt) | Deletes all conversations with their files (Foundation included), projects, tasks and findings, deadlines and watches. **Keeps** the ledger, settings, profile, password and models. |

### About (Om Maximus)

| Row | What it does |
|---|---|
| New versions | Toggle and "Check now". Checks at most once a day. Sends the version and platform; logged; never installs without your yes. |
| Plan | Free and open source, Apache-2.0 |
| The terms | "Read the terms" |
| What leaves the computer | The list at the top of this guide |

---

## 21. Help

- **Opening it.** ··· → Help (Hjälp). The help view lists about 44 topics in 8 groups:
  - Get started
  - Ask and get answers
  - Files and meetings
  - Home and Foundation
  - You and LinkedIn
  - The agent
  - Protection and privacy
  - The model
- **Topics.** Clicking a topic shows its written text, with no model call.
- **Show me** (Visa mig) sits under topics that point at a place. It opens that place (a settings section, a composer button, Home, Tasks, Sent or Everything Maximus can do) and highlights it for a moment.
- **Your own question.** Type it in the help view, and the local model answers from the help knowledge base. Nothing leaves the computer.
- **Everything Maximus can do** (Allt Maximus kan): the button at the top right, or the ··· menu. It opens a searchable panel with two columns, Assistant and Agent. Clicking a row puts an example in the composer. **How?** (Hur?) opens the matching help topic.
- **`/help`** prints the four capability tables in the chat. `/rundtur` replays the tour.

---

## 22. What Maximus does not do

- It does not send anything unless you press Send. It never sends messages, posts, likes, or contacts anyone in your name on its own. The agent's suggestions are drafts.
- It does not knock on your phone. Knock-knock happens only in the window, when you are at the computer.
- It does not edit or delete your existing mail, notes, reminders or meetings.
- It does not run when closed, unless you chose the background mode.
- It does not follow the masked text to wherever you paste it. What the recipient does with it is your choice.
- It does not protect against malware already running on your Mac.
- It does not decide for you what is sensitive. The mask shows; you decide.
- It does not replace legal judgement. The model can be wrong about legal provisions, and says when it is unsure.
- Public holidays are not counted in deadline arithmetic.
- The interface is Swedish and English. The English masking lists are US-weighted (see the FAQ).
