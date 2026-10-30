'use client';

import type { AIModel } from '@/types/ai.types';
import { MODEL_CONFIG } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ModelSelectorProps {
  selectedModels: AIModel[];
  onToggle: (model: AIModel) => void;
  allModels: AIModel[];
}

export function ModelSelector({ selectedModels, onToggle, allModels }: ModelSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Modèles IA
        </label>
        <span className="text-[10px] text-muted-foreground/60">
          {selectedModels.length}/{allModels.length} actif{selectedModels.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex gap-2">
        {allModels.map((model) => {
          const config = MODEL_CONFIG[model];
          const isActive = selectedModels.includes(model);

          return (
            <button
              key={model}
              type="button"
              onClick={() => onToggle(model)}
              className={`
                group relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium
                transition-all duration-200 ease-out cursor-pointer select-none
                border backdrop-blur-sm
                ${isActive
                  ? `${config.bgClass}/15 border-current/30 shadow-md shadow-current/5`
                  : 'bg-muted/30 border-border/30 text-muted-foreground hover:bg-muted/60 hover:border-border/50'
                }
              `}
              style={isActive ? { color: config.color } : undefined}
              title={isActive && selectedModels.length === 1
                ? 'Au moins un modèle doit être sélectionné'
                : `${isActive ? 'Désactiver' : 'Activer'} ${config.name}`
              }
            >
              {/* Check indicator */}
              <span
                className={`
                  flex items-center justify-center w-4 h-4 rounded-md border transition-all duration-200
                  ${isActive
                    ? `${config.bgClass} border-transparent`
                    : 'border-muted-foreground/30 bg-transparent'
                  }
                `}
              >
                {isActive && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>

              {/* Icon & Label */}
              <span className="text-base leading-none">{config.icon}</span>
              <span className={isActive ? '' : 'opacity-60'}>{config.name}</span>

              {/* Active glow effect */}
              {isActive && (
                <span
                  className="absolute inset-0 rounded-xl opacity-10 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at center, ${config.color}, transparent 70%)` }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
