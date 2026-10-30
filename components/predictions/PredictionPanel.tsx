'use client';

import { AICard } from '@/components/predictions/AICard';
import { VerdictCard } from '@/components/predictions/VerdictCard';
import type { PredictionEvent } from '@/types/verdict.types';
import type { AIModel } from '@/types/ai.types';
import { Loader2 } from 'lucide-react';
import type { MatchData } from '@/types/tennis.types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MODEL_CONFIG } from '@/lib/utils';

interface PredictionPanelProps {
  latestPrediction: PredictionEvent | null;
  isPredicting: boolean;
  matchData: MatchData | null;
  selectedModels?: AIModel[];
}

export function PredictionPanel({ latestPrediction, isPredicting, matchData, selectedModels }: PredictionPanelProps) {
  if (!matchData) return null;

  const nextGameNum = matchData.nextGame.number;
  const isMatchEnded = matchData.status === 'final';

  if (isMatchEnded && !latestPrediction) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground">
        <p>Le match est terminé.</p>
      </div>
    );
  }

  if (isPredicting) {
    const activeModels: AIModel[] = selectedModels && selectedModels.length > 0
      ? selectedModels
      : ['claude', 'gpt4o', 'gemini'];

    return (
      <div className="flex flex-col items-center justify-center h-full p-12 space-y-6 animate-pulse-subtle">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
          <Loader2 className="w-16 h-16 text-primary animate-spin relative z-10" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-medium tracking-tight">Analyse en cours...</h3>
          <p className="text-muted-foreground">Jeu n°{nextGameNum}</p>
        </div>
        <div className="flex gap-4 mt-8">
          {activeModels.map((model) => {
            const config = MODEL_CONFIG[model];
            return (
              <div
                key={model}
                className={`flex items-center gap-2 ${config.bgClass}/10 ${config.textClass} px-3 py-1.5 rounded-full text-xs font-medium`}
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                {config.name}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!latestPrediction) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4 border border-dashed border-border rounded-xl">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-2">
          <span className="text-2xl">⏳</span>
        </div>
        <h3 className="text-lg font-medium text-foreground">En attente de la fin du jeu</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Les modèles d'IA analyseront automatiquement les statistiques à la fin du jeu en cours (Jeu n°{nextGameNum}).
        </p>
      </div>
    );
  }

  const claudePred = latestPrediction.predictions.find(p => p.model === 'claude');
  const gptPred = latestPrediction.predictions.find(p => p.model === 'gpt4o');
  const geminiPred = latestPrediction.predictions.find(p => p.model === 'gemini');

  return (
    <div className="space-y-6 flex flex-col h-full animate-slide-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">
          Prédiction Jeu n°{latestPrediction.game_number}
        </h2>
        <span className="text-xs text-muted-foreground font-mono">
          {new Date(latestPrediction.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <VerdictCard verdict={latestPrediction.verdict} />

      <Tabs defaultValue="models" className="w-full mt-4 flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="models">Analyses détaillées</TabsTrigger>
          <TabsTrigger value="factors">Facteurs clés</TabsTrigger>
        </TabsList>
        <TabsContent value="models" className="flex-1 mt-4">
          <div className="grid grid-cols-1 gap-4">
            <AICard model="claude" prediction={claudePred} />
            <AICard model="gpt4o" prediction={gptPred} />
            <AICard model="gemini" prediction={geminiPred} />
          </div>
        </TabsContent>
        <TabsContent value="factors" className="flex-1 mt-4">
          <div className="bg-card/50 border border-border rounded-xl p-4 h-full">
            <h3 className="text-sm font-medium mb-4 text-muted-foreground">Consensus des facteurs</h3>
            <ul className="space-y-4">
              {claudePred?.key_factors?.map((kf, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-lg shrink-0 mt-0.5">
                    {kf.impact === 'positive' ? '🟢' : kf.impact === 'negative' ? '🔴' : '⚪'}
                  </span>
                  <div>
                    <span className="font-medium text-foreground">{kf.factor} : </span>
                    <span className="text-muted-foreground">{kf.value}</span>
                  </div>
                </li>
              )).slice(0, 5)}
              {!claudePred?.key_factors?.length && (
                <li className="text-muted-foreground text-sm italic">Aucun facteur détaillé disponible.</li>
              )}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
