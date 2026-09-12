import { useState, useEffect, useRef } from 'react';
import { SUBURBS_LIST } from '../utils/suburbs';

function generateDefaultSearchName(filters) {
  const parts = [];
  if (filters.suburbs?.length && filters.suburbs.length < SUBURBS_LIST.length) {
    parts.push(filters.suburbs.length <= 2 ? filters.suburbs.join(' & ') : `${filters.suburbs.length} Suburbs`);
  } else {
    parts.push('All Suburbs');
  }

  if (filters.maxPrice < 80000) {
    parts.push(`≤ R${(filters.maxPrice / 1000).toFixed(0)}k`);
  }
  if (filters.minBeds !== null && filters.minBeds !== undefined) {
    parts.push(`${filters.minBeds}+ Beds`);
  }
  if (filters.furnished === true) parts.push('Furnished');
  if (filters.furnished === false) parts.push('Unfurnished');
  if (filters.goodValueOnly) parts.push('Good Value');

  return parts.join(' · ');
}

export default function SavedSearchesModal({
  isOpen,
  onClose,
  currentFilters,
  savedSearches = [],
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

  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setNewSearchName(generateDefaultSearchName(currentFilters));
    setEditingId(null);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!newSearchName.trim()) return;
    onSaveCurrentSearch(newSearchName.trim());
    setNewSearchName('');
  };

  const handleStartRename = (search) => {
    setEditingId(search.id);
    setEditingName(search.name);
  };

  const handleSaveRename = (id) => {
    if (editingName.trim()) {
      onRenameSearch(id, editingName.trim());
    }
    setEditingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-searches-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border-[3px] border-ink bg-white shadow-[6px_6px_0_#111111] p-6 max-h-[90vh] flex flex-col justify-between"
      >
        <div>
          {/* HEADER */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-ink">
            <h3 id="saved-searches-title" className="text-base font-black uppercase text-ink">
              Saved Searches
            </h3>
            <button
              onClick={onClose}
              className="border-2 border-ink bg-neutral-100 hover:bg-yellow text-ink px-2 py-0.5 text-xs font-black uppercase cursor-pointer"
              aria-label="Close saved searches modal"
            >
              ✕
            </button>
          </div>

          {/* SAVE CURRENT SEARCH BOX */}
          <form onSubmit={handleSave} className="mb-5 p-3.5 border-2 border-ink bg-paper/60 shadow-[2px_2px_0_#111111]">
            <label className="block text-xs font-black uppercase tracking-wider text-ink mb-1.5">
              Save Active Search Filters:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSearchName}
                onChange={(e) => setNewSearchName(e.target.value)}
                placeholder="e.g. Atlantic Seaboard 2-Beds"
                className="flex-1 border-2 border-ink bg-white px-2.5 py-1.5 text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-blue"
              />
              <button
                type="submit"
                className="border-2 border-ink bg-yellow text-ink text-xs font-black uppercase px-3 py-1.5 hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all shadow-[1px_1px_0_#111111] cursor-pointer shrink-0"
              >
                + Save
              </button>
            </div>
          </form>

          {/* UNDO NOTIFICATION TOAST */}
          {recentlyDeleted && (
            <div className="mb-4 border-2 border-ink bg-yellow p-2.5 flex items-center justify-between text-xs font-bold shadow-[2px_2px_0_#111111]">
              <span>Deleted &ldquo;{recentlyDeleted.name}&rdquo;</span>
              <button
                onClick={onUndoDelete}
                className="underline font-black text-ink hover:text-blue cursor-pointer uppercase text-[11px]"
              >
                Undo
              </button>
            </div>
          )}

          {/* SAVED SEARCHES LIST */}
          <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
            {savedSearches.length === 0 ? (
              <div className="text-center py-6 text-xs text-neutral-500 font-medium">
                No searches saved yet. Save your favorite filter combinations above for 1-click access anytime!
              </div>
            ) : (
              savedSearches.map((search) => (
                <div
                  key={search.id}
                  className="border-2 border-ink bg-neutral-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[1px_1px_0_#111111]"
                >
                  <div className="flex-1 min-w-0">
                    {editingId === search.id ? (
                      <div className="flex items-center gap-1 mb-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="border border-ink px-1.5 py-0.5 text-xs font-bold bg-white text-ink"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(search.id)}
                          className="text-[10px] font-black bg-ink text-paper px-1.5 py-0.5 uppercase"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-xs text-ink uppercase truncate">
                          {search.name}
                        </span>
                        <button
                          onClick={() => handleStartRename(search)}
                          className="text-[10px] text-neutral-400 hover:text-ink cursor-pointer"
                          title="Rename search"
                          aria-label={`Rename ${search.name}`}
                        >
                          ✎
                        </button>
                      </div>
                    )}
                    <div className="text-[11px] text-neutral-600 font-mono">
                      {generateDefaultSearchName(search.filters)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        onApplySearch(search.filters);
                        onClose();
                      }}
                      className="border-2 border-ink bg-blue text-white text-xs font-black uppercase px-3 py-1 hover:opacity-90 cursor-pointer shadow-[1px_1px_0_#111111]"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => onDeleteSearch(search.id)}
                      className="text-xs text-neutral-400 hover:text-red-600 font-bold p-1 cursor-pointer"
                      title="Delete saved search"
                      aria-label={`Delete ${search.name}`}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="pt-4 mt-4 border-t border-neutral-200 flex justify-end">
          <button
            onClick={onClose}
            className="border-2 border-ink bg-white text-ink text-xs font-black uppercase px-4 py-1.5 hover:bg-neutral-100 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
