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
        className="h-7 text-xs px-2"
      >
        <BarChart3 className="w-3.5 h-3.5 mr-1" />
        Daily
      </Button>
      <Button
        variant={mode === 'cumulative' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('cumulative')}
        className="h-7 text-xs px-2"
      >
        <TrendingUp className="w-3.5 h-3.5 mr-1" />
        Cumul.
      </Button>
    </div>
  );
}
