import React from 'react';
import { QualitySummary } from '../../types';

interface QualityPieChartProps {
  summary: QualitySummary;
}

export const QualityPieChart: React.FC<QualityPieChartProps> = ({ summary }) => {
  const total =
    summary.pass_count +
    summary.repair_count +
    summary.review_count +
    summary.reject_count || 1;

  const passPct = (summary.pass_count / total) * 100;
  const repairPct = (summary.repair_count / total) * 100;
  const reviewPct = (summary.review_count / total) * 100;
  const rejectPct = (summary.reject_count / total) * 100;

  // Render SVG donut slices
  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  const passOffset = 0;
  const repairOffset = -(passPct / 100) * circumference;
  const reviewOffset = -((passPct + repairPct) / 100) * circumference;
  const rejectOffset = -((passPct + repairPct + reviewPct) / 100) * circumference;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-around py-2">
      {/* Donut representation */}
      <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-[#1C1C22]"
            strokeWidth="10"
            fill="transparent"
          />
          {/* PASS */}
          {passPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="#10B981"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={`${(passPct / 100) * circumference} ${circumference}`}
              strokeDashoffset={passOffset}
            />
          )}
          {/* REPAIR */}
          {repairPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="#3B82F6"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={`${(repairPct / 100) * circumference} ${circumference}`}
              strokeDashoffset={repairOffset}
            />
          )}
          {/* REVIEW */}
          {reviewPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="#F59E0B"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={`${(reviewPct / 100) * circumference} ${circumference}`}
              strokeDashoffset={reviewOffset}
            />
          )}
          {/* REJECT */}
          {rejectPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="#EF4444"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={`${(rejectPct / 100) * circumference} ${circumference}`}
              strokeDashoffset={rejectOffset}
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold font-mono text-[#F4F4F5]">{total}</span>
          <span className="text-[10px] text-[#71717A] uppercase font-mono tracking-wider">Chunks</span>
        </div>
      </div>

      {/* Legend & Stats breakdown */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[#A1A1AA]">PASS:</span>
          <span className="font-semibold text-[#F4F4F5]">{summary.pass_count}</span>
          <span className="text-[10px] text-[#71717A]">({passPct.toFixed(0)}%)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          <span className="text-[#A1A1AA]">REPAIR:</span>
          <span className="font-semibold text-[#F4F4F5]">{summary.repair_count}</span>
          <span className="text-[10px] text-[#71717A]">({repairPct.toFixed(0)}%)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
          <span className="text-[#A1A1AA]">REVIEW:</span>
          <span className="font-semibold text-[#F4F4F5]">{summary.review_count}</span>
          <span className="text-[10px] text-[#71717A]">({reviewPct.toFixed(0)}%)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          <span className="text-[#A1A1AA]">REJECT:</span>
          <span className="font-semibold text-[#F4F4F5]">{summary.reject_count}</span>
          <span className="text-[10px] text-[#71717A]">({rejectPct.toFixed(0)}%)</span>
        </div>
      </div>
    </div>
  );
};

