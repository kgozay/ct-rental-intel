import { useState, useEffect, useRef } from 'react';
import { SUBURBS_LIST } from '../utils/suburbs';

export default function AIPanel({ filteredListings, filters }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [typewriterIndex, setTypewriterIndex] = useState(0);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [showSkip, setShowSkip] = useState(false);

  // Cache analyses by signature of the inputs so re-clicking Generate doesn't re-query
  const cacheRef = useRef({});
  const skipTimerRef = useRef(null);
  const signature = JSON.stringify({
    suburbs: [...filters.suburbs].sort(),
    maxPrice: filters.maxPrice,
    minBeds: filters.minBeds,
    furnished: filters.furnished,
    goodValueOnly: filters.goodValueOnly,
    count: filteredListings.length
  });

  // Dynamic button label
  const activeSuburbs = filters.suburbs;
  const suburbSummary = activeSuburbs.length === SUBURBS_LIST.length
    ? 'ALL-SUBURB'
    : activeSuburbs.length === 1
      ? activeSuburbs[0].toUpperCase()
      : activeSuburbs.length <= 3
        ? activeSuburbs.map(s => s.toUpperCase()).join(', ')
        : `${activeSuburbs.length} SUBURBS`;
  const buttonLabel = loading
    ? '⏳ Analysing...'
    : `✦ ANALYSE ${filteredListings.length} ${suburbSummary} LISTING${filteredListings.length !== 1 ? 'S' : ''}`;

  // Typewriter effect
  useEffect(() => {
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);

    if (!analysis) {
      return;
    }

    // speed: ~2 characters per tick to stream fast
    const interval = setInterval(() => {
      setTypewriterIndex(prev => {
        if (prev < analysis.length) {
          return prev + 2;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 10);

    skipTimerRef.current = setTimeout(() => {
      setShowSkip(true);
    }, 1500);

    return () => {
      clearInterval(interval);
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    };
  }, [analysis]);

  const streamedText = analysis.slice(0, typewriterIndex);

  const handleSkip = () => {
    setTypewriterIndex(analysis.length);
    setShowSkip(false);
  };

  const handleAnalyse = async () => {
    const cached = cacheRef.current[signature];
    if (cached) {
      setShowSkip(false);
      setTypewriterIndex(0);
      setAnalysis(cached.analysis);
      setGeneratedAt(cached.generatedAt);
      return;
    }

    setLoading(true);
    setShowSkip(false);
    setTypewriterIndex(0);
    setAnalysis('');
    try {
      const response = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listings: filteredListings,
          context: {
            suburb: filters.suburbs.join(', '),
            maxPrice: filters.maxPrice,
            minBeds: filters.minBeds
          }
        })
      });
      if (response.ok) {
        const data = await response.json();
        setTypewriterIndex(0);
        setAnalysis(data.analysis);
        setGeneratedAt(data.generatedAt);
        cacheRef.current[signature] = { analysis: data.analysis, generatedAt: data.generatedAt };
      } else {
        setAnalysis("Analysis failed — the service is temporarily unavailable. Please try again in a moment.");
      }
    } catch (err) {
      console.error(err);
      setAnalysis("Couldn't reach the AI analysis service. Please verify your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const isStreamingFinished = streamedText.length >= (analysis || '').length;

  return (
    <div className="border-[3px] border-ink bg-paper shadow-[6px_6px_0_#111111] p-5 mb-7 rounded-none text-left">
      <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-wider px-2.5 py-1 mb-5">
        AI Market Analysis
      </h2>
      
      <div className="mb-6">
        <button
          onClick={handleAnalyse}
          disabled={loading || filteredListings.length === 0}
          className="inline-flex items-center gap-2 border-[3px] border-ink bg-blue text-white font-extrabold uppercase px-[1.125rem] py-[0.6875rem] text-[0.8125rem] tracking-[0.5px] cursor-pointer transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#111111] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed select-none shadow-[2px_2px_0_#111111]"
        >
          {buttonLabel}
        </button>
      </div>

      <div
        className="border-[3px] border-ink bg-white p-5 min-h-[140px] text-sm md:text-base leading-relaxed text-ink font-medium rounded-none relative"
        role="region"
        aria-label="AI market analysis report"
        aria-live="polite"
      >
        {loading && (
          <div className="flex items-center justify-center py-6 text-neutral-400 font-extrabold animate-pulse">
            ✦ Analysing {filteredListings.length} listings with Gemini 2.5 Flash...
          </div>
        )}

        {!loading && !analysis && (
          <div className="text-neutral-500 font-medium">
            <div className="font-black text-ink text-sm mb-1.5">AI Market Report</div>
            <p className="text-sm leading-relaxed max-w-lg">
              Generates a comprehensive, 3-paragraph analyst report evaluating value picks across your active {filteredListings.length} listings, identifying supply anomalies, and detailing concrete rental search tactics.
            </p>
          </div>
        )}

        {!loading && analysis && (
          <div className="space-y-4">
            {streamedText.split('\n\n').map((para, idx) => {
              const paraKey = `para-${idx}`;
              // Parse basic bold markers (**text**)
              const cleanPara = para.split('**').map((chunk, cIdx) => {
                if (cIdx % 2 !== 0) {
                  return <strong key={`${paraKey}-b-${cIdx}`} className="font-black text-ink">{chunk}</strong>;
                }
                return chunk;
              });

              return (
                <p key={paraKey} className="leading-relaxed">
                  {cleanPara}
                  {idx === streamedText.split('\n\n').length - 1 && !isStreamingFinished && (
                    <span className="blinking-cursor" />
                  )}
                </p>
              );
            })}
          </div>
        )}
      </div>

      {showSkip && !isStreamingFinished && (
        <div className="mt-3">
          <button
            onClick={handleSkip}
            className="border-2 border-ink bg-bgrey text-ink text-[0.6875rem] font-black uppercase px-3 py-1 cursor-pointer hover:bg-neutral-200 transition-colors shadow-[1px_1px_0_#111111]"
          >
            Skip Animation ⏩
          </button>
        </div>
      )}

      {generatedAt && !loading && (
        <div className="mt-3 text-[0.6875rem] font-bold text-neutral-400 select-none">
          Report generated at {new Date(generatedAt).toLocaleString('en-ZA')}
        </div>
      )}
    </div>
  );
}
