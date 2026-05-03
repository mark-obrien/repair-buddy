'use client';

interface Props {
  onRegenerate: () => void;
  disabled?: boolean;
}

export function RegenerateButton({ onRegenerate, disabled }: Props) {
  return (
    <button
      onClick={onRegenerate}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Regenerate this guide from scratch (bypasses cache)"
    >
      ↻ Regenerate
    </button>
  );
}
