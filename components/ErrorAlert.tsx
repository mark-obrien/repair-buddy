interface Props {
  message: string;
}

export function ErrorAlert({ message }: Props) {
  return (
    <div className="flex gap-3 p-4 bg-error/5 border border-error/20 rounded-lg text-error">
      <span className="material-symbols-outlined text-lg shrink-0">error</span>
      <div>
        <p className="text-label-caps font-bold uppercase mb-1">Error</p>
        <p className="text-sm text-on-surface-variant">{message}</p>
      </div>
    </div>
  );
}
