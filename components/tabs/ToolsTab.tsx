import type { RepairGuide } from '@/lib/types';

interface Props {
  standardTools: RepairGuide['standardTools'];
  specialtyTools: RepairGuide['specialtyTools'];
}

export function ToolsTab({ standardTools, specialtyTools }: Props) {
  const hasAny = standardTools.length > 0 || specialtyTools.length > 0;

  if (!hasAny) {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-4xl mb-2">🔧</div>
        <p className="text-sm">No tools were identified in this video.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {standardTools.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-3">
            Standard Tools
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {standardTools.map((tool, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                <span className="text-lg shrink-0">🔧</span>
                <div>
                  <span className="font-medium text-gray-900 text-sm">{tool.name}</span>
                  {tool.size && (
                    <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                      {tool.size}
                    </span>
                  )}
                  {tool.notes && <p className="text-xs text-gray-500 mt-0.5">{tool.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {specialtyTools.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-3">
            Specialty Tools
          </h3>
          <div className="space-y-3">
            {specialtyTools.map((tool, i) => (
              <div key={i} className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-lg shrink-0">⭐</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{tool.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{tool.purpose}</p>
                    {tool.altMethod && (
                      <p className="text-xs text-emerald-700 mt-1.5 flex items-start gap-1">
                        <span className="shrink-0">💡</span>
                        <span><strong>Alternative:</strong> {tool.altMethod}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
