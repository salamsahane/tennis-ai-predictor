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
      <div className="flex justify-between items-end px-1">
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Confiance
        </span>
        <span className={`text-2xl font-black font-mono tracking-tighter ${colorClass}`}>
          {score}%
        </span>
      </div>
      
      <div className="h-4 w-full bg-muted/50 rounded-full overflow-hidden border border-border/50 shadow-inner relative">
        {/* Animated fill */}
        <div 
          className={`absolute top-0 left-0 h-full ${bgClass} transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1)`}
          style={{ width: `${animatedScore}%` }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-[shimmer_2s_infinite]" />
        </div>
      </div>
      
      <div className="flex justify-between text-[10px] text-muted-foreground/70 font-mono px-1">
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
