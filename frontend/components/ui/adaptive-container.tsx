import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface AdaptiveContainerProps {
  children: ReactNode;
  className?: string;
  type?: 'card' | 'metric' | 'user' | 'chart';
}

/**
 * AdaptiveContainer - wrapper component for container queries
 * Enables child components to adapt based on container width instead of viewport width
 */
export function AdaptiveContainer({ 
  children, 
  className, 
  type = 'card' 
}: AdaptiveContainerProps) {
  const containerClass = {
    card: 'container-card',
    metric: 'container-metric',
    user: 'container-user',
    chart: 'container-chart',
  }[type];

  return (
    <div className={cn(containerClass, className)}>
      {children}
    </div>
  );
}
