<!--
version: 8
datum: 2026-10-11
-->
# Villkor för Maximus

Version 8 · gäller från 11 oktober 2026

## 1. Parter och vad det här är

1.1 Villkoren gäller mellan Aurolabs AB ("Aurolabs") och den som installerar och använder Maximus ("du"). Använder du Maximus i en verksamhet godkänner du villkoren för verksamhetens räkning.

1.2 Maximus är ett program som körs på din dator. Språkmodellerna körs lokalt. Det du skriver, de filer du lägger till och de svar du får stannar på datorn, med de undantag som står i avsnitt 4.

## 2. Licensen

2.1 Maximus är gratis och öppen källkod under Apache License 2.0 (Apache-2.0). Du får installera och använda Maximus utan kostnad och utan tidsgräns, för dig själv och i din verksamhet.

2.2 Källkoden får läsas, ändras och delas enligt Apache-2.0. Licenstexten följer med källkoden och gäller före det som står här om de skulle säga olika saker om koden.

2.3 Namnet och märket Maximus tillhör Aurolabs. Apache-2.0 ger ingen rätt att använda dem för en ändrad version.

2.4 Språk- och talmodellerna (till exempel Gemma, Qwen, Llama och Whisper) är andras verk och hämtas från sina utgivare. De lyder under sina egna licenser, som Maximus visar när du väljer modell.

## 3. Ditt material

3.1 Det du skapat i Maximus låses aldrig in. Det går alltid att läsa och exportera.

## 4. Vad som lämnar datorn

4.1 Ingenting av ditt innehåll skickas till Aurolabs. Aurolabs ser inte dina frågor, svar, filer, e-post, kalender eller anteckningar.

4.2 Maximus kontaktar Aurolabs bara för att:
- fråga om det finns en ny version, och hämta den, om du valt det. Då skickas versionsnummer och plattform — inget som skiljer din dator från en annan.

4.3 Maximus hämtar modeller och webbinnehåll från andra när du ber om det: modellfiler från sina utgivare (också den namnmodell som hjälper maskeringen), och — om du slagit på webbsök, sidor eller kopplingar — sökfrågor, sidor och bilder från internet. Ett uppdrag du gett agenten kan söka och läsa sidor på egen hand, så länge uppdraget gäller. Namn och nummer byts ut i sökfrågorna innan de lämnar datorn, och det som går ut bokförs i liggaren på din dator, rad för rad.

4.3 a) Kopplingar (MCP). Du kan koppla in en tjänst till Maximus genom att ge en länk, eller genom att be om det ("koppla dig mot min …"). Agenten kan också föreslå en koppling när en fråga eller ett uppdrag behöver något Maximus saknar. Den letar då i MCP-projektets officiella register, i katalogen Smithery och i källkod och paket på GitHub, npm och PyPI. Sökordet är tjänstens namn och står i liggaren. Ingenting kopplas in och ingenting installeras innan du sagt ja på ett kort som visar vem som gett ut kopplingen, om den är officiell eller inofficiell, var den körs och vilka verktyg den har. En koppling vars texter försöker styra modellen kopplas inte in.

4.3 b) En koppling som körs hos någon annan får de verktygsanrop agenten eller du gör, med namn och nummer maskerade som i sökfrågorna, och varje anrop står i liggaren. En koppling som installeras på din dator är program skrivet av någon annan som körs som du. Den installeras först efter ditt uttryckliga ja, i en egen mapp, med låst version och kontrollsumma, och kan tas bort med ett klick. Inloggningar och nycklar ligger i datorns nyckelring. Verktyg som skriver, skickar, betalar eller raderar körs bara efter ditt ja varje gång, enligt 5.2. Aurolabs ger inte ut och ansvarar inte för kopplingar från andra; det du godkänner gäller mellan dig och den som ger ut kopplingen och tjänsten den når.

4.4 Liggaren är hashkedjad, så att en ändrad eller borttagen dag syns. Den går inte att tömma från appen.

## 5. Dina källor och agenten

5.1 Maximus läser Mail, Kalender, Påminnelser, Anteckningar, Meddelanden, samtalslistan och mappar på din dator bara om du ger tillstånd, och bara det du pekat ut. Läsningen sker på datorn.

5.2 Agenten kan föreslå att göra saker åt dig: skapa en påminnelse, lägga in ett möte, lägga ett mejlutkast i Utkast, föreslå ett svar på ett mejl, skriva en anteckning i den mapp du valt och köra en genväg du själv byggt. En handling görs först när du sagt ja — eller utan att fråga, om du valt "får göra" för just den sortens handling. Påminnelser och möten går att ångra från Maximus.

5.3 Maximus skickar aldrig något utan att du trycker Skicka. Agenten kan föreslå svar på mejl, men ett förslag är text i Maximus: inget skrivs i Mail och inget skickas förrän du själv trycker Skicka. Skicka är en knapp bara du kan trycka på. Agenten och modellen kan inte trycka på den, och text i ett mejl, ett dokument, en sida eller ett svar kan inte utlösa den. Det som skickas är exakt den text du ser när du trycker. Efter tryckningen har du tio sekunder att ångra; ångrar du, eller stängs Maximus under tiden, skickas ingenting. Sedan skapar Mail ett svar på det ursprungliga brevet, från ditt konto och med den signatur som visades, om någon, och skickar det. Det som skickats står i liggaren. Meddelanden (iMessage och SMS) skickar Maximus aldrig.

5.4 Du ansvarar för de handlingar du godkänner, för de svar du skickar och för de sorter av handlingar du låter agenten göra utan att fråga. Vad en genväg gör bestäms av genvägen, inte av Maximus.

5.5 Väljer du att agenten ska köra i bakgrunden startas den när du loggar in och arbetar också när appen är stängd. Du stänger av det under Inställningar → Agenten.

5.6 Agenten sorterar efter dina uppdrag och kan ta fel. Det den lagt åt sidan står kvar med skäl, så att du kan se efter.

5.7 Agenten kan föreslå vad du kan göra, med skälet och underlaget: till exempel svara på ett mejl, boka ett möte eller höra av dig till någon. Ett förslag är ett utkast. Inget skickas och ingen kontaktas i ditt namn utan att du själv gör det, enligt 5.2 och 5.3. Ibland ställer agenten en kort fråga om dig när du sitter vid datorn, för att hålla det Maximus vet om dig aktuellt. Frågan går aldrig till telefonen, och både förslagen och frågorna stängs av under Inställningar → Agenten → Handlingar.

## 6. Personuppgifter

6.1 Du är personuppgiftsansvarig för de uppgifter du behandlar i Maximus. Eftersom innehållet aldrig når Aurolabs är Aurolabs inte ditt personuppgiftsbiträde för det innehållet.

6.2 Den som använder Maximus lämnar inga personuppgifter till Aurolabs.

6.3 Du ansvarar för att din användning är laglig — till exempel att du får behandla de uppgifter du lägger in, och att webbsök slås på bara där det är tillåtet.

6.4 Med /du ser du vad Maximus vet om dig och varifrån varje uppgift kommer. Du kan lägga till, ändra och ta bort uppgifter. En ändring görs först när du sagt ja, och det du tar bort raderas ur Maximus egna filer på datorn. Dina svar på agentens frågor sparas på samma sätt, först efter ditt ja.

## 7. Modellens svar och ansvar

7.1 Svaren skrivs av en språkmodell. De kan vara fel, ofullständiga eller inaktuella, också när de låter säkra. Maximus är ett stöd för ditt arbete, inte ett beslut. Kontrollera det du ska agera på.

7.2 Maximus levereras i befintligt skick. Aurolabs ansvarar inte för indirekta skador, som utebliven vinst, förlorad data eller beslut som fattats på ett svar.

7.3 Maximus är gratis och Aurolabs ansvarar inte för skada som uppstår genom användningen, utom vid uppsåt eller grov vårdslöshet.

7.4 Ta säkerhetskopior. Glömmer du lösenordet eller koden till en förseglad session kan ingen — inte heller Aurolabs — öppna innehållet.

## 8. Uppdateringar och ändringar

8.1 Aurolabs ger ut nya versioner av Maximus. Du väljer om Maximus ska fråga efter dem, och en ny version installeras bara när du sagt ja.

8.2 Varje version är signerad av Aurolabs, och Maximus installerar bara en version vars signatur stämmer.

8.3 Ändras villkoren i sak frågar Maximus om ditt godkännande innan du fortsätter.

## 9. Avtalstid och uppsägning

9.1 Villkoren gäller så länge du använder Maximus.

9.2 Du kan sluta använda Maximus när som helst. Ditt material ligger kvar på din dator.

## 10. Konsumenter

10.1 Använder du Maximus som privatperson gäller de rättigheter du har enligt tvingande konsumentlagstiftning, oavsett vad som står ovan.

## 11. Tillämplig lag och tvist

11.1 Svensk lag gäller. Tvist avgörs av allmän domstol med Stockholms tingsrätt som första instans, om inte tvingande regler säger något annat.

## 12. Kontakt

Aurolabs AB · aurolabs.ai/maximus
