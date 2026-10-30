'use client';

import { useEffect, useState } from 'react';
import { getConfidenceColor, getConfidenceBgColor } from '@/lib/utils';

interface ConfidenceMeterProps {
  score: number; // 0-100
  level: 'HIGH' | 'MEDIUM' | 'LOW';
}

export function ConfidenceMeter({ score, level }: ConfidenceMeterProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    // Animate the bar filling up
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  const colorClass = getConfidenceColor(level);
  const bgClass = getConfidenceBgColor(level);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-end justify-between px-1">
        <span className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
          Confiance
        </span>
        <span className={`font-mono text-2xl font-black tracking-tighter ${colorClass}`}>
          {score}%
        </span>
      </div>

      <div className="bg-muted/50 border-border/50 relative h-4 w-full overflow-hidden rounded-full border shadow-inner">
        {/* Animated fill */}
        <div
          className={`absolute top-0 left-0 h-full ${bgClass} cubic-bezier(0.34, 1.56, 0.64, 1) transition-all duration-1000`}
          style={{ width: `${animatedScore}%` }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 -skew-x-12 animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>

      <div className="text-muted-foreground/70 flex justify-between px-1 font-mono text-[10px]">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
