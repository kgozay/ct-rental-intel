import { useState, useEffect, useRef } from 'react';
import { SUBURBS_LIST } from '../utils/suburbs';

export default function AIPanel({ filteredListings, filters }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [typewriterIndex, setTypewriterIndex] = useState(0);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [showSkip, setShowSkip] = useState(false);

  // Cache analyses by a signature of the inputs so re-clicking Generate with the
  // same filters/data doesn't refire (and re-bill) the Gemini call.
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
    setShowSkip(false);
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);

    if (!analysis) {
      Promise.resolve().then(() => {
        setTypewriterIndex(0);
      });
      return;
    }

    Promise.resolve().then(() => {
      setTypewriterIndex(0);
    });

    // speed: ~2 characters per tick to type relatively fast
    const interval = setInterval(() => {
      setTypewriterIndex(prev => {
        if (prev < analysis.length) {
          return prev + 2;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 12);

    skipTimerRef.current = setTimeout(() => setShowSkip(true), 2000);

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
    // Serve from cache if we've already analysed this exact filter/data signature.
    const cached = cacheRef.current[signature];
    if (cached) {
      setAnalysis(cached.analysis);
      setGeneratedAt(cached.generatedAt);
      return;
    }

    setLoading(true);
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
        setAnalysis(data.analysis);
        setGeneratedAt(data.generatedAt);
        cacheRef.current[signature] = { analysis: data.analysis, generatedAt: data.generatedAt };
      } else {
        setAnalysis("Analysis failed — your Gemini API key may have reached its quota. Try again in a few minutes.");
      }
    } catch (err) {
      console.error(err);
      setAnalysis("Couldn't reach the AI service. Check your internet connection and try again.");
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
          disabled={loading}
          className="inline-flex items-center gap-2 border-[3px] border-ink bg-blue text-white font-extrabold uppercase px-[1.125rem] py-[0.6875rem] text-[0.8125rem] tracking-[0.5px] cursor-pointer transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#111111] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed select-none shadow-[2px_2px_0_#111111]"
        >
          {buttonLabel}
        </button>
      </div>

      <div
        className="border-[3px] border-ink bg-white p-5 min-h-[140px] text-sm md:text-base leading-relaxed text-ink font-medium rounded-none relative"
        role="region"
        aria-label="AI market analysis"
        aria-live="polite"
      >
        {loading && (
          <div className="flex items-center justify-center py-6 text-neutral-400 font-extrabold">
            Analysing {filteredListings.length} listings — this takes 10–20 seconds...
          </div>
        )}

        {!loading && !analysis && (
          <div className="text-neutral-500 font-medium">
            <div className="font-black text-ink text-sm mb-1.5">AI market report</div>
            <p className="text-sm leading-relaxed max-w-lg">
              Gemini 2.5 Flash reads the {filteredListings.length} active listings and writes a 3-paragraph analyst report — value picks by suburb and bedroom count, supply and furnishing patterns, and concrete tactics for where to search. Takes 10–20 seconds.
            </p>
          </div>
        )}

        {!loading && analysis && (
          <div>
            {streamedText.split('\n\n').map((para, idx) => {
              const paraKey = `para-${idx}-${para.substring(0, 15)}`;
              // Parse basic bold markers (**suburb**) inside typewriter
              const cleanPara = para.split('**').map((chunk, cIdx) => {
                if (cIdx % 2 !== 0) {
                  return <strong key={`${paraKey}-bold-${cIdx}`} className="font-black text-ink">{chunk}</strong>;
                }
                return chunk;
              });

              return (
                <p key={paraKey} className="mb-4 last:mb-0">
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
            Skip Animation
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
