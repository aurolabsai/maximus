// Påminnelser, lästa på den här datorn (2026-10-05).
//
// Auro: "vi måste även koppla på Påminnelser! Det är den biten som saknas."
//
// Samma väg som kalender.swift: EventKit, Apples egen väg in. Påminnelser är
// en egen sort i EventKit och ett eget tillstånd i macOS — ja till Kalender
// är inte ja till Påminnelser — så den har en egen hjälpare och en egen
// fråga.
//
// ── Läser. Aldrig skriver ─────────────────────────────────────────────────
//
// EKEventStore kan spara och radera påminnelser. Den här filen anropar
// ingenting av det: bara tillståndsfrågan, predikaten och fetchReminders.
// Ett test ser efter att verben inte finns.

import Foundation
import EventKit

let argv = CommandLine.arguments
// paminnelser.swift [dagar]
//   Öppna påminnelser, och de som bockats av de senaste `dagar` dagarna
//   (förval 7) — "klart" är också något agenten kan behöva veta.
let dagar = argv.count > 1 ? (Double(argv[1]) ?? 7) : 7

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
    store.requestFullAccessToReminders(completion: svar)
} else {
    store.requestAccess(to: .reminder, completion: svar)
}
// Samma tidsgräns som kalendern: en fråga macOS inte kan visa besvaras
// aldrig, och en hjälpare som hänger är värre än en som säger nej.
if vanta.wait(timeout: .now() + 20) == .timedOut {
    felet = "Påminnelser svarade inte på tillståndsfrågan. Ge Maximus tillstånd i Systeminställningar → Integritet och säkerhet → Påminnelser."
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
    ut(["fel": felet ?? "Maximus fick inte läsa Påminnelser.", "tillstand": true] as [String: Any])
    exit(2)
}

let listor = store.calendars(for: .reminder)
let skriv = ISO8601DateFormatter()

func hamta(_ p: NSPredicate) -> [EKReminder] {
    var ut: [EKReminder] = []
    let s = DispatchSemaphore(value: 0)
    store.fetchReminders(matching: p) { r in ut = r ?? []; s.signal() }
    _ = s.wait(timeout: .now() + 30)
    return ut
}

let oppna = hamta(store.predicateForIncompleteReminders(withDueDateStarting: nil, ending: nil, calendars: listor))
let klara = hamta(store.predicateForCompletedReminders(
    withCompletionDateStarting: Date().addingTimeInterval(-dagar * 86400), ending: Date(), calendars: listor))

ut((oppna + klara).map { r -> [String: Any] in
    var o: [String: Any] = [
        "id": r.calendarItemIdentifier,
        "titel": r.title ?? "(utan rubrik)",
        "lista": r.calendar?.title ?? "",
        "klar": r.isCompleted,
        "prio": r.priority,
    ]
    if let d = r.dueDateComponents, let t = Calendar.current.date(from: d) {
        o["forfaller"] = skriv.string(from: t)
        o["heldag"] = d.hour == nil
    }
    if let t = r.completionDate { o["klarDa"] = skriv.string(from: t) }
    if let t = r.lastModifiedDate { o["andrad"] = skriv.string(from: t) }
    if let t = r.creationDate { o["skapad"] = skriv.string(from: t) }
    if let t = r.notes, !t.isEmpty { o["text"] = t }
    return o
})
