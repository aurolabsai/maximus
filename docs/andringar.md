# Ändringar · Changelog

Nyast först. Varje version på svenska, sedan på engelska. Maximus är i beta.
Newest first. Each version in Swedish, then in English. Maximus is in beta.

Se också [vad Maximus gör](functionality.md), [FAQ](faq.md) och [säkerhet](security.md).

---

## 2026-10-11 — i `main`, inte släppt som app än · in `main`, not yet released

### Svenska

Allt nedan är sammanslaget och provat i `main`, men finns inte i appen du laddar ned i dag. Det släpps som **1.0.2 (beta)** när Apples notarisering är klar.

**Nytt**

- **Flera mejlkonton och kalendrar, var och en med en etikett.** Välj valfritt antal konton, lådor per konto och kalendrar, i inställningarna och i starten. Varje källa får etiketten *Privat*, *Jobb*, en egen ("styrelsen") eller ingen. Etiketten avgör om ett fynd är jobb eller privat, i stället för att modellen gissar. Ett svar går alltid från kontot brevet kom till, och Maximus kontrollerar att avsändaren är en av kontots adresser innan Mail skickar. Mötesförslag hamnar i kalendern med samma etikett. Samtalen och `/fynd` går att filtrera på etiketten.
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

Everything below is merged and tested in `main`, but not in the app you download today. It ships as **1.0.2 (beta)** once Apple notarization is done.

**New**

- **Several mail accounts and calendars, each with a label.** Pick any number of accounts, mailboxes per account and calendars, in Settings and in onboarding. Each source gets the label *Private*, *Work*, your own ("the board") or none. The label decides whether a finding is work or private, instead of the model guessing. A reply always goes from the account the mail came to, and Maximus checks that the sender is one of that account's addresses before Mail sends. Meeting proposals go to the calendar with the same label. Conversations and `/finds` filter by label.
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
