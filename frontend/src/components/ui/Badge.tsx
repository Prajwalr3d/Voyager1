import React from 'react';
import { QualityStatus, DiagnosticSeverity, ChunkContentType } from '../../types';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'pass' | 'repair' | 'review' | 'reject' | 'info' | 'neutral' | 'accent';
  status?: QualityStatus;
  severity?: DiagnosticSeverity;
  contentType?: ChunkContentType;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  status,
  severity,
  contentType,
  size = 'sm',
  className = '',
}) => {
  // Determine variant based on status or severity if provided
  let effectiveVariant = variant || 'neutral';

  if (status) {
    if (status === 'pass') effectiveVariant = 'pass';
    else if (status === 'repair') effectiveVariant = 'repair';
    else if (status === 'review') effectiveVariant = 'review';
    else if (status === 'reject') effectiveVariant = 'reject';
  } else if (severity) {
    if (severity === 'hard_gate') effectiveVariant = 'reject';
    else if (severity === 'warning') effectiveVariant = 'review';
    else if (severity === 'info') effectiveVariant = 'info';
  }

  const variantStyles = {
    pass: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60',
    repair: 'bg-blue-950/60 text-blue-400 border border-blue-800/60',
    review: 'bg-amber-950/60 text-amber-400 border border-amber-800/60',
    reject: 'bg-rose-950/60 text-rose-400 border border-rose-800/60',
    info: 'bg-sky-950/60 text-sky-400 border border-sky-800/60',
    accent: 'bg-violet-950/60 text-violet-300 border border-violet-800/60',
    neutral: 'bg-[#18181B] text-[#A1A1AA] border border-[#27272A]',
  };

  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5 tracking-wider uppercase font-semibold font-mono',
    sm: 'text-xs px-2 py-0.5 font-medium font-mono',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  let label = children;
  if (!label && status) {
    label = status.toUpperCase();
  } else if (!label && severity) {
    label = severity.replace('_', ' ').toUpperCase();
  } else if (!label && contentType) {
    label = contentType.replace('_', ' ').toUpperCase();
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium select-none ${variantStyles[effectiveVariant]} ${sizeStyles[size]} ${className}`}
    >
      {effectiveVariant === 'pass' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
      {effectiveVariant === 'repair' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>}
      {effectiveVariant === 'review' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
      {effectiveVariant === 'reject' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>}
      {label}
    </span>
  );
};

