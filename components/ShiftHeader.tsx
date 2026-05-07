'use client';
export function ShiftHeader({ onNewRepair }: { onNewRepair?: () => void }) {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-surface-container-lowest border-b border-surface-container-highest shadow-sm">
      <div className="flex items-center gap-4">
        {/* SHIFT wordmark */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="text-on-primary font-bold text-sm" style={{fontFamily:'monospace'}}>S»</span>
          </div>
          <span className="font-h3 text-on-surface uppercase tracking-tight text-xl font-bold">SHIFT</span>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-gutter">
        <div className="bg-surface-container-low flex items-center px-4 py-2 border border-surface-container-highest rounded-lg">
          <span className="material-symbols-outlined text-outline mr-2 text-sm">search</span>
          <input
            className="bg-transparent border-none outline-none text-xs font-bold uppercase tracking-widest placeholder:text-outline w-56"
            placeholder="SEARCH GUIDES..."
            type="text"
          />
        </div>
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors text-xl">notifications</span>
          <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors text-xl">settings</span>
          <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors text-xl">account_circle</span>
        </div>
      </div>
    </header>
  );
}
