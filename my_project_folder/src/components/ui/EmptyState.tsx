import React, { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-[#29292F] bg-[#0E0E11] ${className}`}
    >
      <div className="p-3 rounded-full bg-[#17171B] border border-[#29292F] text-violet-400 mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-[#F4F4F5]">{title}</h3>
      <p className="text-xs text-[#A1A1AA] max-w-sm mt-1 mb-4 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

