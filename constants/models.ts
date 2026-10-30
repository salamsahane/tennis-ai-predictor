// constants/models.ts
// Provider model IDs, kept in one place so upgrades touch a single file

import type { AIModel } from '@/types/ai.types';

export const PROVIDER_MODEL_IDS = {
  claude: 'claude-sonnet-5-5',
  gpt4o: 'gpt-4o',
  gemini: 'gemini-3.8-flash',
} as const satisfies Record<AIModel, string>;
