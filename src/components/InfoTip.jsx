import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon';

/**
 * Accessible toggletip: works with tap, click and keyboard (unlike `title`).
 * Closes on Escape, outside click, or blur away from the tip.
 */
export default function InfoTip({ label = 'More information', children, align = 'left', className = '' }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="inline-flex items-center justify-center w-6 h-6 -my-1 cursor-pointer opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-yellow"
      >
        <Icon name="info" size={14} />
      </button>
      {open && (
        <span
          id={id}
          role="status"
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full mt-2 z-30 w-64 max-w-[80vw] border-2 border-ink bg-white text-ink p-3 text-xs font-medium normal-case tracking-normal leading-relaxed text-left whitespace-normal shadow-[3px_3px_0_#111111] ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
