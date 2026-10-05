const BASE = 'inline-block px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider rounded-none select-none whitespace-nowrap';

/**
 * Value verdict chip. Takes a valuation from utils/valuation.getListingValuation
 * so sample-size confidence is always reflected (Good vs Potential vs Unrated).
 */
export default function ValueBadge({ valuation, showTypical = false }) {
  if (!valuation || valuation.score === null) return null;
  const { verdict, label } = valuation;

  if (verdict === 'good_value') {
    return <span className={`${BASE} border-2 border-ink bg-lime text-ink shadow-[1px_1px_0_#111111]`}>{label}</span>;
  }
  if (verdict === 'potential_value') {
    return <span className={`${BASE} border-2 border-ink bg-yellow text-ink shadow-[1px_1px_0_#111111]`}>{label}</span>;
  }
  if (verdict === 'premium_price') {
    return <span className={`${BASE} border-2 border-ink bg-ink text-paper shadow-[1px_1px_0_#111111]`}>{label}</span>;
  }
  if (verdict === 'unrated') {
    return (
      <span className={`${BASE} border border-dashed border-ink/60 text-ink/80 text-[10px]`} title="Fewer than 3 comparable listings">
        Unrated
      </span>
    );
  }
  if (verdict === 'typical_price' && showTypical) {
    return <span className={`${BASE} border border-ink/50 bg-paper text-ink/80 text-[10px]`}>{label}</span>;
  }
  return null;
}
