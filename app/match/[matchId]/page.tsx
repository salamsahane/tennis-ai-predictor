'use client';

import { useMatchStream } from '@/hooks/useMatchStream';
import { usePredictionHistory } from '@/hooks/usePredictionHistory';
import { useModelSelection } from '@/hooks/useModelSelection';
import { LiveScoreBoard } from '@/components/match/LiveScoreBoard';
import { StatsPanel } from '@/components/match/StatsPanel';
import { PredictionPanel } from '@/components/predictions/PredictionPanel';
import { PredictionHistory } from '@/components/predictions/PredictionHistory';
import { GameHistory } from '@/components/match/GameHistory';
import { ModelSelector } from '@/components/predictions/ModelSelector';
import { Loader2, ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function MatchPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  // SportRadar IDs use a specific format: sr:sport_event:123456
  const fullMatchId = `sr:sport_event:${matchId}`;

  const { matchData, predictions, isPredicting, connectionStatus, error } =
    useMatchStream(fullMatchId);
  const { performance, verdictAccuracy, totalPredictions, completedPredictions } =
    usePredictionHistory(predictions);
  const { selectedModels, toggleModel, allModels, isHydrated } = useModelSelection();

  const latestPrediction = predictions.length > 0 ? predictions[0] : null;

  if (error) {
    return (
      <div className="bg-court-pattern flex min-h-screen flex-col items-center justify-center p-4">
        <div className="bg-destructive/10 text-destructive border-destructive/20 animate-slide-in max-w-md rounded-2xl border p-8 text-center">
          <h2 className="mb-4 text-2xl font-bold">Erreur</h2>
          <p className="mb-6">{error}</p>
          <Link
            href="/"
            className="bg-background border-border hover:bg-muted inline-flex items-center justify-center rounded-lg border px-4 py-2 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="bg-court-pattern flex min-h-screen flex-col items-center justify-center p-4">
        <Loader2 className="text-primary mb-4 h-12 w-12 animate-spin" />
        <h2 className="text-foreground text-xl font-medium">Connexion au flux en direct...</h2>
        <p className="text-muted-foreground mt-2 text-sm">Récupération des données du match</p>
      </div>
    );
  }

  return (
    <div className="bg-background bg-court-pattern min-h-screen">
      {/* Navbar */}
      <header className="bg-background/80 border-border sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground group flex items-center transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-medium">Retour</span>
          </Link>

          {/* Model selector in header */}
          {isHydrated && (
            <div className="hidden md:block">
              <ModelSelector
                selectedModels={selectedModels}
                onToggle={toggleModel}
                allModels={allModels}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="bg-muted/50 border-border flex items-center gap-2 rounded-full border px-3 py-1">
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-muted-foreground text-xs font-medium">Connecté</span>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                  <span className="text-muted-foreground text-xs font-medium">Reconnexion...</span>
                </>
              ) : (
                <>
                  <WifiOff className="text-destructive h-3.5 w-3.5" />
                  <span className="text-muted-foreground text-xs font-medium">Déconnecté</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Match Data */}
          <div className="space-y-6 lg:col-span-5">
            <section>
              <h2 className="text-muted-foreground mb-3 px-1 text-sm font-semibold tracking-widest uppercase">
                Score en direct
              </h2>
              <LiveScoreBoard match={matchData} />
            </section>

            <section>
              <StatsPanel match={matchData} />
            </section>

            <div className="grid grid-cols-1 gap-6">
              <PredictionHistory
                performance={performance}
                totalPredictions={totalPredictions}
                verdictAccuracy={verdictAccuracy}
                completedPredictions={completedPredictions}
              />
              <GameHistory predictions={predictions} />
            </div>
          </div>

          {/* Right Column: AI Predictions */}
          <div className="lg:col-span-7">
            <section className="bg-card/40 border-border relative h-full min-h-[600px] overflow-hidden rounded-3xl border p-6 shadow-2xl backdrop-blur-sm lg:p-8">
              <div className="bg-primary/5 pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full blur-[60px]" />
              <PredictionPanel
                latestPrediction={latestPrediction}
                isPredicting={isPredicting}
                matchData={matchData}
                selectedModels={selectedModels}
              />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
