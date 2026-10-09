// Text ur en PDF, med macOS egen PDFKit.
//
// Förut läste `pdftotext` (poppler) PDF:erna, och poppler finns inte på en
// Mac som inte har Homebrew. Den som installerade Maximus och drog in sin
// första PDF möttes av "Be IT installera poppler" (Fas 22, 2026-10-04).
// PDFKit ligger i operativsystemet, läser samma filer, och kompileras till
// ett eget litet program när appen packas — se scripts/hamta-verktyg.mjs.
//
// Sidorna skiljs med en sidbrytning (\f), som pdftotext gjorde, så att
// städningen i lib/dokument.mjs känner igen dem.
//
// Kör helt lokalt. Ingenting lämnar datorn.

import Foundation
import PDFKit

let args = CommandLine.arguments
guard args.count > 1 else {
    FileHandle.standardError.write("Ange en PDF.\n".data(using: .utf8)!)
    exit(2)
}
guard let dok = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
    FileHandle.standardError.write("PDF-filen går inte att läsa. Är den skadad eller tom?\n".data(using: .utf8)!)
    exit(3)
}
if dok.isLocked {
    FileHandle.standardError.write("PDF-filen är lösenordsskyddad.\n".data(using: .utf8)!)
    exit(4)
}

var ut = ""
for i in 0..<dok.pageCount {
    if let sida = dok.page(at: i), let text = sida.string {
        ut += text
    }
    if i < dok.pageCount - 1 { ut += "\n\u{0C}\n" }
}
FileHandle.standardOutput.write(ut.data(using: .utf8)!)
