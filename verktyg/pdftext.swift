
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
