// Kindle dashboard data and pages. Turns database rows, weather, markets and
// news into "scenes" (lists of block specs) that lib/kindleDraw.js paints.
//
// Pages: home, weather, news, article, projects, project (tabs: next, done,
// nights, notes). Everything outside the database fails soft: if weather,
// markets or news can't be fetched the page says so, or shows the last good copy.

import crypto from 'node:crypto';
import { sydneyNow, addDaysISO, fmtTime } from '@/lib/kindleCommand';
import { latestPerSection, needsYouFor } from '@/lib/nightRun';
import { renderScene, zonesHeader, errorScene } from '@/lib/kindleDraw';

export { renderScene, zonesHeader, errorScene, addDaysISO };

export const PAGE_NAMES = ['home', 'weather', 'news', 'article', 'projects', 'project'];
export const TABS = ['next', 'done', 'nights', 'notes'];

// Castle Hill NSW. School hours drive the "Leave / Home" line on Weather.
export const WEATHER_PLACE = { name: 'Castle Hill', lat: -33.7311, lon: 151.0044 };
export const SCHOOL = { leaveHour: 8, leaveLabel: '8:00am', homeHour: 15, homeLabel: '3:15pm' };

export const FEEDS = {
  money: { url: 'https://www.abc.net.au/news/feed/104217374/rss.xml', tag: 'MONEY', source: 'ABC Business' },
  politics: { url: 'https://www.abc.net.au/news/feed/104217372/rss.xml', tag: 'POLITICS', source: 'ABC Politics' },
};
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; JARVIS-AIO Kindle dashboard)' };

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

// ------------------------------------------------------------- tiny cache

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
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(6000), headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function getText(url, fetchImpl, ms = 8000) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(ms), headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ---------------------------------------------------------------- weather

const WMO = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail',
};
export const weatherText = (code) => WMO[code] || 'Unknown';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (deg) => (Number.isFinite(deg) ? COMPASS[Math.round(deg / 45) % 8] : '');
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'pm' : 'am'}`;
const clockLabel = (iso) => {
  const m = /T(\d{2}):(\d{2})/.exec(iso || '');
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]}${h >= 12 ? 'pm' : 'am'}`;
};
const uvWord = (uv) => (uv >= 11 ? 'Extreme' : uv >= 8 ? 'Very high' : uv >= 6 ? 'High' : uv >= 3 ? 'Moderate' : 'Low');

export function parseWeather(json) {
  if (!json || !json.current || !json.daily) return null;
  const c = json.current;
  const d = json.daily;
  const date = String(c.time || '').slice(0, 10);
  const days = (d.time || []).map((day, i) => ({
    date: day,
    code: d.weather_code?.[i],
    max: Math.round(d.temperature_2m_max?.[i]),
    min: Math.round(d.temperature_2m_min?.[i]),
    rain: d.precipitation_probability_max?.[i] ?? null,
  }));
  // Hour-by-hour for today, keyed by hour of the day.
  const byHour = {};
  const h = json.hourly;
  if (h && Array.isArray(h.time)) {
    h.time.forEach((t, i) => {
      if (String(t).slice(0, 10) !== date) return;
      byHour[Number(String(t).slice(11, 13))] = { temp: Math.round(h.temperature_2m?.[i]), rain: h.precipitation_probability?.[i] ?? 0 };
    });
  }
  return {
    date,
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature),
    code: c.weather_code,
    wind: Math.round(c.wind_speed_10m),
    windDir: compass(c.wind_direction_10m),
    days,
    byHour,
    sunrise: clockLabel(d.sunrise?.[0]),
    sunset: clockLabel(d.sunset?.[0]),
    uv: d.uv_index_max?.[0] != null ? Math.round(d.uv_index_max[0]) : null,
  };
}

export function getWeather(fetchImpl = fetch) {
  const { lat, lon } = WEATHER_PLACE;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m' +
    '&hourly=temperature_2m,precipitation_probability' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max' +
    '&timezone=Australia%2FSydney&forecast_days=5';
  return cached('weather', 15 * 60_000, async () => parseWeather(await getJson(url, fetchImpl)));
}

// "Umbrella: not needed" and the Leave / Home line, from today's hours.
export function umbrellaAdvice(w) {
  const hours = Object.keys(w.byHour).map(Number).sort((a, b) => a - b);
  const day = hours.filter((h) => h >= 6 && h <= 21);
  if (!day.length) return { title: 'Umbrella: no data', line1: 'No hourly rain data yet.', line2: '' };
  let peak = day[0];
  for (const h of day) if (w.byHour[h].rain > w.byHour[peak].rain) peak = h;
  const max = w.byHour[peak].rain;
  const school = hours.filter((h) => h >= SCHOOL.leaveHour && h <= SCHOOL.homeHour);
  const wetSchool = school.some((h) => w.byHour[h].rain >= 40);
  const needed = max >= 40;
  const at = (h) => (w.byHour[h] ? `${w.byHour[h].temp}°` : '—');
  return {
    title: needed ? 'Umbrella: take one' : 'Umbrella: not needed',
    line1: `${needed ? 'Rain likely around' : 'Rain peaks'} ${hourLabel(peak)} (${max}%). ${wetSchool ? 'Wet during school.' : 'Dry for school.'}`,
    line2: `Leave ${SCHOOL.leaveLabel}  ${at(SCHOOL.leaveHour)}     Home ${SCHOOL.homeLabel}  ${at(SCHOOL.homeHour)}`,
  };
}

// ---------------------------------------------------------------- markets

const money = (n, d = 0) => n.toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (now, prev) => (prev ? ((now - prev) / prev) * 100 : 0);
const changeText = (p) => `${p >= 0 ? '+' : '-'}${Math.abs(p).toFixed(1)}%`;
const dirOf = (p) => (Math.abs(p) < 0.05 ? 0 : p > 0 ? 1 : -1);
const PLACEHOLDER = (label) => ({ label, value: '—', change: 'n/a', dir: 0 });

export function parseYahoo(json, label) {
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice == null) return PLACEHOLDER(label);
  const prev = meta.chartPreviousClose ?? meta.previousClose;
  const p = pct(meta.regularMarketPrice, prev);
  return { label, value: money(meta.regularMarketPrice), change: changeText(p), dir: dirOf(p) };
}
export function parseFrankfurter(json, label) {
  const dates = Object.keys(json?.rates || {}).sort();
  if (dates.length < 1) return PLACEHOLDER(label);
  const now = json.rates[dates[dates.length - 1]]?.USD;
  const prev = dates.length > 1 ? json.rates[dates[dates.length - 2]]?.USD : null;
  if (now == null) return PLACEHOLDER(label);
  const p = prev ? pct(now, prev) : 0;
  return { label, value: now.toFixed(3), change: prev ? changeText(p) : 'n/a', dir: prev ? dirOf(p) : 0 };
}
export function parseCoinGecko(json, id, label) {
  const row = json?.[id];
  if (!row || row.aud == null) return PLACEHOLDER(label);
  const v = row.aud >= 10000 ? `$${(row.aud / 1000).toFixed(1)}k` : `$${money(row.aud)}`;
  const p = row.aud_24h_change ?? 0;
  return { label, value: v, change: changeText(p), dir: dirOf(p) };
}

export function getMarkets(fetchImpl = fetch) {
  return cached('markets', 10 * 60_000, async () => {
    const start = addDaysISO(sydneyNow().iso, -8);
    const jobs = [
      getJson('https://query1.finance.yahoo.com/v8/finance/chart/%5EAXJO?interval=1d&range=5d', fetchImpl).then((j) => parseYahoo(j, 'ASX 200')),
      getJson(`https://api.frankfurter.app/${start}..?from=AUD&to=USD`, fetchImpl).then((j) => parseFrankfurter(j, 'AUD/USD')),
      getJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=aud&include_24hr_change=true', fetchImpl).then((j) => [
        parseCoinGecko(j, 'bitcoin', 'Bitcoin'),
        parseCoinGecko(j, 'ethereum', 'Ethereum'),
      ]),
    ];
    const res = await Promise.allSettled(jobs);
    const pick = (i, label) => (res[i].status === 'fulfilled' ? res[i].value : PLACEHOLDER(label));
    const coins = res[2].status === 'fulfilled' ? res[2].value : [PLACEHOLDER('Bitcoin'), PLACEHOLDER('Ethereum')];
    const items = [pick(0, 'ASX 200'), pick(1, 'AUD/USD'), ...coins];
    // All four failing means "no data", not four dashes worth caching.
    return items.every((m) => m.value === '—') ? null : items;
  });
}

// ------------------------------------------------------------------- news

function decodeEntities(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const storyId = (link, title = '') => crypto.createHash('sha1').update(String(link || title)).digest('hex').slice(0, 10);

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
    if (!title) continue;
    const link = tag('link') || tag('guid');
    items.push({ id: storyId(link, title), title, summary: tag('description'), link, date: tag('pubDate') });
  }
  return items;
}

export function ago(dateStr, now = new Date()) {
  const t = Date.parse(dateStr);
  if (!Number.isFinite(t)) return '';
  const mins = Math.max(0, Math.round((now.getTime() - t) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

// Three money and three politics stories, each tagged.
export async function getNews(fetchImpl = fetch) {
  const lists = await Promise.all(
    Object.entries(FEEDS).map(([key, f]) =>
      cached(`news:${key}`, 30 * 60_000, async () => {
        const items = parseRss(await getText(f.url, fetchImpl), 6);
        return items.length ? items : null;
      }).then((items) => (items || []).slice(0, 3).map((it) => ({ ...it, tag: f.tag, source: f.source, dark: key === 'politics' }))),
    ),
  );
  const all = lists.flat();
  return all.length ? all : null;
}

// Pull the readable paragraphs out of an article page.
export function extractParagraphs(html) {
  const cleaned = String(html || '').replace(/<(script|style|noscript|svg|figure|aside|nav|header|footer|form)[\s\S]*?<\/\1>/gi, '');
  const art = /<article[\s\S]*?<\/article>/i.exec(cleaned)?.[0] || cleaned;
  const seen = new Set();
  const out = [];
  for (const m of art.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = decodeEntities(m[1]);
    if (t.length < 45 || seen.has(t)) continue;
    if (/^(posted|updated|share|related|topics?:|copyright|sign up|subscribe|abc news|more on)/i.test(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// Keep each block short enough to land on one page: split long paragraphs at sentence ends.
export function chunkParagraphs(paras, max = 420) {
  const out = [];
  for (const p of paras) {
    if (p.length <= max) {
      out.push(p);
      continue;
    }
    let cur = '';
    for (const s of p.split(/(?<=[.!?])\s+/)) {
      if (cur && cur.length + s.length + 1 > max) {
        out.push(cur);
        cur = s;
      } else cur = cur ? `${cur} ${s}` : s;
    }
    if (cur) out.push(cur);
  }
  return out;
}

const allowedArticleHost = (link) => {
  try {
    const h = new URL(link).hostname;
    return h === 'abc.net.au' || h.endsWith('.abc.net.au');
  } catch {
    return false;
  }
};

export function getArticle(link, fetchImpl = fetch) {
  if (!allowedArticleHost(link)) return Promise.resolve(null);
  return cached(`article:${link}`, 60 * 60_000, async () => {
    const paras = extractParagraphs(await getText(link, fetchImpl, 10000));
    return paras.length >= 2 ? { paras } : null;
  });
}

// ---------------------------------------------------------------- database

export async function loadBase(db, now = new Date()) {
  const { iso, dow } = sydneyNow(now);
  const owner = process.env.AIO_OWNER_ID || '04b4fa14-b541-4b23-92d6-886d6202d727';
  const [settings, periods, tasks, projects, nightRows] = await Promise.all([
    db.from('aio_settings').select('value').eq('user_id', owner).eq('key', 'current_week').maybeSingle(),
    db.from('aio_timetable').select('*').eq('user_id', owner).eq('day_of_week', dow).order('start_time'),
    db.from('aio_checklist').select('*').eq('user_id', owner).eq('due_date', iso),
    db.from('aio_projects').select('*').eq('user_id', owner),
    db.from('aio_night_runs').select('*').eq('user_id', owner).order('run_date', { ascending: false }).limit(90),
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

const latestReports = (nightRows) => {
  const date = nightRows[0]?.run_date;
  return date ? latestPerSection(nightRows.filter((r) => r.run_date === date)) : [];
};

// ---------------------------------------------------------------- time text

const WEEKDAY = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short' });
const DAYMON = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const utc = (iso) => new Date(`${iso}T00:00:00Z`);
export function dayLabel(iso, today) {
  if (!iso) return 'Earlier';
  if (iso === today) return 'Today';
  if (iso === addDaysISO(today, -1)) return 'Yesterday';
  return `${WEEKDAY.format(utc(iso))} ${DAYMON.format(utc(iso))}`;
}
const groupLabel = (iso, today) => (!iso ? 'EARLIER' : iso === today ? `TODAY · ${WEEKDAY.format(utc(iso)).toUpperCase()}` : dayLabel(iso, today).toUpperCase());
const shortDay = (iso, today) => (iso === today ? 'today' : WEEKDAY.format(utc(iso)));
const sydneyStamp = (now) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'short' }).format(now);
const sydneyClock = (now) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', minute: '2-digit', hour12: true }).format(now).replace(/\s/g, '').toLowerCase();

// -------------------------------------------------------- project model

const STATUS_WORD = { good: 'ON TRACK', warn: 'WATCH', bad: 'BLOCKED', idle: 'IDEA' };
const isoDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

export function projectModel(p, nightRows, today) {
  const section = sectionForProject(p.name);
  const roadmap = (Array.isArray(p.roadmap) ? p.roadmap : []).filter((i) => i && i.title);
  const open = [
    ...roadmap.filter((i) => i.status === 'in_progress'),
    ...roadmap.filter((i) => i.status !== 'in_progress' && i.status !== 'done'),
  ];
  const doneRoadmap = roadmap.filter((i) => i.status === 'done');

  // One report per night for this project, newest first.
  const perNight = new Map();
  for (const r of nightRows.filter((r) => r.section === section)) {
    const prev = perNight.get(r.run_date);
    if (!prev || String(r.created_at) > String(prev.created_at)) perNight.set(r.run_date, r);
  }
  const nights = [...perNight.values()].sort((a, b) => String(b.run_date).localeCompare(String(a.run_date))).slice(0, 7);

  const seen = new Set();
  const doneItems = [];
  const add = (title, date) => {
    const key = String(title).trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    doneItems.push({ title: String(title).trim(), date });
  };
  doneRoadmap.forEach((i) => add(i.title, isoDate(i.done_at)));
  for (const n of nights) {
    const built = Array.isArray(n.details?.built) ? n.details.built : [];
    built.forEach((b) => add(typeof b === 'string' ? b : b?.title || '', n.run_date));
  }
  doneItems.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const latest = nights[0];
  const needs = latest?.needs_you || [];
  const pill = needs.length ? { text: 'NEEDS YOU', dark: true } : { text: String(p.status_label || STATUS_WORD[p.status_color] || 'ACTIVE').toUpperCase().slice(0, 12), dark: false };
  const notes = (Array.isArray(p.notes) ? p.notes : []).filter((n) => n && (n.heading || n.body));
  const weekAgo = addDaysISO(today, -6);

  return {
    id: p.id,
    name: p.name,
    section,
    open,
    inProgress: open.filter((i) => i.status === 'in_progress'),
    queued: open.filter((i) => i.status !== 'in_progress'),
    doneItems,
    doneThisWeek: doneItems.filter((d) => d.date && d.date >= weekAgo).length,
    roadmapDone: doneRoadmap.length,
    roadmapTotal: roadmap.length,
    nights,
    needs,
    latest,
    notes,
    pill,
    lead: p.last_update || '',
  };
}

// ------------------------------------------------------------------ scenes

export function buildHome({ base, weather, news, now = new Date() }) {
  const blocks = [{ t: 'title', text: 'Today', sub: `${sydneyStamp(now)}  ·  Week ${base.week}` }];
  if (weather) {
    const d0 = weather.days[0];
    blocks.push({ t: 'weatherChip', temp: weather.temp, condition: weatherText(weather.code), sub: d0 ? `High ${d0.max}°  ·  Low ${d0.min}°` : `Feels ${weather.feels}°` });
  }
  if (news && news[0]) blocks.push({ t: 'storyChip', tag: news[0].tag, dark: news[0].dark, title: news[0].title });
  blocks.push({ t: 'list', title: 'Schedule', rows: base.periods.map((p) => ({ l: p.subject, r: fmtTime(p.start_time) })), empty: 'No school today.' });
  blocks.push({ t: 'list', title: 'Due today', check: true, rows: base.tasks.map((t) => ({ l: t.title, done: t.status === 'done' })), empty: 'Nothing due today.' });
  const reports = latestReports(base.nightRows);
  if (reports.length) {
    const needs = needsYouFor(reports);
    if (needs.length) blocks.push({ t: 'callout', label: 'NEEDS YOU', lines: needs.slice(0, 4) });
    else blocks.push({ t: 'text', text: 'Nothing needs you.' });
  }
  return { nav: 'home', eyebrow: sydneyStamp(now).toUpperCase(), stamp: sydneyClock(now), self: { go: 'home' }, blocks };
}

export function buildWeather({ weather, now = new Date() }) {
  const base = { nav: 'weather', eyebrow: `WEATHER  ·  ${WEATHER_PLACE.name.toUpperCase()}`, stamp: sydneyClock(now), self: { go: 'weather' } };
  if (!weather) return { ...base, blocks: [{ t: 'title', text: 'Weather' }, { t: 'text', text: 'Weather is unavailable right now. It will come back on the next refresh.', sz: 28 }] };
  const adv = umbrellaAdvice(weather);
  const hours = [6, 8, 10, 12, 14, 16, 18, 20].filter((h) => weather.byHour[h]).map((h) => ({ label: hourLabel(h), temp: weather.byHour[h].temp, rain: weather.byHour[h].rain }));
  const days = weather.days.slice(0, 5).map((d, i) => ({
    name: i === 0 ? 'Today' : WEEKDAY.format(utc(d.date)),
    text: weatherText(d.code),
    min: d.min,
    max: d.max,
    rain: d.rain,
  }));
  const chips = [];
  if (weather.sunrise) chips.push(`Sunrise ${weather.sunrise}`);
  if (weather.sunset) chips.push(`Sunset ${weather.sunset}`);
  if (weather.uv != null) chips.push(`UV ${weather.uv}  ${uvWord(weather.uv)}`);
  return {
    ...base,
    blocks: [
      { t: 'weatherHero', temp: weather.temp, code: weather.code, condition: weatherText(weather.code), sub: `Feels ${weather.feels}°  ·  Wind ${weather.wind} km/h ${weather.windDir}`.trim() },
      { t: 'umbrella', ...adv },
      { t: 'hourly', hours },
      { t: 'days', days },
      { t: 'chips', items: chips },
    ],
  };
}

export function buildNews({ news, markets, now = new Date() }) {
  const blocks = [{ t: 'title', text: 'Money & Politics', sub: 'Tap any story to read it' }];
  blocks.push({ t: 'markets', items: markets || [PLACEHOLDER('ASX 200'), PLACEHOLDER('AUD/USD'), PLACEHOLDER('Bitcoin'), PLACEHOLDER('Ethereum')] });
  if (!news) blocks.push({ t: 'text', text: 'News is unavailable right now. It will come back on the next refresh.', sz: 28 });
  for (const n of news || []) {
    blocks.push({ t: 'story', id: n.id, tag: n.tag, dark: n.dark, title: n.title, meta: `${n.source}${n.date ? ` · ${ago(n.date, now)}` : ''}` });
  }
  return { nav: 'news', eyebrow: 'NEWS  ·  MONEY & POLITICS', stamp: sydneyClock(now), self: { go: 'news' }, blocks };
}

export function buildArticle({ story, article, now = new Date() }) {
  const base = { nav: 'news', eyebrow: 'NEWS  ·  READING', stamp: sydneyClock(now), edgeTap: true };
  if (!story) {
    return { ...base, self: { go: 'news' }, blocks: [{ t: 'back', text: 'News', go: 'news' }, { t: 'title', text: 'Story not found' }, { t: 'text', text: 'That story has dropped off the list. Go back and tap it again.', sz: 28 }] };
  }
  const paras = article?.paras?.length ? article.paras : [story.summary || 'No text available for this story.'];
  const words = paras.join(' ').split(/\s+/).length;
  const meta = `${story.source}${story.date ? `  ·  ${ago(story.date, now)} ago` : ''}  ·  ${Math.max(1, Math.round(words / 200))} min read`;
  const blocks = [
    { t: 'back', text: 'News', go: 'news', tag: story.tag },
    { t: 'articleHead', title: story.title, meta },
    ...chunkParagraphs(paras).map((text) => ({ t: 'para', text })),
  ];
  if (!article) blocks.push({ t: 'text', text: 'Full story unavailable, showing the summary only.', sz: 22 });
  return { ...base, self: { go: 'article', id: story.id }, blocks };
}

export function buildProjects({ base, now = new Date() }) {
  const blocks = [{ t: 'title', text: 'Projects', sub: 'Tap one for everything inside' }];
  const models = base.projects.map((p) => projectModel(p, base.nightRows, base.iso));
  models.sort((a, b) => Number(b.needs.length > 0) - Number(a.needs.length > 0) || String(a.name).localeCompare(String(b.name)));
  if (!models.length) blocks.push({ t: 'text', text: 'No projects yet.', sz: 28 });
  for (const m of models) {
    const last = m.doneItems[0];
    blocks.push({
      t: 'project',
      id: m.id,
      name: m.name,
      pill: m.pill.text,
      dark: m.pill.dark,
      done: m.roadmapDone,
      total: m.roadmapTotal,
      doneLine: last ? `${last.title} · ${last.date ? shortDay(last.date, base.iso) : 'earlier'}` : 'Nothing recorded yet',
      nextLine: m.open[0]?.title || 'Nothing queued',
    });
  }
  return { nav: 'projects', eyebrow: 'PROJECTS', stamp: sydneyClock(now), self: { go: 'projects' }, blocks };
}

const NIGHT_STYLE = { ok: { word: 'OK', dot: 'filled', dark: false }, warn: { word: 'LOOK', dot: 'ring', dark: true }, fail: { word: 'FAILED', dot: 'ring', dark: true } };

export function buildProject({ base, id, tab = 'next', now = new Date() }) {
  const p = base.projects.find((x) => String(x.id) === String(id));
  const stamp = sydneyClock(now);
  if (!p) {
    return { nav: 'projects', eyebrow: 'PROJECT', stamp, self: { go: 'projects' }, blocks: [{ t: 'back', text: 'Projects', go: 'projects' }, { t: 'title', text: 'Project not found' }, { t: 'text', text: 'That project no longer exists.', sz: 28 }] };
  }
  const m = projectModel(p, base.nightRows, base.iso);
  const active = TABS.includes(tab) ? tab : 'next';
  const blocks = [
    { t: 'back', text: 'Projects', go: 'projects', repeat: true },
    { t: 'projectHead', text: m.name, pill: m.pill.text, dark: m.pill.dark, repeat: true },
    {
      t: 'tabs',
      go: 'project',
      id: String(m.id),
      repeat: true,
      items: [
        { label: 'Next', count: m.open.length, tab: 'next', active: active === 'next' },
        { label: 'Done', count: m.doneItems.length, tab: 'done', active: active === 'done' },
        { label: 'Nights', count: m.nights.length, tab: 'nights', active: active === 'nights' },
        { label: 'Notes', count: m.notes.length, tab: 'notes', active: active === 'notes' },
      ],
    },
  ];

  if (active === 'next') {
    if (m.needs.length) blocks.push({ t: 'callout', label: 'NEEDS YOU', lines: m.needs.slice(0, 3) });
    if (m.inProgress.length) {
      blocks.push({ t: 'section', text: 'In progress' });
      for (const it of m.inProgress) {
        const steps = (Array.isArray(it.steps) ? it.steps : []).map((s) => (typeof s === 'string' ? { title: s, done: false } : { title: s.title || '', done: !!s.done })).filter((s) => s.title);
        blocks.push({ t: 'progressCard', title: it.title, steps, detail: it.detail });
      }
    }
    if (m.queued.length) {
      blocks.push({ t: 'section', text: 'Up next' });
      m.queued.forEach((it, i) => {
        const meta = [it.estimate, it.blocked ? `BLOCKED: ${it.blocked}` : '', it.detail && !it.estimate && !it.blocked ? it.detail : ''].filter(Boolean).join('  ·  ');
        blocks.push({ t: 'row', num: m.inProgress.length + i + 1, title: it.title, meta });
      });
    }
    if (!m.open.length) blocks.push({ t: 'text', text: 'Nothing queued. Add items on the roadmap tab of the website.', sz: 26 });
    if (m.latest) {
      const sql = Array.isArray(m.latest.details?.pending_sql) ? m.latest.details.pending_sql : [];
      blocks.push({ t: 'text', text: `Pending SQL: ${sql.length ? sql.join(', ') : 'none'}`, sz: 22 });
    }
    if (m.lead) blocks.push({ t: 'text', text: `Where it's at: ${m.lead}`, sz: 24, w: 400, col: '#333', max: 4 });
  } else if (active === 'done') {
    const okNights = m.nights.filter((n) => n.status === 'ok').length;
    blocks.push({ t: 'stats', items: [{ n: m.doneItems.length, label: 'done total' }, { n: m.doneThisWeek, label: 'this week' }, { n: `${okNights}/${m.nights.length}`, label: 'nights ok' }] });
    if (!m.doneItems.length) blocks.push({ t: 'text', text: 'Nothing recorded as done yet. Finished roadmap items and nightly builds show up here.', sz: 26 });
    let lastKey;
    for (const d of m.doneItems) {
      const key = d.date || 'earlier';
      if (key !== lastKey) {
        blocks.push({ t: 'section', text: groupLabel(d.date, base.iso) });
        lastKey = key;
      }
      blocks.push({ t: 'doneItem', text: d.title });
    }
  } else if (active === 'nights') {
    if (!m.section) blocks.push({ t: 'text', text: 'This project has no nightly run.', sz: 26 });
    else if (!m.nights.length) blocks.push({ t: 'text', text: 'No nightly reports yet.', sz: 26 });
    else blocks.push({ t: 'section', text: 'Last 7 nights' });
    for (const n of m.nights) {
      const st = NIGHT_STYLE[n.status] || NIGHT_STYLE.warn;
      const built = Array.isArray(n.details?.built) ? n.details.built.length : 0;
      blocks.push({ t: 'nightRow', date: dayLabel(n.run_date, base.iso), status: st.word, dark: st.dark, dotKey: st.dot === 'filled' ? 'good' : 'warn', summary: `${n.summary || ''}${built ? `  Built ${built}.` : ''}` });
    }
  } else {
    if (!m.notes.length) blocks.push({ t: 'text', text: 'No notes yet. Add them in the project page on the website.', sz: 26 });
    for (const n of m.notes.slice(0, 12)) blocks.push({ t: 'noteCard', heading: n.heading, body: n.body });
  }

  return { nav: 'projects', eyebrow: `PROJECT  ·  ${String(m.name).toUpperCase()}`, stamp, self: { go: 'project', id: String(m.id), tab: active }, blocks };
}

// One call for the route: work out what a page needs and build it.
export async function buildScene({ page, id, tab }, { db, fetchImpl = fetch, now = new Date() }) {
  const needsBase = ['home', 'projects', 'project'].includes(page);
  const needsNews = ['home', 'news', 'article'].includes(page);
  const [base, weather, news, markets] = await Promise.all([
    needsBase ? loadBase(db, now) : null,
    page === 'home' || page === 'weather' ? getWeather(fetchImpl) : null,
    needsNews ? getNews(fetchImpl) : null,
    page === 'news' ? getMarkets(fetchImpl) : null,
  ]);
  if (page === 'weather') return buildWeather({ weather, now });
  if (page === 'news') return buildNews({ news, markets, now });
  if (page === 'article') {
    const story = (news || []).find((n) => n.id === id);
    const article = story ? await getArticle(story.link, fetchImpl) : null;
    return buildArticle({ story, article, now });
  }
  if (page === 'projects') return buildProjects({ base, now });
  if (page === 'project') return buildProject({ base, id, tab, now });
  return buildHome({ base, weather, news, now });
}
