'use client';

import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useMatchSearch } from '@/hooks/useMatchSearch';
import { MatchCard } from '@/components/match/MatchCard';

export function PlayerSearch() {
  const { inputValue, setInputValue, matches, isLoading, error, hasQueried } = useMatchSearch('');

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="group animate-slide-in relative" suppressHydrationWarning>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Search className="text-muted-foreground group-focus-within:text-primary h-5 w-5 transition-colors" />
        </div>
        <Input
          type="text"
          placeholder="Entrez les noms des joueurs (ex: Berrettini Comesana)"
          className="bg-background/50 border-primary/20 focus-visible:ring-primary/50 h-14 rounded-xl pr-12 pl-12 text-lg shadow-lg backdrop-blur-sm transition-all"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        {isLoading && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive border-destructive/20 animate-slide-in rounded-lg border p-4 text-center">
            Erreur lors de la recherche des matchs
          </div>
        )}

        {!isLoading && !error && hasQueried && matches.length === 0 && (
          <div className="bg-card/50 border-border text-muted-foreground animate-slide-in rounded-xl border p-8 text-center backdrop-blur-sm">
            Aucun match en cours trouvé pour cette recherche.
          </div>
        )}

        {matches.length > 0 && (
          <div className="animate-slide-in grid gap-4">
            <h3 className="text-muted-foreground pl-1 text-sm font-medium">
              Matchs en cours trouvés ({matches.length}) :
            </h3>
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
