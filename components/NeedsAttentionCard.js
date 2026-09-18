export default function NeedsAttentionCard() {
  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="mb-2 text-xs text-muted">Needs attention</div>
      <p className="text-sm text-muted">
        Nothing to flag yet — this fills in once the Projects section is wired up to Rade.XT,
        RuneHaven, and LeadLens.
      </p>
    </div>
  );
}
