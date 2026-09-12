import { useState } from 'react';
import { SUBURBS_LIST } from '../utils/suburbs';

export default function FirstRunState({ onStartScrape, isStarting }) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirm = () => {
    setShowConfirm(false);
    onStartScrape();
  };

  return (
    <div className="border-[3px] border-ink bg-paper p-6 md:p-10 shadow-[6px_6px_0_#111111] my-6">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-block bg-yellow border-2 border-ink px-3 py-1 text-xs font-black uppercase tracking-wider mb-4 shadow-[2px_2px_0_#111111]">
          First-Time Setup
        </div>
        <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-ink mb-3">
          No Market Snapshot Yet
        </h2>
        <p className="text-sm md:text-base text-ink/80 font-medium leading-relaxed mb-6">
          Cape Town Rental Intelligence continuously analyses residential property rentals to find
          underpriced listings. To begin evaluating the market, initiate the first snapshot across our
          7 target suburbs.
        </p>

        {/* Coverage Scope Grid */}
        <div className="bg-white border-2 border-ink p-4 mb-6 text-left shadow-[3px_3px_0_#111111]">
          <div className="text-xs font-black uppercase tracking-wider text-ink/70 mb-2">
            Coverage Area (7 Suburbs):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUBURBS_LIST.map(suburb => (
              <span
                key={suburb}
                className="bg-paper border border-ink/40 text-ink text-xs font-bold px-2 py-0.5"
              >
                {suburb}
              </span>
            ))}
          </div>
        </div>

        {/* Action expectations */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-8">
          <div className="border border-ink/30 bg-white/60 p-3">
            <div className="text-xs font-black text-ink">Direct Source</div>
            <div className="text-[11px] text-ink/70 mt-1">
              Residential listings ingested directly from Property24.
            </div>
          </div>
          <div className="border border-ink/30 bg-white/60 p-3">
            <div className="text-xs font-black text-ink">~1–2 Minutes</div>
            <div className="text-[11px] text-ink/70 mt-1">
              Data processes asynchronously in the background.
            </div>
          </div>
          <div className="border border-ink/30 bg-white/60 p-3">
            <div className="text-xs font-black text-ink">2-Day Cooldown</div>
            <div className="text-[11px] text-ink/70 mt-1">
              Updates are limited to once every 48 hours to preserve scraper quota.
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isStarting}
          className="border-[3px] border-ink bg-yellow px-6 py-3 text-sm md:text-base font-black uppercase tracking-wide text-ink shadow-[4px_4px_0_#111111] hover:bg-yellow/90 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#111111] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {isStarting ? 'Initiating Snapshot...' : 'Create Market Snapshot'}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-[2px]"
        >
          <div className="border-[3px] border-ink bg-paper p-6 max-w-md w-full shadow-[8px_8px_0_#111111]">
            <h3 id="confirm-modal-title" className="text-lg font-black uppercase tracking-tight text-ink mb-2">
              Start Market Ingestion?
            </h3>
            <p className="text-xs text-ink/80 leading-relaxed mb-5">
              This will launch data collection across 7 Cape Town suburbs via Apify. The process runs
              in the background and takes approximately 1 to 2 minutes. Once triggered, the next manual update
              will be locked for 48 hours.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="border-2 border-ink bg-white px-4 py-2 text-xs font-black uppercase text-ink hover:bg-neutral-100 cursor-pointer shadow-[2px_2px_0_#111111]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="border-2 border-ink bg-lime px-4 py-2 text-xs font-black uppercase text-ink hover:bg-lime/80 cursor-pointer shadow-[2px_2px_0_#111111]"
              >
                Yes, Start Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
