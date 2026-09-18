'use client';

import { useState } from 'react';

// Placeholder only — intent parsing and routing to the aio_ tables
// gets wired up in the last build phase, once every section it needs
// to talk to already exists.
export default function CommandBar() {
  const [value, setValue] = useState('');

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add this to the timetable, give me a summary for tomorrow…"
          className="flex-1 rounded border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
    </div>
  );
}
