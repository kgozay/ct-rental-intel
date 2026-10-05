import { useState, useEffect, useRef } from 'react';
import { describeFilters } from '../utils/describeFilters';
import Icon from './Icon';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';


export default function SavedSearchesModal({
  isOpen,
  onClose,
  currentFilters,
  savedSearches = [],
  matchCounts = {},
  onSaveCurrentSearch,
  onApplySearch,
  onDeleteSearch,
  onRenameSearch,
  onUndoDelete,
  recentlyDeleted,
}) {
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const modalRef = useRef(null);
  const nameInputRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setNewSearchName(describeFilters(currentFilters));
    setEditingId(null);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const nodes = [...modalRef.current.querySelectorAll(FOCUSABLE)];
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!newSearchName.trim()) return;
    onSaveCurrentSearch(newSearchName.trim());
    setNewSearchName('');
  };

  const handleSaveRename = (id) => {
    if (editingName.trim()) onRenameSearch(id, editingName.trim());
    setEditingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-ink/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-searches-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border-[3px] border-ink bg-white shadow-[6px_6px_0_#111111] p-5 sm:p-6 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-ink">
          <h2 id="saved-searches-title" className="text-base font-black uppercase text-ink m-0">Saved searches</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 inline-flex items-center justify-center border-2 border-ink bg-white hover:bg-yellow text-ink cursor-pointer"
            aria-label="Close saved searches"
          >
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mb-5 p-3.5 border-2 border-ink bg-paper">
          <label htmlFor="saved-search-name" className="block text-xs font-black uppercase tracking-wider text-ink mb-1.5">
            Save the current filters as
          </label>
          <div className="flex gap-2">
            <input
              id="saved-search-name"
              ref={nameInputRef}
              type="text"
              value={newSearchName}
              onChange={(e) => setNewSearchName(e.target.value)}
              placeholder="e.g. Atlantic Seaboard 2-beds"
              className="flex-1 min-w-0 min-h-[40px] border-2 border-ink bg-white px-2.5 py-1.5 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-blue"
            />
            <button
              type="submit"
              className="min-h-[40px] border-2 border-ink bg-yellow text-ink text-xs font-black uppercase px-3 py-1.5 shadow-[1px_1px_0_#111111] cursor-pointer shrink-0"
            >
              Save
            </button>
          </div>
        </form>

        {recentlyDeleted && (
          <div role="status" className="mb-4 border-2 border-ink bg-yellow p-2.5 flex items-center justify-between text-xs font-bold">
            <span>Deleted &ldquo;{recentlyDeleted.name}&rdquo;</span>
            <button type="button" onClick={onUndoDelete} className="underline font-black text-ink cursor-pointer uppercase text-[11px] min-h-[32px] px-2">
              Undo
            </button>
          </div>
        )}

        <ul className="space-y-3 overflow-y-auto pr-1 list-none p-0 m-0 flex-1">
          {savedSearches.length === 0 ? (
            <li className="text-center py-6 text-sm text-ink/80 font-medium">
              No saved searches yet. Save a filter combination above to reopen it in one tap — we&rsquo;ll flag new matches each time you visit.
            </li>
          ) : (
            savedSearches.map((search) => {
              const counts = matchCounts[search.id] || { total: 0, fresh: 0 };
              return (
                <li key={search.id} className="border-2 border-ink bg-neutral-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {editingId === search.id ? (
                      <form
                        className="flex items-center gap-1 mb-1"
                        onSubmit={(e) => { e.preventDefault(); handleSaveRename(search.id); }}
                      >
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); } }}
                          aria-label="New name"
                          className="border-2 border-ink px-1.5 py-1 text-xs font-bold bg-white text-ink min-w-0 flex-1"
                          autoFocus
                        />
                        <button type="submit" className="text-[11px] font-black bg-ink text-paper px-2 py-1.5 uppercase cursor-pointer">Save</button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-black text-xs text-ink uppercase truncate">{search.name}</span>
                        <button
                          type="button"
                          onClick={() => { setEditingId(search.id); setEditingName(search.name); }}
                          className="w-7 h-7 inline-flex items-center justify-center text-ink/70 hover:text-ink cursor-pointer"
                          aria-label={`Rename ${search.name}`}
                        >
                          <Icon name="edit" size={12} />
                        </button>
                      </div>
                    )}
                    <div className="text-[11px] text-ink/80 font-mono">{describeFilters(search.filters)}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] font-bold">
                      <span className="text-ink/80">{counts.total} matching now</span>
                      {counts.fresh > 0 && (
                        <span className="bg-lime text-ink border border-ink px-1.5 font-black uppercase">{counts.fresh} new</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => { onApplySearch(search); onClose(); }}
                      className="min-h-[36px] border-2 border-ink bg-blue text-white text-xs font-black uppercase px-3 py-1 cursor-pointer shadow-[1px_1px_0_#111111]"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSearch(search.id)}
                      className="w-9 h-9 inline-flex items-center justify-center text-ink/70 hover:text-bred cursor-pointer"
                      aria-label={`Delete ${search.name}`}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
