Maximus 1.0.4 (beta) — 15 oktober 2026

Rättat
• Modellen stängs nu helt när du stänger Maximus, i stället för att ibland
  bli kvar och ta minne.
• Exempeltexterna i appen och hjälpen är skrivna om.

---

Maximus 1.0.4 (beta) — October 15, 2026

Fixed
• The model now shuts down fully when you quit Maximus, instead of sometimes
  staying behind and using memory.
• The example texts in the app and the help are rewritten.

Maximus 1.0.3 (beta) — 12 oktober 2026

Nytt
• Koppla in en tjänst med egna ord: "koppla dig mot min Fortnox och håll koll
  på det", eller en länk till en MCP-server. Maximus letar, läser
  instruktionerna och visar vem som skrivit den, officiell eller inofficiell,
  och vad varje verktyg gör. Inget kopplas in utan ditt ja, och allt som
  skriver, skickar, betalar eller raderar frågar varje gång.
• Skydd mot promptinjektion: ett mejl, en sida eller en fil som gömmer
  instruktioner till AI:n får inte styra något. En tur som läst främmande
  text gör ingenting själv, och värden ur texten märks med sin källa.
• Kontrollen: varje svar prövas mot det du bad om, mot underlaget och mot
  det som faktiskt gjorts. Håller det inte står en rad under svaret om vad
  som inte kunde kontrolleras. Inställningar → Du → Svaren.
• Vakten: Maximus lagar fel av känd sort själv — egna påminnelser som kommer
  tillbaka, en plötslig flod, en modell som inte svarar, ett lov som
  försvunnit, loopar — och säger vad den gjorde.
• Inget från Microsoft: modellerna för maskering och skydd körs av en egen
  liten motor (tract) som inte kan nå nätet, och webben läses med macOS egen
  WebKit. Inget laddas ned från Microsoft och Bing är borttagen ur
  sökmotorerna. Appen är omkring 90 MB mindre.
• Notiser i Maximus namn också när fönstret är stängt.
• Namnmodellen erbjuds också dig som uppdaterar.
• Villkoren version 8: kopplingarna (4.3 a–b) och, från 1.0.2, förslagen,
  knack-knack och /du. Du godkänner dem en gång när appen startar.

Också med (det som skulle blivit 1.0.2)
• Flera mejlkonton och kalendrar, var och en med en etikett: Privat, Jobb
  eller egen. Ett svar går alltid från kontot mejlet kom till.
• Nyheter och LinkedIn-flödet som en sammanställning per varv.
• Underlaget med: ett kort per sak, med Visa hela och Öppna i Mail.
• Agenten som kollega: förslag med skäl. Inget skickas utan att du trycker
  Skicka. Ibland en kort knack-knack-fråga, bara när du sitter vid datorn.
• /du (/me): vad Maximus vet om dig, och rättelser du godkänner.
• Maskerat/Anonymiserat syns bara när en molnmodell svarar, och en svensk
  namnmodell som maskeringens andra nivå.
• Saknas ett lov i macOS, eller försvann det vid uppdateringen, visar
  Maximus vilket, med en knapp till rätt ruta.
• Ny appikon i grafit, vitt och lila.

Rättat
• Svaret säger inte längre att något är skapat när det bara är ett förslag
  som väntar på ditt ja.
• Samtalet: en sida som nämner "AI" stryks inte längre som ett försök att
  styra modellen, ingen sökning görs när frågan saknar ämne, under svaret
  står bara källor svaret bygger på, inklistrad text klassas inte som känslig
  för en lagtext i sidfoten, och fynden säger "du" om dig.
• Ikonen i notiserna följer med efter en uppdatering.
• Appen säger till när den körs från skivavbilden. Versionsnoterna visas som
  läsbar text.
• Säkerhetsrättelser i maskeringen, låset, /du och webbhämtningen.

---

Maximus 1.0.3 (beta) — 12 October 2026

New
• Connect a service in your own words: "connect to my Fortnox and keep an eye
  on it", or a link to an MCP server. Maximus looks, reads the instructions
  and shows who wrote it, official or unofficial, and what every tool does.
  Nothing is connected without your yes, and anything that writes, sends,
  pays or deletes asks every time.
• Protection against prompt injection: a mail, page or file that hides
  instructions for the AI can't steer anything. A turn that has read foreign
  text does nothing by itself, and values from the text are marked with
  their source.
• The answer check: every answer is checked against what you asked, the
  material and what was actually done. If it doesn't hold, a line under the
  answer says what could not be verified. Settings → You → Answers.
• The watch: Maximus fixes known kinds of error itself — its own reminders
  coming back, a sudden flood, a model that doesn't answer, a permission
  gone, loops — and says what it did.
• Nothing from Microsoft: the masking and protection models run on a small
  engine of our own (tract) that cannot reach the network, and the web is read
  with macOS's own WebKit. Nothing is downloaded from Microsoft, and Bing is
  gone from the search engines. The app is about 90 MB smaller.
• Notifications in Maximus' name also when the window is closed.
• The name model is offered to those who update too.
• Terms version 8: connections (4.3 a–b) and, from 1.0.2, the suggestions,
  knock-knock and /me. You accept them once when the app starts.

Also included (what would have been 1.0.2)
• Several mail accounts and calendars, each with a label: Private, Work or
  your own. A reply always goes from the account the mail came to.
• The news and your LinkedIn feed as one digest per round.
• The material comes along: a card per item, with Show all and Open in Mail.
• The agent as a colleague: suggestions with reasons. Nothing is sent unless
  you press Send. Now and then a short knock-knock question, only when
  you're at the computer.
• /me (/du): what Maximus knows about you, and corrections you approve.
• Masked/Anonymized only shows when a cloud model answers, and a Swedish
  name model as the masking's second layer.
• When a macOS permission is missing, or went missing in the update,
  Maximus shows which, with a button to the right pane.
• A new app icon in graphite, white and lilac.

Fixed
• An answer no longer says something was created when it is only a proposal
  waiting for your yes.
• Chat: a page that mentions "AI" is no longer struck as an attempt to steer
  the model, no search is made when the question has no topic, only sources
  the answer uses are listed under it, pasted text is not marked sensitive
  because of a law in its footer, and findings call you "you".
• The notification icon follows along after an update.
• The app tells you when it runs from the disk image. Release notes show as
  readable text.
• Security fixes in masking, the lock, /me and web fetching.
