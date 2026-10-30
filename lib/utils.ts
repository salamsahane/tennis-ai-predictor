import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a player name (last, first -> first last) */
export function formatPlayerName(name: string): string {
  if (name.includes(',')) {
    const [last, first] = name.split(',').map((s) => s.trim());
    return `${first} ${last}`;
  }
  return name;
}

/** Get short player name (last name only) */
export function shortName(name: string): string {
  if (name.includes(',')) {
    return name.split(',')[0].trim();
  }
  return name.split(' ').pop() || name;
}

/** Format a confidence score into a display string */
export function formatConfidence(score: number): string {
  return `${Math.round(score)}%`;
}

/** Get color class for confidence level */
export function getConfidenceColor(level: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (level) {
    case 'HIGH':
      return 'text-emerald-400';
    case 'MEDIUM':
      return 'text-amber-400';
    case 'LOW':
      return 'text-red-400';
  }
}

/** Get background color class for confidence level */
export function getConfidenceBgColor(level: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (level) {
    case 'HIGH':
      return 'bg-emerald-500';
    case 'MEDIUM':
      return 'bg-amber-500';
    case 'LOW':
      return 'bg-red-500';
  }
}

/** Model display configuration */
export const MODEL_CONFIG = {
  claude: {
    name: 'Claude',
    color: '#F97316',
    bgClass: 'bg-orange-500',
    textClass: 'text-orange-400',
    icon: '🤖',
  },
  gpt4o: {
    name: 'GPT-4o',
    color: '#22C55E',
    bgClass: 'bg-green-500',
    textClass: 'text-green-400',
    icon: '🧠',
  },
  gemini: {
    name: 'Gemini',
    color: '#3B82F6',
    bgClass: 'bg-blue-500',
    textClass: 'text-blue-400',
    icon: '✨',
  },
} as const;

/** Delay utility */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Safe JSON parse */
export function safeJsonParse<T>(text: string): T | null {
  try {
    // Try to extract JSON from possible markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const cleanText = jsonMatch ? jsonMatch[1].trim() : text.trim();
    return JSON.parse(cleanText);
  } catch {
    return null;
  }
}
