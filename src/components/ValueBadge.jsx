export default function ValueBadge({ score }) {
  if (score === null || score === undefined) return null;

  if (score > 1.15) {
    return (
      <span className="inline-block border-2 border-ink px-[0.625rem] py-[0.1875rem] text-[0.6875rem] font-extrabold uppercase tracking-wide rounded-none select-none bg-lime text-ink">
        Good value
      </span>
    );
  }
  if (score < 0.85) {
    return (
      <span className="inline-block border-2 border-ink px-[0.625rem] py-[0.1875rem] text-[0.6875rem] font-extrabold uppercase tracking-wide rounded-none select-none bg-bred text-white">
        Expensive
      </span>
    );
  }
  return null;
}
