import type { SourceInfo } from '@/services/tennis/providers/types';

export function sourceLabel(source: SourceInfo): string {
  return source.kind === 'replay' ? 'Replay' : `Live · ${source.label}`;
}
