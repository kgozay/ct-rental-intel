import { getValueVerdict } from '../utils/confidence';

export default function ValueExplanation({
  listing,
  suburbMedianPrice,
  suburbMedianPpm2,
  sampleSize,
  confidence = 'medium',
}) {
  if (!listing) return null;

  const score = listing.value_score;
  const { label } = getValueVerdict(score, confidence);
  const ppm2 = listing.price_per_m2;
  const medianRate = suburbMedianPpm2;

  let diffPercent = null;
  if (ppm2 && medianRate) {
    diffPercent = Math.round(((medianRate - ppm2) / medianRate) * 100);
  }

  return (
    <div className="border-2 border-ink bg-paper p-4 text-ink shadow-[2px_2px_0_#111111]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-ink">
          Value Assessment Methodology
        </h4>
        <span className={`text-[10px] font-black uppercase px-2 py-0.5 border border-ink ${
          confidence === 'high' ? 'bg-lime text-ink' : confidence === 'medium' ? 'bg-yellow text-ink' : 'bg-paper text-ink'
        }`}>
          {confidence} confidence
        </span>
      </div>

      <p className="text-xs text-ink/80 leading-relaxed mb-3">
        Value score compares this property's rent per square metre against the median rate of comparable
        rentals in <span className="font-bold">{listing.suburb}</span>.
      </p>

      {/* Metric Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white border border-ink/20 p-2.5 mb-3 text-center">
        <div>
          <div className="text-[10px] font-black uppercase text-ink/60">This Listing</div>
          <div className="text-xs font-mono font-bold text-ink mt-0.5">
            {ppm2 ? `R ${ppm2}/m²` : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase text-ink/60">Suburb Median</div>
          <div className="text-xs font-mono font-bold text-ink mt-0.5">
            {medianRate ? `R ${medianRate}/m²` : (suburbMedianPrice ? `R ${suburbMedianPrice}` : 'N/A')}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase text-ink/60">Difference</div>
          <div className={`text-xs font-mono font-black mt-0.5 ${diffPercent > 0 ? 'text-emerald-700' : diffPercent < 0 ? 'text-amber-700' : 'text-ink'}`}>
            {diffPercent !== null ? (diffPercent > 0 ? `${diffPercent}% cheaper` : `${Math.abs(diffPercent)}% premium`) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase text-ink/60">Comparables</div>
          <div className="text-xs font-mono font-bold text-ink mt-0.5">
            {sampleSize ? `${sampleSize} units` : 'Local batch'}
          </div>
        </div>
      </div>

      {/* Verdict Announcement */}
      <div className="text-xs font-medium text-ink/90 mb-2">
        <span className="font-black uppercase tracking-wide">Result: </span>
        <span>This home is rated <span className="font-bold underline">{label}</span> ({score ? `${score}x median efficiency` : 'insufficient size info'}).</span>
      </div>

      {/* Cautionary note */}
      <p className="text-[10px] text-ink/60 leading-normal italic border-t border-ink/10 pt-2 m-0">
        Note: Specific features such as ocean views, private parking, condition, balconies, or furnished fittings can legitimately command price variations.
      </p>
    </div>
  );
}
