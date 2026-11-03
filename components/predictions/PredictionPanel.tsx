'use client';

import { AICard } from '@/components/predictions/AICard';
import { VerdictCard } from '@/components/predictions/VerdictCard';
import type { PredictionEvent } from '@/types/verdict.types';
import type { AIModel } from '@/types/ai.types';
import { Loader2 } from 'lucide-react';
import type { MatchData } from '@/types/tennis.types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MODEL_CONFIG } from '@/lib/utils';

interface PredictionPanelProps {
  latestPrediction: PredictionEvent | null;
  isPredicting: boolean;
  /** Every model failed for the last finished game */
  predictionFailed?: boolean;
  matchData: MatchData | null;
  selectedModels?: AIModel[];
}

const FAILED_MESSAGE =
  'Aucun modèle d’IA n’a pu répondre pour le dernier jeu. Nouvelle tentative à la fin du jeu suivant.';

export function PredictionPanel({
  latestPrediction,
  isPredicting,
  predictionFailed = false,
  matchData,
  selectedModels,
}: PredictionPanelProps) {
  if (!matchData) return null;

  const nextGameNum = matchData.nextGame.number;
  const isMatchEnded = matchData.status === 'final';

  if (isMatchEnded && !latestPrediction) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center p-8">
        <p>Le match est terminé.</p>
      </div>
    );
  }

  if (isPredicting) {
    const activeModels: AIModel[] =
      selectedModels && selectedModels.length > 0 ? selectedModels : ['claude', 'gpt4o', 'gemini'];

    return (
      <div className="animate-pulse-subtle flex h-full flex-col items-center justify-center space-y-6 p-12">
        <div className="relative">
          <div className="bg-primary/20 absolute inset-0 animate-pulse rounded-full blur-xl"></div>
          <Loader2 className="text-primary relative z-10 h-16 w-16 animate-spin" />
        </div>
        <div className="space-y-2 text-center">
          <h3 className="text-xl font-medium tracking-tight">Analyse en cours...</h3>
          <p className="text-muted-foreground">Jeu n°{nextGameNum}</p>
        </div>
        <div className="mt-8 flex gap-4">
          {activeModels.map((model) => {
            const config = MODEL_CONFIG[model];
            return (
              <div
                key={model}
                className={`flex items-center gap-2 ${config.tint10} ${config.textClass} rounded-full px-3 py-1.5 text-xs font-medium`}
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                {config.name}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!latestPrediction && predictionFailed) {
    return (
      <div className="border-destructive/30 flex h-full flex-col items-center justify-center space-y-4 rounded-xl border border-dashed p-12 text-center">
        <div className="bg-destructive/10 mb-2 flex h-16 w-16 items-center justify-center rounded-full">
          <span className="text-2xl">⚠️</span>
        </div>
        <h3 className="text-foreground text-lg font-medium">Prédiction indisponible</h3>
        <p role="status" className="text-muted-foreground max-w-sm text-sm">
          {FAILED_MESSAGE}
        </p>
      </div>
    );
  }

  if (!latestPrediction) {
    return (
      <div className="border-border flex h-full flex-col items-center justify-center space-y-4 rounded-xl border border-dashed p-12 text-center">
        <div className="bg-muted mb-2 flex h-16 w-16 items-center justify-center rounded-full">
          <span className="text-2xl">⏳</span>
        </div>
        <h3 className="text-foreground text-lg font-medium">En attente de la fin du jeu</h3>
        <p className="text-muted-foreground max-w-sm text-sm">
          Les modèles d’IA analyseront automatiquement les statistiques à la fin du jeu en cours
          (Jeu n°{nextGameNum}).
        </p>
      </div>
    );
  }

  const claudePred = latestPrediction.predictions.find((p) => p.model === 'claude');
  const gptPred = latestPrediction.predictions.find((p) => p.model === 'gpt4o');
  const geminiPred = latestPrediction.predictions.find((p) => p.model === 'gemini');

  return (
    <div className="animate-slide-in flex h-full flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">
          Prédiction Jeu n°{latestPrediction.game_number}
        </h2>
        <span className="text-muted-foreground font-mono text-xs">
          {new Date(latestPrediction.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {predictionFailed && (
        <p
          role="status"
          className="bg-destructive/10 text-destructive border-destructive/20 rounded-lg border px-3 py-2 text-sm"
        >
          {FAILED_MESSAGE}
        </p>
      )}

      <VerdictCard verdict={latestPrediction.verdict} />

      <Tabs defaultValue="models" className="mt-4 flex w-full flex-1 flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="models">Analyses détaillées</TabsTrigger>
          <TabsTrigger value="factors">Facteurs clés</TabsTrigger>
        </TabsList>
        <TabsContent value="models" className="mt-4 flex-1">
          <div className="grid grid-cols-1 gap-4">
            <AICard model="claude" prediction={claudePred} />
            <AICard model="gpt4o" prediction={gptPred} />
            <AICard model="gemini" prediction={geminiPred} />
          </div>
        </TabsContent>
        <TabsContent value="factors" className="mt-4 flex-1">
          <div className="bg-card/50 border-border h-full rounded-xl border p-4">
            <h3 className="text-muted-foreground mb-4 text-sm font-medium">
              Consensus des facteurs
            </h3>
            <ul className="space-y-4">
              {claudePred?.key_factors
                ?.map((kf, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="mt-0.5 shrink-0 text-lg">
                      {kf.impact === 'positive' ? '🟢' : kf.impact === 'negative' ? '🔴' : '⚪'}
                    </span>
                    <div>
                      <span className="text-foreground font-medium">{kf.factor} : </span>
                      <span className="text-muted-foreground">{kf.value}</span>
                    </div>
                  </li>
                ))
                .slice(0, 5)}
              {!claudePred?.key_factors?.length && (
                <li className="text-muted-foreground text-sm italic">
                  Aucun facteur détaillé disponible.
                </li>
              )}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
