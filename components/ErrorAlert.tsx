interface Props {
  message: string;
}

export function ErrorAlert({ message }: Props) {
  return (
    <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
      <span className="text-lg shrink-0">⚠️</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}
