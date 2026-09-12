import { getValueVerdict } from '../utils/confidence';

export default function ValueBadge({ score, confidence = 'medium', showTypical = false }) {
  if (score === null || score === undefined) return null;

  const { verdict, label } = getValueVerdict(score, confidence);

  if (verdict === 'good_value') {
    return (
      <span className="inline-block border-2 border-ink px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider rounded-none select-none bg-lime text-ink shadow-[1px_1px_0_#111111]">
        {label}
      </span>
    );
  }
  if (verdict === 'potential_value') {
    return (
      <span className="inline-block border-2 border-ink px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider rounded-none select-none bg-yellow text-ink shadow-[1px_1px_0_#111111]">
        {label}
      </span>
    );
  }
  if (verdict === 'premium_price') {
    return (
      <span className="inline-block border-2 border-ink px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider rounded-none select-none bg-ink text-paper shadow-[1px_1px_0_#111111]">
        {label}
      </span>
    );
  }
  if (verdict === 'typical_price' && showTypical) {
    return (
      <span className="inline-block border border-ink/40 bg-paper text-ink/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-none select-none">
        {label}
      </span>
    );
  }
  return null;
}
