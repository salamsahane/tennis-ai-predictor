'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PredictionEvent } from '@/types/verdict.types';

interface GameHistoryProps {
  predictions: PredictionEvent[];
}

export function GameHistory({ predictions }: GameHistoryProps) {
  if (predictions.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card/30 border-border">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">Historique des jeux</CardTitle>
      </CardHeader>
      <CardContent className="p-0 max-h-[300px] overflow-y-auto">
        <div className="flex flex-col">
          {predictions.map((p, idx) => (
            <div key={`${p.set_number}-${p.game_number}`} className="flex items-center justify-between p-3 border-b border-border/50 hover:bg-muted/20 text-sm">
              <div className="font-mono text-muted-foreground">
                Set {p.set_number}, Jeu {p.game_number}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Vainqueur prédit :</span>
                <span className="font-medium text-primary">{p.verdict.predicted_winner.split(' ').pop()}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
