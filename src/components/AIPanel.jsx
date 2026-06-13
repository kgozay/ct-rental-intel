import React, { useState, useEffect, useRef } from 'react';

export default function AIPanel({ filteredListings, filters }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [typewriterIndex, setTypewriterIndex] = useState(0);
  const [generatedAt, setGeneratedAt] = useState(null);

  // Cache analyses by a signature of the inputs so re-clicking Generate with the
  // same filters/data doesn't refire (and re-bill) the Gemini call.
  const cacheRef = useRef({});
  const signature = JSON.stringify({
    suburbs: [...filters.suburbs].sort(),
    maxPrice: filters.maxPrice,
    minBeds: filters.minBeds,
    furnished: filters.furnished,
    goodValueOnly: filters.goodValueOnly,
    count: filteredListings.length
  });

  // Typewriter effect
  useEffect(() => {
    if (!analysis) {
      setTypewriterIndex(0);
      return;
    }

    setTypewriterIndex(0);
    
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

    return () => clearInterval(interval);
  }, [analysis]);

  const streamedText = analysis.slice(0, typewriterIndex);

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
        setAnalysis("Failed to generate analysis. Please check that your Gemini API key is configured.");
      }
    } catch (err) {
      console.error(err);
      setAnalysis("An error occurred while communicating with the AI service.");
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
          className="inline-flex items-center gap-2 border-[3px] border-ink bg-blue text-white font-extrabold uppercase px-[18px] py-[11px] text-[13px] tracking-[0.5px] cursor-pointer transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#111111] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed select-none shadow-[2px_2px_0_#111111]"
        >
          {loading ? '⏳ Analysing...' : '✦ Generate Analysis'}
        </button>
      </div>

      <div className="border-[3px] border-ink bg-white p-5 min-h-[140px] text-sm md:text-base leading-relaxed text-ink font-medium rounded-none relative">
        {loading && (
          <div className="flex items-center justify-center py-6 text-neutral-400 font-extrabold">
            ⏳ Analysing {filteredListings.length} listings with Gemini...
          </div>
        )}
        
        {!loading && !analysis && (
          <div className="text-neutral-400 font-bold">
            Click generate to analyse the {filteredListings.length} active listings...
          </div>
        )}

        {!loading && analysis && (
          <div>
            {streamedText.split('\n\n').map((para, idx) => {
              // Parse basic bold markers (**suburb**) inside typewriter
              const cleanPara = para.split('**').map((chunk, cIdx) => {
                if (cIdx % 2 !== 0) {
                  return <strong key={cIdx} className="font-black text-ink">{chunk}</strong>;
                }
                return chunk;
              });

              return (
                <p key={idx} className="mb-4 last:mb-0">
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

      {generatedAt && !loading && (
        <div className="mt-3 text-[11px] font-bold text-neutral-400 select-none">
          Report generated at {new Date(generatedAt).toLocaleString('en-ZA')}
        </div>
      )}
    </div>
  );
}
