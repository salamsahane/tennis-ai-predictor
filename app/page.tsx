'use client';

import { PlayerSearch } from '@/components/match/PlayerSearch';
import { ModelSelector } from '@/components/predictions/ModelSelector';
import { useModelSelection } from '@/hooks/useModelSelection';
import { Sparkles, Activity } from 'lucide-react';

export default function Home() {
  const { selectedModels, toggleModel, allModels, isHydrated } = useModelSelection();

  return (
    <main className="min-h-screen bg-court-pattern flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[var(--color-tennis-ball)]/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="z-10 w-full max-w-4xl mx-auto space-y-12">
        
        <div className="text-center space-y-6 animate-slide-in">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4 border border-primary/20 backdrop-blur-sm">
            <div className="relative">
              <Sparkles className="w-8 h-8 text-primary animate-pulse-subtle" />
              <Activity className="w-4 h-4 text-[var(--color-tennis-ball)] absolute -bottom-1 -right-1" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 drop-shadow-sm">
            Tennis AI <span className="text-primary">Predictor</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            L'intelligence artificielle au service du tennis. Retrouvez des prédictions en temps réel pour le prochain jeu basées sur l'analyse de 3 modèles LLM (Claude, GPT-4o, Gemini).
          </p>
        </div>

        <div className="bg-card/40 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl relative space-y-6">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-3xl pointer-events-none" />
          
          {/* Model Selector */}
          {isHydrated && (
            <div className="relative z-10 animate-slide-in">
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
      
      <footer className="absolute bottom-6 text-center text-sm text-muted-foreground w-full">
        <p>Propulsé par SportRadar & Multi-Agent AI</p>
      </footer>

    </main>
  );
}
