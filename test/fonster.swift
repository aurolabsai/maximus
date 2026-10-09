// Provhjälp för Fas 26: räkna en process fönster på skärmen, och skicka den
// samma Apple-händelser som Dock skickar — "återöppna" (klick på ikonen) och
// "avsluta" (⌘Q).
//
//   swift test/fonster.swift fonster <pid>     → antal synliga fönster
//   swift test/fonster.swift ateroppna <pid>
//   swift test/fonster.swift avsluta <pid>

import Foundation
import CoreGraphics
import AppKit

let a = CommandLine.arguments
guard a.count == 3, let pid = Int32(a[2]) else { print("användning: fonster|ateroppna|avsluta <pid>"); exit(1) }

func skicka(_ id: AEEventID) {
    let mal = NSAppleEventDescriptor(processIdentifier: pid)
    let h = NSAppleEventDescriptor(eventClass: AEEventClass(kCoreEventClass), eventID: id, targetDescriptor: mal,
                                   returnID: AEReturnID(kAutoGenerateReturnID), transactionID: AETransactionID(kAnyTransactionID))
    do { _ = try h.sendEvent(options: [.noReply], timeout: 5); print("skickat") }
    catch { print("fel: \(error)"); exit(1) }
}

switch a[1] {
case "fonster":
    let lista = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
    print(lista.filter { ($0[kCGWindowOwnerPID as String] as? Int32) == pid && ($0[kCGWindowLayer as String] as? Int) == 0 }.count)
case "ateroppna": skicka(AEEventID(kAEReopenApplication))
case "avsluta": skicka(AEEventID(kAEQuitApplication))
default: print("okänt"); exit(1)
}
