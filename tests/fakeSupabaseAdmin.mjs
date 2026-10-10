// In-memory stand-in for the Supabase admin client, used only by tests.
export const state = {
  tables: {},
  inserts: [],
  noDocNumberColumn: false,
};

export function resetState(tables = {}) {
  state.tables = structuredClone(tables);
  state.inserts = [];
  state.noDocNumberColumn = false;
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
  order(col, opts = {}) { this.ordering = [col, opts.ascending !== false]; return this; }
  limit(n) { this.max = n; return this; }
  insert(rows) { this.rows = Array.isArray(rows) ? rows : [rows]; return this; }
  maybeSingle() { this.mode = 'maybe'; return this.run(); }
  single() { this.mode = 'single'; return this.run(); }
  then(resolve, reject) { return this.run().then(resolve, reject); }

  async run() {
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
    let out = [...(state.tables[this.table] || [])];
    for (const [c, v] of this.filters) out = out.filter((r) => r[c] === v);
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
