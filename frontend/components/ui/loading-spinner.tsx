import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
};

/**
 * Unified loading spinner component
 * Replaces all duplicate loading states across the application
 */
export function LoadingSpinner({ 
  className, 
  size = 'md',
  text,
  fullScreen = false 
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-primary border-t-transparent',
          sizeClasses[size]
        )}
        role="status"
        aria-label="Loading"
      />
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-[200px] py-8">
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * Loading spinner for cards
 */
export function CardLoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <LoadingSpinner size="md" />
    </div>
  );
}

/**
 * Loading spinner for tables
 */
export function TableLoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner size="md" />
    </div>
  );
}
