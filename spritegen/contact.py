"""Write sprites-preview.html — the review page for every generated frame.

Self-contained (JSON inlined) so it opens straight from the filesystem.
Shows, per animation: the composite the engine will draw (albedo + additive
emissive + a fake bloom pass), the raw albedo, and the 60px silhouette test.
"""
from __future__ import annotations

import base64
import json
from pathlib import Path

HTML = """<!doctype html>
<html lang="pt-BR"><meta charset="utf-8">
<title>Spacerocker — contact sheet</title>
<style>
 @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600&display=swap');
 :root{--void:#05060D;--hull:#2A2F3E;--signal:#FF2E88;--coolant:#00E5FF;}
 *{box-sizing:border-box}
 body{margin:0;background:var(--void);color:#C9D1E4;
      font:400 14px/1.5 'Chakra Petch',system-ui,sans-serif;padding:32px 40px 80px}
 h1{font-size:34px;letter-spacing:-.02em;margin:0 0 4px;color:#fff}
 h1 b{color:var(--signal);font-weight:600}
 .sub{color:#6C7690;margin:0 0 28px}
 .bar{position:sticky;top:0;background:rgba(5,6,13,.94);padding:12px 0 16px;
      border-bottom:1px solid #1B2030;margin-bottom:24px;z-index:9;
      display:flex;gap:10px;align-items:center;flex-wrap:wrap}
 button{background:#141A28;color:#C9D1E4;border:1px solid #232B3D;padding:7px 14px;
        border-radius:3px;font:inherit;cursor:pointer}
 button.on{background:var(--coolant);color:#02131a;border-color:var(--coolant)}
 h2{font-size:20px;margin:34px 0 2px;color:#fff;letter-spacing:-.01em}
 .meta{color:#6C7690;font-size:12px;margin-bottom:12px}
 .row{display:flex;gap:14px;flex-wrap:wrap}
 .cell{background:#0A0D16;border:1px solid #171D2B;border-radius:3px;padding:10px}
 .cell .lbl{font-size:11px;color:#6C7690;margin-bottom:6px;display:flex;
            justify-content:space-between;gap:14px}
 canvas{display:block;image-rendering:auto;background:
   repeating-conic-gradient(#0B0F1A 0 25%,#0E131F 0 50%) 0 0/16px 16px}
 .sil canvas{background:#EDEEF2}
</style>
<h1>SPACEROCKER <b>·</b> contact sheet</h1>
<p class="sub">Every atlas present, animated at the real in-game fps.
The silhouette row tests readability at 60px.</p>
<div class="bar">
  <button data-mode="comp" class="on">Composite (engine)</button>
  <button data-mode="albedo">Albedo</button>
  <button data-mode="emissive">Emissive</button>
  <button data-mode="sil">Silhouette 60px</button>
  <span style="color:#6C7690;font-size:12px">__COUNT__ frames</span>
</div>
<div id="app"></div>
<script>
const DATA = __DATA__;
let MODE = 'comp';
const imgs = {};
function load(src){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src;});}

async function boot(){
  for (const a of DATA.atlases){
    imgs[a.name] = {alb: await load(a.albedo), emi: await load(a.emissive)};
  }
  render();
  document.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    MODE=b.dataset.mode;
    document.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
  });
  requestAnimationFrame(tick);
}

const players = [];
function render(){
  const app = document.getElementById('app');
  for (const a of DATA.atlases){
    for (const [ent, e] of Object.entries(a.entities)){
      const h2 = document.createElement('h2'); h2.textContent = a.label+' · '+ent;
      const m = document.createElement('div'); m.className='meta';
      m.textContent = e.frameSize.w+'×'+e.frameSize.h+' px'
        + (e.hp!==undefined? ' · HP '+e.hp : '')
        + (e.hitRadius!==undefined? ' · hitRadius '+e.hitRadius : '');
      const row = document.createElement('div'); row.className='row';
      for (const [st, an] of Object.entries(e.animations)){
        const cell = document.createElement('div'); cell.className='cell';
        const lbl = document.createElement('div'); lbl.className='lbl';
        lbl.innerHTML='<span>'+st+'</span><span>'+an.frames.length+'f · '+an.fps+'fps</span>';
        const c = document.createElement('canvas');
        const sc = Math.min(1.5, 190/Math.max(e.frameSize.w,e.frameSize.h));
        c.width = Math.round(e.frameSize.w*sc); c.height = Math.round(e.frameSize.h*sc);
        cell.append(lbl,c); row.append(cell);
        players.push({c, ctx:c.getContext('2d'), atlas:a.name, frames:an.frames,
                      fps:an.fps, loop:an.loop, t:0, i:0, cell, sc});
      }
      app.append(h2,m,row);
    }
  }
}

let last = performance.now();
function tick(now){
  const dt = (now-last)/1000; last = now;
  for (const p of players){
    p.t += dt;
    const step = 1/p.fps;
    while (p.t > step){ p.t -= step; p.i = (p.i+1) % p.frames.length; }
    draw(p);
  }
  requestAnimationFrame(tick);
}

function draw(p){
  const A = DATA.atlases.find(a=>a.name===p.atlas);
  const f = A.frames[p.frames[p.i]].frame;
  const g = p.ctx, W = p.c.width, H = p.c.height;
  p.cell.classList.toggle('sil', MODE==='sil');
  g.clearRect(0,0,W,H);
  g.globalCompositeOperation='source-over'; g.filter='none';
  const im = imgs[p.atlas];
  if (MODE==='albedo'){ g.drawImage(im.alb,f.x,f.y,f.w,f.h,0,0,W,H); return; }
  if (MODE==='emissive'){ g.fillStyle='#05060D'; g.fillRect(0,0,W,H);
    g.globalCompositeOperation='lighter'; g.drawImage(im.emi,f.x,f.y,f.w,f.h,0,0,W,H); return; }
  if (MODE==='sil'){
    const o = document.createElement('canvas'); o.width=60; o.height=60;
    const oc = o.getContext('2d'); oc.drawImage(im.alb,f.x,f.y,f.w,f.h,0,0,60,60);
    oc.globalCompositeOperation='source-in'; oc.fillStyle='#080A12'; oc.fillRect(0,0,60,60);
    g.fillStyle='#EDEEF2'; g.fillRect(0,0,W,H);
    g.imageSmoothingEnabled=false; g.drawImage(o,0,0,W,H); g.imageSmoothingEnabled=true;
    return;
  }
  g.fillStyle='#05060D'; g.fillRect(0,0,W,H);
  g.drawImage(im.alb,f.x,f.y,f.w,f.h,0,0,W,H);
  g.globalCompositeOperation='lighter';
  g.filter='blur(6px)'; g.drawImage(im.emi,f.x,f.y,f.w,f.h,0,0,W,H);
  g.filter='none'; g.drawImage(im.emi,f.x,f.y,f.w,f.h,0,0,W,H);
}
boot();
</script>
</html>"""


def _data_uri(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


LABELS = {
    "common": "Player + power-ups", "act1": "Act I", "act2": "Act II",
    "act3": "Act III", "boss_hexapod": "BOSS 1 - HEXAPOD",
    "boss_basilisk": "BOSS 2 - BASILISK",
    "boss_ouroboros": "BOSS 3 - OUROBOROS",
}
ORDER = list(LABELS)


def _present(out_dir: Path) -> list[str]:
    """Every atlas actually sitting in out_dir, in reading order."""
    names = {p.stem[:-7] for p in out_dir.glob("*_albedo.png")}
    return ([n for n in ORDER if n in names]
            + sorted(names - set(ORDER)))


def write(out_dir: Path, inline: bool = True) -> Path:
    """inline=True embeds the PNGs, so the page works on its own anywhere."""
    atlases, total = [], 0
    for name in _present(out_dir):
        label = LABELS.get(name, name)
        doc = json.loads((out_dir / f"{name}.json").read_text())
        meta = doc["meta"]
        ents = meta.get("entities") or meta["boss"]["parts"]
        atlases.append({
            "name": name, "label": label,
            "albedo": (_data_uri(out_dir / f"{name}_albedo.png") if inline
                       else f"{name}_albedo.png"),
            "emissive": (_data_uri(out_dir / f"{name}_emissive.png") if inline
                         else f"{name}_emissive.png"),
            "entities": ents,
            "frames": {k: {"frame": v["frame"]} for k, v in doc["frames"].items()},
        })
        total += len(doc["frames"])

    html = (HTML.replace("__DATA__", json.dumps({"atlases": atlases}))
                .replace("__COUNT__", str(total)))
    path = out_dir / "sprites-preview.html"
    path.write_text(html, encoding="utf-8")
    return path
