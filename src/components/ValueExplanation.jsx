import { CONFIDENCE_THRESHOLDS, VALUE_THRESHOLDS } from '../utils/confidence';

const fmtR = (n) => `R${Number(n).toLocaleString('en-ZA')}`;

/**
 * Explains a listing's value verdict from its real valuation evidence:
 * basis (R/m² or same-bedroom rent), benchmark, difference and sample size.
 */
export default function ValueExplanation({ listing, valuation }) {
  if (!listing || !valuation) return null;
  const { score, basis, listingValue, benchmark, diffPercent, sampleSize, confidence, label } = valuation;

  if (!basis) {
    return (
      <div className="border-2 border-ink bg-paper p-4 text-ink">
        <h4 className="text-xs font-black uppercase tracking-wider mb-2">Value Assessment</h4>
        <p className="text-xs text-ink/80 leading-relaxed m-0">
          This listing has no floor area or bedroom count to compare against, so it isn&rsquo;t rated.
        </p>
      </div>
    );
  }

  const isPpm = basis === 'ppm';
  const unit = isPpm ? '/m²' : '/mo';
  const bedsLabel = listing.bedrooms === 0 ? 'studio' : `${listing.bedrooms}-bed`;
  const confidenceClass = confidence === 'high'
    ? 'bg-lime text-ink'
    : confidence === 'medium'
      ? 'bg-yellow text-ink'
      : 'bg-white text-ink';

  return (
    <div className="border-2 border-ink bg-paper p-4 text-ink shadow-[2px_2px_0_#111111]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-ink">Value Assessment</h4>
        <span className={`text-[11px] font-black uppercase px-2 py-0.5 border border-ink ${confidenceClass}`}>
          {confidence === 'insufficient' ? 'Too few comparables' : `${confidence} confidence`}
        </span>
      </div>

      <p className="text-xs text-ink/80 leading-relaxed mb-3">
        {isPpm
          ? <>Compares this home&rsquo;s rent per square metre with the median of {sampleSize} listings with a known size in <span className="font-bold">{listing.suburb}</span>.</>
          : <>No floor area is listed, so this compares the rent with the median of {sampleSize} other {bedsLabel} listings in <span className="font-bold">{listing.suburb}</span>.</>}
      </p>

      <dl className="grid grid-cols-2 gap-2 bg-white border border-ink/30 p-2.5 mb-3 text-center m-0">
        <div>
          <dt className="text-[11px] font-black uppercase text-ink/80">This listing</dt>
          <dd className="text-xs font-mono font-bold text-ink mt-0.5 m-0">{fmtR(listingValue)}{unit}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-black uppercase text-ink/80">Suburb median</dt>
          <dd className="text-xs font-mono font-bold text-ink mt-0.5 m-0">{fmtR(benchmark)}{unit}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-black uppercase text-ink/80">Difference</dt>
          <dd className={`text-xs font-mono font-black mt-0.5 m-0 ${diffPercent > 0 ? 'text-emerald-800' : diffPercent < 0 ? 'text-amber-800' : 'text-ink'}`}>
            {diffPercent === 0 ? 'At median' : diffPercent > 0 ? `${diffPercent}% below` : `${Math.abs(diffPercent)}% above`}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-black uppercase text-ink/80">Comparables</dt>
          <dd className="text-xs font-mono font-bold text-ink mt-0.5 m-0">n = {sampleSize}</dd>
        </div>
      </dl>

      <p className="text-xs font-medium text-ink/90 mb-2">
        <span className="font-black uppercase tracking-wide">Result: </span>
        Rated <span className="font-bold underline">{label}</span> (score {score.toFixed(2)}×).
      </p>

      <p className="text-[11px] text-ink/75 leading-normal border-t border-ink/15 pt-2 m-0">
        Score = median ÷ this listing. ≥ {VALUE_THRESHOLDS.GOOD.toFixed(2)} is good value, ≤ {VALUE_THRESHOLDS.PREMIUM.toFixed(2)} is premium.
        Ratings need at least {CONFIDENCE_THRESHOLDS.LOW} comparables; under {CONFIDENCE_THRESHOLDS.MEDIUM} a good score shows as &ldquo;Potential value&rdquo;.
        Views, parking, condition and furnishings can justify price differences.
      </p>
    </div>
  );
}
