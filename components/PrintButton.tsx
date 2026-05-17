'use client';

interface Props {
  disabled?: boolean;
}

export function PrintButton({ disabled }: Props) {
  function handlePrint() {
    if (typeof window === 'undefined') return;
    window.print();
  }

  return (
    <button
      onClick={handlePrint}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 text-label-caps text-xs px-3 py-1.5 rounded border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title="Print or save as PDF"
    >
      <span className="material-symbols-outlined text-sm">print</span>
      PRINT / PDF
    </button>
  );
}
