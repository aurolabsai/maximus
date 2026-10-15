
import Foundation
import EventKit

let argv = CommandLine.arguments
let vad = argv.count > 1 ? argv[1] : "handelser"

let store = EKEventStore()
let vanta = DispatchSemaphore(value: 0)
var slapptIn = false
var felet: String? = nil

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
    ut(kalendrar.map { ["namn": avRymd($0.title), "id": $0.calendarIdentifier, "konto": avRymd($0.source?.title ?? "")] })
    exit(0)
}

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
            "kalenderId": h.calendar?.calendarIdentifier ?? "",
            "heldag": h.isAllDay,
        ]
        if let s = h.startDate { r["start"] = skriv.string(from: s) }
        if let s = h.endDate { r["slut"] = skriv.string(from: s) }
        if let p = h.location, !p.isEmpty { r["plats"] = p }
        if let t = h.notes, !t.isEmpty { r["text"] = t }
        if let d = h.attendees, !d.isEmpty {
            r["deltagare"] = d.compactMap { $0.name ?? $0.url.absoluteString }
        }
        return r
    })
