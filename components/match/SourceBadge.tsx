import { Badge } from '@/components/ui/badge';
import { sourceLabel } from '@/lib/source-label';
import type { SourceInfo } from '@/services/tennis/providers/types';

export function SourceBadge({ source }: { source: SourceInfo }) {
  return (
    <Badge
      variant={source.kind === 'live' ? 'default' : 'secondary'}
      className={source.kind === 'live' ? undefined : 'bg-muted text-muted-foreground'}
    >
      {sourceLabel(source)}
    </Badge>
  );
}
