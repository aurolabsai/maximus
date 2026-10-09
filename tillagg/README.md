# MAXIMUS för webbläsaren

**Två funktioner, och bara den ena behöver MAXIMUS installerat.**

## 1. Stäng ute privatkonton

Sätter de huvuden leverantörerna själva stöder:

| Tjänst | Huvud |
|---|---|
| ChatGPT | `ChatGPT-Allowed-Workspace-Id` |
| Claude | `anthropic-allowed-org-ids` |
| Microsoft | `Restrict-Access-To-Tenants` |

Ingen TLS-inspektion, ingen proxy, och tillägget läser inte ett tecken av
trafiken — webbläsaren sätter huvudet utan att visa det för oss. Det görs med
`declarativeNetRequest` och inte `webRequest` av just det skälet: ett tillägg
som KAN läsa trafiken till chatgpt.com är ett tillägg en säkerhetsavdelning
måste granska; ett som bara sätter ett huvud är det inte.

Anthropic beskriver själva varför en proxy inte räcker: *"Off the network, on a
personal laptop, on a phone tethered to home wifi, there's no proxy in the path
and nothing to inject."*

Kräver ingen MAXIMUS-installation. En IT-avdelning som bara vill stänga
privatkonton kan rulla ut tillägget ensamt.

## 2. Maskera innan sändning

Fångar texten i skrivrutan, skickar den till MAXIMUS på datorn, och lägger
tillbaka den maskerad. **Masken görs aldrig i webbläsaren.**

Det är inte en genväg utan hela poängen. En maskering kopierad in i ett
tillägg är en andra maskering att hålla i takt med den riktiga, och den dagen
de glider isär är det tillägget som släpper igenom ett personnummer.

**Den skickar inte åt dig.** Texten byts ut i rutan och tillägget stannar. Du
läser och skickar själv — ett påstående om vad som lämnar datorn som ingen
läst är ingen trygghet.

**Den fallerar stängt.** Svarar inte MAXIMUS blockeras sändningen. Ett tillägg som
släpper igenom omaskerad text när det inte når MAXIMUS gör precis det den finns
för att förhindra, i just det ögonblick den behövs.

### Parning

Tillägget kommer utifrån appens vanliga lås: det kan inte känna till
startnyckeln i adressfältet, och dess anrop är cross-site. Därför en kod som
användaren flyttar för hand, en gång:

**MAXIMUS → Inställningar → Kopplingar → Webbläsartillägg** → kopiera koden →
tilläggets inställningar → Para ihop.

Vägen koden öppnar kan **en** sak: maskera text. Inga sessioner, inga frågor,
ingen liggare. En kod på avvägar ska inte kunna bli en läsrättighet till någons
ärenden — och ett prov (`test/tillagg.test.mjs`) vaktar att vägen inte växer.

## Installera under utveckling

```
chrome://extensions → Utvecklarläge → Läs in okomprimerat → välj tillagg/
```

Fungerar i Chrome och Edge. En listning i Chrome Web Store täcker båda.

**Domänpublicering** ger snabbare granskning och undantag från Single
Purpose-policyn. **Tvångsinstallation via Intune** ger implicit beviljade
rättigheter — dialogen "läs och ändra dina data på chatgpt.com" visas aldrig
för användaren.

## Vad det inte gör

- Läser inte trafiken. Hyresgästspärren sätter ett huvud; den ser inget svar.
- Maskerar inte själv. Utan MAXIMUS på datorn är den funktionen avstängd.
- Skickar ingenting åt dig. Den byter ut texten och stannar.
- Skyddar inte mot att du klistrar in i en flik den inte känner till. Listan
  över sidor står i `manifest.json`.
