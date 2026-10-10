# Maximus FAQ

Short answers to what new users ask. For the full guide, see [functionality.md](functionality.md).

### Does anything I type leave my Mac?

Only if you turned something on that sends it. By default the model runs on your Mac, and your questions, files and answers stay there. These can leave:

- a masked web search, when web search is not Off;
- a masked question to a cloud model, if you chose one;
- pages the agent fetches for you;
- a phone ping;
- an update check.

Every one of these is a row in **Sent (Skickat)**.

### What does it cost?

Nothing. It is free and open source under Apache-2.0. You can read, change and share the code.

### What Mac do I need?

macOS 12 or later on Apple Silicon.

| Memory | Default model |
|---|---|
| 16 GB | Gemma 4 E4B |
| 24 GB or more | Gemma 4 12B (6.5 GB), which runs comfortably |
| Less than 16 GB | Gemma 4 E2B |

Settings → Model lists the other models that fit your memory (Qwen 3, Llama, Mistral), with the recommended one first. We default to Gemma because it wrote the best Swedish of the open models we tested. If your Mac is too weak, the first-start screen offers a cloud model instead.

If the model seems stuck, its own log is in `~/Library/Application Support/Maximus/modell.log` — load, slots and timings, never your questions or answers.

### Why does macOS warn me when I open it?

Because Maximus isn't notarized by Apple yet. Our Apple Developer enrollment is being processed; the first release after it will open without a warning. Until then, either install from Terminal — no warning at all:

```bash
curl -fsSL https://raw.githubusercontent.com/aurolabsai/maximus/main/install.sh | sh
```

— or open the disk image and take one manual step on the first launch:

1. Open Maximus once. The warning only offers **Done** — click it.
2. Go to **System Settings → Privacy & Security**, scroll to **Security**, and click **Open Anyway** next to *"Maximus was blocked…"*. Confirm with your password or Touch ID.

You do this once. On macOS 14 and earlier, right-click Maximus → Open → Open also works. Until it is notarized, macOS may also ask again for Calendar and Reminders access after an update.

### Is the interface available in English?

Yes. Maximus follows your Mac's language: English unless your Mac is set to Swedish, Norwegian or Danish. Change it under Settings → Appearance and input; it switches at once, no restart.

Masking reads both languages. The English name lists come from US public records (SSA first names, Census surnames), so they are US-weighted; other names are still caught by the capitalisation rule. Check Sent the first times you use it with English names.

### Can it use ChatGPT, Claude or Gemini instead of the local model?

Yes. Go to Settings → Model → In the cloud. With an API key you can use OpenAI, Anthropic, Google Gemini or Berget AI (Sweden). OpenRouter uses a browser login and is experimental. Your question is masked before it goes out, the answer is restored on your Mac, and every call is logged. The key is stored in the macOS keychain.

### What does "Masked" vs "Anonymized" mean, and does it change the answer?

These settings only change what you can **copy out** of Maximus. The local model always reads your original text.

- **Masked** replaces names, ID numbers, addresses, phone numbers and account numbers with placeholders such as "Person A".
- **Anonymized** does the same, and also rewrites identifying details (amounts, dates, unusual specifics) so they are vaguer.

From 1.0.2 (in `main`, not yet released), the choice is shown only when a cloud model answers. See the next question.

### Why don't I see Masked/Anonymized when using the local model?

*(1.0.2)* Because nothing leaves the computer for it to protect. With the local model, the question is answered on your Mac, so the button in the composer says **Local** and the menu says "Local · nothing leaves the computer" (or that only masked search queries go out, when web search is on). Search queries, page fetches and tool calls are still masked as before. The choice comes back as soon as you switch to a cloud model, also in the middle of a conversation.

If you want a masked or anonymized text anyway, ask for it: *"mask this text: …"*, *"anonymize the attachment"*, *"mask your last answer"*. It is done on your Mac, even with a cloud model turned on, and you get a card with the text to copy, how many details were replaced, and the map of what each placeholder stands for. Nothing is sent and no row is written to Sent, because nothing left.

### What is the name model, and can I turn it off?

*(1.0.2)* It is the masking's second layer. The rules go first and catch everything with a format (ID numbers, phone numbers, addresses, e-mail). After them, a small model on your Mac, [nym-pii-multilingual-small](https://huggingface.co/Wismut/nym-pii-multilingual-small) (MIT licence, about 150 MB, Swedish and other languages), reads for what has no format: unusual names, street addresses, and at the Strict level also places and workplaces. It only **adds** placeholders; it never removes one the rules set.

It downloads together with the language model at first start (existing installs get a **Download the name model** button), from a locked revision, and every file is checked by size and sha256. A file that doesn't match is deleted. If the model is missing or won't load, the rules mask alone, as before. A short text takes about 15 ms; a long document is read once in the background.

Turn it off under Settings → Protection → What is hidden → **Swedish/multilingual name model**. Off means the rules alone.

### How do I take a masked version to another AI?

Hover over your own question, then press **Masked version to take with you**, then copy it. Attachments, your rules and earlier turns do *not* come along. Maximus cannot see or log what you paste elsewhere.

### When does it search the web?

With **Auto**, it searches only when the question needs a fact the model cannot have, such as a current rate, a specific company or a link. General "how does X work" questions never go out, and neither do personal ones. With **Off**, nothing is searched. You can also write "don't search" in a question, and that question will not be searched, even when web search is set to On. For sensitive questions you see the exact masked search terms first and approve them.

### Does Maximus remember my other conversations?

Only if you set a conversation to **Remember me**. The default is **Isolated**. **Forget after** deletes the conversation when you leave it. Conversations in the same project can also read each other, except locked ones.

### Which files can I drop in?

- PDFs, including scanned ones (read with OCR)
- Word, RTF, ODT, text and Markdown
- Spreadsheets: xlsx, ods, csv, tsv
- Images
- Audio and video: m4a, mp3, wav, mp4, mov and more

Everything is read on your Mac. Documents can be up to 40 MB and audio up to 500 MB.

### Can it do maths on my spreadsheet?

Maximus computes the sum, mean, median, min and max for each numeric column in code, then gives those figures to the model. The model interprets the numbers; it does not produce them. Swedish number formats are understood.

### Can it transcribe meetings?

Yes. Press ⌘⇧R or type `/spela`. The meeting is transcribed on your Mac in 5-minute parts while it runs, and summarised when you stop. The audio is never saved, only the text.

The microphone button next to the composer is **dictation**, which is a different feature. Say "skicka" to send.

### Can it make Word, PowerPoint or PDF files?

Yes, in three ways:

- Any answer can become Word, PDF, PowerPoint, Excel or Markdown with **Make a file of the answer**.
- `/presentation` and `/dokument` build a sourced document step by step, starting from an outline you approve.
- If you add your own `.potx` or `.dotx` template under Settings → You → Answers, Maximus uses it.

### What is the agent, and is it on by default?

The agent reads the apps you allowed (Mail, Calendar, Notes, Messages, Reminders, a folder, LinkedIn in Safari, web pages), ranks what it finds, and tells you what matters. It can read nothing until you say yes to each source, either during onboarding or under Settings → Agent → Sources.

### How do I give the agent a task?

Write it in plain words, for example "keep an eye on invoices in my inbox and tell me what's due". You can also type `/uppdrag` followed by the task. Maximus shows what the task will read and look for, then asks how often to run it: when something new arrives, every hour, once a day, on a schedule like "weekdays 08:00", or just once.

### Can the agent send mail or act on my behalf?

It never sends anything unless you press Send, never sends messages, never posts or likes anything, and never edits or deletes your existing items. It can **propose** to:

- create a reminder;
- add a meeting;
- put a mail draft in Drafts;
- write a new note;
- run a Shortcut;
- reply to a mail that asks you something (a **Suggested reply**).

A suggested reply is text in Maximus. Nothing is written in Mail and nothing is sent until you press **Send** in the reply box. Send is never a tool the agent or the model can call, and text in a mail cannot trigger it. After the press you have ten seconds to undo, then Mail sends it as a real reply from your account.

By default each proposal waits for your **Yes**. You can change that per action under Settings → Agent → Actions.

### Will the agent ever send something for me?

No. The agent and the model can suggest; only you send. A suggested reply, a suggestion from the agent as a colleague, a meeting proposal — each is a draft. A mail goes out only when you press **Send** in the reply box (with ten seconds to undo), a meeting is prepared as a proposal and nothing is saved in Calendar before your yes, and a "get in touch" is a draft you copy. Maximus never sends messages, never posts or likes, and never contacts anyone in your name. Text in a mail or a page cannot press Send either: Send is not a tool the agent or the model has.

### What are the agent's suggestions and the "knock-knock"?

*(1.0.2)* **Suggestions with reasons**: from what the agent found in your mail, calendar, messages and LinkedIn, it suggests what you could do — reply, schedule, get in touch, follow up — and why, with the material attached. A suggestion without a reason or material is never shown. Take it, change it or decline it; declining with a reason ("not relevant", "already done", "don't ask about X") steers the next ones.

**Knock-knock**: now and then the agent opens a short conversation ("How is X going?") to keep `/me` current. Only when you are active at the computer — not while Maximus is resting, not during a conversation, dictation or a meeting — at most once a day by default, and never to your phone or Notification Center. Your answer becomes a proposed change in `/me`, saved only after your yes. Both can be turned off under Settings → Agent → Actions, and **Not now** or **Never ask about this** works on every knock.

### Can the agent read several mail accounts and calendars?

*(1.0.2)* Yes. Under Settings → Agent → Sources (or in onboarding) choose any number of accounts, the mailboxes per account, and calendars, and give each a label: **Private**, **Work** or your own ("the board"). Everything from a labelled source counts as that label, so the model doesn't have to guess. Replies always go from the account the mail came to, and Maximus checks that the sender is one of that account's addresses before Mail sends. Conversations and `/finds` can be filtered by label.

### Why did the agent set something aside?

It judged the item not relevant to you, and it always gives a reason. Nothing is hidden: set-aside items are listed with their reasons in the task view and under `/fynd`. Items the model did not assess are kept "to be safe".

### Why did a task say macOS hasn't given Maximus permission?

Because macOS said no when the agent tried to read that source: Calendar, Reminders, Mail, Notes, or Full Disk Access for Messages and the call list. Maximus can't give itself that permission; only you can, in System Settings. *(1.0.2)* The task row says *"{source}: macOS hasn't given Maximus permission. Click to grant it."*, and the task offers **Give Maximus access to …**. That opens the right pane in System Settings, and when you come back the task resumes and runs at once. You get one notification the first time, not three silent errors.

Until Maximus is notarized, macOS may forget these permissions after an update and ask again.

### Does the agent run when Maximus is closed?

By default, no. Closing the window stops everything, and missed tasks catch up when you reopen the app. Under Settings → Agent → Work → When the agent runs, you can make Maximus open at login, or run it in the background as a macOS LaunchAgent.

### Will it drain my battery?

On battery, the agent looks less often ("Sparser"). It skips investigations unless tempo is set to Full gas. Between rounds the model rests. The **Calm** tempo looks every 15 minutes.

### How do I get notified on my iPhone?

Go to Settings → Agent → Notifications → To the phone and choose **Reminder via iCloud** or **iMessage**.

- **When it notifies:** only for important findings, and only when your Mac has been idle for 10 minutes.
- **Limits:** at most 4 notifications per hour and 12 per day.
- **What it sends:** a title and one line, never the material itself.

### Can I answer from my phone?

Yes, through the Reminders channel:

- **Tick off** a reminder to mark it as read.
- **Write in its note** to send a reply to the conversation it came from.
- **Add your own reminder** to the "Maximus" list, or ask Siri to, and it becomes a message to the agent.

Text that comes from the phone gets no web search and cannot create tasks. Any action it asks for still needs your yes at the computer.

### What is Foundation (Grunden)?

Foundation is a set of sessions, one per app the agent reads (Inbox, Calendar, Notes, Messages, Reminders), plus **You** for your profile. Findings from each app land in that app's session. These sessions can only be removed with **Clear all**.

### How do I see or correct what Maximus knows about me?

*(1.0.2)* Type `/me` (`/du` in Swedish). You get a summary: who you are, what you work on, what interests you, what the agent watches for you and why, and where each fact came from — LinkedIn, your CV, you, or a conversation you let it remember.

Then correct it in plain words, as in a chat: *"I've left X"*, *"add that I'm on the board of Y"*, *"forget everything about Z"*. Maximus shows exactly what will change, before and after, and changes nothing until you say yes — and the yes applies to exactly what you were shown. "Forget" removes Z from your profile and the LinkedIn import, and also from the agent's own stores (findings, set-aside items, suggestions, reply drafts, the phone lines), and the preview says how many items in which. Your conversations are not touched. Sent gets a local row with the counts, never the text.

The model can misread a correction, for example guess a date you never wrote. That is why you always see the change before it is saved.

### Why does the agent show the news as one digest?

*(1.0.2)* Because nine articles about the same thing are one piece of news. Each round, the agent writes a digest of the news and your LinkedIn feed: a few paragraphs per topic, why it matters to you, and the sources underneath. Each paragraph is checked against its sources, and what doesn't hold is dropped. Only items aimed at you — your name, your company, a contact, something you're waiting for — become findings of their own. News never goes to your phone. A news item or page you open is public, so it is not masked and you are not asked to anonymize it.

### Does it post or like on LinkedIn?

No. It reads your LinkedIn export, your CV or your profile page in Safari to understand who you are. If you allow it, it also reads your feed in Safari. It never writes, likes or contacts anyone in your name.

### How do I protect my data if someone gets my Mac?

Set a **password** under Settings → Protection → Lock. With a password, your conversations, files, settings and the ledger are encrypted on disk. A forgotten password cannot be recovered.

You can also add a **six-digit lock code**. The code stops someone at your keyboard, but it does not protect a copied data folder. Only the password protects a copy.

### What's the difference between a locked and a sealed conversation?

- **Locked:** the code is a gate in the interface. Your password still opens the conversation.
- **Sealed:** the conversation is encrypted with your password *and* the code. If you forget the code, the conversation is gone for good.

### How do I hide the screen quickly?

Press **Esc twice**, or click the maximus mark at the bottom of the rail. This puts the app at rest. If you have a password, it really locks. Without one, it only hides the screen.

### How do I share a conversation with a colleague?

Open the conversation's row menu and choose **Share encrypted**. This makes a `.maximus` file and a code. Send the file and the code by different routes. Your colleague opens the file with ··· → **Import** and types the code.

### Can I delete what was logged in Sent?

Not from a button that empties it. You can switch logging off ("Off means nothing is written"), or set a retention period under Sent → Pruning. Pruning is itself logged. **Clear all** removes your work but keeps the ledger.

### How do I start over?

Go to Settings → Your data → Start over → **Clear all**, or type `/rensa`. This deletes all conversations (including Foundation), projects, tasks, findings and deadlines. It keeps your settings, profile, password, models and the ledger.

To remove Maximus completely, follow the uninstall steps in the README.

### Can it be wrong?

Yes. A local model is slower than a frontier model and can be wrong. That is why the composer always says so. Some safeguards help:

- Answers cite their sources.
- Citations are checked against the source.
- The decision-record PDF lists what could not be substantiated.

Maximus does not replace legal judgement.
