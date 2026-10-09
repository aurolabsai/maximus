// Skrivhjälparen (Fas 32, 2026-10-05).
//
// Läsarna — kalender.swift, paminnelser.swift — skriver aldrig, och ett prov
// ser att verben saknas i dem. Den här filen är den enda som skriver i
// Kalender och Påminnelser, och den anropas bara efter ditt ja (eller ditt
// "får göra" för just den handlingen). Se lib/handlingar.mjs.
//
//   skriv.swift paminnelse '{"titel":"…","forfaller":"2026-10-06T09:00:00Z","lista":"…"}'
//   skriv.swift mote '{"titel":"…","start":"…","slut":"…","plats":"…","anteckning":"…"}'
//   skriv.swift ta-bort '<id>'       (ångra: det som skapades här)
//
// Svarar med JSON: { "id": "…" } eller { "fel": "…", "tillstand": true }.

import Foundation
import EventKit

let argv = CommandLine.arguments
guard argv.count >= 3 else { print("{\"fel\":\"saknar argument\"}"); exit(1) }
let vad = argv[1]
let store = EKEventStore()

func ut(_ o: [String: Any]) {
    let d = (try? JSONSerialization.data(withJSONObject: o)) ?? Data("{}".utf8)
    print(String(data: d, encoding: .utf8) ?? "{}")
}

func lov(_ typ: EKEntityType) -> Bool {
    let s = DispatchSemaphore(value: 0)
    var ok = false
    let svar: (Bool, Error?) -> Void = { j, _ in ok = j; s.signal() }
    if #available(macOS 14.0, *) {
        if typ == .reminder { store.requestFullAccessToReminders(completion: svar) }
        else { store.requestFullAccessToEvents(completion: svar) }
    } else { store.requestAccess(to: typ, completion: svar) }
    if s.wait(timeout: .now() + 20) == .timedOut { return false }
    return ok
}

func tid(_ s: Any?) -> Date? {
    guard let s = s as? String else { return nil }
    let a = ISO8601DateFormatter(); a.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = a.date(from: s) { return d }
    let b = ISO8601DateFormatter(); b.formatOptions = [.withInternetDateTime]
    if let d = b.date(from: s) { return d }
    let c = DateFormatter(); c.locale = Locale(identifier: "en_US_POSIX"); c.dateFormat = "yyyy-MM-dd'T'HH:mm"
    return c.date(from: s)
}

let data = (try? JSONSerialization.jsonObject(with: Data(argv[2].utf8))) as? [String: Any] ?? [:]

switch vad {
case "paminnelse":
    guard lov(.reminder) else { ut(["fel": "Maximus får inte skriva i Påminnelser.", "tillstand": true]); exit(2) }
    let r = EKReminder(eventStore: store)
    r.title = (data["titel"] as? String) ?? "Påminnelse"
    if let n = data["anteckning"] as? String { r.notes = n }
    let listor = store.calendars(for: .reminder)
    var lista = listor.first(where: { $0.title == (data["lista"] as? String) })
    // "skapaLista": listan skapas om den saknas, i samma konto som
    // förvalslistan (iCloud när det finns) — så att telefonen får den.
    if lista == nil, (data["skapaLista"] as? Bool) == true, let namn = data["lista"] as? String,
       let kalla = store.defaultCalendarForNewReminders()?.source {
        let ny = EKCalendar(for: .reminder, eventStore: store)
        ny.title = namn; ny.source = kalla
        if (try? store.saveCalendar(ny, commit: true)) != nil { lista = ny }
    }
    r.calendar = lista ?? store.defaultCalendarForNewReminders()
    if let d = tid(data["forfaller"]) {
        r.dueDateComponents = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: d)
        r.addAlarm(EKAlarm(absoluteDate: d))
    }
    do { try store.save(r, commit: true); ut(["id": r.calendarItemIdentifier]) }
    catch { ut(["fel": error.localizedDescription]); exit(1) }
case "mote":
    guard lov(.event) else { ut(["fel": "Maximus får inte skriva i Kalender.", "tillstand": true]); exit(2) }
    guard let start = tid(data["start"]) else { ut(["fel": "Starttiden saknas."]); exit(1) }
    let e = EKEvent(eventStore: store)
    e.title = (data["titel"] as? String) ?? "Möte"
    e.startDate = start
    e.endDate = tid(data["slut"]) ?? start.addingTimeInterval(3600)
    if let p = data["plats"] as? String { e.location = p }
    if let n = data["anteckning"] as? String { e.notes = n }
    e.calendar = store.defaultCalendarForNewEvents
    do { try store.save(e, span: .thisEvent, commit: true); ut(["id": e.calendarItemIdentifier]) }
    catch { ut(["fel": error.localizedDescription]); exit(1) }
case "ta-bort":
    let id = argv[2]
    _ = lov(.reminder); _ = lov(.event)
    if let x = store.calendarItem(withIdentifier: id) {
        do {
            if let r = x as? EKReminder { try store.remove(r, commit: true) }
            else if let e = x as? EKEvent { try store.remove(e, span: .thisEvent, commit: true) }
            ut(["borttagen": id])
        } catch { ut(["fel": error.localizedDescription]); exit(1) }
    } else { ut(["fel": "Finns inte längre."]); exit(1) }
default:
    ut(["fel": "Okänd handling."]); exit(1)
}
