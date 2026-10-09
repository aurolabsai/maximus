// Diktering på datorn (Fas 42). Läser ljud på stdin — 16 kHz, mono,
// 16-bitars PCM, little endian — och skriver en JSON-rad per resultat:
//
//   {"text":"…","klar":false}   tillfälligt, kan ändras medan du talar
//   {"text":"…","klar":true}    fastställt
//   {"slut":true}               stdin stängd och allt utskrivet
//
// Apples DictationTranscriber (SpeechAnalyzer, macOS 26). Den kör på
// datorn; SpeechTranscriber kan inte svenska än. Ljudet kommer från appen,
// så hjälparen behöver aldrig mikrofonen själv.
//
//   swift verktyg/diktera.swift [sv-SE] ['["Nordal","Maximus"]']
import Speech
import AVFoundation
import Foundation

func skriv(_ d: [String: Any]) {
  if let j = try? JSONSerialization.data(withJSONObject: d), let s = String(data: j, encoding: .utf8) {
    FileHandle.standardOutput.write((s + "\n").data(using: .utf8)!)
  }
}
func fel(_ t: String) -> Never { skriv(["fel": t]); exit(1) }

let sprak = Locale(identifier: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "sv-SE")
// Felen på dikteringens språk: engelska för en-*, annars svenska.
let engelska = sprak.identifier.hasPrefix("en")
func sag(_ sv: String, _ en: String) -> String { engelska ? en : sv }
let klar = DispatchSemaphore(value: 0)

Task {
  do {
    guard let locale = await DictationTranscriber.supportedLocale(equivalentTo: sprak) else { fel(sag("Språket stöds inte för diktering: \(sprak.identifier)", "This language is not supported for dictation: \(sprak.identifier)")) }
    let tr = DictationTranscriber(locale: locale, contentHints: [], transcriptionOptions: [.punctuation],
                                  reportingOptions: [.volatileResults], attributeOptions: [])
    // Språkmodellen hämtas en gång, av macOS, om den inte redan finns.
    if let begar = try await AssetInventory.assetInstallationRequest(supporting: [tr]) {
      skriv(["laddar": true]); try await begar.downloadAndInstall()
    }
    let analys = SpeechAnalyzer(modules: [tr])
    // Egna ord (namn, företag, projekt) som ledtrådar: utan dem blev
    // "Nordal" "Kalix". Kommer som JSON-lista i andra argumentet.
    if CommandLine.arguments.count > 2, let d = CommandLine.arguments[2].data(using: .utf8),
       let ord = try? JSONSerialization.jsonObject(with: d) as? [String], !ord.isEmpty {
      let ctx = AnalysisContext()
      ctx.contextualStrings[.general] = Array(ord.prefix(200))
      try await analys.setContext(ctx)
    }
    guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [tr]) else { fel(sag("Inget ljudformat.", "No audio format available.")) }
    let (strom, matning) = AsyncStream<AnalyzerInput>.makeStream()
    let lasare = Task {
      for try await r in tr.results {
        skriv(["text": String(r.text.characters), "klar": r.isFinal])
      }
    }
    try await analys.start(inputSequence: strom)
    skriv(["redo": true])
    let in16 = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!
    guard let omvandla = AVAudioConverter(from: in16, to: format) else { fel(sag("Kan inte omvandla ljudet.", "Cannot convert the audio.")) }
    let stdin = FileHandle.standardInput
    while true {
      let data = stdin.readData(ofLength: 3200)   // 100 ms
      if data.isEmpty { break }
      let n = AVAudioFrameCount(data.count / 2)
      guard let buf = AVAudioPCMBuffer(pcmFormat: in16, frameCapacity: n) else { continue }
      buf.frameLength = n
      data.withUnsafeBytes { p in memcpy(buf.int16ChannelData![0], p.baseAddress!, data.count) }
      let ut = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(Double(n) * format.sampleRate / 16000) + 64)!
      var given = false
      var err: NSError?
      omvandla.convert(to: ut, error: &err) { _, status in
        if given { status.pointee = .noDataNow; return nil }
        given = true; status.pointee = .haveData; return buf
      }
      if ut.frameLength > 0 { matning.yield(AnalyzerInput(buffer: ut)) }
    }
    matning.finish()
    try await analys.finalizeAndFinishThroughEndOfInput()
    _ = await lasare.result
    skriv(["slut": true])
  } catch { fel("\(error.localizedDescription)") }
  klar.signal()
}
klar.wait()
