import { useState, useEffect } from 'react';
import type { MatchData } from '@/types/tennis.types';
import type { PredictionEvent } from '@/types/verdict.types';
import type { AIModel } from '@/types/ai.types';

const STORAGE_KEY = 'tennis-ai-selected-models';
const ALL_MODELS: AIModel[] = ['claude', 'gpt4o', 'gemini'];

export function useMatchStream(matchId: string | null) {
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [predictions, setPredictions] = useState<PredictionEvent[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;

    setConnectionStatus('connecting');
    setError(null);
    let eventSource: EventSource | null = null;
    let isMounted = true;

    // Read selected models from localStorage at connection time
    let models = ALL_MODELS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AIModel[];
        const valid = parsed.filter((m) => ALL_MODELS.includes(m));
        if (valid.length > 0) models = valid;
      }
    } catch { /* defaults to all */ }

    const modelsParam = models.join(',');

    const connect = () => {
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource(`/api/stream/${matchId}?models=${modelsParam}`);

      eventSource.addEventListener('match_update', (e) => {
        if (!isMounted) return;
        setMatchData(JSON.parse(e.data));
        setConnectionStatus('connected');
        setError(null);
      });

      eventSource.addEventListener('prediction_start', () => {
        if (!isMounted) return;
        setIsPredicting(true);
      });

      eventSource.addEventListener('prediction_result', (e) => {
        if (!isMounted) return;
        const result = JSON.parse(e.data) as PredictionEvent;
        // Check if we already have this prediction (prevent duplicates on reconnect)
        setPredictions(prev => {
          const exists = prev.some(p => p.game_number === result.game_number && p.set_number === result.set_number);
          if (exists) return prev;
          return [result, ...prev]; // Prepend new predictions
        });
        setIsPredicting(false);
      });

      eventSource.addEventListener('match_ended', (e) => {
        if (!isMounted) return;
        // Optionally handle match ended event
        setConnectionStatus('disconnected');
        if (eventSource) eventSource.close();
      });

      eventSource.addEventListener('error', (e) => {
        if (!isMounted) return;
        
        // Custom error events from the server
        try {
          // If e.data exists, it's a custom error event we dispatched from the server
          if ('data' in e && typeof e.data === 'string') {
            const data = JSON.parse(e.data);
            if (data.message === 'Match not found') {
              setError('Match not found');
              eventSource?.close();
              setConnectionStatus('disconnected');
              return;
            }
          }
        } catch {
          // Ignore parse errors
        }

        // Standard EventSource error (connection lost)
        setConnectionStatus('connecting'); // Reconnecting
      });

      // Handle raw EventSource onerror
      eventSource.onerror = (e) => {
        if (!isMounted) return;
        // Only set disconnected if we're not receiving any data at all
        if (eventSource?.readyState === EventSource.CLOSED) {
          setConnectionStatus('disconnected');
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
      setConnectionStatus('disconnected');
    };
  }, [matchId]);

  return { matchData, predictions, isPredicting, connectionStatus, error };
}
