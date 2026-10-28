import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  data: any;
  title?: string;
  className?: string;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data, title = 'JSON Metadata', className = '' }) => {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded border border-[#29292F] bg-[#0A0A0C] font-mono text-xs overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#121215] border-b border-[#222227] text-[#A1A1AA]">
        <span className="font-semibold text-[11px] text-[#D4D4D8] uppercase tracking-wider">{title}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] hover:text-white transition-colors"
          title="Copy JSON"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="p-3 overflow-x-auto max-h-80 text-[#A1A1AA] text-[11px] leading-relaxed">
        <pre>{jsonString}</pre>
      </div>
    </div>
  );
};

