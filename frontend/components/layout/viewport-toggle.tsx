'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Monitor, Smartphone, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ViewportMode = 'auto' | 'mobile' | 'desktop';

export function ViewportToggle() {
  const [mode, setMode] = useState<ViewportMode>('auto');

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('viewport-mode') as ViewportMode;
    if (saved) {
      setMode(saved);
      applyViewportMode(saved);
    }
  }, []);

  const applyViewportMode = (newMode: ViewportMode) => {
    const root = document.documentElement;
    
    // Remove all viewport classes
    root.classList.remove('force-mobile', 'force-desktop');
    
    // Apply new mode
    if (newMode === 'mobile') {
      root.classList.add('force-mobile');
    } else if (newMode === 'desktop') {
      root.classList.add('force-desktop');
    }
    // 'auto' doesn't need a class - uses normal responsive behavior
  };

  const handleModeChange = (newMode: ViewportMode) => {
    setMode(newMode);
    localStorage.setItem('viewport-mode', newMode);
    applyViewportMode(newMode);
  };

  const getIcon = () => {
    switch (mode) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'desktop':
        return <Monitor className="h-4 w-4" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  const getModeLabel = (m: ViewportMode) => {
    switch (m) {
      case 'mobile':
        return 'Mobile';
      case 'desktop':
        return 'Desktop';
      default:
        return 'Auto';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={`Viewport: ${getModeLabel(mode)}`}
        >
          {getIcon()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleModeChange('auto')}
          className={mode === 'auto' ? 'bg-accent' : ''}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Auto (Responsive)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleModeChange('mobile')}
          className={mode === 'mobile' ? 'bg-accent' : ''}
        >
          <Smartphone className="mr-2 h-4 w-4" />
          Mobile View
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleModeChange('desktop')}
          className={mode === 'desktop' ? 'bg-accent' : ''}
        >
          <Monitor className="mr-2 h-4 w-4" />
          Desktop View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
