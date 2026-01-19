'use client';

import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp } from 'lucide-react';

interface ModeToggleProps {
  mode: 'daily' | 'cumulative';
  onModeChange: (mode: 'daily' | 'cumulative') => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg">
      <Button
        variant={mode === 'daily' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('daily')}
        className="h-9 sm:h-8 min-h-[44px] sm:min-h-0 text-xs px-2"
      >
        <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
        <span className="hidden xs:inline">Daily</span>
      </Button>
      <Button
        variant={mode === 'cumulative' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('cumulative')}
        className="h-9 sm:h-8 min-h-[44px] sm:min-h-0 text-xs px-2"
      >
        <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
        <span className="hidden xs:inline">Cumul.</span>
      </Button>
    </div>
  );
}
