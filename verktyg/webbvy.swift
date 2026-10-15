
import Foundation
import AppKit
import WebKit
import Network

setvbuf(stdout, nil, _IOLBF, 0)

func skriv(_ svar: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: svar),
          let rad = String(data: data, encoding: .utf8) else { return }
    FileHandle.standardOutput.write((rad + "\n").data(using: .utf8)!)
}

func fel(_ id: Any, _ kod: String, _ teknik: String = "") {
    skriv(["id": id, "ok": false, "kod": kod, "teknik": teknik])
}

let GRINDREGLER = """
[{"trigger":{"url-filter":"^[a-z0-9+.-]+://[0-9.]+[:/]"},"action":{"type":"block"}},
 {"trigger":{"url-filter":"^[a-z0-9+.-]+://[0-9.]+$"},"action":{"type":"block"}},
 {"trigger":{"url-filter":"^[a-z0-9+.-]+://[^/]*@"},"action":{"type":"block"}},
 {"trigger":{"url-filter":"^[a-z0-9+.-]+://\\\\["},"action":{"type":"block"}},
 {"trigger":{"url-filter":"^[a-z0-9+.-]+://localhost[.:/]"},"action":{"type":"block"}},
 {"trigger":{"url-filter":"^[a-z0-9+.-]+://localhost$"},"action":{"type":"block"}},
 {"trigger":{"url-filter":"^file:"},"action":{"type":"block"}}]
"""
let ALLT = """
[{"trigger":{"url-filter":".*"},"action":{"type":"block"}}]
"""

var grindlista: WKContentRuleList? = nil
var alltlista: WKContentRuleList? = nil

let AVSTANGT = ["PeerConnectionEnabled", "WebTransportEnabled", "LinkDNSPrefetchEnabled",
                "LinkPreconnect", "LinkPreconnectEarlyHintsEnabled", "ServiceWorkersEnabled",
                "MediaDevicesEnabled", "LinkPrefetchEnabled", "SpeculationRulesPrefetchEnabled"]
let MASTE = ["PeerConnectionEnabled", "WebTransportEnabled", "ServiceWorkersEnabled"]

@discardableResult
func stangAv(_ p: WKPreferences) -> [String] {
    let klass = WKPreferences.self as AnyObject
    var funktioner: [NSObject] = []
    for urval in ["_features", "_experimentalFeatures", "_internalDebugFeatures"] where klass.responds(to: Selector((urval))) {
        if let f = klass.perform(Selector((urval)))?.takeUnretainedValue() as? [NSObject] { funktioner += f }
    }
    let satt = Selector(("_setEnabled:forFeature:"))
    let fraga = Selector(("_isEnabledForFeature:"))
    var av = Set<String>()
    for f in funktioner {
        guard let nyckel = f.value(forKey: "key") as? String, AVSTANGT.contains(nyckel),
              p.responds(to: satt), p.responds(to: fraga) else { continue }
        typealias Satt = @convention(c) (AnyObject, Selector, Bool, AnyObject) -> Void
        typealias Fraga = @convention(c) (AnyObject, Selector, AnyObject) -> Bool
        unsafeBitCast(p.method(for: satt), to: Satt.self)(p, satt, false, f)
        if !unsafeBitCast(p.method(for: fraga), to: Fraga.self)(p, fraga, f) { av.insert(nyckel) }
    }
    for (sel, nyckel) in [("_setPeerConnectionEnabled:", "PeerConnectionEnabled"), ("_setDNSPrefetchingEnabled:", "")] {
        let s = Selector((sel))
        guard p.responds(to: s) else { continue }
        typealias SattBool = @convention(c) (AnyObject, Selector, Bool) -> Void
        unsafeBitCast(p.method(for: s), to: SattBool.self)(p, s, false)
        if nyckel == "PeerConnectionEnabled", p.responds(to: Selector(("_peerConnectionEnabled"))),
           p.value(forKey: "_peerConnectionEnabled") as? Bool == false { av.insert(nyckel) }
    }
    return MASTE.filter { !av.contains($0) }
}

let ejAvstangt = stangAv(WKPreferences())

let UTAN_WEBRTC = """
(() => {
  const bort = ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCRtpSender',
    'RTCRtpReceiver', 'RTCRtpTransceiver', 'RTCIceCandidate', 'RTCSessionDescription', 'RTCDtlsTransport',
    'RTCIceTransport', 'RTCSctpTransport', 'RTCCertificate', 'RTCEncodedAudioFrame', 'RTCEncodedVideoFrame',
    'RTCRtpScriptTransform', 'WebTransport'];
  for (const k of bort) { try { delete window[k]; } catch (e) {} try { Object.defineProperty(window, k, { value: undefined, configurable: false, writable: false }); } catch (e) {} }
  try { Object.defineProperty(Navigator.prototype, 'mediaDevices', { get: () => undefined, configurable: false }); } catch (e) {}
  try { Object.defineProperty(Navigator.prototype, 'serviceWorker', { get: () => undefined, configurable: false }); } catch (e) {}
})();
"""

let regelkatalog = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent("maximus-webbvy-\(getpid())")
let regellager = WKContentRuleListStore(url: regelkatalog)!

func kompilera(_ namn: String, _ json: String, _ klar: @escaping (WKContentRuleList?) -> Void) {
    regellager.compileContentRuleList(forIdentifier: namn, encodedContentRuleList: json) { lista, e in
        if let e = e { FileHandle.standardError.write("regler \(namn): \(e)\n".data(using: .utf8)!) }
        klar(lista)
    }
}

final class Sida: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    let namn: String
    let vy: WKWebView
    let utanNat: Bool
    var svarId: Any? = nil
    var status: Int? = nil
    var nedladdning = false
    var inlagd = false
    var timer: Timer? = nil
    let kvar: [String]

    init(namn: String, proxy: (String, UInt16)?, utanNat: Bool) {
        self.namn = namn
        self.utanNat = utanNat
        let c = WKWebViewConfiguration()
        let lager = WKWebsiteDataStore.nonPersistent()
        if let (vard, port) = proxy, #available(macOS 14.0, *) {
            lager.proxyConfigurations = [ProxyConfiguration(httpCONNECTProxy:
                NWEndpoint.hostPort(host: NWEndpoint.Host(vard), port: NWEndpoint.Port(rawValue: port)!))]
        }
        c.websiteDataStore = lager
        c.preferences.javaScriptCanOpenWindowsAutomatically = false
        kvar = stangAv(c.preferences)
        c.userContentController.addUserScript(WKUserScript(source: UTAN_WEBRTC, injectionTime: .atDocumentStart,
                                                           forMainFrameOnly: false, in: .page))
        c.mediaTypesRequiringUserActionForPlayback = .all
        c.applicationNameForUserAgent = "Version/18.0 Safari/605.1.15"
        if let g = grindlista { c.userContentController.add(g) }
        if utanNat, let a = alltlista { c.userContentController.add(a) }
        vy = WKWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 900), configuration: c)
        super.init()
        let skript = WKUserScript(source: "window.webkit.messageHandlers.maximusTolkad.postMessage(1)",
                                  injectionTime: .atDocumentEnd, forMainFrameOnly: true, in: .defaultClient)
        c.userContentController.addUserScript(skript)
        c.userContentController.add(self, contentWorld: .defaultClient, name: "maximusTolkad")
        vy.navigationDelegate = self
    }

    func svara(_ svar: [String: Any]) {
        guard let id = svarId else { return }
        svarId = nil
        timer?.invalidate()
        var s = svar
        s["id"] = id
        skriv(s)
    }

    func klar() {
        if !utanNat, !["http", "https"].contains(vy.url?.scheme?.lowercased() ?? "") {
            svara(["ok": false, "kod": "natfel", "teknik": vy.url?.absoluteString ?? ""])
            return
        }
        svara(["ok": true, "sida": namn, "url": vy.url?.absoluteString ?? "",
               "titel": vy.title ?? "", "status": status ?? 0])
    }

    func userContentController(_ u: WKUserContentController, didReceive m: WKScriptMessage) {
        if m.frameInfo.isMainFrame && inlagd { klar() }
    }

    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let s = a.request.url?.scheme?.lowercased() ?? ""
        if !["http", "https", "about", "blob", "data"].contains(s) { decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }

    func webView(_ w: WKWebView, decidePolicyFor r: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if r.isForMainFrame, let h = r.response as? HTTPURLResponse { status = h.statusCode }
        if !r.canShowMIMEType { if r.isForMainFrame { nedladdning = true }; decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }

    func webView(_ w: WKWebView, didCommit n: WKNavigation!) { inlagd = true }
    func webView(_ w: WKWebView, didFinish n: WKNavigation!) { klar() }

    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { misslyckad(e) }
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { misslyckad(e) }

    func misslyckad(_ e: Error) {
        let ns = e as NSError
        if nedladdning { svara(["ok": false, "kod": "nedladdning", "teknik": ns.localizedDescription]); return }
        let kod = ns.domain == "WebKitErrorDomain" && ns.code == 104 ? "stoppad" : "natfel"
        svara(["ok": false, "kod": kod, "teknik": "\(ns.domain) \(ns.code): \(ns.localizedDescription)"])
    }

    func webView(_ w: WKWebView, didReceive c: URLAuthenticationChallenge,
                 completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if c.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
            completionHandler(.performDefaultHandling, nil)
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }

    func oppna(id: Any, url: URL?, html: String?, bas: URL?, timeout: Double) {
        svarId = id
        timer = Timer.scheduledTimer(withTimeInterval: timeout / 1000, repeats: false) { [weak self] _ in
            self?.svara(["ok": false, "kod": "tidsgrans", "teknik": ""])
            self?.vy.stopLoading()
        }
        if let html = html { vy.loadHTMLString(html, baseURL: bas) }
        else if let url = url { vy.load(URLRequest(url: url)) }
    }

    func stang() {
        timer?.invalidate()
        vy.stopLoading()
        vy.navigationDelegate = nil
        vy.configuration.userContentController.removeAllScriptMessageHandlers()
    }
}

var sidor: [String: Sida] = [:]
var nasta = 0

func hantera(_ rad: String) {
    guard let data = rad.data(using: .utf8),
          let u = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let id = u["id"], let typ = u["typ"] as? String else { return }
    switch typ {
    case "om":
        var proxy = false
        if #available(macOS 14.0, *) { proxy = true }
        skriv(["id": id, "ok": true, "proxy": proxy, "regler": grindlista != nil && alltlista != nil,
               "ejAvstangt": ejAvstangt])
    case "oppna":
        guard grindlista != nil, alltlista != nil else { fel(id, "regler"); return }
        guard ejAvstangt.isEmpty else { fel(id, "webrtc", ejAvstangt.joined(separator: ",")); return }
        let timeout = (u["timeout"] as? Double) ?? 25000
        nasta += 1
        let namn = "s\(nasta)"
        if let html = u["html"] as? String {
            let bas = (u["bas"] as? String).flatMap { URL(string: $0) }
            let s = Sida(namn: namn, proxy: nil, utanNat: true)
            guard s.kvar.isEmpty else { fel(id, "webrtc", s.kvar.joined(separator: ",")); return }
            sidor[namn] = s
            s.oppna(id: id, url: nil, html: html, bas: bas, timeout: timeout)
            return
        }
        guard let a = u["url"] as? String, let url = URL(string: a),
              ["http", "https"].contains(url.scheme?.lowercased() ?? "") else { fel(id, "adress"); return }
        guard #available(macOS 14.0, *) else { fel(id, "ingenProxy"); return }
        guard let p = u["proxy"] as? String, let i = p.lastIndex(of: ":"),
              let port = UInt16(p[p.index(after: i)...]) else { fel(id, "ingenProxy"); return }
        let s = Sida(namn: namn, proxy: (String(p[..<i]), port), utanNat: false)
        guard s.kvar.isEmpty else { fel(id, "webrtc", s.kvar.joined(separator: ",")); return }
        sidor[namn] = s
        s.oppna(id: id, url: url, html: nil, bas: nil, timeout: timeout)
    case "kor":
        guard let n = u["sida"] as? String, let s = sidor[n], let fn = u["fn"] as? String else { fel(id, "ingenSida"); return }
        let arg = (u["arg"] as? String) ?? "null"
        s.vy.callAsyncJavaScript("return JSON.stringify(await (\(fn))(JSON.parse(arg)))",
                                 arguments: ["arg": arg], in: nil, in: .defaultClient) { r in
            switch r {
            case .success(let v):
                let text = (v as? String) ?? "null"
                let varde = (try? JSONSerialization.jsonObject(with: text.data(using: .utf8)!, options: .fragmentsAllowed)) ?? NSNull()
                skriv(["id": id, "ok": true, "varde": varde, "url": s.vy.url?.absoluteString ?? ""])
            case .failure(let e):
                fel(id, "skript", e.localizedDescription)
            }
        }
    case "stang":
        if let n = u["sida"] as? String, let s = sidor.removeValue(forKey: n) { s.stang() }
        skriv(["id": id, "ok": true])
    case "slut":
        skriv(["id": id, "ok": true])
        exit(0)
    default:
        fel(id, "okand")
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)

kompilera("grind", GRINDREGLER) { g in
    grindlista = g
    kompilera("allt", ALLT) { a in
        alltlista = a
        try? FileManager.default.removeItem(at: regelkatalog)
        skriv(["redo": true, "regler": g != nil && a != nil])
        Thread.detachNewThread {
            while let rad = readLine(strippingNewline: true) {
                DispatchQueue.main.async { hantera(rad) }
            }
            exit(0)
        }
    }
}

app.run()
