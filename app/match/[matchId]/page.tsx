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

  const { matchData, predictions, isPredicting, connectionStatus, error } = useMatchStream(fullMatchId);
  const { performance, verdictAccuracy, totalPredictions } = usePredictionHistory(predictions, matchData);
  const { selectedModels, toggleModel, allModels, isHydrated } = useModelSelection();

  const latestPrediction = predictions.length > 0 ? predictions[0] : null;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-court-pattern">
        <div className="bg-destructive/10 text-destructive p-8 rounded-2xl border border-destructive/20 text-center max-w-md animate-slide-in">
          <h2 className="text-2xl font-bold mb-4">Erreur</h2>
          <p className="mb-6">{error}</p>
          <Link href="/" className="inline-flex items-center justify-center px-4 py-2 bg-background border border-border rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-court-pattern">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-medium text-foreground">Connexion au flux en direct...</h2>
        <p className="text-muted-foreground text-sm mt-2">Récupération des données du match</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-court-pattern">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center text-muted-foreground hover:text-foreground transition-colors group">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
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
            <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-full border border-border">
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-medium text-muted-foreground">Connecté</span>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span className="text-xs font-medium text-muted-foreground">Reconnexion...</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-xs font-medium text-muted-foreground">Déconnecté</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Match Data */}
          <div className="lg:col-span-5 space-y-6">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
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
              />
              <GameHistory predictions={predictions} />
            </div>
          </div>

          {/* Right Column: AI Predictions */}
          <div className="lg:col-span-7">
            <section className="h-full min-h-[600px] bg-card/40 backdrop-blur-sm border border-border rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[60px] pointer-events-none" />
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
