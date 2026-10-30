'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { AIPrediction, AIModel } from '@/types/ai.types';
import { MODEL_CONFIG, formatConfidence, shortName } from '@/lib/utils';
import { Check, X, AlertTriangle, Clock, Ban } from 'lucide-react';

interface AICardProps {
  model: AIModel;
  prediction?: AIPrediction;
}

export function AICard({ model, prediction }: AICardProps) {
  const config = MODEL_CONFIG[model];

  // Disabled state: model was not selected by the user
  if (prediction?.error === 'disabled') {
    return (
      <Card className="bg-card/20 border-border/30 border-dashed">
        <CardContent className="flex items-center justify-between p-4 opacity-40">
          <div className="flex items-center gap-3">
            <div
              className={`bg-muted/30 flex h-8 w-8 items-center justify-center rounded-full text-lg grayscale`}
            >
              {config.icon}
            </div>
            <div>
              <div className="text-muted-foreground font-medium">{config.name}</div>
              <div className="text-muted-foreground/70 flex items-center gap-1 text-xs">
                <Ban className="h-3 w-3" />
                Désactivé par l’utilisateur
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state: model was called but failed
  if (!prediction || prediction.error) {
    return (
      <Card className="bg-card/30 border-border/50 border-dashed">
        <CardContent className="flex items-center justify-between p-4 opacity-50">
          <div className="flex items-center gap-3">
            <div
              className={`h-8 w-8 rounded-full ${config.tint20} flex items-center justify-center text-lg`}
            >
              {config.icon}
            </div>
            <div>
              <div className="font-medium">{config.name}</div>
              <div className="text-destructive flex items-center gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" />
                {prediction?.error || 'Non disponible'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const winProb = Math.round(prediction.win_probability * 100);

  return (
    <Card className="bg-card/50 border-border hover:border-primary/20 shadow-sm backdrop-blur-sm transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`h-10 w-10 shrink-0 rounded-xl ${config.tint10} flex items-center justify-center text-xl`}
            >
              {config.icon}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{config.name}</span>
                <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                  <Clock className="h-3 w-3" />
                  {(prediction.latency_ms / 1000).toFixed(1)}s
                </span>
              </div>

              <div className="text-sm font-medium">
                Vainqueur :{' '}
                <span className={config.textClass}>{shortName(prediction.predicted_winner)}</span>
              </div>

              <p
                className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-relaxed"
                title={prediction.reasoning}
              >
                {prediction.reasoning}
              </p>
            </div>
          </div>

          <div className="flex min-w-[70px] shrink-0 flex-col items-end gap-2">
            <div className="font-mono text-xl font-bold tracking-tighter">
              {formatConfidence(winProb)}
            </div>
            <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
              <div className={`h-full ${config.bgClass}`} style={{ width: `${winProb}%` }} />
            </div>
            {prediction.is_break_predicted && (
              <span className="mt-1 rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-bold text-orange-500 uppercase">
                Break
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
