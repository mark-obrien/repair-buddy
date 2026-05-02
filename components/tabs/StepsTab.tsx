import type { RepairGuide } from '@/lib/types';

interface Props {
  steps: RepairGuide['repairSteps'];
}

export function StepsTab({ steps }: Props) {
  if (steps.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-4xl mb-2">📋</div>
        <p className="text-sm">No repair steps were identified in this video.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.step} className="flex gap-4 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="shrink-0 w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
            {step.step}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 text-sm mb-1">{step.title}</h4>
            <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
            {step.warnings && step.warnings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {step.warnings.map((w, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                    <span className="shrink-0">⚠️</span>
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
