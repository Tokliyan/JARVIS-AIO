// Draws a Kindle dashboard "scene" (a list of block specs) as a PNG in the v3
// look: Inter type, rounded grey cards, black pills, a floating tab bar.
//
// All drawing is done in a fixed 1072-unit-wide design space and scaled to
// whatever size the Kindle asks for, so layout is identical on every device.
//
// Long scenes are split into pages automatically. Blocks marked `repeat` (the
// project header and its tabs, for example) are drawn on every page.

import path from 'node:path';
import { GlobalFonts } from '@napi-rs/canvas';

export const WD = 1072; // design width
const P = 56; // side padding
const G = '#ECECEC'; // card grey
const G2 = '#D4D4D4'; // track grey
const K = '#000000';
const TOP = 110; // where content starts
const TAB_H = 132; // space the tab bar takes at the bottom
const PAGER_H = 118; // space the Prev / Next row takes when a scene has pages
export const NAV = ['home', 'weather', 'projects', 'news'];
export const NAV_LABEL = { home: 'Home', weather: 'Weather', projects: 'Projects', news: 'News' };

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  fontsReady = true;
  const dir = path.join(process.cwd(), 'assets', 'fonts');
  for (const w of [400, 600, 700, 800]) {
    try {
      GlobalFonts.registerFromPath(path.join(dir, `inter-latin-${w}-normal.woff`), 'Inter');
    } catch {
      /* falls back to the system sans-serif */
    }
  }
}

// ------------------------------------------------------------------ kit

function makeKit(ctx, zones, hd) {
  const fam = 'Inter, sans-serif';
  const setFont = (sz, w) => {
    ctx.font = `${w || 400} ${sz}px ${fam}`;
  };
  const width = (s, sz, w) => {
    setFont(sz, w);
    return ctx.measureText(s).width;
  };
  const T = (s, x, y, o = {}) => {
    const { sz = 30, w = 400, col = K, al = 'l' } = o;
    setFont(sz, w);
    ctx.fillStyle = col;
    const tw = ctx.measureText(s).width;
    ctx.fillText(s, al === 'r' ? x - tw : al === 'c' ? x - tw / 2 : x, y);
    return tw;
  };
  const fit = (s, mw, sz, w) => {
    let t = String(s ?? '');
    if (width(t, sz, w) <= mw) return t;
    while (t.length > 1 && width(`${t}…`, sz, w) > mw) t = t.slice(0, -1);
    return `${t}…`;
  };
  // Word-wrap into at most `max` lines, ending the last one with an ellipsis.
  const lines = (s, mw, sz, w, max = 99) => {
    const out = [];
    let cur = '';
    for (const word of String(s ?? '').split(/\s+/).filter(Boolean)) {
      const t = cur ? `${cur} ${word}` : word;
      if (width(t, sz, w) > mw && cur) {
        out.push(cur);
        cur = word;
      } else cur = t;
    }
    if (cur) out.push(cur);
    if (out.length > max) {
      out.length = max;
      out[max - 1] = fit(`${out[max - 1]} …`, mw, sz, w);
    }
    return out;
  };
  const rr = (x, y, w, h, r, fill, stroke, lw = 3) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  };
  const pill = (s, x, y, o = {}) => {
    const { sz = 22, dark = false, right = false, light = false } = o;
    const w = width(s, sz, 700) + sz * 1.3;
    const h = sz * 1.9;
    const px = right ? x - w : x;
    rr(px, y, w, h, h / 2, dark ? K : light ? '#fff' : G);
    T(s, px + w / 2, y + h / 2 + sz * 0.35, { sz, w: 700, col: dark ? '#fff' : K, al: 'c' });
    return { w, h, x: px };
  };
  const bar = (x, y, w, h, f) => {
    rr(x, y, w, h, h / 2, G2);
    if (f > 0) rr(x, y, Math.max(h, w * Math.min(f, 1)), h, h / 2, K);
  };
  const check = (cx, cy, r, done) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (done) {
      ctx.fillStyle = K;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(3, r * 0.28);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.35);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.35);
      ctx.stroke();
    } else {
      ctx.strokeStyle = K;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };
  const dot = (cx, cy, r, style) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (style === 'filled') {
      ctx.fillStyle = K;
      ctx.fill();
    } else {
      ctx.strokeStyle = K;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (style === 'ring') {
      ctx.fillStyle = K;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const chevron = (cx, cy, dark = true) => {
    rr(cx - 26, cy - 26, 52, 52, 26, dark ? K : G2);
    ctx.strokeStyle = dark ? '#fff' : K;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 12);
    ctx.lineTo(cx + 8, cy);
    ctx.lineTo(cx - 6, cy + 12);
    ctx.stroke();
  };
  const sun = (cx, cy, r) => {
    ctx.fillStyle = K;
    ctx.strokeStyle = K;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r * 1.45);
      ctx.lineTo(cx + Math.cos(a) * r * 1.9, cy + Math.sin(a) * r * 1.9);
      ctx.stroke();
    }
  };
  const cloud = (cx, cy, s, col = K) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx - s * 0.5, cy + s * 0.1, s * 0.38, 0, Math.PI * 2);
    ctx.arc(cx, cy - s * 0.15, s * 0.5, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.55, cy + s * 0.1, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - s * 0.5, cy + s * 0.1, s * 1.05, s * 0.38);
  };
  // Weather picture for a WMO code.
  const weatherIcon = (cx, cy, code) => {
    const rain = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);
    const storm = [95, 96, 99].includes(code);
    if (code === 0 || code === 1) return sun(cx, cy, 34);
    if (code === 2) {
      sun(cx - 30, cy - 36, 30);
      cloud(cx + 30, cy + 34, 74, '#fff');
      return cloud(cx + 30, cy + 34, 62);
    }
    cloud(cx, cy - 6, 78);
    if (rain || storm) {
      ctx.strokeStyle = K;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      for (const dx of [-34, 0, 34]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy + 52);
        ctx.lineTo(cx + dx - 10, cy + 78);
        ctx.stroke();
      }
    }
    return null;
  };
  const zone = (x, y, w, h, extra) =>
    zones.push({ x: +(x / WD).toFixed(4), y: +(y / hd).toFixed(4), w: +(w / WD).toFixed(4), h: +(h / hd).toFixed(4), ...extra });
  return { ctx, T, fit, lines, rr, pill, bar, check, dot, chevron, weatherIcon, zone, width, setFont };
}

// ----------------------------------------------------------------- blocks

const STATUS_DOT = { good: 'filled', warn: 'ring', bad: 'ring', idle: 'empty' };

// Each builder turns a spec into { h, draw(y) } using the kit.
const BLOCKS = {
  title: (b, k) => ({
    h: b.sub ? 112 : 86,
    draw: (y) => {
      k.T(k.fit(b.text, WD - P * 2, 58, 800), P, y + 54, { sz: 58, w: 800 });
      if (b.sub) k.T(k.fit(b.sub, WD - P * 2, 26, 400), P, y + 92, { sz: 26, col: '#555' });
    },
  }),

  back: (b, k) => ({
    h: 70,
    draw: (y) => {
      const p = k.pill(`‹  ${b.text}`, P, y, { sz: 24 });
      k.zone(P - 10, y - 10, p.w + 60, p.h + 20, { go: b.go, ...(b.params || {}) });
      if (b.tag) k.pill(b.tag, P + p.w + 18, y + 6, { sz: 18 });
    },
  }),

  projectHead: (b, k) => ({
    h: 104,
    draw: (y) => {
      k.T(k.fit(b.text, WD - P * 2 - 230, 64, 800), P, y + 70, { sz: 64, w: 800 });
      if (b.pill) k.pill(b.pill, WD - P, y + 28, { sz: 20, dark: b.dark, right: true });
    },
  }),

  tabs: (b, k) => ({
    h: 94,
    draw: (y) => {
      k.rr(P, y, WD - P * 2, 74, 37, G);
      const tw = (WD - P * 2 - 10) / b.items.length;
      b.items.forEach((it, i) => {
        const x = P + 5 + i * tw;
        if (it.active) k.rr(x, y + 5, tw, 64, 32, K);
        const label = it.count != null ? `${it.label}  ${it.count}` : it.label;
        k.T(label, x + tw / 2, y + 47, { sz: 26, w: 700, col: it.active ? '#fff' : K, al: 'c' });
        k.zone(x, y, tw, 74, { go: b.go, id: b.id, tab: it.tab });
      });
    },
  }),

  section: (b, k) => ({
    h: 46,
    draw: (y) => k.T(String(b.text).toUpperCase(), P, y + 30, { sz: 20, w: 800, col: '#555' }),
  }),

  text: (b, k) => {
    const sz = b.sz || 24;
    const ls = k.lines(b.text, WD - P * 2, sz, b.w || 600, b.max || 3);
    return {
      h: ls.length * sz * 1.4 + 18,
      draw: (y) => ls.forEach((l, i) => k.T(l, P, y + sz + i * sz * 1.4, { sz, w: b.w || 600, col: b.col || '#555' })),
    };
  },

  callout: (b, k) => {
    const items = b.lines && b.lines.length ? b.lines : [b.text || ''];
    const wrapped = items.map((t) => k.lines(b.lines ? `• ${t}` : t, WD - P * 2 - 60, 28, 700, 2));
    const count = wrapped.reduce((n, l) => n + l.length, 0);
    return {
      h: 70 + count * 36 + 30,
      draw: (y) => {
        const hh = 70 + count * 36 + 16;
        k.rr(P, y, WD - P * 2, hh, 30, K);
        k.T(b.label, P + 30, y + 40, { sz: 19, w: 800, col: '#aaa' });
        let yy = y + 78;
        for (const ls of wrapped) for (const l of ls) {
          k.T(l, P + 30, yy, { sz: 28, w: 700, col: '#fff' });
          yy += 36;
        }
      },
    };
  },

  // A card with a heading and rows: schedule, due today.
  list: (b, k) => {
    const rows = b.rows && b.rows.length ? b.rows : [{ l: b.empty || 'Nothing here.', muted: true }];
    return {
      h: 74 + rows.length * 46 + 30,
      draw: (y) => {
        k.rr(P, y, WD - P * 2, 74 + rows.length * 46 + 14, 32, G);
        k.T(b.title, P + 32, y + 52, { sz: 30, w: 700 });
        rows.forEach((r, i) => {
          const yy = y + 100 + i * 46;
          let x = P + 32;
          if (b.check && !r.muted) {
            k.check(x + 13, yy - 9, 13, r.done);
            x += 40;
          }
          const right = r.r ? k.width(r.r, 28, 700) + 16 : 0;
          k.T(k.fit(r.l, WD - P * 2 - 64 - right - (x - P - 32), 28, r.muted ? 400 : 600), x, yy, { sz: 28, w: r.muted ? 400 : 600, col: r.muted ? '#666' : K });
          if (r.r) k.T(r.r, WD - P - 32, yy, { sz: 28, w: 700, al: 'r' });
        });
      },
    };
  },

  // Home: weather summary chip (taps through to Weather).
  weatherChip: (b, k) => ({
    h: 156,
    draw: (y) => {
      k.rr(P, y, WD - P * 2, 138, 34, G);
      k.T(`${b.temp}°`, P + 34, y + 104, { sz: 92, w: 800 });
      k.T(b.condition, P + 250, y + 64, { sz: 32, w: 700 });
      k.T(b.sub, P + 250, y + 104, { sz: 24, col: '#444' });
      k.chevron(WD - P - 50, y + 69);
      k.zone(P, y, WD - P * 2, 138, { go: 'weather' });
    },
  }),

  storyChip: (b, k) => {
    const ls = k.lines(b.title, WD - P * 2 - 170, 28, 700, 2);
    return {
      h: 60 + ls.length * 36 + 40,
      draw: (y) => {
        const hh = 60 + ls.length * 36 + 24;
        k.rr(P, y, WD - P * 2, hh, 30, G);
        k.pill(b.tag, P + 28, y + 14, { sz: 18, dark: b.dark, light: true });
        ls.forEach((l, i) => k.T(l, P + 28, y + 80 + i * 36, { sz: 28, w: 700 }));
        k.chevron(WD - P - 50, y + hh / 2);
        k.zone(P, y, WD - P * 2, hh, { go: 'news' });
      },
    };
  },

  weatherHero: (b, k) => ({
    h: 270,
    draw: (y) => {
      k.rr(P, y, WD - P * 2, 250, 36, G);
      k.T(`${b.temp}°`, P + 40, y + 190, { sz: 190, w: 800 });
      k.weatherIcon(WD - P - 150, y + 92, b.code);
      k.T(b.condition, P + 40, y + 232, { sz: 34, w: 700 });
      k.T(b.sub, WD - P - 40, y + 232, { sz: 24, w: 600, col: '#444', al: 'r' });
    },
  }),

  umbrella: (b, k) => ({
    h: 172,
    draw: (y) => {
      k.rr(P, y, WD - P * 2, 150, 36, K);
      k.T(b.title, P + 40, y + 64, { sz: 40, w: 800, col: '#fff' });
      k.T(k.fit(b.line1, WD - P * 2 - 80, 26, 400), P + 40, y + 104, { sz: 26, col: '#ddd' });
      k.T(k.fit(b.line2, WD - P * 2 - 80, 26, 600), P + 40, y + 136, { sz: 26, w: 600, col: '#fff' });
    },
  }),

  hourly: (b, k) => ({
    h: 306,
    draw: (y) => {
      k.rr(P, y, WD - P * 2, 290, 36, G);
      k.T('Today', P + 36, y + 50, { sz: 30, w: 700 });
      k.T('Bars show rain chance', WD - P - 36, y + 50, { sz: 22, w: 600, col: '#555', al: 'r' });
      const pts = b.hours;
      if (!pts.length) return k.T('No hourly data.', P + 36, y + 120, { sz: 26, col: '#666' });
      const cx = P + 90;
      const cw = WD - P * 2 - 150;
      const top = y + 96;
      const ch = 110;
      const vals = pts.map((p) => p.temp);
      const lo = Math.min(...vals) - 1;
      const hi = Math.max(...vals) + 1;
      const px = (i) => cx + (pts.length > 1 ? (i * cw) / (pts.length - 1) : cw / 2);
      const py = (v) => top + ch - ((v - lo) / Math.max(hi - lo, 1)) * ch;
      const c = k.ctx;
      c.strokeStyle = K;
      c.lineWidth = 6;
      c.lineJoin = 'round';
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(px(i), py(p.temp)) : c.moveTo(px(i), py(p.temp))));
      c.stroke();
      pts.forEach((p, i) => {
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(px(i), py(p.temp), 9, 0, Math.PI * 2);
        c.fill();
        c.lineWidth = 5;
        c.stroke();
        k.T(`${p.temp}°`, px(i), py(p.temp) - 20, { sz: 24, w: 700, al: 'c' });
        const r = Math.max(0, Math.min(p.rain ?? 0, 100)) * 1.4;
        k.rr(px(i) - 16, y + 250 - r - 6, 32, r + 6, 8, K);
        k.T(p.label, px(i), y + 278, { sz: 22, w: 600, col: '#444', al: 'c' });
      });
    },
  }),

  days: (b, k) => ({
    h: 316,
    draw: (y) => {
      k.rr(P, y, WD - P * 2, 300, 36, G);
      k.T('Next 5 days', P + 36, y + 52, { sz: 30, w: 700 });
      const gmin = Math.min(...b.days.map((d) => d.min));
      const gmax = Math.max(...b.days.map((d) => d.max));
      const span = Math.max(gmax - gmin, 1);
      b.days.forEach((d, i) => {
        const yy = y + 102 + i * 38;
        k.T(d.name, P + 36, yy + 6, { sz: 26, w: 700 });
        k.T(k.fit(d.text, 200, 24, 400), P + 124, yy + 6, { sz: 24, col: '#333' });
        const bx = 560;
        const bw = 230;
        k.rr(bx, yy - 10, bw, 16, 8, G2);
        k.rr(bx + ((d.min - gmin) / span) * bw, yy - 10, Math.max(14, ((d.max - d.min) / span) * bw), 16, 8, K);
        k.T(`${d.min}°`, bx - 12, yy + 6, { sz: 24, al: 'r', col: '#444' });
        k.T(`${d.max}°`, bx + bw + 12, yy + 6, { sz: 24, w: 700 });
        k.T(d.rain != null ? `${d.rain}%` : '', WD - P - 36, yy + 6, { sz: 24, w: 700, al: 'r' });
      });
    },
  }),

  chips: (b, k) => ({
    h: 70,
    draw: (y) => {
      let x = P;
      for (const s of b.items) x += k.pill(s, x, y, { sz: 24 }).w + 14;
    },
  }),

  markets: (b, k) => ({
    h: 136,
    draw: (y) => {
      const bw = (WD - P * 2 - 36) / b.items.length;
      b.items.forEach((m, i) => {
        const x = P + i * (bw + 12);
        k.rr(x, y, bw, 126, 26, G);
        k.T(m.label, x + 20, y + 40, { sz: 21, w: 600, col: '#555' });
        k.T(m.value, x + 20, y + 84, { sz: 33, w: 800 });
        const c = k.ctx;
        c.fillStyle = K;
        if (m.dir === 1) {
          c.beginPath();
          c.moveTo(x + 22, y + 112);
          c.lineTo(x + 34, y + 112);
          c.lineTo(x + 28, y + 101);
          c.fill();
        } else if (m.dir === -1) {
          c.beginPath();
          c.moveTo(x + 22, y + 101);
          c.lineTo(x + 34, y + 101);
          c.lineTo(x + 28, y + 112);
          c.fill();
        }
        k.T(m.change, x + (m.dir ? 44 : 20), y + 113, { sz: 21, w: 700 });
      });
    },
  }),

  story: (b, k) => {
    const ls = k.lines(b.title, WD - P * 2 - 130, 29, 700, 2);
    return {
      h: 154,
      draw: (y) => {
        k.rr(P, y, WD - P * 2, 146, 30, G);
        ls.forEach((l, i) => k.T(l, P + 28, y + 44 + i * 34, { sz: 29, w: 700 }));
        const pl = k.pill(b.tag, P + 28, y + 96, { sz: 18, dark: b.dark, light: true });
        k.T(k.fit(b.meta, WD - P * 2 - 130 - pl.w - 14, 21, 600), P + 28 + pl.w + 14, y + 96 + pl.h / 2 + 7, { sz: 21, w: 600, col: '#555' });
        k.chevron(WD - P - 52, y + 73);
        k.zone(P, y, WD - P * 2, 146, { go: 'article', id: b.id });
      },
    };
  },

  articleHead: (b, k) => {
    const ls = k.lines(b.title, WD - P * 2, 52, 800, 5);
    return {
      h: ls.length * 60 + 106,
      draw: (y) => {
        ls.forEach((l, i) => k.T(l, P, y + 50 + i * 60, { sz: 52, w: 800 }));
        const yy = y + ls.length * 60 + 4;
        k.T(b.meta, P, yy + 26, { sz: 24, w: 600, col: '#555' });
        k.ctx.fillStyle = G2;
        k.ctx.fillRect(P, yy + 46, WD - P * 2, 3);
      },
    };
  },

  para: (b, k) => {
    const ls = k.lines(b.text, WD - P * 2, 36, 400);
    return {
      h: ls.length * 54 + 22,
      draw: (y) => ls.forEach((l, i) => k.T(l, P, y + 38 + i * 54, { sz: 36 })),
    };
  },

  project: (b, k) => ({
    h: 208,
    draw: (y) => {
      k.rr(P, y, WD - P * 2, 196, 32, G);
      k.T(k.fit(b.name, WD - P * 2 - 300, 38, 800), P + 30, y + 56, { sz: 38, w: 800 });
      k.pill(b.pill, WD - P - 30, y + 18, { sz: 19, dark: b.dark, right: true, light: true });
      k.bar(P + 30, y + 80, WD - P * 2 - 60 - 170, 14, b.total ? b.done / b.total : 0);
      k.T(b.total ? `${b.done} of ${b.total} done` : 'No roadmap yet', WD - P - 30, y + 93, { sz: 22, w: 700, al: 'r' });
      k.T('DONE', P + 30, y + 133, { sz: 19, w: 800, col: '#666' });
      k.T(k.fit(b.doneLine, WD - P * 2 - 170, 26, 600), P + 130, y + 135, { sz: 26, w: 600 });
      k.T('NEXT', P + 30, y + 172, { sz: 19, w: 800, col: '#666' });
      k.T(k.fit(b.nextLine, WD - P * 2 - 170, 26, 700), P + 130, y + 174, { sz: 26, w: 700 });
      k.zone(P, y, WD - P * 2, 196, { go: 'project', id: String(b.id), tab: 'next' });
    },
  }),

  progressCard: (b, k) => {
    const steps = b.steps || [];
    const detail = !steps.length && b.detail ? k.lines(b.detail, WD - P * 2 - 60, 24, 400, 2) : [];
    const hh = 86 + (steps.length ? 40 + steps.length * 36 : detail.length * 32 + 10) - 4;
    return {
      h: hh + 18,
      draw: (y) => {
        k.rr(P, y, WD - P * 2, hh, 32, G);
        const badge = steps.length ? `${steps.filter((s) => s.done).length} of ${steps.length} steps` : '';
        k.T(k.fit(b.title, WD - P * 2 - 260, 34, 800), P + 30, y + 56, { sz: 34, w: 800 });
        if (badge) k.pill(badge, WD - P - 24, y + 22, { sz: 19, right: true, light: true });
        let yy = y + 78;
        if (steps.length) {
          k.bar(P + 30, yy, WD - P * 2 - 60, 12, steps.filter((s) => s.done).length / steps.length);
          yy += 54;
          steps.forEach((s) => {
            k.check(P + 46, yy - 8, 12, s.done);
            k.T(k.fit(s.title, WD - P * 2 - 120, 24, s.done ? 400 : 600), P + 78, yy, { sz: 24, w: s.done ? 400 : 600, col: s.done ? '#666' : K });
            yy += 36;
          });
        } else {
          detail.forEach((l, i) => k.T(l, P + 30, yy + 24 + i * 32, { sz: 24, col: '#333' }));
        }
      },
    };
  },

  row: (b, k) => ({
    h: 100,
    draw: (y) => {
      k.rr(P, y, WD - P * 2, 88, 28, G);
      k.T(String(b.num), P + 30, y + 56, { sz: 30, w: 800, col: '#888' });
      k.T(k.fit(b.title, WD - P * 2 - 130, 27, 700), P + 82, y + 38, { sz: 27, w: 700 });
      if (b.meta) k.T(k.fit(b.meta, WD - P * 2 - 130, 21, 600), P + 82, y + 70, { sz: 21, w: 600, col: '#555' });
    },
  }),

  doneItem: (b, k) => ({
    h: 82,
    draw: (y) => {
      k.rr(P, y, WD - P * 2, 72, 24, G);
      k.check(P + 42, y + 36, 16, true);
      k.T(k.fit(b.text, WD - P * 2 - 120, 26, 600), P + 78, y + 46, { sz: 26, w: 600 });
    },
  }),

  stats: (b, k) => ({
    h: 116,
    draw: (y) => {
      k.rr(P, y, WD - P * 2, 96, 30, G);
      const cw = (WD - P * 2) / b.items.length;
      b.items.forEach((s, i) => {
        const x = P + 30 + i * cw;
        const nw = k.T(String(s.n), x, y + 60, { sz: 42, w: 800 });
        k.T(s.label, x + nw + 12, y + 60, { sz: 22, w: 600, col: '#555' });
      });
    },
  }),

  nightRow: (b, k) => {
    const ls = k.lines(b.summary || '', WD - P * 2 - 120, 22, 400, 2);
    return {
      h: 78 + ls.length * 28 + 12,
      draw: (y) => {
        const hh = 78 + ls.length * 28;
        k.rr(P, y, WD - P * 2, hh, 26, G);
        k.dot(P + 44, y + 40, 16, STATUS_DOT[b.dotKey] || 'empty');
        k.T(b.date, P + 82, y + 48, { sz: 26, w: 700 });
        k.pill(b.status, WD - P - 24, y + 16, { sz: 18, dark: b.dark, right: true, light: true });
        ls.forEach((l, i) => k.T(l, P + 82, y + 82 + i * 28, { sz: 22, col: '#333' }));
      },
    };
  },

  noteCard: (b, k) => {
    const ls = k.lines(b.body || '', WD - P * 2 - 60, 24, 400, 6);
    return {
      h: 88 + ls.length * 33 + 14,
      draw: (y) => {
        k.rr(P, y, WD - P * 2, 88 + ls.length * 33, 28, G);
        k.T(k.fit(b.heading || 'Note', WD - P * 2 - 60, 28, 800), P + 30, y + 52, { sz: 28, w: 800 });
        ls.forEach((l, i) => k.T(l, P + 30, y + 92 + i * 33, { sz: 24, col: '#333' }));
      },
    };
  },
};

// ------------------------------------------------------------------- scene

// Draws page `pg` (0-based) of a scene. Returns { png, zones, pages, pg }.
export function renderScene(createCanvas, scene, width, height, pg = 0) {
  ensureFonts();
  const s = width / WD;
  const hd = height / s;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.scale(s, s);
  const zones = [];
  const k = makeKit(ctx, zones, hd);

  const made = (scene.blocks || []).map((b) => {
    const build = BLOCKS[b.t];
    return { spec: b, ...(build ? build(b, k) : { h: 0, draw() {} }) };
  });
  const repeating = made.filter((m) => m.spec.repeat);
  const flowing = made.filter((m) => !m.spec.repeat);
  const repeatH = repeating.reduce((n, m) => n + m.h, 0);

  const plan = (limit) => {
    const pages = [[]];
    let used = repeatH;
    for (const m of flowing) {
      if (used + m.h > limit && pages[pages.length - 1].length) {
        pages.push([]);
        used = repeatH;
      }
      pages[pages.length - 1].push(m);
      used += m.h;
    }
    return pages;
  };
  const roomy = hd - TAB_H - 24 - TOP;
  let pages = plan(roomy);
  const paged = pages.length > 1;
  if (paged) pages = plan(roomy - PAGER_H);
  const total = pages.length;
  const cur = Math.min(Math.max(pg, 0), total - 1);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WD, hd);

  // Chrome: eyebrow, close button.
  k.T(scene.eyebrow || '', P, 74, { sz: 24, w: 700, col: '#555' });
  k.rr(WD - P - 56, 34, 56, 56, 28, G);
  ctx.strokeStyle = K;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(WD - P - 38, 52);
  ctx.lineTo(WD - P - 18, 72);
  ctx.moveTo(WD - P - 18, 52);
  ctx.lineTo(WD - P - 38, 72);
  ctx.stroke();
  k.zone(WD - P - 90, 14, 124, 96, { go: 'close' });

  // Content: repeating blocks first, then this page's blocks.
  let y = TOP;
  for (const m of repeating) {
    m.draw(y);
    y += m.h;
  }
  for (const m of pages[cur]) {
    m.draw(y);
    y += m.h;
  }

  // Pager.
  const self = { go: scene.self?.go, id: scene.self?.id, tab: scene.self?.tab };
  if (total > 1) {
    const py = hd - TAB_H - PAGER_H + 10;
    k.rr(P, py, WD - P * 2, 90, 45, G);
    k.rr(P + 6, py + 6, 260, 78, 39, cur > 0 ? K : G2);
    k.T('‹  Prev', P + 136, py + 56, { sz: 28, w: 700, col: cur > 0 ? '#fff' : '#777', al: 'c' });
    k.T(`Page ${cur + 1} of ${total}`, WD / 2, py + 56, { sz: 26, w: 600, al: 'c' });
    k.rr(WD - P - 266, py + 6, 260, 78, 39, cur < total - 1 ? K : G2);
    k.T('Next  ›', WD - P - 136, py + 56, { sz: 28, w: 700, col: cur < total - 1 ? '#fff' : '#777', al: 'c' });
    if (cur > 0) k.zone(P, py, 280, 90, { ...self, pg: cur - 1 });
    if (cur < total - 1) k.zone(WD - P - 280, py, 280, 90, { ...self, pg: cur + 1 });
    if (scene.edgeTap) {
      if (cur > 0) k.zone(0, hd * 0.15, WD * 0.14, hd * 0.6, { ...self, pg: cur - 1 });
      if (cur < total - 1) k.zone(WD * 0.86, hd * 0.15, WD * 0.14, hd * 0.6, { ...self, pg: cur + 1 });
    }
    // Swipes. The plugin ignores these when working out what a tap hit.
    if (cur < total - 1) zones.push({ x: 0, y: 0, w: 1, h: 1, swipe: 'west', ...self, pg: cur + 1 });
    if (cur > 0) zones.push({ x: 0, y: 0, w: 1, h: 1, swipe: 'east', ...self, pg: cur - 1 });
  }

  // Footer stamp and tab bar.
  k.T(scene.stamp ? `Updated ${scene.stamp}` : '', P, hd - 12, { sz: 18, w: 600, col: '#888' });
  const ty = hd - TAB_H + 6;
  k.rr(P, ty, WD - P * 2, 92, 46, G);
  const tw = (WD - P * 2 - 12) / NAV.length;
  NAV.forEach((n, i) => {
    const x = P + 6 + i * tw;
    const active = n === scene.nav;
    if (active) k.rr(x, ty + 6, tw, 80, 40, K);
    k.T(NAV_LABEL[n], x + tw / 2, ty + 56, { sz: 30, w: active ? 700 : 600, col: active ? '#fff' : K, al: 'c' });
    k.zone(x, ty, tw, 92, { go: n });
  });

  return { png: canvas.toBuffer('image/png'), zones, pages: total, pg: cur };
}

export function zonesHeader(zones) {
  // Header values must be plain ASCII.
  return JSON.stringify(zones).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function errorScene(message) {
  return {
    nav: 'home',
    eyebrow: 'SOMETHING WENT WRONG',
    stamp: '',
    blocks: [
      { t: 'title', text: 'Something went wrong' },
      { t: 'text', text: String(message || 'Unknown error'), sz: 26, max: 6 },
    ],
  };
}
