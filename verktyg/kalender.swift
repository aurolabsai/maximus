// Kalendern, läst på den här datorn.
//
// AppleScript klarar det här på papperet och inte i praktiken. Mätt
// 2026-09-28 på elva kalendrar: sexton sekunder för en vecka som innehöll
// noll händelser, och trettio för ±60 dagar. Kostnaden ligger i att varje
// `every event of c whose ...` tvingar Kalender att gå igenom hela
// kalendern, och prenumererade kalendrar — helgdagar, födelsedagar,
// Siri-förslag — är stora. Några av dem svarar dessutom -1728 på den
// pluralform som är knepet för att göra AppleScript snabbt.
//
// EventKit är samma uppgift mot ett index i stället för mot en app. Det är
// Apples egen väg in, och den tar millisekunder.
//
// ── Läser. Aldrig skriver ─────────────────────────────────────────────────
//
// EKEventStore kan spara och radera händelser. Den här filen anropar
// ingenting av det: bara requestFullAccessToEvents, predicateForEvents och
// events(matching:). Den som granskar filen ska kunna se att verben inte
// finns, och ett test ser efter.
//
// Tillstånd frågas en gång av macOS. Säger användaren nej finns ingen
// kalender, och det är ett fullgott svar.

import Foundation
import EventKit

let argv = CommandLine.arguments
// kalender.swift <vad> [fran-iso] [till-iso]
//   vad = "kalendrar"  → namnen på kalendrarna
//   vad = "handelser"  → händelserna i fönstret
let vad = argv.count > 1 ? argv[1] : "handelser"

let store = EKEventStore()
let vanta = DispatchSemaphore(value: 0)
var slapptIn = false
var felet: String? = nil

// macOS 14 bytte namn på frågan. Appen ska fungera från macOS 12 (se
// tauri.conf.json), och när hjälparen kompileras i förväg (Fas 22) måste
// båda vägarna finnas.
let svar: (Bool, Error?) -> Void = { ok, fel in
    slapptIn = ok
    if let f = fel { felet = f.localizedDescription }
    vanta.signal()
}
if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents(completion: svar)
} else {
    store.requestAccess(to: .event, completion: svar)
}
// Tidsgräns på tillståndsfrågan.
//
// Kan macOS inte visa dialogen — för att anropet kommer från ett skal utan
// gränssnitt, eller för att svaret redan är nej på systemnivå — svarar
// requestFullAccessToEvents aldrig, och semaforen väntar i evighet. En
// hjälpprocess som hänger är värre än en som säger nej: den som väntar på
// ett svar får en snurra utan slut.
if vanta.wait(timeout: .now() + 20) == .timedOut {
    felet = "Kalendern svarade inte på tillståndsfrågan. Ge MAXIMUS tillstånd i Systeminställningar → Integritet och säkerhet → Kalendrar."
    slapptIn = false
}

func ut(_ o: Any) {
    guard let d = try? JSONSerialization.data(withJSONObject: o, options: []),
          let s = String(data: d, encoding: .utf8) else {
        print("{\"fel\":\"kunde inte skriva svaret\"}")
        exit(1)
    }
    print(s)
}

if !slapptIn {
    ut(["fel": felet ?? "MAXIMUS fick inte läsa Kalender.", "tillstand": true] as [String: Any])
    exit(2)
}

// Namnen kommer ibland HTML-rymda ur kalendrar som importerats från andra
// tjänster: "Me, myself &amp; I". Det är lagrat så, inte ett fel här — men
// användaren skrev ett &, och det är det hon ska få se.
func avRymd(_ s: String) -> String {
    var t = s
    for (fran, till) in [("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"),
                         ("&quot;", "\""), ("&#39;", "'"), ("&apos;", "'")] {
        t = t.replacingOccurrences(of: fran, with: till)
    }
    return t
}

let kalendrar = store.calendars(for: .event)

if vad == "kalendrar" {
    ut(kalendrar.map { ["namn": avRymd($0.title), "id": $0.calendarIdentifier] })
    exit(0)
}

// Node skriver ISO med millisekunder — "2026-09-28T13:42:07.123Z" — och
// .withInternetDateTime ensamt läser inte bråkdelen. Parsningen föll då
// tyst tillbaka på ett sjudagarsfönster från nu, vilket såg ut som att
// kalendern var tom. Ett tyst fel som ser ut som ett riktigt svar är värre
// än ett fel som syns.
//
// Därför två försök, och en avslutning om ingen av dem bet: hellre säga att
// datumet inte gick att läsa än att svara på en annan fråga än den ställda.
func tolkaTid(_ s: String) -> Date? {
    let medBrak = ISO8601DateFormatter()
    medBrak.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = medBrak.date(from: s) { return d }
    let utan = ISO8601DateFormatter()
    utan.formatOptions = [.withInternetDateTime]
    return utan.date(from: s)
}

let nu = Date()
var fran = nu
var till = nu.addingTimeInterval(7 * 86400)
if argv.count > 2 {
    guard let d = tolkaTid(argv[2]) else {
        ut(["fel": "Kunde inte läsa starttiden: \(argv[2])"] as [String: Any]); exit(1)
    }
    fran = d
}
if argv.count > 3 {
    guard let d = tolkaTid(argv[3]) else {
        ut(["fel": "Kunde inte läsa sluttiden: \(argv[3])"] as [String: Any]); exit(1)
    }
    till = d
}

// Fönstret är ett krav, inte en bekvämlighet: EventKit vill ha ett spann och
// blir långsamt utan det, precis som allt annat som läser en kalender.
let predikat = store.predicateForEvents(withStart: fran, end: till, calendars: kalendrar)
let handelser = store.events(matching: predikat)

let skriv = DateFormatter()
skriv.dateFormat = "yyyy-MM-dd'T'HH:mm"
skriv.locale = Locale(identifier: "en_US_POSIX")

ut(handelser
    .sorted { ($0.startDate ?? Date.distantPast) < ($1.startDate ?? Date.distantPast) }
    .map { h -> [String: Any] in
        var r: [String: Any] = [
            "rubrik": avRymd(h.title ?? "(utan rubrik)"),
            "kalender": avRymd(h.calendar?.title ?? ""),
            "heldag": h.isAllDay,
        ]
        if let s = h.startDate { r["start"] = skriv.string(from: s) }
        if let s = h.endDate { r["slut"] = skriv.string(from: s) }
        if let p = h.location, !p.isEmpty { r["plats"] = p }
        if let t = h.notes, !t.isEmpty { r["text"] = t }
        // Vilka som är kallade. Namnen är persondata och går genom grinden
        // som allt annat — men utan dem är ett möte bara en rubrik.
        if let d = h.attendees, !d.isEmpty {
            r["deltagare"] = d.compactMap { $0.name ?? $0.url.absoluteString }
        }
        return r
    })
