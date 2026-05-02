import type { RepairGuide } from '@/lib/types';

interface Props {
  parts: RepairGuide['partsNeeded'];
}

export function PartsTab({ parts }: Props) {
  if (parts.length === 0) {
    return <EmptyState message="No parts were identified in this video." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="pb-2 pr-4 font-semibold text-gray-700">Part</th>
            <th className="pb-2 pr-4 font-semibold text-gray-700">Part #</th>
            <th className="pb-2 pr-4 font-semibold text-gray-700 text-center">Qty</th>
            <th className="pb-2 font-semibold text-gray-700">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {parts.map((part, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="py-2.5 pr-4 font-medium text-gray-900">{part.name}</td>
              <td className="py-2.5 pr-4 text-gray-500 font-mono text-xs">
                {part.partNumber ?? '—'}
              </td>
              <td className="py-2.5 pr-4 text-center">
                {part.quantity != null ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-semibold text-xs">
                    {part.quantity}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="py-2.5 text-gray-600">{part.notes ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-10 text-gray-400">
      <div className="text-4xl mb-2">🔩</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
