// In-memory stand-in for the Supabase admin client, used only by tests.
export const state = {
  tables: {},
  inserts: [],
  noDocNumberColumn: false,
  missingTables: [],
};

export function resetState(tables = {}) {
  state.tables = structuredClone(tables);
  state.inserts = [];
  state.noDocNumberColumn = false;
  state.missingTables = [];
}

let idCounter = 0;

class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.cols = '*';
    this.ordering = null;
    this.max = null;
    this.rows = null;
    this.mode = 'many';
  }
  select(cols = '*') { this.cols = cols; return this; }
  eq(col, val) { this.filters.push([col, val]); return this; }
  in(col, vals) { this.filters.push([col, vals, 'in']); return this; }
  update(patch) { this.patch = patch; return this; }
  order(col, opts = {}) { this.ordering = [col, opts.ascending !== false]; return this; }
  limit(n) { this.max = n; return this; }
  insert(rows) { this.rows = Array.isArray(rows) ? rows : [rows]; return this; }
  maybeSingle() { this.mode = 'maybe'; return this.run(); }
  single() { this.mode = 'single'; return this.run(); }
  then(resolve, reject) { return this.run().then(resolve, reject); }

  async run() {
    if (state.missingTables.includes(this.table)) {
      return { data: null, error: { message: `Could not find the table 'public.${this.table}' in the schema cache` } };
    }
    if (
      this.table === 'aio_studyboy_docs' &&
      state.noDocNumberColumn &&
      String(this.cols).includes('doc_number')
    ) {
      return { data: null, error: { message: 'column aio_studyboy_docs.doc_number does not exist' } };
    }
    if (this.rows) {
      const stored = this.rows.map((r) => ({ id: `id-${++idCounter}`, ...r }));
      (state.tables[this.table] ||= []).push(...stored);
      state.inserts.push({ table: this.table, rows: stored });
      return { data: this.mode === 'single' ? stored[0] : stored, error: null };
    }
    const match = (r) => this.filters.every(([c, v, op]) => (op === 'in' ? v.includes(r[c]) : r[c] === v));
    if (this.patch) {
      const hit = (state.tables[this.table] || []).filter(match);
      hit.forEach((r) => Object.assign(r, this.patch));
      return { data: hit, error: null };
    }
    let out = (state.tables[this.table] || []).filter(match);
    if (this.ordering) {
      const [c, asc] = this.ordering;
      out.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
    }
    if (this.max != null) out = out.slice(0, this.max);
    if (this.mode === 'maybe') return { data: out[0] ?? null, error: null };
    if (this.mode === 'single') return { data: out[0] ?? null, error: out[0] ? null : { message: 'no rows' } };
    return { data: out, error: null };
  }
}

export function supabaseAdmin() {
  return { from: (table) => new Query(table) };
}
