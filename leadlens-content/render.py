#!/usr/bin/env python3
"""
Leadlens content renderer: one post spec (JSON) in, a carousel (PNG slides)
and a Reel (MP4) out. Flat brand style, no network, no stock media.

  python3 leadlens-content/render.py leadlens-content/specs/2026-10-23.json

Writes leadlens-content/out/<id>/{carousel-01.png.., reel.mp4, caption.txt, contact-sheet.png}
Needs: python3 + playwright (chromium), ffmpeg. Fonts are vendored in ./fonts.

Spec shape (see specs/example.json):
{
  "id": "2026-10-23", "topic": "...", "caption": "...", "hashtags": ["..."],
  "carousel": {"slides": [{"headline": "...", "accent": "word", "body": "..."}]},
  "reel": {"beats": [{"text": "...", "accent": "word", "bubble": "...", "note": "..."}]}
}
The renderer adds the CTA slide / end card itself. Lint failures stop the
render (exit 2) so a rule break never reaches the output folder.
"""
import base64, hashlib, json, re, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent
FONTS = HERE / "fonts"

CTA = "Comment AGENT and I'll send you the info"
BRAND = dict(bg="#0a0a0f", lime="#c4f542", text="#e8e8ec", panel="#171617", line="#2a2a2e", muted="#8f8d92")
FPS = 30
SAFE_TOP, SAFE_BOTTOM = 250, 380  # Instagram UI zones on 1080x1920


# ------------------------------------------------------------------ lint
def lint(spec):
    errs = []
    texts = []
    for s in spec.get("carousel", {}).get("slides", []):
        texts += [s.get("headline", ""), s.get("body", ""), s.get("accent", "")]
    for b in spec.get("reel", {}).get("beats", []):
        texts += [b.get("text", ""), b.get("bubble", ""), b.get("note", ""), b.get("accent", "")]
    texts += [spec.get("caption", "")]
    blob = "\n".join(texts)
    if re.search(r"lead\s?lens", blob, re.I) and re.search(r"LeadLens|Lead Lens|LEADLENS", blob):
        errs.append('wordmark must be "Leadlens" (never LeadLens)')
    if re.search(r"[%$]|\b\d+\s?(x|times)\b", blob):
        errs.append("no statistics, prices or invented numbers (found %, $ or 'Nx')")
    if re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", blob):
        errs.append("no email addresses")
    if re.search(r"\b(oakhill|year 1\d|i'm 1\d|i am 1\d|\d{2}[- ]year[- ]old|high school|school)\b", blob, re.I):
        errs.append("no name, age or school")
    for s in spec.get("carousel", {}).get("slides", []):
        if s.get("accent") and s["accent"].lower() not in s.get("headline", "").lower():
            errs.append(f"accent '{s['accent']}' not found in its headline")
    beats = spec.get("reel", {}).get("beats", [])
    if not 4 <= len(beats) <= 7:
        errs.append("reel needs 4-7 beats")
    for b in beats:
        if b.get("accent") and b["accent"].lower() not in b.get("text", "").lower():
            errs.append(f"accent '{b['accent']}' not found in beat text")
    if not spec.get("caption"):
        errs.append("caption missing")
    return errs


# ------------------------------------------------------------------ html
def font_css():
    def b64(name):
        return base64.b64encode((FONTS / name).read_bytes()).decode()
    return f"""
@font-face{{font-family:'Instrument Serif';font-style:normal;src:url(data:font/woff2;base64,{b64('instrument-serif-latin-400-normal.woff2')})}}
@font-face{{font-family:'Instrument Serif';font-style:italic;src:url(data:font/woff2;base64,{b64('instrument-serif-latin-400-italic.woff2')})}}
@font-face{{font-family:'Plus Jakarta Sans';font-weight:500;src:url(data:font/woff2;base64,{b64('plus-jakarta-sans-latin-500-normal.woff2')})}}
@font-face{{font-family:'Plus Jakarta Sans';font-weight:700;src:url(data:font/woff2;base64,{b64('plus-jakarta-sans-latin-700-normal.woff2')})}}
"""


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def hl(text, accent):
    t = esc(text)
    if accent:
        a = esc(accent)
        i = t.lower().find(a.lower())
        if i >= 0:
            t = t[:i] + f'<em>{t[i:i+len(a)]}</em>' + t[i + len(a):]
    return t


BASE_CSS = f"""
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:{BRAND['bg']};color:{BRAND['text']};font-family:'Plus Jakarta Sans',sans-serif;overflow:hidden}}
h1,.serif{{font-family:'Instrument Serif',serif;font-weight:400;letter-spacing:-0.01em}}
em{{color:{BRAND['lime']};font-style:italic}}
.mark{{font-family:'Instrument Serif',serif;font-size:40px;color:{BRAND['text']}}}
.small{{color:{BRAND['muted']};font-weight:500}}
"""


def slide_html(kind, headline="", accent="", body="", idx=1, total=1):
    if kind == "cta":
        main = f'<h1 style="font-size:104px;line-height:1.05">{hl(CTA, "AGENT")}</h1>'
        sub = '<p class="small" style="font-size:34px;margin-top:48px">Free to ask. No pressure.</p>'
        foot = '<div class="mark" style="font-size:64px">Leadlens</div>'
    else:
        size = 132 if idx == 1 else 96
        main = f'<h1 style="font-size:{size}px;line-height:1.04">{hl(headline, accent)}</h1>'
        sub = f'<p style="font-size:42px;line-height:1.45;margin-top:56px;color:{BRAND["text"]};max-width:860px">{esc(body)}</p>' if body else ""
        foot = f'<div class="small" style="font-size:28px">{idx} / {total}</div>'
    return f"""<!doctype html><meta charset=utf-8><style>{font_css()}{BASE_CSS}
body{{width:1080px;height:1350px;padding:90px 90px 80px;display:flex;flex-direction:column;justify-content:space-between}}
.rule{{height:2px;background:{BRAND['line']};margin:0}}
</style>
<div style="display:flex;justify-content:space-between;align-items:center"><div class="mark">Leadlens</div><div class="small" style="font-size:26px">swipe &rarr;</div></div>
<div>{main}{sub}</div>
<div><div class="rule" style="margin-bottom:28px"></div>{foot}</div>"""


REEL_HTML = f"""<!doctype html><meta charset=utf-8><style>{{FONTS}}{BASE_CSS}
body{{width:1080px;height:1920px;position:relative}}
#stage{{position:absolute;left:90px;right:90px;top:{SAFE_TOP}px;bottom:{SAFE_BOTTOM}px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:56px}}
#line{{font-size:110px;line-height:1.06}}
#line.long{{font-size:92px}}
#bubble{{background:{BRAND['panel']};border:2px solid {BRAND['line']};border-radius:36px;padding:44px 48px;font-size:44px;line-height:1.4;max-width:860px}}
#tag{{font-size:26px;letter-spacing:.12em;text-transform:uppercase;color:{BRAND['muted']};margin-bottom:18px}}
#note{{font-size:40px;color:{BRAND['lime']};font-weight:700}}
#wm{{position:absolute;left:90px;top:{SAFE_TOP}px;display:none}}
#end .mark{{font-size:84px;margin-top:40px}}
</style>
<div id=stage><div id=wrap style="opacity:0;width:100%"><h1 id=line></h1><div id=bw style="display:none;margin-top:56px"><div id=tag>Example</div><div id=bubble></div></div><div id=note style="margin-top:36px;display:none"></div></div></div>
<script>
function show(b,a){{
  const w=document.getElementById('wrap');
  document.getElementById('line').innerHTML=b.html;
  document.getElementById('line').className=b.long?'long':'';
  document.getElementById('bw').style.display=b.bubble?'block':'none';
  document.getElementById('bubble').textContent=b.bubble||'';
  const n=document.getElementById('note');n.style.display=b.note?'block':'none';n.textContent=b.note||'';
  w.style.opacity=a;w.style.transform='translateY('+((1-a)*22)+'px)';
}}
</script>"""


# ------------------------------------------------------------------ main
def main(path):
    spec = json.loads(Path(path).read_text())
    errs = lint(spec)
    if errs:
        print("LINT FAILED:\n - " + "\n - ".join(errs))
        return 2

    out = HERE / "out" / spec["id"]
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    from playwright.sync_api import sync_playwright

    slides = spec["carousel"]["slides"]
    total = len(slides) + 1
    with sync_playwright() as p:
        br = p.chromium.launch()
        pg = br.new_page(viewport={"width": 1080, "height": 1350})
        for i, s in enumerate(slides, 1):
            pg.set_content(slide_html("body", s["headline"], s.get("accent", ""), s.get("body", ""), i, total))
            pg.evaluate("document.fonts.ready")
            pg.screenshot(path=str(out / f"carousel-{i:02d}.png"))
        pg.set_content(slide_html("cta"))
        pg.evaluate("document.fonts.ready")
        pg.screenshot(path=str(out / f"carousel-{total:02d}.png"))

        # ---- reel
        beats = []
        for b in spec["reel"]["beats"]:
            t = b["text"]
            hold = 3.4 if len(t) > 70 or b.get("bubble") else 2.8
            beats.append(dict(html=hl(t, b.get("accent")), long=len(t) > 60, bubble=b.get("bubble", ""), note=b.get("note", ""), hold=hold))
        beats.append(dict(html=hl(CTA, "AGENT") , long=True, bubble="", note="Leadlens", hold=3.5))

        pg2 = br.new_page(viewport={"width": 1080, "height": 1920})
        pg2.set_content(REEL_HTML.replace("{FONTS}", font_css()))
        pg2.evaluate("document.fonts.ready")
        frames = out / "_frames"
        frames.mkdir()
        concat = []
        n = 0

        def snap(b, a, dur):
            nonlocal n
            pg2.evaluate("([b,a])=>show(b,a)", [b, a])
            f = frames / f"f{n:05d}.png"
            pg2.screenshot(path=str(f))
            concat.append(f"file '{f}'\nduration {dur:.5f}")
            n += 1

        fade_in, fade_out = 12, 8
        for b in beats:
            for k in range(1, fade_in + 1):
                snap(b, k / fade_in, 1 / FPS)
            snap(b, 1.0, b["hold"])
            for k in range(1, fade_out + 1):
                snap(b, 1 - k / fade_out, 1 / FPS)
        br.close()

    total_s = sum(b["hold"] for b in beats) + len(beats) * (fade_in + fade_out) / FPS
    (frames / "list.txt").write_text("\n".join(concat) + f"\nfile '{frames}/f{n-1:05d}.png'\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(frames / "list.txt"),
                    "-vf", f"fps={FPS},format=yuv420p", "-c:v", "libx264", "-crf", "18", "-movflags", "+faststart",
                    "-an", str(out / "reel.mp4")], check=True)
    shutil.rmtree(frames)

    tags = " ".join(spec.get("hashtags", []))
    (out / "caption.txt").write_text(spec["caption"].strip() + "\n\n" + CTA + ".\n\n" + tags + "\n")

    # contact sheet for quick review
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(out / "reel.mp4"), "-vf",
                    "fps=1/4,scale=270:-1,tile=5x1", "-frames:v", "1", str(out / "contact-sheet.png")], check=False)

    size = (out / "reel.mp4").stat().st_size / 1e6
    print(f"OK {spec['id']}: {total} slides, reel {total_s:.1f}s, {size:.1f} MB -> {out}")
    if not 14 <= total_s <= 28:
        print(f"WARNING: reel length {total_s:.1f}s is outside 14-28s; adjust beats")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
