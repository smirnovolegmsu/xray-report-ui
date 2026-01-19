'use client';

import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp } from 'lucide-react';

interface ModeToggleProps {
  mode: 'daily' | 'cumulative';
  onModeChange: (mode: 'daily' | 'cumulative') => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      <Button
        variant={mode === 'daily' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('daily')}
        className="h-8"
      >
        <BarChart3 className="w-4 h-4 mr-1" />
        Daily
      </Button>
      <Button
        variant={mode === 'cumulative' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('cumulative')}
        className="h-8"
      >
        <TrendingUp className="w-4 h-4 mr-1" />
        Cumulative
      </Button>
    </div>
  );
}
