// Textigenkänning via Apples Vision-ramverk.
//
// Varför inte en bildmodell: ingen VL-modell finns på disk, och att hämta en
// kostar flera gigabyte för ett arbete macOS redan gör bättre. Köparen
// klistrar in en skärmbild av ett mejl, ett beslut, en faktura eller en
// tabell — inte ett fotografi av en solnedgång. Det är textigenkänning som
// behövs, och den ligger i operativsystemet.
//
// Kör helt lokalt. Ingenting lämnar datorn, vilket är hela produktens löfte.

import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count > 1, let bild = NSImage(contentsOfFile: args[1]),
      let cg = bild.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("Kunde inte läsa bilden.\n".data(using: .utf8)!)
    exit(2)
}

let begaran = VNRecognizeTextRequest()
begaran.recognitionLevel = .accurate
// Svenska först. Engelska som andraspråk, eftersom ett svenskt dokument ofta
// bär engelska termer och produktnamn.
begaran.recognitionLanguages = ["sv-SE", "en-US"]
begaran.usesLanguageCorrection = true

let hanterare = VNImageRequestHandler(cgImage: cg, options: [:])
do {
    try hanterare.perform([begaran])
} catch {
    FileHandle.standardError.write("Textigenkänningen misslyckades: \(error)\n".data(using: .utf8)!)
    exit(3)
}

guard let traffar = begaran.results else { exit(0) }

// Raderna byggs ur koordinaterna, inte ur Visions ordning.
//
// Vision läser en tabell kolumnvis: först alla perioder, sedan alla
// omfattningar, sedan alla beslut. Då tappas kopplingen mellan dem — och i
// ett beslut är det just raden som betyder något. "1 mars–31 augusti,
// 50 procent, beviljas" blir tre lösryckta uppgifter.
//
// Träffarna grupperas därför efter y-läge och sorteras efter x inom varje
// grupp. Toleransen är halva radhöjden: två block på samma rad kan skilja
// några punkter i höjd utan att vara olika rader.
struct Block {
    let text: String
    let x: CGFloat
    let y: CGFloat
    let h: CGFloat
}

var block: [Block] = []
for t in traffar {
    guard let basta = t.topCandidates(1).first else { continue }
    // Under 0,3 i tillförlitlighet är det oftast brus — en logotyp, en kant,
    // en skugga. Att släppa igenom brus är värre än att tappa ett ord.
    if basta.confidence < 0.3 { continue }
    let r = t.boundingBox
    block.append(Block(text: basta.string, x: r.minX, y: r.midY, h: r.height))
}

// Vision räknar y nedifrån och upp. Vi vill uppifrån och ned.
block.sort { $0.y > $1.y }

var rader: [String] = []
var aktuell: [Block] = []
for b in block {
    if let forsta = aktuell.first, abs(forsta.y - b.y) > max(forsta.h, b.h) * 0.5 {
        rader.append(aktuell.sorted { $0.x < $1.x }.map { $0.text }.joined(separator: "  "))
        aktuell = []
    }
    aktuell.append(b)
}
if !aktuell.isEmpty {
    rader.append(aktuell.sorted { $0.x < $1.x }.map { $0.text }.joined(separator: "  "))
}
print(rader.joined(separator: "\n"))
