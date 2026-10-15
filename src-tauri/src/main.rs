
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{fs, io::{Read, Write}, net::{SocketAddr, TcpStream}, path::PathBuf, process::{Command, Stdio}, time::{Duration, Instant}};
use sha2::{Digest, Sha256};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

static AVSLUT: std::sync::OnceLock<(String, String)> = std::sync::OnceLock::new();

static SERVERN: std::sync::OnceLock<(PathBuf, bool)> = std::sync::OnceLock::new();

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const BUNT_ID: &str = "ai.aurolabs.maximus";

fn main() {
    if std::env::args().nth(1).as_deref() == Some("--notis") {
        std::process::exit(visa_notis());
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_sharekit::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let port = std::env::var("MAXIMUS_PORT").unwrap_or_else(|_| "3261".into());
            let portnummer: u16 = port.parse()?;
            let adress: SocketAddr = format!("127.0.0.1:{port}").parse()?;
            let ursprung = format!("http://127.0.0.1:{port}");

            let hem_tidigt = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .unwrap_or_default();
            let datakatalog = std::env::var("MAXIMUS_DATA").map(PathBuf::from).unwrap_or_else(|_| {
                if cfg!(target_os = "windows") {
                    std::env::var("APPDATA").map(PathBuf::from)
                        .unwrap_or_else(|_| PathBuf::from(&hem_tidigt).join("AppData/Roaming"))
                        .join("Maximus")
                } else {
                    PathBuf::from(&hem_tidigt).join("Library/Application Support/Maximus")
                }
            });

            let nyckel: String = match slumpa_hex(32) {
                Ok(n) => n,
                Err(e) => stoppa_med_fel("Maximus kunde inte starta",
                    &format!("Operativsystemet gav ingen slumpkälla för nyckeln ({e}).")),
            };

            let redan_uppe = TcpStream::connect_timeout(&adress, Duration::from_millis(300)).is_ok();
            let nyckel = if redan_uppe {
                fs::read_to_string(datakatalog.join("nyckel"))
                    .map(|s| s.trim().to_string())
                    .unwrap_or(nyckel)
            } else { nyckel };
            if redan_uppe {
                if let Err(e) = vanta_pa_identitet(&adress, &port, &nyckel, Duration::from_secs(5)) {
                    stoppa_med_fel(&format!("Port {port} är upptagen av något annat"), &e);
                }
            }
            let _ = AVSLUT.set((port.clone(), nyckel.clone()));
            let _ = SERVERN.set((datakatalog.clone(), !redan_uppe));
            let dold = std::env::args().any(|a| a == "--dold");

            if !redan_uppe {
                let resurser = app.path().resource_dir()?;
                let hem = hem_tidigt.clone();
                let data = datakatalog.clone();
                fs::create_dir_all(&data)?;
                let logg = fs::OpenOptions::new().create(true).append(true).open(data.join("server.log"))?;

                let stig = if cfg!(target_os = "windows") {
                    std::env::var("PATH").unwrap_or_default()
                } else {
                    format!("{hem}/.local/bin:{hem}/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin")
                };
                let node = resurser.join(if cfg!(target_os = "windows") {
                    "resources/node.exe"
                } else {
                    "resources/node"
                });
                let server = resurser.join("resources/backend");
                let barn = Command::new(node)
                    .arg(server.join("server.mjs"))
                    .arg("--tyst")
                    .current_dir(&server)
                    .env("PATH", stig)
                    .env("MAXIMUS_RESURSER", resurser.join("resources"))
                    .env("MAXIMUS_NYCKEL", &nyckel)
                    .env("MAXIMUS_FORALDER", std::process::id().to_string())
                    .env("MAXIMUS_PORT", &port)
                    .env("MAXIMUS_DATA", &data)
                    .env("MAXIMUS_APP", std::env::current_exe().map(|p| p.display().to_string()).unwrap_or_default())
                    .stdin(Stdio::null())
                    .stdout(logg.try_clone()?)
                    .stderr(logg)
                    .spawn()?;
                drop(barn);

                if let Err(e) = vanta_pa_identitet(&adress, &port, &nyckel, Duration::from_secs(60)) {
                    stoppa_med_fel("Maximus kunde inte starta", &format!(
                        "{e} Loggen ligger i {}.", data.join("server.log").display()));
                }
            }

            let start = format!("{ursprung}/?n={nyckel}");
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(start.parse()?))
                .title("Maximus")
                .inner_size(1280., 900.)
                .visible(!dold)
                .min_inner_size(760., 600.)
                .on_navigation(move |url| {
                    let egen = url.scheme() == "http"
                        && url.host_str() == Some("127.0.0.1")
                        && url.port() == Some(portnummer);
                    if !egen && ["https", "http", "mailto"].contains(&url.scheme()) {
                        oppna_utanfor(url.as_str());
                    }
                    egen
                })
                .on_new_window(|url, _| {
                    if ["https", "http"].contains(&url.scheme()) {
                        oppna_utanfor(url.as_str());
                    }
                    tauri::webview::NewWindowResponse::Deny
                })
                .on_download(move |_, handelse| {
                    match handelse {
                        tauri::webview::DownloadEvent::Requested { url, destination } => {
                            if url.host_str() != Some("127.0.0.1") || url.port() != Some(portnummer) { return false; }
                            let ext = match url.path().rsplit('.').next() {
                                Some("csv") => "csv", Some("json") => "json", Some("txt") => "txt",
                                Some("pdf") => "pdf",
                                _ => return false,
                            };
                            let hem = PathBuf::from(std::env::var("HOME").unwrap_or_default());
                            let ned = hem.join("Downloads");
                            if fs::create_dir_all(&ned).is_err() { return false; }
                            let stampel = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis();
                            *destination = ned.join(format!("maximus-liggare-{stampel}.{ext}"));
                        }
                        tauri::webview::DownloadEvent::Finished { path, success, .. } => {
                            if success {
                                if let Some(path) = path {
                                    #[cfg(target_os = "macos")]
                                    { let _ = Command::new("/usr/bin/open").arg("-R").arg(path).spawn(); }
                                    #[cfg(not(target_os = "macos"))]
                                    { let _ = path; }
                                }
                            }
                        }
                        _ => {}
                    }
                    true
                })
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Maximus kunde inte starta")
        .run(|app, handelse| match handelse {
            tauri::RunEvent::WindowEvent { event: tauri::WindowEvent::Destroyed, .. } => {
                app.exit(0);
            }
            tauri::RunEvent::Exit => stang_servern(),
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => {
                if let Some(f) = app.get_webview_window("main") {
                    let _ = f.show();
                    let _ = f.set_focus();
                }
            }
            _ => {}
        });
}

fn stang_servern() {
    if let Some((data, egen)) = SERVERN.get() {
        if !egen && data.join("bakgrund").exists() { return; }
    }
    let (port, nyckel) = match AVSLUT.get() {
        Some(v) => v.clone(),
        None => return,
    };
    let adress: SocketAddr = match format!("127.0.0.1:{port}").parse() {
        Ok(a) => a,
        Err(_) => return,
    };

    if vanta_pa_identitet(&adress, &port, &nyckel, Duration::from_secs(2)).is_err() { return; }

    if let Ok(mut s) = TcpStream::connect_timeout(&adress, Duration::from_millis(500)) {
        let _ = s.set_write_timeout(Some(Duration::from_millis(500)));
        let _ = write!(
            s,
            "POST /api/stang HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nX-Maximus-Local: 1\r\n\
             X-Maximus-Nyckel: {nyckel}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        );
        let _ = s.flush();
    }

    for _ in 0..30 {
        if TcpStream::connect_timeout(&adress, Duration::from_millis(100)).is_err() { return; }
        std::thread::sleep(Duration::from_millis(100));
    }
}

fn las_notis(indata: &str) -> Option<(String, String)> {
    let v: serde_json::Value = serde_json::from_str(indata).ok()?;
    let falt = |k: &str| v.get(k).and_then(|x| x.as_str()).map(|s| s.chars().take(200).collect::<String>());
    let (titel, text) = (falt("titel")?, falt("text").unwrap_or_default());
    if titel.trim().is_empty() && text.trim().is_empty() { return None; }
    Some((titel, text))
}

fn visa_notis() -> i32 {
    let mut indata = String::new();
    if std::io::stdin().take(16384).read_to_string(&mut indata).is_err() { return 2; }
    let Some((titel, text)) = las_notis(&indata) else { return 2 };
    #[cfg(target_os = "macos")]
    {
        let _ = mac_notification_sys::set_application(BUNT_ID);
        match mac_notification_sys::send_notification(&titel, None, &text, None) {
            Ok(_) => 0,
            Err(e) => { eprintln!("MAXIMUS: notisen gick inte fram ({e})."); 1 }
        }
    }
    #[cfg(not(target_os = "macos"))]
    { let _ = (titel, text); 2 }
}

fn slumpa_hex(n: usize) -> Result<String, String> {
    let mut r = vec![0u8; n];
    getrandom::fill(&mut r).map_err(|e| e.to_string())?;
    Ok(hex(&r))
}

fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{x:02x}")).collect() }

fn fran_hex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 { return None; }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(s.get(i..i + 2)?, 16).ok()).collect()
}

fn hmac_sha256(nyckel: &[u8], data: &[u8]) -> [u8; 32] {
    let mut k = [0u8; 64];
    if nyckel.len() > 64 {
        k[..32].copy_from_slice(&Sha256::digest(nyckel));
    } else {
        k[..nyckel.len()].copy_from_slice(nyckel);
    }
    let mut inre = Sha256::new();
    inre.update(k.map(|b| b ^ 0x36));
    inre.update(data);
    let inre = inre.finalize();
    let mut yttre = Sha256::new();
    yttre.update(k.map(|b| b ^ 0x5c));
    yttre.update(inre);
    yttre.finalize().into()
}

fn lika_konstant(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

enum Identitet { Ratt, Fel(String), Tyst }

fn fraga_identitet(adress: &SocketAddr, port: &str, nyckel: &str) -> Identitet {
    let utmaning = match slumpa_hex(32) {
        Ok(u) => u,
        Err(e) => return Identitet::Fel(format!("Ingen slumpkälla: {e}.")),
    };
    let mut s = match TcpStream::connect_timeout(adress, Duration::from_millis(500)) {
        Ok(s) => s,
        Err(_) => return Identitet::Tyst,
    };
    let _ = s.set_write_timeout(Some(Duration::from_secs(3)));
    let _ = s.set_read_timeout(Some(Duration::from_secs(5)));
    if write!(s, "GET /api/identitet?utmaning={utmaning} HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n").is_err() {
        return Identitet::Tyst;
    }
    let mut svar = Vec::new();
    if s.take(65536).read_to_end(&mut svar).is_err() || svar.is_empty() {
        return Identitet::Fel("Den som svarar på porten gav inget svar på Maximus fråga.".into());
    }
    let svar = String::from_utf8_lossy(&svar);
    let (huvud, kropp) = svar.split_once("\r\n\r\n").unwrap_or((&svar, ""));
    let status_ok = huvud.lines().next()
        .map(|r| r.split_whitespace().nth(1) == Some("200")).unwrap_or(false);
    let bevis = serde_json::from_str::<serde_json::Value>(kropp.trim()).ok()
        .and_then(|v| v.get("svar").and_then(|x| x.as_str()).map(str::to_string))
        .and_then(|h| fran_hex(&h));
    let vantat = hmac_sha256(nyckel.as_bytes(), utmaning.as_bytes());
    match bevis {
        Some(b) if status_ok && lika_konstant(&b, &vantat) => Identitet::Ratt,
        _ => Identitet::Fel("Den som svarar på porten kunde inte visa att den är Maximus, så nyckeln \
             skickades inte dit. Avsluta programmet som använder porten — eller en äldre Maximus som \
             kör i bakgrunden — och öppna Maximus igen.".into()),
    }
}

fn vanta_pa_identitet(adress: &SocketAddr, port: &str, nyckel: &str, tid: Duration) -> Result<(), String> {
    let slut = Instant::now() + tid;
    loop {
        match fraga_identitet(adress, port, nyckel) {
            Identitet::Ratt => return Ok(()),
            Identitet::Fel(e) => return Err(e),
            Identitet::Tyst if Instant::now() >= slut =>
                return Err(format!("Servern svarade inte på port {port}.")),
            Identitet::Tyst => std::thread::sleep(Duration::from_millis(200)),
        }
    }
}

fn stoppa_med_fel(rubrik: &str, text: &str) -> ! {
    eprintln!("MAXIMUS: {rubrik}. {text}");
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("/usr/bin/osascript")
            .args(["-e", "on run argv\ndisplay alert (item 1 of argv) message (item 2 of argv) as critical\nend run",
                   "--", rubrik, text])
            .status();
    }
    std::process::exit(1);
}

fn oppna_utanfor(adress: &str) {
    #[cfg(target_os = "macos")]
    { let _ = Command::new("/usr/bin/open").arg(adress).spawn(); }
    #[cfg(not(target_os = "macos"))]
    { eprintln!("MAXIMUS: att öppna länkar utanför fönstret stöds bara på macOS i version 1.0 ({adress})."); }
}

#[cfg(test)]
mod prov {
    use super::*;

    #[test]
    fn hmac_stammer() {
        assert_eq!(hex(&hmac_sha256(b"nyckel-i-provet", b"00112233445566778899aabbccddeeff")),
            "f602aaab612dc0ed22f96fa321113497c7e529711acabc6d093baaddd0258923");
        assert_eq!(hex(&hmac_sha256(b"Jefe", b"what do ya want for nothing?")),
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
        assert_eq!(hex(&hmac_sha256(&[0xaa; 131], b"Test Using Larger Than Block-Size Key - Hash Key First")),
            "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54");
    }

    #[test]
    fn notisens_indata() {
        assert_eq!(las_notis(r#"{"titel":"Fynd","text":"Tre nya"}"#), Some(("Fynd".into(), "Tre nya".into())));
        assert_eq!(las_notis(r#"{"titel":"-NSQuitAlwaysKeepsWindows YES"}"#).map(|v| v.0),
            Some("-NSQuitAlwaysKeepsWindows YES".into()));
        assert_eq!(las_notis(&format!(r#"{{"titel":"{}","text":"x"}}"#, "å".repeat(500))).map(|v| v.0.chars().count()), Some(200));
        assert_eq!(las_notis("inte json"), None);
        assert_eq!(las_notis(r#"{"text":"utan rubrik"}"#), None);
        assert_eq!(las_notis(r#"{"titel":" ","text":""}"#), None);
    }

    #[test]
    fn identiteten_stammer() {
        let konf: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(konf["identifier"].as_str(), Some(BUNT_ID));
    }

    #[test]
    fn jamforelse_och_hex() {
        assert!(lika_konstant(b"abc", b"abc"));
        assert!(!lika_konstant(b"abc", b"abd"));
        assert!(!lika_konstant(b"abc", b"abcd"));
        assert_eq!(fran_hex("00ff10"), Some(vec![0, 255, 16]));
        assert_eq!(fran_hex("0"), None);
        assert_eq!(fran_hex("zz"), None);
        assert_eq!(slumpa_hex(32).unwrap().len(), 64);
    }
}
