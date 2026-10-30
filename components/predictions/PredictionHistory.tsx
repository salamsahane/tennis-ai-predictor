'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MODEL_CONFIG } from '@/lib/utils';
import type { ModelPerformance } from '@/types/verdict.types';

interface PredictionHistoryProps {
  performance: ModelPerformance[];
  totalPredictions: number;
  verdictAccuracy: number;
}

export function PredictionHistory({ performance, totalPredictions, verdictAccuracy }: PredictionHistoryProps) {
  if (totalPredictions === 0) {
    return (
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg">Performances IA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Pas encore assez de données.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format data for Recharts
  const chartData = performance.map(p => ({
    name: MODEL_CONFIG[p.model].name,
    accuracy: p.accuracy,
    correct: p.correct,
    total: p.total,
    fill: MODEL_CONFIG[p.model].color,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-sm">
          <p className="font-bold text-foreground mb-1">{label}</p>
          <p className="text-primary font-mono">{data.accuracy}% de précision</p>
          <p className="text-muted-foreground text-xs mt-1">
            {data.correct} corrects sur {data.total} prédictions
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Précision des modèles</CardTitle>
        <div className="text-right">
          <div className="text-2xl font-black text-primary font-mono tracking-tighter">
            {verdictAccuracy}%
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            Verdict Global
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }} 
                width={70}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.5)' }} />
              <Bar 
                dataKey="accuracy" 
                radius={[0, 4, 4, 0]}
                barSize={32}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-center text-muted-foreground mt-2">
          Basé sur {totalPredictions} jeu(x) évalué(s)
        </div>
      </CardContent>
    </Card>
  );
}
