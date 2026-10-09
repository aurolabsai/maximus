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

The app is not notarized by Apple yet. The first time, open Maximus once and close the warning, then go to System Settings → Privacy & Security and click Open Anyway. On macOS 14 and earlier, right-click Maximus → Open → Open also works. Until it is notarized, macOS also asks again for Calendar and Reminders access after an update.

### Is the interface available in English?

Yes. Maximus follows your Mac's language: English unless your Mac is set to Swedish, Norwegian or Danish. Change it under Settings → Appearance and input; it switches at once, no restart.

Masking reads both languages. The English name lists come from US public records (SSA first names, Census surnames), so they are US-weighted; other names are still caught by the capitalisation rule. Check Sent the first times you use it with English names.

### Can it use ChatGPT, Claude or Gemini instead of the local model?

Yes. Go to Settings → Model → In the cloud. With an API key you can use OpenAI, Anthropic, Google Gemini or Berget AI (Sweden). OpenRouter uses a browser login and is experimental. Your question is masked before it goes out, the answer is restored on your Mac, and every call is logged. The key is stored in the macOS keychain.

### What does "Masked" vs "Anonymized" mean, and does it change the answer?

These settings only change what you can **copy out** of Maximus. The local model always reads your original text.

- **Masked** replaces names, ID numbers, addresses, phone numbers and account numbers with placeholders such as "Person A".
- **Anonymized** does the same, and also rewrites identifying details (amounts, dates, unusual specifics) so they are vaguer.

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

It never sends mail or messages, never posts or likes anything, and never edits or deletes your existing items. It can **propose** to:

- create a reminder;
- add a meeting;
- put a mail draft in Drafts;
- write a new note;
- run a Shortcut.

By default each proposal waits for your **Yes**. You can change that per action under Settings → Agent → Actions.

### Why did the agent set something aside?

It judged the item not relevant to you, and it always gives a reason. Nothing is hidden: set-aside items are listed with their reasons in the task view and under `/fynd`. Items the model did not assess are kept "to be safe".

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
