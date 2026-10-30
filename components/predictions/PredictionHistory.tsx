'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  type TooltipContentProps,
} from 'recharts';
import { MODEL_CONFIG } from '@/lib/utils';
import type { ModelPerformance } from '@/types/verdict.types';

interface PredictionHistoryProps {
  performance: ModelPerformance[];
  totalPredictions: number;
  verdictAccuracy: number | null;
  completedPredictions: number;
}

interface ChartDatum {
  name: string;
  accuracy: number | null;
  correct: number;
  total: number;
  fill: string;
}

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as ChartDatum;
  return (
    <div className="bg-popover border-border rounded-lg border p-3 text-sm shadow-xl">
      <p className="text-foreground mb-1 font-bold">{label}</p>
      <p className="text-primary font-mono">
        {data.accuracy === null ? 'Précision en attente' : `${data.accuracy}% de précision`}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {data.correct} corrects sur {data.total} prédictions
      </p>
    </div>
  );
}

export function PredictionHistory({
  performance,
  totalPredictions,
  verdictAccuracy,
  completedPredictions,
}: PredictionHistoryProps) {
  if (totalPredictions === 0) {
    return (
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg">Performances IA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-48 items-center justify-center text-sm">
            Pas encore assez de données.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format data for Recharts
  const chartData: ChartDatum[] = performance.map((p) => ({
    name: MODEL_CONFIG[p.model].name,
    accuracy: p.accuracy,
    correct: p.correct,
    total: p.total,
    fill: MODEL_CONFIG[p.model].color,
  }));

  return (
    <Card className="bg-card/50 border-border backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Précision des modèles</CardTitle>
        <div className="text-right">
          <div className="text-primary font-mono text-2xl font-black tracking-tighter">
            {verdictAccuracy === null ? 'en attente' : `${verdictAccuracy}%`}
          </div>
          <div className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
            Verdict Global
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {completedPredictions === 0 ? (
          <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
            Précision en attente des résultats réels.
          </div>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="var(--border)"
                  opacity={0.5}
                />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--foreground)', fontSize: 12, fontWeight: 500 }}
                  width={70}
                />
                <Tooltip
                  content={ChartTooltip}
                  cursor={{ fill: 'color-mix(in oklch, var(--muted) 50%, transparent)' }}
                />
                <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={32}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="text-muted-foreground mt-2 text-center text-xs">
          Basé sur {completedPredictions} jeu(x) évalué(s)
        </div>
      </CardContent>
    </Card>
  );
}
