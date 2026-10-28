import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BenchmarkMetricSet } from '../../types';

interface BenchmarkBarChartProps {
  fixedMetrics: BenchmarkMetricSet;
  structureMetrics: BenchmarkMetricSet;
  smartchunkMetrics: BenchmarkMetricSet;
  graphMetrics: BenchmarkMetricSet;
}

export const BenchmarkBarChart: React.FC<BenchmarkBarChartProps> = ({
  fixedMetrics,
  structureMetrics,
  smartchunkMetrics,
  graphMetrics,
}) => {
  const data = [
    {
      metric: 'Recall@5',
      'Fixed-Size (512)': +(fixedMetrics.recall_at_5 * 100).toFixed(1),
      'Structure-Aware': +(structureMetrics.recall_at_5 * 100).toFixed(1),
      'SmartChunk Standard': +(smartchunkMetrics.recall_at_5 * 100).toFixed(1),
      'SmartChunk + Graph': +(graphMetrics.recall_at_5 * 100).toFixed(1),
    },
    {
      metric: 'MRR@5',
      'Fixed-Size (512)': +(fixedMetrics.mrr_at_5 * 100).toFixed(1),
      'Structure-Aware': +(structureMetrics.mrr_at_5 * 100).toFixed(1),
      'SmartChunk Standard': +(smartchunkMetrics.mrr_at_5 * 100).toFixed(1),
      'SmartChunk + Graph': +(graphMetrics.mrr_at_5 * 100).toFixed(1),
    },
    {
      metric: 'Equation Integrity',
      'Fixed-Size (512)': +fixedMetrics.equation_integrity_pct.toFixed(1),
      'Structure-Aware': +structureMetrics.equation_integrity_pct.toFixed(1),
      'SmartChunk Standard': +smartchunkMetrics.equation_integrity_pct.toFixed(1),
      'SmartChunk + Graph': +graphMetrics.equation_integrity_pct.toFixed(1),
    },
    {
      metric: 'Table Integrity',
      'Fixed-Size (512)': +fixedMetrics.table_integrity_pct.toFixed(1),
      'Structure-Aware': +structureMetrics.table_integrity_pct.toFixed(1),
      'SmartChunk Standard': +smartchunkMetrics.table_integrity_pct.toFixed(1),
      'SmartChunk + Graph': +graphMetrics.table_integrity_pct.toFixed(1),
    },
    {
      metric: 'Provenance',
      'Fixed-Size (512)': +fixedMetrics.provenance_completeness_pct.toFixed(1),
      'Structure-Aware': +structureMetrics.provenance_completeness_pct.toFixed(1),
      'SmartChunk Standard': +smartchunkMetrics.provenance_completeness_pct.toFixed(1),
      'SmartChunk + Graph': +graphMetrics.provenance_completeness_pct.toFixed(1),
    },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#141418] border border-[#29292F] p-3 rounded-lg shadow-xl text-xs font-mono">
          <p className="text-[#F4F4F5] font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[#A1A1AA]">{entry.name}:</span>
              </span>
              <span className="font-bold text-[#F4F4F5]">{entry.value}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222227" vertical={false} />
          <XAxis
            dataKey="metric"
            stroke="#71717A"
            tick={{ fill: '#A1A1AA', fontSize: 11, fontFamily: 'monospace' }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#71717A"
            tick={{ fill: '#A1A1AA', fontSize: 11, fontFamily: 'monospace' }}
            unit="%"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12, fontFamily: 'monospace' }}
          />
          <Bar dataKey="Fixed-Size (512)" fill="#52525B" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Structure-Aware" fill="#3B82F6" radius={[2, 2, 0, 0]} />
          <Bar dataKey="SmartChunk Standard" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
          <Bar dataKey="SmartChunk + Graph" fill="#10B981" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

