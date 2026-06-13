export default function ValueBadge({ score }) {
  if (score === null || score === undefined) return null;

  let label = 'Fair';
  let badgeClass = 'bg-bgrey text-ink';

  if (score > 1.15) {
    label = 'Good value';
    badgeClass = 'bg-lime text-ink';
  } else if (score < 0.85) {
    label = 'Expensive';
    badgeClass = 'bg-bred text-white';
  }

  return (
    <span className={`inline-block border-2 border-ink px-[0.625rem] py-[0.1875rem] text-[0.6875rem] font-extrabold uppercase tracking-wide rounded-none select-none ${badgeClass}`}>
      {label}
    </span>
  );
}
