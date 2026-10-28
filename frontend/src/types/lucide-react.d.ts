declare module 'lucide-react' {
  import * as React from 'react';

  export interface LucideProps extends React.SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
    className?: string;
  }

  export type LucideIcon = React.ForwardRefExoticComponent<
    LucideProps & React.RefAttributes<SVGSVGElement>
  >;

  export const LayoutDashboard: LucideIcon;
  export const Files: LucideIcon;
  export const Binary: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const ShieldAlert: LucideIcon;
  export const BarChart3: LucideIcon;
  export const Network: LucideIcon;
  export const MessageSquare: LucideIcon;
  export const Bot: LucideIcon;
  export const Settings: LucideIcon;
  export const Layers: LucideIcon;
  export const Sparkles: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const Check: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const Info: LucideIcon;
  export const X: LucideIcon;
  export const Copy: LucideIcon;
  export const Upload: LucideIcon;
  export const UploadCloud: LucideIcon;
  export const Loader2: LucideIcon;
  export const Search: LucideIcon;
  export const Filter: LucideIcon;
  export const Sliders: LucideIcon;
  export const SlidersHorizontal: LucideIcon;
  export const Play: LucideIcon;
  export const RotateCcw: LucideIcon;
  export const Wrench: LucideIcon;
  export const Trash2: LucideIcon;
  export const FileText: LucideIcon;
  export const FileCode: LucideIcon;
  export const Sigma: LucideIcon;
  export const Table: LucideIcon;
  export const BookOpen: LucideIcon;
  export const Bookmark: LucideIcon;
  export const Share2: LucideIcon;
  export const ZoomIn: LucideIcon;
  export const ZoomOut: LucideIcon;
  export const Maximize2: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowUpRight: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const Zap: LucideIcon;
  export const Clock: LucideIcon;
  export const Cpu: LucideIcon;
  export const Database: LucideIcon;
  export const Menu: LucideIcon;
  export const ToggleLeft: LucideIcon;
  export const ToggleRight: LucideIcon;
  export const Activity: LucideIcon;
  export const Code2: LucideIcon;
  export const Hash: LucideIcon;
  export const User: LucideIcon;
  export const Send: LucideIcon;
  export const HelpCircle: LucideIcon;
  export const Terminal: LucideIcon;
  export const Download: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Server: LucideIcon;

  const defaultIcon: LucideIcon;
  export default defaultIcon;
}

