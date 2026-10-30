'use client';

import { PlayerSearch } from '@/components/match/PlayerSearch';
import { ModelSelector } from '@/components/predictions/ModelSelector';
import { useModelSelection } from '@/hooks/useModelSelection';
import { Sparkles, Activity } from 'lucide-react';

export default function Home() {
  const { selectedModels, toggleModel, allModels, isHydrated } = useModelSelection();

  return (
    <main className="bg-court-pattern relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 md:p-8">
      {/* Background decoration */}
      <div className="bg-primary/5 pointer-events-none absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]" />
      <div className="pointer-events-none absolute top-0 right-0 h-[400px] w-[400px] rounded-full bg-[var(--color-tennis-ball)]/5 blur-[80px]" />

      <div className="z-10 mx-auto w-full max-w-4xl space-y-12">
        <div className="animate-slide-in space-y-6 text-center">
          <div className="bg-primary/10 border-primary/20 mb-4 inline-flex items-center justify-center rounded-2xl border p-3 backdrop-blur-sm">
            <div className="relative">
              <Sparkles className="text-primary animate-pulse-subtle h-8 w-8" />
              <Activity className="absolute -right-1 -bottom-1 h-4 w-4 text-[var(--color-tennis-ball)]" />
            </div>
          </div>

          <h1 className="from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-5xl font-black tracking-tighter text-transparent drop-shadow-sm md:text-7xl">
            Tennis AI <span className="text-primary">Predictor</span>
          </h1>

          <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed md:text-xl">
            L’intelligence artificielle au service du tennis. Retrouvez des prédictions en temps
            réel pour le prochain jeu basées sur l’analyse de 3 modèles LLM (Claude, GPT-4o,
            Gemini).
          </p>
        </div>

        <div className="bg-card/40 relative space-y-6 rounded-3xl border border-white/5 p-6 shadow-2xl backdrop-blur-md md:p-8">
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/5 to-transparent" />

          {/* Model Selector */}
          {isHydrated && (
            <div className="animate-slide-in relative z-10">
              <ModelSelector
                selectedModels={selectedModels}
                onToggle={toggleModel}
                allModels={allModels}
              />
            </div>
          )}

          <div className="relative z-10">
            <PlayerSearch />
          </div>
        </div>
      </div>

      <footer className="text-muted-foreground absolute bottom-6 w-full text-center text-sm">
        <p>Propulsé par SportRadar & Multi-Agent AI</p>
      </footer>
    </main>
  );
}
