import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export interface ModelOption {
  id: string;
  name: string;
  supportsVision: boolean;
  description: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  envKey: string;
  models: ModelOption[];
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', supportsVision: true, description: 'Best balance of speed and quality' },
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', supportsVision: true, description: 'Most capable, slower' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', supportsVision: true, description: 'Fastest, most affordable' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', supportsVision: true, description: 'Most capable OpenAI model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', supportsVision: true, description: 'Fast and affordable' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', supportsVision: true, description: 'Fast and efficient' },
      { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro', supportsVision: true, description: 'Google\'s most capable model' },
    ],
  },
];

export const DEFAULT_PROVIDER = 'anthropic';
export const DEFAULT_MODEL = 'claude-sonnet-4-6';

export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === providerId);
}

export function getModelOption(providerId: string, modelId: string): ModelOption | undefined {
  return getProviderConfig(providerId)?.models.find((m) => m.id === modelId);
}

export function getModel(providerId: string, modelId: string): LanguageModel {
  switch (providerId) {
    case 'openai':
      return openai(modelId);
    case 'google':
      return google(modelId);
    default:
      return anthropic(modelId);
  }
}

export function checkProviderKey(providerId: string): string | null {
  const config = getProviderConfig(providerId);
  if (!config) return `Unknown provider: ${providerId}`;
  if (!process.env[config.envKey]) {
    return `${config.name} API key not configured. Add ${config.envKey} to .env.local.`;
  }
  return null;
}
