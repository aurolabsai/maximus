
use serde::Deserialize;
use std::io::{BufRead, Write};
use std::time::Instant;
use tract_onnx::prelude::*;

#[derive(Deserialize)]
struct Fraga {
    id: u64,
    ids: Vec<i64>,
}

const TAK_TOKEN: usize = 8192;

fn base64(b: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::with_capacity(b.len().div_ceil(3) * 4);
    for c in b.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        s.push(A[(n >> 18) as usize & 63] as char);
        s.push(A[(n >> 12) as usize & 63] as char);
        s.push(if c.len() > 1 { A[(n >> 6) as usize & 63] as char } else { '=' });
        s.push(if c.len() > 2 { A[n as usize & 63] as char } else { '=' });
    }
    s
}

fn json(v: serde_json::Value) {
    let mut ut = std::io::stdout().lock();
    let _ = writeln!(ut, "{v}");
    let _ = ut.flush();
}

#[derive(Clone, Copy, PartialEq)]
enum Ingang {
    Ids,
    Mask,
    Typ,
}

fn ladda(fil: &str) -> TractResult<(Arc<TypedRunnableModel>, Vec<Ingang>, Vec<String>)> {
    let mut m = tract_onnx::onnx()
        .with_ignore_output_shapes(true)
        .with_ignore_value_info(true)
        .model_for_path(fil)?;
    let s = m.symbols.sym("S");
    let mut ingangar = vec![];
    let mut namn = vec![];
    for i in 0..m.input_outlets()?.len() {
        let n = m.node(m.input_outlets()?[i].node).name.clone();
        ingangar.push(match n.as_str() {
            "input_ids" => Ingang::Ids,
            "attention_mask" => Ingang::Mask,
            "token_type_ids" => Ingang::Typ,
            _ => return Err(TractError::msg(format!("okänd ingång {n}"))),
        });
        namn.push(n);
        m.set_input_fact(i, i64::fact([1.to_dim(), s.to_dim()]).into())?;
    }
    if !ingangar.contains(&Ingang::Ids) {
        return Err(TractError::msg("modellen saknar input_ids".to_string()));
    }
    let r = m.into_optimized()?.into_runnable()?;
    Ok((r, ingangar, namn))
}

fn kor(m: &Arc<TypedRunnableModel>, ingangar: &[Ingang], ids: &[i64]) -> TractResult<(Vec<usize>, Vec<f32>)> {
    let n = ids.len();
    if n == 0 || n > TAK_TOKEN {
        return Err(TractError::msg(format!("{n} token")));
    }
    let mut in_: TVec<TValue> = tvec![];
    for g in ingangar {
        let t: Tensor = match g {
            Ingang::Ids => tract_ndarray::Array2::from_shape_vec((1, n), ids.to_vec())?.into_tensor(),
            Ingang::Mask => tract_ndarray::Array2::<i64>::ones((1, n)).into_tensor(),
            Ingang::Typ => tract_ndarray::Array2::<i64>::zeros((1, n)).into_tensor(),
        };
        in_.push(t.into());
    }
    let ut = m.run(in_)?;
    let t = ut[0].cast_to::<f32>()?;
    Ok((t.shape().to_vec(), t.to_plain_array_view::<f32>()?.iter().copied().collect()))
}

fn main() {
    let arg: Vec<String> = std::env::args().collect();
    let Some(fil) = arg.get(1) else {
        json(serde_json::json!({ "fel": "ange en modellfil" }));
        std::process::exit(2);
    };
    let tradar: usize = std::env::var("MAXIMUS_MODELL_TRADAR").ok().and_then(|t| t.parse().ok()).unwrap_or(1).clamp(1, 8);
    if tradar > 1 {
        tract_linalg::multithread::set_default_executor(tract_linalg::multithread::Executor::multithread(tradar));
    }
    let t0 = Instant::now();
    let (m, ingangar, namn) = match ladda(fil) {
        Ok(x) => x,
        Err(e) => {
            json(serde_json::json!({ "fel": format!("{e:#}") }));
            std::process::exit(1);
        }
    };
    json(serde_json::json!({ "klar": true, "ingangar": namn, "ms": t0.elapsed().as_millis() as u64 }));

    for rad in std::io::stdin().lock().lines() {
        let Ok(rad) = rad else { break };
        if rad.trim().is_empty() {
            continue;
        }
        let f: Fraga = match serde_json::from_str(&rad) {
            Ok(f) => f,
            Err(e) => {
                json(serde_json::json!({ "fel": format!("trasig fråga: {e}") }));
                continue;
            }
        };
        match kor(&m, &ingangar, &f.ids) {
            Ok((form, data)) => {
                let b: Vec<u8> = data.iter().flat_map(|x| x.to_le_bytes()).collect();
                json(serde_json::json!({ "id": f.id, "form": form, "data": base64(&b) }));
            }
            Err(e) => json(serde_json::json!({ "id": f.id, "fel": format!("{e:#}") })),
        }
    }
}
