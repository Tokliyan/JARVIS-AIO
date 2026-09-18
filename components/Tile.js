// Small colour-coded square that carries meaning — which project or subject a
// row belongs to. Colour encodes information; it isn't decoration.
const TONES = {
  school: 'bg-[#E8F0FE] text-[#2B5CA8] dark:bg-[#1C2C46] dark:text-[#8FB4EA]',
  radext: 'bg-[#E9F3EC] text-[#2F6F4E] dark:bg-[#173226] dark:text-[#7FC7A0]',
  runehaven: 'bg-[#F3ECFB] text-[#6B44A8] dark:bg-[#2B2044] dark:text-[#C0A4EA]',
  leadlens: 'bg-[#EEF6E4] text-[#4F7A20] dark:bg-[#25341A] dark:text-[#A8D97A]',
  ambient: 'bg-[#FDF0E4] text-[#B4761F] dark:bg-[#3B2817] dark:text-[#E0B36A]',
  routine: 'bg-[#F0EFEC] text-[#6E6B66] dark:bg-[#2B2A27] dark:text-[#B5B0A8]',
  general: 'bg-[#F0EFEC] text-[#6E6B66] dark:bg-[#2B2A27] dark:text-[#B5B0A8]',
};

export function toneFor(tag = '') {
  const t = tag.toLowerCase();
  if (t.startsWith('school')) return 'school';
  if (t.includes('rade')) return 'radext';
  if (t.includes('rune')) return 'runehaven';
  if (t.includes('lead')) return 'leadlens';
  if (t.includes('ambient')) return 'ambient';
  if (t.includes('routine')) return 'routine';
  return 'general';
}

export default function Tile({ tag, children, size = 'md' }) {
  const tone = TONES[toneFor(tag)] || TONES.general;
  const dims = size === 'sm' ? 'h-5 w-5 text-[10px]' : 'h-7 w-7 text-xs';
  const label = children ?? (tag || '?').replace(/^school · /i, '').slice(0, 2);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded font-medium ${dims} ${tone}`}
    >
      {label}
    </span>
  );
}
