'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AIModel } from '@/types/ai.types';

const STORAGE_KEY = 'tennis-ai-selected-models';
const ALL_MODELS: AIModel[] = ['claude', 'gpt4o', 'gemini'];

/**
 * Hook to manage which AI models are selected for predictions.
 * Persists selection to localStorage.
 */
export function useModelSelection() {
  const [selectedModels, setSelectedModels] = useState<AIModel[]>(ALL_MODELS);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AIModel[];
        // Validate: ensure at least one model, and all values are valid
        const valid = parsed.filter((m) => ALL_MODELS.includes(m));
        if (valid.length > 0) {
          setSelectedModels(valid);
        }
      }
    } catch {
      // If localStorage is unavailable, default to all models
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedModels));
    } catch {
      // Ignore storage errors
    }
  }, [selectedModels, isHydrated]);

  const toggleModel = useCallback((model: AIModel) => {
    setSelectedModels((prev) => {
      if (prev.includes(model)) {
        // Don't allow deselecting the last model
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== model);
      }
      return [...prev, model];
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedModels([...ALL_MODELS]);
  }, []);

  const isSelected = useCallback(
    (model: AIModel) => selectedModels.includes(model),
    [selectedModels],
  );

  return {
    selectedModels,
    toggleModel,
    selectAll,
    isSelected,
    allModels: ALL_MODELS,
    isHydrated,
  };
}
