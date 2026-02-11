import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ReactNode } from "react";

interface TooltipWrapperProps {
  children: ReactNode;
  content: ReactNode;
  delayDuration?: number;
}

export function TooltipWrapper({ 
  children, 
  content, 
  delayDuration = 0 
}: TooltipWrapperProps) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          className="p-3 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-xl z-[9999]"
        >
          <div className="text-xs space-y-1 min-w-[150px]">
            {content}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function DataList({ data, title }: { data: any, title: string }) {
  if (!data) return null;
  
  const entries = Object.entries(data).filter(([key]) => key !== 'id' && key !== 'label');
  
  return (
    <div className="space-y-1.5">
      <div className="font-bold text-slate-900 border-b pb-1 mb-1 uppercase tracking-wider text-[10px]">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {entries.map(([key, value]) => (
          <div key={key} className="contents">
            <span className="text-slate-500 font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
            <span className="text-slate-900 font-bold text-right">
              {typeof value === 'number' ? Number(value).toLocaleString() : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
