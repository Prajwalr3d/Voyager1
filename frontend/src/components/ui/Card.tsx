import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  hoverable?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  elevated = false,
  hoverable = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-[#29292F] transition-colors duration-150 ${
        elevated ? 'bg-[#17171B]' : 'bg-[#131316]'
      } ${hoverable ? 'hover:border-[#3F3F46] hover:bg-[#18181E] cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}> = ({ title, subtitle, action, className = '' }) => {
  return (
    <div className={`p-4 border-b border-[#222227] flex items-center justify-between gap-4 ${className}`}>
      <div>
        <h3 className="text-sm font-semibold text-[#F4F4F5] tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-[#A1A1AA] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
};

export const CardBody: React.FC<{
  children: ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return <div className={`p-4 ${className}`}>{children}</div>;
};

export const CardFooter: React.FC<{
  children: ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`p-3.5 bg-[#0F0F12] border-t border-[#222227] rounded-b-lg flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
};

