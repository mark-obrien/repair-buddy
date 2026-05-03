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
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Print or save as PDF"
    >
      🖨 Print / PDF
    </button>
  );
}
