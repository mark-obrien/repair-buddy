'use client';

import { PROVIDERS } from '@/lib/providers';

interface Props {
  providerId: string;
  modelId: string;
  onChange: (providerId: string, modelId: string) => void;
  disabled?: boolean;
}

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: '🟠',
  openai: '🟢',
  google: '🔵',
};

export function ModelSelector({ providerId, modelId, onChange, disabled }: Props) {
  const provider = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0];
  const models = provider.models;

  function handleProviderChange(newProviderId: string) {
    const newProvider = PROVIDERS.find((p) => p.id === newProviderId);
    if (!newProvider) return;
    // Default to first model of new provider
    onChange(newProviderId, newProvider.models[0].id);
  }

  function handleModelChange(newModelId: string) {
    onChange(providerId, newModelId);
  }

  const selectedModel = models.find((m) => m.id === modelId) ?? models[0];

  return (
    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100">
      <span className="text-xs text-gray-400 font-medium shrink-0">Model</span>

      {/* Provider tabs */}
      <div className="flex rounded-md border border-gray-200 overflow-hidden">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => handleProviderChange(p.id)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              p.id === providerId
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {PROVIDER_ICONS[p.id]} {p.name}
          </button>
        ))}
      </div>

      {/* Model dropdown */}
      <select
        value={modelId}
        onChange={(e) => handleModelChange(e.target.value)}
        disabled={disabled}
        className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} — {m.description}
          </option>
        ))}
      </select>

      {selectedModel && (
        <span className="text-xs text-gray-400 hidden sm:inline">
          {selectedModel.supportsVision ? '🎬 Vision' : '📝 Text only'}
        </span>
      )}
    </div>
  );
}
