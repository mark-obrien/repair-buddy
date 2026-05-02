import type { RepairGuide } from '@/lib/types';

interface Props {
  torqueValues: RepairGuide['torqueValues'];
}

export function TorqueTab({ torqueValues }: Props) {
  if (torqueValues.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-4xl mb-2">⚙️</div>
        <p className="text-sm">No torque specifications were mentioned in this video.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4 flex gap-2">
        <span className="shrink-0">⚠️</span>
        Always verify torque values against your vehicle&apos;s service manual. These are extracted from the video and may not cover all applications.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="pb-2 pr-4 font-semibold text-gray-700">Component</th>
              <th className="pb-2 pr-4 font-semibold text-gray-700 text-right">Value</th>
              <th className="pb-2 pr-4 font-semibold text-gray-700">Unit</th>
              <th className="pb-2 font-semibold text-gray-700">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {torqueValues.map((tv, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-2.5 pr-4 font-medium text-gray-900">{tv.component}</td>
                <td className="py-2.5 pr-4 text-right">
                  <span className="text-orange-600 font-bold font-mono">{tv.value}</span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    {tv.unit}
                  </span>
                </td>
                <td className="py-2.5 text-gray-500 text-xs">{tv.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}