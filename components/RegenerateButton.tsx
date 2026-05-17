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
      className="inline-flex items-center gap-1.5 text-label-caps text-xs px-3 py-1.5 rounded border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title="Regenerate this guide from scratch (bypasses cache)"
    >
      <span className="material-symbols-outlined text-sm">refresh</span>
      REGENERATE
    </button>
  );
}
