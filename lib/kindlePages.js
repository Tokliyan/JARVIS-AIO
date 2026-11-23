// The Kindle dashboard: five pages (Home, Weather, Projects, News, and one
// project's detail), each drawn as a PNG for the Kindle's screen plus a list
// of "tap zones" so the Ask JARVIS plugin knows what a tap on the picture does.
//
// Everything here is split in two so it can be tested without a database:
//   - gather*/build*  turn data into a plain "scene" (a list of blocks)
//   - renderScene     draws a scene onto a canvas and works out the tap zones

import { sydneyNow, addDaysISO, fmtTime } from '@/lib/kindleCommand';
import { latestPerSection, needsYouFor, SECTION_LABELS } from '@/lib/nightRun';

export const PAGES = ['home', 'weather', 'projects', 'news'];
export const TAB_LABELS = { home: 'Home', weather: 'Weather', projects: 'Projects', news: 'News' };

// Castle Hill NSW. Change here to move the weather.
export const WEATHER_PLACE = { name: 'Castle Hill', lat: -33.7311, lon: 151.0044 };
export const NEWS_FEED = 'https://www.abc.net.au/news/feed/51120/rss.xml';

// Night-run sections -> which project they describe.
const SECTION_FOR_PROJECT = [
  [/rade/i, 'rade'],
  [/rune/i, 'runehaven'],
  [/lead/i, 'leadlens'],
  [/jarvis|ambient/i, 'jarvis'],
];
export function sectionForProject(name = '') {
  const hit = SECTION_FOR_PROJECT.find(([re]) => re.test(name));
  return hit ? hit[1] : null;
}

// --------------------------------------------------------------- weather

const WMO = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail',
};
export function weatherText(code) {
  return WMO[code] || 'Unknown';
}

const cache = new Map();
async function cached(key, ttlMs, load, now = Date.now()) {
  const hit = cache.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value;
  try {
    const value = await load();
    if (value) cache.set(key, { at: now, value });
    return value || (hit ? hit.value : null); // stale beats nothing
  } catch {
    return hit ? hit.value : null;
  }
}
export function _clearCache() {
  cache.clear();
}

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function parseWeather(json) {
  if (!json || !json.current || !json.daily) return null;
  const c = json.current;
  const d = json.daily;
  const days = (d.time || []).map((date, i) => ({
    date,
    code: d.weather_code?.[i],
    max: Math.round(d.temperature_2m_max?.[i]),
    min: Math.round(d.temperature_2m_min?.[i]),
    rain: d.precipitation_probability_max?.[i] ?? null,
  }));
  const hours = [];
  const h = json.hourly;
  if (h && Array.isArray(h.time)) {
    for (let i = 0; i < h.time.length && hours.length < 8; i++) {
      if (h.time[i] < c.time) continue;
      if (hours.length === 0 || i % 3 === 0) {
        hours.push({ time: h.time[i], temp: Math.round(h.temperature_2m?.[i]), rain: h.precipitation_probability?.[i] ?? null });
      }
    }
  }
  return {
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature),
    code: c.weather_code,
    wind: Math.round(c.wind_speed_10m),
    days,
    hours,
  };
}

export function getWeather(fetchImpl = fetch) {
  const { lat, lon } = WEATHER_PLACE;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
    '&hourly=temperature_2m,precipitation_probability' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=Australia%2FSydney&forecast_days=5';
  return cached('weather', 15 * 60_000, async () => parseWeather(await getJson(url, fetchImpl)));
}

// ------------------------------------------------------------------ news

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/<[^>]+>/g, '') // feeds often carry escaped HTML inside descriptions
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRss(xml, limit = 6) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(String(xml || ''))) && items.length < limit) {
    const tag = (name) => {
      const t = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(m[1]);
      return t ? decodeEntities(t[1]) : '';
    };
    const title = tag('title');
    if (title) items.push({ title, summary: tag('description'), date: tag('pubDate') });
  }
  return items;
}

export function getNews(fetchImpl = fetch) {
  return cached('news', 30 * 60_000, async () => {
    const res = await fetchImpl(NEWS_FEED, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseRss(await res.text(), 8);
    return items.length ? items : null;
  });
}

// ------------------------------------------------------------- database

// One batch of reads that every page builds from. Anything that fails (an
// unrun SQL file, a table that doesn't exist) just comes back empty.
export async function loadBase(db, now = new Date()) {
  const { iso, dow } = sydneyNow(now);
  const owner = process.env.AIO_OWNER_ID || '04b4fa14-b541-4b23-92d6-886d6202d727';
  const [settings, periods, tasks, projects, nightRows] = await Promise.all([
    db.from('aio_settings').select('value').eq('user_id', owner).eq('key', 'current_week').maybeSingle(),
    db.from('aio_timetable').select('*').eq('user_id', owner).eq('day_of_week', dow).order('start_time'),
    db.from('aio_checklist').select('*').eq('user_id', owner).eq('due_date', iso),
    db.from('aio_projects').select('*').eq('user_id', owner),
    db.from('aio_night_runs').select('*').eq('user_id', owner).order('run_date', { ascending: false }).limit(40),
  ]);
  const week = settings?.data?.value || 'A';
  return {
    iso,
    dow,
    week,
    periods: (periods?.data || []).filter((p) => !p.week_type || p.week_type === week),
    tasks: tasks?.data || [],
    projects: projects?.data || [],
    nightRows: nightRows?.data || [],
  };
}

function latestReports(nightRows) {
  const date = nightRows[0]?.run_date;
  return date ? latestPerSection(nightRows.filter((r) => r.run_date === date)) : [];
}

const COLOR_RANK = { bad: 0, warn: 1, good: 2, idle: 3 };
function sortProjects(projects) {
  return [...projects].sort(
    (a, b) => (COLOR_RANK[a.status_color] ?? 4) - (COLOR_RANK[b.status_color] ?? 4) || String(a.name).localeCompare(String(b.name)),
  );
}

function sydneyStamp(now) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long',
  }).format(now);
}
function sydneyClock(now) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(now).replace(/\s/g, '').toLowerCase();
}

// ------------------------------------------------------------------ scenes

export function buildHome({ base, weather, news, now = new Date() }) {
  const blocks = [];
  blocks.push({ t: 'title', text: 'Today', sub: `${sydneyStamp(now)}  -  Week ${base.week}` });

  if (weather) {
    const today = weather.days[0];
    blocks.push({ t: 'line', text: `${weather.temp}°  ${weatherText(weather.code)}${today ? `  -  high ${today.max}°, low ${today.min}°` : ''}`, bold: true, go: 'weather' });
  }
  if (news && news[0]) blocks.push({ t: 'wrap', text: news[0].title, size: 'small', lines: 2, go: 'news' });
  blocks.push({ t: 'rule' });

  blocks.push({ t: 'head', text: 'Schedule' });
  if (base.periods.length === 0) blocks.push({ t: 'line', text: 'No school today.' });
  for (const p of base.periods) blocks.push({ t: 'row', left: p.subject, right: fmtTime(p.start_time) });
  blocks.push({ t: 'rule' });

  blocks.push({ t: 'head', text: 'Due today' });
  if (base.tasks.length === 0) blocks.push({ t: 'line', text: 'Nothing due today.' });
  for (const t of base.tasks) {
    blocks.push({ t: 'line', text: `${t.status === 'done' ? '[x]' : '[ ]'} ${t.title}`, strike: t.status === 'done' });
  }

  const reports = latestReports(base.nightRows);
  if (reports.length) {
    const needs = needsYouFor(reports);
    blocks.push({ t: 'rule' });
    blocks.push({ t: 'head', text: 'Needs you' });
    if (needs.length === 0) blocks.push({ t: 'line', text: 'Nothing needs you.' });
    for (const n of needs.slice(0, 4)) blocks.push({ t: 'wrap', text: `- ${n}`, lines: 2 });
  }
  return { page: 'home', blocks, stamp: sydneyClock(now) };
}

export function buildWeather({ weather, now = new Date() }) {
  const blocks = [{ t: 'title', text: 'Weather', sub: WEATHER_PLACE.name }];
  if (!weather) {
    blocks.push({ t: 'line', text: 'Weather is unavailable right now.' });
    return { page: 'weather', blocks, stamp: sydneyClock(now) };
  }
  blocks.push({ t: 'big', text: `${weather.temp}°` });
  blocks.push({ t: 'line', text: `${weatherText(weather.code)}  -  feels like ${weather.feels}°  -  wind ${weather.wind} km/h`, bold: true });
  blocks.push({ t: 'rule' });
  blocks.push({ t: 'head', text: 'Next hours' });
  for (const h of weather.hours) {
    const label = new Date(`${h.time}:00Z`).toLocaleTimeString('en-AU', { timeZone: 'UTC', hour: 'numeric', hour12: true }).replace(/\s/g, '').toLowerCase();
    blocks.push({ t: 'row', left: label, right: `${h.temp}°${h.rain != null ? `   rain ${h.rain}%` : ''}` });
  }
  blocks.push({ t: 'rule' });
  blocks.push({ t: 'head', text: '5 days' });
  weather.days.forEach((d, i) => {
    const name = i === 0 ? 'Today' : new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-AU', { timeZone: 'UTC', weekday: 'long' });
    blocks.push({ t: 'row', left: `${name}  -  ${weatherText(d.code)}`, right: `${d.min}° / ${d.max}°${d.rain != null ? `   ${d.rain}%` : ''}` });
  });
  return { page: 'weather', blocks, stamp: sydneyClock(now) };
}

const DOT_STYLE = { good: 'filled', warn: 'half', bad: 'ring', idle: 'empty' };

export function buildProjects({ base, now = new Date() }) {
  const reports = latestReports(base.nightRows);
  const blocks = [{ t: 'title', text: 'Projects', sub: 'Tap a project for details' }];
  const projects = sortProjects(base.projects);
  if (projects.length === 0) blocks.push({ t: 'line', text: 'No projects yet.' });
  for (const p of projects) {
    const section = sectionForProject(p.name);
    const rep = section ? reports.find((r) => r.section === section) : null;
    blocks.push({
      t: 'card',
      title: p.name,
      sub: p.status_label || (rep ? rep.summary : ''),
      dot: DOT_STYLE[p.status_color] || 'empty',
      go: 'project',
      id: p.id,
    });
  }
  return { page: 'projects', blocks, stamp: sydneyClock(now) };
}

export function buildProject({ base, id, now = new Date() }) {
  const p = base.projects.find((x) => String(x.id) === String(id));
  if (!p) {
    return {
      page: 'projects',
      blocks: [{ t: 'back', text: 'Projects', go: 'projects' }, { t: 'title', text: 'Not found' }, { t: 'line', text: 'That project no longer exists.' }],
      stamp: sydneyClock(now),
    };
  }
  const reports = latestReports(base.nightRows);
  const section = sectionForProject(p.name);
  const rep = section ? reports.find((r) => r.section === section) : null;
  const roadmap = (Array.isArray(p.roadmap) ? p.roadmap : []).filter((i) => i && i.status !== 'done');

  const blocks = [
    { t: 'back', text: 'Projects', go: 'projects' },
    { t: 'title', text: p.name, sub: p.status_label || '' },
  ];
  if (p.last_update) {
    blocks.push({ t: 'head', text: "Where it's at" });
    blocks.push({ t: 'wrap', text: String(p.last_update), lines: 6 });
    blocks.push({ t: 'rule' });
  }
  if (rep) {
    blocks.push({ t: 'head', text: `${SECTION_LABELS[rep.section] || 'Last night'}  -  ${rep.status}` });
    blocks.push({ t: 'wrap', text: rep.summary, lines: 4 });
    for (const n of (rep.needs_you || []).slice(0, 3)) blocks.push({ t: 'wrap', text: `Needs you: ${n}`, lines: 2, bold: true });
    blocks.push({ t: 'rule' });
  }
  blocks.push({ t: 'head', text: 'Roadmap' });
  if (roadmap.length === 0) blocks.push({ t: 'line', text: 'Nothing open.' });
  for (const item of roadmap.slice(0, 10)) {
    blocks.push({ t: 'wrap', text: `${item.status === 'in_progress' ? '> ' : '- '}${item.title}`, lines: 2 });
  }
  const metrics = (Array.isArray(p.metrics) ? p.metrics : []).slice(0, 4);
  if (metrics.length) {
    blocks.push({ t: 'rule' });
    blocks.push({ t: 'head', text: 'At a glance' });
    for (const m of metrics) blocks.push({ t: 'row', left: m.label, right: `${m.unit === '$' ? '$' : ''}${m.value}${m.unit && m.unit !== '$' ? m.unit : ''}` });
  }
  return { page: 'projects', blocks, stamp: sydneyClock(now) };
}

export function buildNews({ news, now = new Date() }) {
  const blocks = [{ t: 'title', text: 'News', sub: 'ABC News' }];
  if (!news) {
    blocks.push({ t: 'line', text: 'News is unavailable right now.' });
  } else {
    for (const n of news.slice(0, 6)) {
      blocks.push({ t: 'wrap', text: n.title, bold: true, lines: 3 });
      if (n.summary) blocks.push({ t: 'wrap', text: n.summary, size: 'small', lines: 2 });
      blocks.push({ t: 'gap' });
    }
  }
  return { page: 'news', blocks, stamp: sydneyClock(now) };
}

// One call for the route: work out which data a page needs and build it.
export async function buildScene({ page, id }, { db, fetchImpl = fetch, now = new Date() }) {
  const wantsBase = page === 'home' || page === 'projects' || page === 'project';
  const [base, weather, news] = await Promise.all([
    wantsBase ? loadBase(db, now) : null,
    page === 'home' || page === 'weather' ? getWeather(fetchImpl) : null,
    page === 'home' || page === 'news' ? getNews(fetchImpl) : null,
  ]);
  if (page === 'weather') return buildWeather({ weather, now });
  if (page === 'news') return buildNews({ news, now });
  if (page === 'projects') return id ? buildProject({ base, id, now }) : buildProjects({ base, now });
  if (page === 'project') return buildProject({ base, id, now });
  return buildHome({ base, weather, news, now });
}

// ----------------------------------------------------------------- render

// Draws a scene and returns { png, zones }. Zones are fractions of the image
// (0 to 1) so they stay right whatever size the Kindle asked for.
export function renderScene(createCanvas, scene, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const zones = [];

  const pad = Math.round(width * 0.06);
  const gap = Math.round(width * 0.018);
  const SIZE = {
    big: Math.round(width * 0.17),
    title: Math.round(width * 0.052),
    head: Math.round(width * 0.038),
    body: Math.round(width * 0.032),
    small: Math.round(width * 0.027),
    tab: Math.round(width * 0.032),
  };
  const topBar = Math.round(height * 0.055);
  const tabH = Math.round(height * 0.075);
  const bottom = height - tabH - Math.round(height * 0.035); // keep room for the footer line
  const font = (px, bold) => `${bold ? 'bold ' : ''}${px}px sans-serif`;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.textBaseline = 'alphabetic';

  const zone = (x, y, w, h, extra) =>
    zones.push({ x: +(x / width).toFixed(4), y: +(y / height).toFixed(4), w: +(w / width).toFixed(4), h: +(h / height).toFixed(4), ...extra });

  function wrapLines(text, px, bold, maxW, maxLines) {
    ctx.font = font(px, bold);
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width <= maxW || !cur) cur = next;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
    return lines;
  }
  function fit(text, px, bold, maxW) {
    ctx.font = font(px, bold);
    let t = String(text);
    if (ctx.measureText(t).width <= maxW) return t;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
    return `${t}…`;
  }
  function dot(cx, cy, r, style) {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (style === 'filled') ctx.fill();
    else ctx.stroke();
    if (style === 'half') {
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI / 2, (Math.PI * 3) / 2);
      ctx.fill();
    }
    if (style === 'ring') {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Top bar: Close on the right.
  ctx.font = font(SIZE.small, true);
  const closeLabel = 'Close  X';
  const cw = ctx.measureText(closeLabel).width;
  ctx.fillText(closeLabel, width - pad - cw, Math.round(topBar * 0.7));
  zone(width * 0.55, 0, width * 0.45, topBar, { go: 'close' });

  let y = topBar + gap;
  const room = (need) => y + need <= bottom;
  let clipped = false;

  for (const b of scene.blocks) {
    if (clipped) break;
    const startY = y;
    let need = SIZE.body + gap;
    if (b.t === 'title') need = SIZE.title + SIZE.body + gap * 2;
    if (b.t === 'big') need = SIZE.big + gap;
    if (!room(need)) {
      clipped = true;
      break;
    }

    if (b.t === 'back') {
      ctx.font = font(SIZE.body, true);
      ctx.fillText(`< ${b.text}`, pad, y + SIZE.body);
      zone(0, y - gap, width * 0.5, SIZE.body + gap * 3, { go: b.go });
      y += SIZE.body + gap * 1.5;
    } else if (b.t === 'title') {
      ctx.font = font(SIZE.title, true);
      ctx.fillText(fit(b.text, SIZE.title, true, width - pad * 2), pad, y + SIZE.title);
      y += SIZE.title + gap * 0.6;
      if (b.sub) {
        ctx.font = font(SIZE.small, false);
        ctx.fillText(fit(b.sub, SIZE.small, false, width - pad * 2), pad, y + SIZE.small);
        y += SIZE.small + gap;
      }
      y += gap;
    } else if (b.t === 'big') {
      ctx.font = font(SIZE.big, true);
      ctx.fillText(b.text, pad, y + SIZE.big * 0.9);
      y += SIZE.big + gap;
    } else if (b.t === 'head') {
      ctx.font = font(SIZE.head, true);
      ctx.fillText(fit(b.text, SIZE.head, true, width - pad * 2), pad, y + SIZE.head);
      y += SIZE.head + gap;
    } else if (b.t === 'line') {
      const px = b.size === 'small' ? SIZE.small : SIZE.body;
      ctx.font = font(px, b.bold);
      const text = fit(b.text, px, b.bold, width - pad * 2);
      ctx.fillText(text, pad, y + px);
      if (b.strike) {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pad, y + px * 0.55);
        ctx.lineTo(pad + ctx.measureText(text).width, y + px * 0.55);
        ctx.stroke();
      }
      if (b.go) zone(0, y - gap / 2, width, px + gap * 1.5, { go: b.go });
      y += px + gap * 1.3;
    } else if (b.t === 'wrap') {
      const px = b.size === 'small' ? SIZE.small : SIZE.body;
      const lines = wrapLines(b.text, px, b.bold, width - pad * 2, b.lines || 3);
      ctx.font = font(px, b.bold);
      const top = y;
      for (const l of lines) {
        ctx.fillText(l, pad, y + px);
        y += px + gap * 0.5;
      }
      if (b.go) zone(0, top - gap / 2, width, y - top + gap, { go: b.go });
      y += gap * 0.8;
    } else if (b.t === 'row') {
      ctx.font = font(SIZE.body, false);
      const right = String(b.right || '');
      const rw = ctx.measureText(right).width;
      ctx.fillText(fit(b.left, SIZE.body, false, width - pad * 2 - rw - gap), pad, y + SIZE.body);
      ctx.fillText(right, width - pad - rw, y + SIZE.body);
      y += SIZE.body + gap * 1.3;
    } else if (b.t === 'card') {
      const h = SIZE.head + SIZE.small + gap * 3.2;
      if (!room(h)) {
        clipped = true;
        break;
      }
      const r = Math.round(SIZE.head * 0.42);
      dot(pad + r, y + h / 2, r, b.dot);
      const tx = pad + r * 2 + gap * 1.4;
      ctx.font = font(SIZE.head, true);
      ctx.fillText(fit(b.title, SIZE.head, true, width - tx - pad - SIZE.head), tx, y + gap + SIZE.head);
      if (b.sub) {
        ctx.font = font(SIZE.small, false);
        ctx.fillText(fit(b.sub, SIZE.small, false, width - tx - pad - SIZE.head), tx, y + gap * 1.6 + SIZE.head + SIZE.small);
      }
      ctx.font = font(SIZE.head, true);
      ctx.fillText('>', width - pad - SIZE.head * 0.5, y + h / 2 + SIZE.head * 0.35);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pad, y + h);
      ctx.lineTo(width - pad, y + h);
      ctx.stroke();
      zone(0, y, width, h, { go: b.go, id: String(b.id) });
      y += h + gap * 0.4;
    } else if (b.t === 'rule') {
      y += gap * 0.4;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();
      y += gap * 1.4;
    } else if (b.t === 'gap') {
      y += gap * 0.8;
    }
    if (y === startY) y += 1;
  }

  if (clipped) {
    ctx.font = font(SIZE.small, false);
    ctx.fillText('… more on the website', pad, bottom + SIZE.small);
  }

  // Footer: when this page was drawn.
  ctx.font = font(SIZE.small, false);
  const stamp = `Updated ${scene.stamp || ''}`;
  ctx.fillText(stamp, pad, height - tabH - Math.round(SIZE.small * 0.6));

  // Bottom tab bar. Tapping a tab jumps straight to that page.
  const tabW = width / PAGES.length;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, height - tabH);
  ctx.lineTo(width, height - tabH);
  ctx.stroke();
  PAGES.forEach((p, i) => {
    const active = p === scene.page;
    if (active) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(i * tabW, height - tabH, tabW, tabH);
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = '#000000';
    }
    ctx.font = font(SIZE.tab, active);
    const tw = ctx.measureText(TAB_LABELS[p]).width;
    ctx.fillText(TAB_LABELS[p], i * tabW + (tabW - tw) / 2, height - tabH / 2 + SIZE.tab * 0.35);
    ctx.fillStyle = '#000000';
    zone(i * tabW, height - tabH, tabW, tabH, { go: p });
  });

  return { png: canvas.toBuffer('image/png'), zones };
}

// The error screen: still a picture, because a Kindle with no console can't
// show anything else.
export function errorScene(message) {
  return {
    page: 'home',
    blocks: [{ t: 'title', text: 'Something went wrong' }, { t: 'wrap', text: String(message || 'Unknown error'), lines: 6 }],
    stamp: '',
  };
}

export function zonesHeader(zones) {
  // Header values must be plain ASCII.
  return JSON.stringify(zones).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export { addDaysISO };
