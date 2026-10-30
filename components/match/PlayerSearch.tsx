'use client';

import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useMatchSearch } from '@/hooks/useMatchSearch';
import { MatchCard } from '@/components/match/MatchCard';

export function PlayerSearch() {
  const { inputValue, setInputValue, matches, isLoading, error, hasQueried } = useMatchSearch('');

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="relative group animate-slide-in" suppressHydrationWarning>
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <Input
          type="text"
          placeholder="Entrez les noms des joueurs (ex: Berrettini Comesana)"
          className="pl-12 pr-12 h-14 text-lg bg-background/50 backdrop-blur-sm border-primary/20 focus-visible:ring-primary/50 rounded-xl shadow-lg transition-all"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-center animate-slide-in">
            Erreur lors de la recherche des matchs
          </div>
        )}

        {!isLoading && !error && hasQueried && matches.length === 0 && (
          <div className="p-8 bg-card/50 backdrop-blur-sm border border-border rounded-xl text-center text-muted-foreground animate-slide-in">
            Aucun match en cours trouvé pour cette recherche.
          </div>
        )}

        {matches.length > 0 && (
          <div className="grid gap-4 animate-slide-in">
            <h3 className="text-sm font-medium text-muted-foreground pl-1">
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
