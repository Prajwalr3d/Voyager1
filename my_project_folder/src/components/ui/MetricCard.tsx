import React, { ReactNode } from 'react';
import { Card } from './Card';
import { Loader2, AlertCircle } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  isDemo?: boolean;
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  icon,
  trend,
  isLoading = false,
  isError = false,
  isEmpty = false,
  isDemo = false,
  onClick,
  className = '',
}) => {
  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      className={`p-4 relative overflow-hidden flex flex-col justify-between ${className}`}
    >
      {/* Demo indicator tag if in demo mode */}
      {isDemo && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider bg-violet-950/70 text-violet-400 border border-violet-800/50 uppercase select-none">
          Demo Fixture
        </div>
      )}

      <div>
        <div className="flex items-center justify-between text-[#A1A1AA] text-xs font-medium">
          <span className="truncate pr-4">{label}</span>
          {icon && <span className="text-[#71717A] shrink-0">{icon}</span>}
        </div>

        <div className="mt-2.5">
          {isLoading ? (
            <div className="flex items-center gap-2 py-1 text-[#71717A]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs">Evaluating...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center gap-1.5 text-rose-400 text-xs py-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Unavailable</span>
            </div>
          ) : isEmpty ? (
            <div className="text-xl font-mono text-[#52525B]">--</div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-[#F4F4F5]">
                {value}
              </span>
              {subValue && (
                <span className="text-xs font-mono text-[#71717A] truncate">
                  {subValue}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {trend && !isLoading && !isError && !isEmpty && (
        <div className="mt-3 pt-2.5 border-t border-[#222227] flex items-center justify-between text-xs">
          <span
            className={`font-mono font-medium ${
              trend.isPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {trend.value}
          </span>
          {trend.label && <span className="text-[#71717A] text-[11px]">{trend.label}</span>}
        </div>
      )}
    </Card>
  );
};

