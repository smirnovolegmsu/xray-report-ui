import { cn } from '@/lib/utils';

interface AdaptiveTextProps {
  full: string;
  short?: string;
  shortest?: string;
  className?: string;
  showTooltip?: boolean;
}

/**
 * AdaptiveText - automatically shortens text based on available space
 * Shows full text on large screens, progressively shorter on smaller screens
 */
export function AdaptiveText({ 
  full, 
  short, 
  shortest, 
  className,
  showTooltip = false 
}: AdaptiveTextProps) {
  return (
    <>
      {/* Full text - shown on large screens */}
      {full && (
        <span 
          className={cn("hidden lg:inline", className)}
          title={showTooltip ? full : undefined}
        >
          {full}
        </span>
      )}
      
      {/* Short text - shown on medium screens */}
      {short && (
        <span 
          className={cn("hidden sm:inline lg:hidden", className)}
          title={showTooltip ? full : undefined}
        >
          {short}
        </span>
      )}
      
      {/* Shortest text - shown on small screens */}
      {shortest ? (
        <span 
          className={cn("inline sm:hidden", className)}
          title={showTooltip ? full : undefined}
        >
          {shortest}
        </span>
      ) : short ? (
        <span 
          className={cn("inline sm:hidden lg:inline", className)}
          title={showTooltip ? full : undefined}
        >
          {short}
        </span>
      ) : (
        <span 
          className={cn("inline lg:hidden", className)}
          title={showTooltip ? full : undefined}
        >
          {full}
        </span>
      )}
    </>
  );
}
