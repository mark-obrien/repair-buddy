interface Props {
  warnings: string[];
}

export function WarningsTab({ warnings }: Props) {
  if (warnings.length === 0) {
    return (
      <div className="text-center py-10 text-emerald-600">
        <div className="text-4xl mb-2">✅</div>
        <p className="text-sm">No specific warnings were noted for this repair.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {warnings.map((warning, i) => (
        <div
          key={i}
          className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg break-inside-avoid"
        >
          <span className="text-xl shrink-0">⚠️</span>
          <p className="text-sm text-amber-900 leading-relaxed">{warning}</p>
        </div>
      ))}
    </div>
  );
}
