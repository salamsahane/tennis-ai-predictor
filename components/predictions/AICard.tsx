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
      <Card className="bg-card/20 border-dashed border-border/30">
        <CardContent className="p-4 flex items-center justify-between opacity-40">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center text-lg grayscale`}>
              {config.icon}
            </div>
            <div>
              <div className="font-medium text-muted-foreground">{config.name}</div>
              <div className="text-xs text-muted-foreground/70 flex items-center gap-1">
                <Ban className="w-3 h-3" />
                Désactivé par l'utilisateur
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
      <Card className="bg-card/30 border-dashed border-border/50">
        <CardContent className="p-4 flex items-center justify-between opacity-50">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full ${config.bgClass}/20 flex items-center justify-center text-lg`}>
              {config.icon}
            </div>
            <div>
              <div className="font-medium">{config.name}</div>
              <div className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
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
    <Card className="bg-card/50 backdrop-blur-sm border-border hover:border-primary/20 transition-colors shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 shrink-0 rounded-xl ${config.bgClass}/10 flex items-center justify-center text-xl`}>
              {config.icon}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{config.name}</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {(prediction.latency_ms / 1000).toFixed(1)}s
                </span>
              </div>
              
              <div className="text-sm font-medium">
                Vainqueur : <span className={config.textClass}>{shortName(prediction.predicted_winner)}</span>
              </div>
              
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-2" title={prediction.reasoning}>
                {prediction.reasoning}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0 min-w-[70px]">
            <div className="text-xl font-bold font-mono tracking-tighter">
              {formatConfidence(winProb)}
            </div>
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${config.bgClass}`} 
                style={{ width: `${winProb}%` }} 
              />
            </div>
            {prediction.is_break_predicted && (
              <span className="text-[10px] uppercase font-bold text-orange-500 mt-1 bg-orange-500/10 px-1.5 py-0.5 rounded">
                Break
              </span>
            )}
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
}
