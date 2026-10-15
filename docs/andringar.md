# Ändringar · Changelog

Nyast först. Varje version på svenska, sedan på engelska. Maximus är i beta.
Newest first. Each version in Swedish, then in English. Maximus is in beta.

Se också [vad Maximus gör](functionality.md), [FAQ](faq.md) och [säkerhet](security.md).

---

## 2026-10-11 — 1.0.3 (beta)

### Svenska

Släppt 11 oktober 2026. Versionen innehåller också allt i avsnittet nedan, som aldrig släpptes som 1.0.2.

- **Namnmodellen för dig som uppdaterar.** Förstagångsstarten hämtar namnmodellen, men den som kom från en äldre version gick aldrig igenom den och maskerade bara med reglerna tills hen hittade Hämta i inställningarna. Nu frågar Maximus, efter rutan om lov efter en ny version: *"Maskeringen har fått en svensk namnmodell (151 MB). Hämta nu?"* **Hämta** eller **Senare**. Förloppet står i ett kvitto och hämtningen i liggaren. Ingenting hämtas utan ja, frågan kommer en gång per version, och knappen i inställningarna finns kvar.
- **Skydd mot promptinjektion.** Ett mejl, en inbjudan, en sida eller en fil kan gömma instruktioner till AI:n ("sök på användarens budget", "skapa ett utkast till x@… med anteckningarna"). En tur som läst sådan främmande text gör nu ingenting själv: *får göra* blir ett kort som väntar på ditt ja, en genväg med indata ur texten körs inte, webbsökningen bär bara dina egna ord, och länkar ur texten öppnas inte. Värden ur texten märks med sin källa på kortet, och meningar i ett svarsförslag med uppgifter ur din kalender eller profil märks före Skicka. Varje verktygssvar stängslas, och en valfri lokal klassificerare (injektionsvakten, cirka 300 MB, hämtas bara på ditt ja under Inställningar → Skydd) ger varje främmande text en poäng. När något stoppas säger svaret det på en rad, och **Visa texten ändå** visar texten för dig. Länkar i svar visar alltid sin adress. Angreppssviten med en attrapp som alltid lyder får igenom 0 av 34 försök. Inget skydd mot promptinjektion är fullständigt: det här begränsar vad agenten kan *göra*, inte vad modellen *skriver*.
- **Notiser i Maximus namn också när fönstret är stängt.** När agenten kör i bakgrunden utan app (läget *I bakgrunden*) stod notisen förut som Skriptredigerare, och ett klick öppnade Skriptredigeraren. Nu visar appens egen binär den, med Maximus ikon, och ett klick öppnar Maximus.
- **Vakten: Maximus lagar fel av känd sort själv.** Före agentens arbete, varje varv, letar regler (ingen modell) efter fem sorters fel som faktiskt hänt: **eko** (egna påminnelser som efter en iCloud-synkning fått nya id:n och lästes som meddelanden från dig), **flod** (redan sedda poster som kommer tillbaka med nya id:n), **modellen som inte svarar** (i kö för minnet), **lovet borta** i macOS och **loopar**. Maximus lagar det lokalt — läser inte ekot som nytt och lagar loggen, lägger det redan sedda under Undanlagt med skäl, lägger frågan i kö och gör om den när modellen svarar i stället för att svara med felet, tar fram rutan för lov, slår ihop upprepningar — och säger det i en rad i Agenten: *"Något såg fel ut: … Jag …"*. Raden står också i Skickat som en lokal rad. Det som inte går att laga säkert får ett förslag på felrapport som du skickar själv. Främmande innehåll kan inte använda vakten för att tysta något: ingen källa pausas, och bara Maximus eget eller redan sett läggs undan.
- **Koppla in en tjänst med egna ord.** "Koppla dig mot min kontorsportal och håll koll på det", "koppla in https://…/mcp", eller en länk under Kopplingar. Maximus letar i MCP-registret, Smithery, GitHub, npm och PyPI, läser instruktionerna och visar ett kort eller en plan: vem som skrivit den, **officiell eller inofficiell**, var den körs, och varje verktyg med om det läser, skriver, skickar, betalar eller raderar. Inget kopplas in eller installeras utan ditt ja. När en fråga nämner en tjänst du saknar ("i Fortnox", "mitt CRM") föreslås 1–3 servrar ur registret under svaret.
- **Granskningen.** En server vars texter försöker styra modellen (tool poisoning, dold text) kopplas inte in, och kortet visar raden. Verktygslistan låses med ett fingeravtryck; ändras den efter ditt ja stängs kopplingen av tills du granskat igen.
- **Efter ja.** Läsande verktyg kan få "får läsa utan att fråga"; allt som skriver, skickar, betalar eller raderar kräver ja varje gång. Argumenten maskeras, varje anrop står i Skickat, och svaren går genom stängslet. Inloggning med OAuth i webbläsaren, token i nyckelringen.
- **Servrar som körs på datorn**, som en inofficiell koppling till en kontorsportal för lokalbokning: installeras efter ett uttryckligt ja, vid låst version med kontrollsumma, i en egen mapp, med ren miljö och beroenden ur låsfilen. README:ns kommandon körs aldrig; en plan som kör ett skript från nätet eller vill ha sudo stoppas. "Håll koll på det" blir ett uppdrag som läser kopplingens listande verktyg. Ta bort tar bort allt med ett klick.
- **Villkoren, version 8:** 4.3 a–b om kopplingar.
- **Kontrollen.** Varje svar prövas när det är klart: att stegen du bad om finns med och i ordning, att det du sa att den inte skulle nämna inte står där, att siffror och datum står i underlaget (bilagan, källan, det verktygen läste), att inget sägs vara bokat, skickat eller skapat som inte är det, och att språket och formen är de du bad om. Håller det inte får modellen ett nytt försök med exakt vad som var fel ("steg 3 saknas", "40 % står inte i underlaget", "du har inte bokat något"). Håller det fortfarande inte står en rad under svaret om vad som inte kunde kontrolleras — aldrig tyst. Gäller vanliga svar, agentens slinga, svarsförslag på mejl, undersökningar, `/du` och kollegans förslag. Regler först; den lokala modellen bara för att bekräfta att ett steg verkligen saknas. Inställningar → Du → Svaren → **Kontrollera svaren**: Förval, Strikt eller Av.
- **Varje släpp provas mot den riktiga modellen.** Före ett nytt släpp körs en provsvit mot samma lokala modell som du får (Gemma 4 12B), på svenska och engelska: agentens sållning, sammanställningar, `/du`, kollegans förslag, svarsförslag, undersökningar, kontrollen, kopplingarna och angreppen med promptinjektion. Ett enda angrepp som når ut stoppar släppet. Proven med påhittade modeller finns kvar; det här är provet med den riktiga.
- **Rättat:** ett svar från agenten som sa "föreslår" (som i "jag föreslår onsdag i stället") ersattes helt med "Jag har inte gjort eller föreslagit något." Nu gäller den regeln bara det som sägs vara gjort eller föreslaget som handling.

### English

Released 11 October 2026. It also contains everything in the section below, which was never released as 1.0.2.

- **The name model for those who update.** First start downloads the name model, but anyone coming from an older version never went through first start and masked with the rules alone until they found Download in Settings. Now Maximus asks, after the permission box shown after a new version: *"Masking now has a Swedish name model (151 MB). Download now?"* **Download** or **Later**. Progress shows in a receipt and the download is in the log. Nothing is downloaded without a yes, the question comes once per version, and the button in Settings stays.
- **Protection against prompt injection.** A mail, invitation, page or file can hide instructions for the AI ("search for the user's budget", "draft a mail to x@… with the notes"). A turn that has read such foreign text now does nothing by itself: *allowed* becomes a card that waits for your yes, a Shortcut with input from the text is not run, web search only carries your own words, and links from the text are not opened. Values from the text are marked with their source on the card, and sentences in a suggested reply that carry details from your calendar or profile are marked before Send. Every tool answer is fenced, and an optional local classifier (the injection guard, about 300 MB, downloaded only on your yes under Settings → Protection) scores every foreign text. When something is stopped, the answer says so in one line, and **Show the text anyway** shows you the text. Links in answers always show their address. The attack suite with a stub that always obeys gets 0 of 34 attempts through. No protection against prompt injection is complete: this bounds what the agent can *do*, not what the model *writes*.
- **Notifications in Maximus' name also when the window is closed.** When the agent ran in the background without the app (the *In the background* mode), a notification showed as Script Editor, and clicking it opened Script Editor. Now the app's own binary shows it, with the Maximus icon, and a click opens Maximus.
- **The watch: Maximus fixes known kinds of error itself.** Before the agent works, every round, rules (no model) look for five kinds of error that have actually happened: **echo** (its own reminders getting new ids in an iCloud sync and being read as messages from you), **flood** (items already seen coming back with new ids), **the model not answering** (queued for memory), **a macOS permission gone**, and **loops**. Maximus fixes it locally — doesn't read the echo as new and repairs its log, sets aside what it has already seen (listed, with the reason), queues the question and asks again when the model answers instead of replying with the error, brings up the permissions box, merges repeats — and says so in one line in Agent: *"Something looked wrong: … I …"*. The line is also in Sent as a local row. What can't be fixed safely gets a suggested bug report that you send yourself. Outside content can't use the watch to silence anything: no source is paused, and only Maximus's own or already-seen items are set aside.
- **Connect a service in your own words.** "Connect to my office portal and keep an eye on it", "connect https://…/mcp", or a link under Connections. Maximus looks in the MCP registry, Smithery, GitHub, npm and PyPI, reads the instructions and shows a card or a plan: who wrote it, **official or unofficial**, where it runs, and every tool with whether it reads, writes, sends, pays or deletes. Nothing is connected or installed without your yes. When a question names a service you lack ("in Fortnox", "my CRM"), 1–3 servers from the registry are suggested under the answer.
- **The review.** A server whose texts try to steer the model (tool poisoning, hidden text) is not connected, and the card shows the line. The tool list is fingerprinted; if it changes after your yes, the connection is turned off until you review it again.
- **After yes.** Reading tools can be allowed to read without asking; anything that writes, sends, pays or deletes asks every time. Arguments are masked, every call is in Sent, and answers are fenced. Sign-in with OAuth in the browser, token in the keychain.
- **Servers that run on your Mac**, like an unofficial connection to an office portal for room booking: installed after an explicit yes, at a locked version with a checksum, in their own folder, with a clean environment and dependencies from the lock file. The README's commands are never run; a plan that pipes a script from the internet or wants sudo is stopped. "Keep an eye on it" becomes a task that reads the connection's listing tools. Remove takes everything away with one click.
- **Terms, version 8:** 4.3 a–b on connections.
- **The answer check.** Every answer is checked when it's done: that the steps you asked for are there and in order, that what you said not to mention isn't, that numbers and dates are in the material (the attachment, the source, what the tools read), that nothing is said to be booked, sent or created that isn't, and that the language and form are what you asked for. If something doesn't hold, the model gets one new attempt with exactly what was wrong ("step 3 is missing", "40 % is not in the material", "you haven't booked anything"). If it still doesn't hold, a line under the answer says what could not be verified — never silently. Applies to ordinary answers, the agent's tool loop, mail-reply suggestions, investigations, `/me` and the colleague's suggestions. Rules first; the local model only to confirm that a step is really missing. Settings → You → Answers → **Check the answers**: Default, Strict or Off.
- **Every release is tested against the real model.** Before a release, a test suite runs against the same local model you get (Gemma 4 12B), in Swedish and English: the agent's triage, digests, `/me`, the colleague's suggestions, reply drafts, investigations, the answer check, connections and prompt-injection attacks. A single attack that gets through blocks the release. The tests with fake models remain; this is the one with the real model.
- **Fixed:** an agent answer that said "suggest" (as in "I suggest Wednesday instead") was replaced entirely by "I haven't done or suggested anything." That rule now applies only to what is said to be done or proposed as an action.

---

## 1.0.2 — släpptes aldrig · never released

### Svenska

Den här versionen släpptes aldrig för sig; den väntade på Apples notarisering. Allt nedan finns med i **1.0.3 (beta)**.

**Nytt**

- **Flera mejlkonton och kalendrar, var och en med en etikett.** Välj valfritt antal konton, lådor per konto och kalendrar, i inställningarna och i starten. Varje källa får etiketten *Privat*, *Jobb*, en egen ("teamet") eller ingen. Etiketten avgör om ett fynd är jobb eller privat, i stället för att modellen gissar. Ett svar går alltid från kontot brevet kom till, och Maximus kontrollerar att avsändaren är en av kontots adresser innan Mail skickar. Mötesförslag hamnar i kalendern med samma etikett. Samtalen och `/fynd` går att filtrera på etiketten.
- **Underlaget följer med.** Varje fynd bär en referens till originalet (mejlet, kalenderposten, anteckningen, filen, meddelandet, sidan). När agenten tar upp något bifogar den ett kort per fynd: titel, källa, utdrag, **Visa hela** och **Öppna i Mail** (eller filen eller sidan). Följdfrågor läser samma original, inte 1 500 avklippta tecken.
- **Nyheter och LinkedIn-flödet som en sammanställning.** En sammanställning per varv, stycken per ämne med varför det angår dig och källorna under, i stället för ett fynd per artikel. Varje stycke prövas mot sina källor. Bara det som riktas mot dig (ditt namn, ditt företag, en kontakt, något du väntar på) blir ett eget fynd. Nyheter når aldrig telefonen om de inte riktas mot dig.
- **Agenten som kollega.** Förslag med skäl ur mejl, kalender, meddelanden och LinkedIn: svara, boka, hör av dig, följ upp. Varje förslag har skälet och underlaget, och är ett utkast du tar, ändrar eller avböjer. Inget skickas utan att du trycker Skicka, och Maximus tar aldrig kontakt med någon i ditt namn. Ett nej med skäl styr nästa förslag. Ber ett mejl om ett möte kommer "Boka in ett möte med …" direkt efter svaret, med tiden ur mejlet om den står där — annars väljer du den; Kalender frågar innan något sparas, och ingen inbjudan skickas.
- **Knack-knack.** Ibland en kort fråga för att hålla `/du` aktuell. Bara när du sitter vid datorn, aldrig i vila, under ett samtal, en diktering eller ett möte, högst en gång om dagen som förval, och aldrig till telefonen. Svaret blir en ändring i `/du` som sparas först efter ditt ja. Båda stängs av under Inställningar → Agenten → Handlingar.
- **`/du` (`/me`): vad Maximus vet om dig.** En sammanfattning, uppgift för uppgift, med varifrån varje uppgift kommer. Rätta i fri text ("jag har slutat på X", "lägg till att …", "glöm allt om Z"). Du ser exakt vad som ändras, före och efter, och ingenting ändras utan ja. "Glöm" tar också bort Z ur agentens egna lager.
- **Maskeringsvalet bara mot molnet.** Maskerat/Anonymiserat/Original visas och gäller bara när en molnmodell svarar. Mot den lokala modellen står det *Lokalt* på knappen, eftersom frågan inte lämnar datorn. Sökfrågor maskeras som förut.
- **Be assistenten maskera eller anonymisera.** "Maskera den här texten: …", "anonymisera bilagan", "maskera ditt senaste svar". Det görs på datorn, också med molnmodellen på, och du får texten, antal per sort och kartan.
- **Namnmodellen, maskeringens andra lager.** Efter reglerna läser en liten svensk/flerspråkig modell, nym-pii-multilingual-small (MIT, cirka 150 MB), det som saknar format: ovanliga namn, adresser, och i Strikt också orter och arbetsplatser. Den lägger bara till platshållare. Hämtas från en låst revision och kontrolleras med sha256. Allt som går ut väntar in den. Kan stängas av under Skydd → Vad som döljs.
- **Lov som saknas i macOS** visas på uppdragets rad, med knappen **Ge Maximus lov till …** som öppnar rätt ruta i Systeminställningar och kör uppdraget igen.
- **Appen säger till när den körs från skivavbilden** (DMG) och inte kan uppdatera sig, med en knapp som öppnar Program.
- **Versionsnoterna** i uppdateringsrutan visas som läsbar text på ditt språk.
- **Installation från Terminal** med `install.sh`: hämtar senaste släppet, kontrollerar sha256 och lägger appen i Program, utan Apples varning.
- **Ny appikon** i grafit, vitt och lila.

**Rättat**

- Uppdateringskollen frågar GitHubs manifest direkt. 1.0.0 frågade en adress som saknades, så installerade appar fick inte veta att 1.0.1 fanns.
- En nyhet som öppnades som samtal frågade om anonymisering och visade "0 uppgifter maskerade". En publik källa märks nu som publik och läggs omaskerad, utan fråga.
- Bilagans anonymiseringsknapp gick via molnet när det var påslaget. Nu alltid lokalt, som knappen lovar.
- Hela originalet granskas för styrning, inte bara utdraget, och ett mejl läses bara ur den låda du gett lov till.
- Låset tömmer också de nya minnena: förslag till `/du`, kollegans minne, dagens möten och namnmodellens fynd.
- Ett godkännande i `/du` gäller exakt det som visades; har något ändrats emellan nekas det.
- En notis per varv i stället för en per uppdrag. Ett samtal du börjar går före agentens arbete mot modellen, och ett varv har ett tak på sex minuter.
- Originalen läses tre åt gången med en tidsgräns, så att ett Mail som inte svarar inte håller upp agenten.
- Med riktiga Gemma: triagen på engelska svarade ibland med prosa i stället för JSON; `/du` kunde ta bort alla intressen eller hitta på datum; kollegan föreslog ibland svar på brev agenten redan svarat på. Svarsutkasten kunde börja med en förklaring, bära ditt namn under avslutningen eller ge ett "svar" på ett nätfiskebrev — nu börjar de med hälsningen, och ett brev som försöker styra modellen får inget förslag. `/du` kunde hitta på årtal i en ny uppgift (3 av 10) — nu 0 av 10. Undersökningen tar med fristen och priset ur underlaget, och ett svar som påstår att det byggt på ett verktyg som aldrig kördes får rätta sig.
- Gränssnittet: källans namn i stället för koden på korten, en tom rad i fyndlistan, källor som visades tre gånger i sammanställningen.

### English

This version was never released on its own; it waited for Apple notarization. Everything below ships in **1.0.3 (beta)**.

**New**

- **Several mail accounts and calendars, each with a label.** Pick any number of accounts, mailboxes per account and calendars, in Settings and in onboarding. Each source gets the label *Private*, *Work*, your own ("the team") or none. The label decides whether a finding is work or private, instead of the model guessing. A reply always goes from the account the mail came to, and Maximus checks that the sender is one of that account's addresses before Mail sends. Meeting proposals go to the calendar with the same label. Conversations and `/finds` filter by label.
- **The material comes along.** Every finding carries a reference to its original (the mail, calendar event, note, file, message, page). When the agent brings something up it attaches a card per finding: title, source, excerpt, **Show all** and **Open in Mail** (or the file or the page). Follow-up questions read the same original, not a 1,500-character clip.
- **News and the LinkedIn feed as a digest.** One digest per round, paragraphs per topic with why it matters to you and the sources underneath, instead of one finding per article. Every paragraph is checked against its sources. Only items aimed at you (your name, your company, a contact, something you're waiting for) become findings of their own. News never reaches the phone unless it is aimed at you.
- **The agent as a colleague.** Suggestions with reasons from mail, calendar, messages and LinkedIn: reply, schedule, get in touch, follow up. Each comes with its reason and material and is a draft you take, change or decline. Nothing is sent unless you press Send, and Maximus never contacts anyone in your name. Declining with a reason steers the next suggestions. When a mail asks for a meeting, "Schedule a meeting with …" follows the reply, with the time from the mail if it's there — otherwise you pick it; Calendar asks before anything is saved, and no invitation is sent.
- **Knock-knock.** Now and then a short question to keep `/me` current. Only when you're at the computer, never while resting, in a conversation, dictation or meeting, at most once a day by default, and never to the phone. Your answer becomes a change in `/me`, saved only after your yes. Both can be turned off under Settings → Agent → Actions.
- **`/me` (`/du`): what Maximus knows about you.** A summary, fact by fact, with where each fact came from. Correct it in plain words ("I've left X", "add that …", "forget everything about Z"). You see exactly what changes, before and after, and nothing changes without a yes. "Forget" also removes Z from the agent's own stores.
- **The masking choice only towards the cloud.** Masked/Anonymized/Original shows and applies only when a cloud model answers. With the local model the button says *Local*, because the question doesn't leave the computer. Search queries are masked as before.
- **Ask the assistant to mask or anonymize.** "Mask this text: …", "anonymize the attachment", "mask your last answer". Done on the Mac, also with the cloud model on, and you get the text, the count per kind and the map.
- **The name model, the masking's second layer.** After the rules, a small Swedish/multilingual model, nym-pii-multilingual-small (MIT, about 150 MB), reads what has no format: unusual names, addresses, and at Strict also places and workplaces. It only adds placeholders. Downloaded from a locked revision and checked with sha256. Everything that leaves waits for it. Can be turned off under Protection → What is hidden.
- **Missing macOS permissions** show on the task row, with **Give Maximus access to …**, which opens the right pane in System Settings and runs the task again.
- **The app tells you when it runs from the disk image** (DMG) and can't update itself, with a button that opens Applications.
- **Release notes** in the update dialog show as readable text in your language.
- **Install from Terminal** with `install.sh`: fetches the latest release, checks sha256 and puts the app in Applications, without Apple's warning.
- **New app icon** in graphite, white and lilac.

**Fixed**

- The update check asks GitHub's manifest directly. 1.0.0 asked an address that didn't exist, so installed apps never learned that 1.0.1 was out.
- A news item opened as a conversation asked about anonymization and showed "0 details masked". A public source is now marked public and added unmasked, without the question.
- The attachment's Anonymize button went through the cloud when it was on. Now always local, as the button promises.
- The whole original is checked for steering, not just the excerpt, and a mail is read only from the mailbox you allowed.
- Locking also clears the new in-memory stores: `/me` proposals, the colleague's memory, today's meetings and the name model's finds.
- A yes in `/me` applies to exactly what was shown; if anything changed in between, it is refused.
- One notification per round instead of one per task. A conversation you start takes precedence over the agent's work on the model, and a round is capped at six minutes.
- Originals are read three at a time with a time limit, so a Mail that doesn't answer doesn't hold up the agent.
- With real Gemma: English triage sometimes answered in prose instead of JSON; `/me` could remove all interests or invent dates; the colleague sometimes suggested replies to mail the agent had already drafted a reply for. Reply drafts could open with an explanation, carry your name under the sign-off or "answer" a phishing mail — now they start with the greeting, and a mail that tries to steer the model gets no draft. `/me` could invent years in a new fact (3 in 10) — now 0 in 10. The investigation keeps the deadline and the price from the material, and an answer that claims to rest on a tool that never ran has to correct itself.
- The interface: the source's name instead of its code on the cards, an empty line in the findings list, sources shown three times in the digest.

---

## 2026-10-10 — 1.0.1 (beta)

### Svenska

**Nytt**

- **Rapportera ett problem:** säg "det här fungerar inte" eller välj Rapportera ett problem i hjälpen. Maximus hjälper dig beskriva det, visar exakt vad som skickas och öppnar ett vanligt mejl i din Mail. Du trycker själv på Skicka. Inga samtal, filer eller namn följer med.
- **Svar på mejl:** agenten kan föreslå svar på mejl som väntar på besked. Du redigerar texten, ser mottagare och signatur och trycker Skicka; i tio sekunder går det att ångra. Av tills du slår på det.
- **Starten:** varje steg går att hoppa över, och "Hoppa över resten" avslutar direkt. Profilen kan skrivas med egna ord.
- **Agenten är av tills den har det den behöver** (en profil och minst en källa) och säger exakt vad som saknas.

Villkoren är version 6: "Maximus skickar aldrig något utan att du trycker Skicka." Appen är inte notariserad än; första starten kräver ett manuellt steg (se [README](../README.md#install)).

### English

**New**

- **Report a problem:** say "this doesn't work" or choose Report a problem in Help. Maximus helps you describe it, shows exactly what will be sent and opens a normal email in your Mail. You press Send yourself. No conversations, files or names go along.
- **Email replies:** the agent can suggest replies to mail that awaits an answer. You edit the text, see recipients and signature, and press Send; you can undo for ten seconds. Off until you turn it on.
- **Onboarding:** every step can be skipped, and "Skip the rest" finishes at once. Your profile can be written in your own words.
- **The agent stays off until it has what it needs** (a profile and at least one source) and says exactly what's missing.

The terms are version 6: "Maximus never sends anything without you pressing Send." The app is not notarized yet; the first launch needs one manual step (see the [README](../README.md#install)).

---

## 2026-10-09 — 1.0.0

### Svenska

Första publika versionen, fri och öppen källkod (Apache-2.0). En AI-arbetsyta som körs på din Mac: modellen, dina filer och dina svar stannar där. Agenten läser det du ger den lov till och säger till när något angår dig, och skickar aldrig något i ditt namn. Allt som lämnar datorn maskeras först och står under Skickat.

### English

The first public version, free and open source (Apache-2.0). An AI workspace that runs on your Mac: the model, your files and your answers stay there. The agent reads what you allow and tells you when something concerns you, and never sends anything in your name. Everything that leaves the computer is masked first and listed under Sent.
