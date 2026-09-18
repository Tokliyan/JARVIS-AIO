// Small tracked label above a group — the section-heading treatment from the
// reference design. Used sparingly, only where a group genuinely needs naming.
export default function SectionLabel({ children }) {
  return (
    <div className="mb-3 font-mono text-2xs uppercase tracking-wider text-faint">{children}</div>
  );
}
