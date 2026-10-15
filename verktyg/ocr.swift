
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

struct Block {
    let text: String
    let x: CGFloat
    let y: CGFloat
    let h: CGFloat
}

var block: [Block] = []
for t in traffar {
    guard let basta = t.topCandidates(1).first else { continue }
    if basta.confidence < 0.3 { continue }
    let r = t.boundingBox
    block.append(Block(text: basta.string, x: r.minX, y: r.midY, h: r.height))
}

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
