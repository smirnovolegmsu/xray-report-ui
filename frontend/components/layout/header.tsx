'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Moon, Sun, Globe, Menu, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { StatusBadges } from './status-badges';
import { ViewportToggle } from './viewport-toggle';
import { PortsStatus } from './ports-status';

interface HeaderProps {
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

export function Header({ onMenuClick, sidebarOpen }: HeaderProps = {}) {
  const { lang, setLang } = useAppStore();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const toggleLang = () => {
    setLang(lang === 'ru' ? 'en' : 'ru');
  };

  return (
    <header className="border-b h-12 flex items-center px-3 justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        {/* Hamburger Menu Button - always visible for sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="h-10 w-10 min-h-[44px] min-w-[44px] md:min-h-0 md:h-9 md:w-9"
          title={sidebarOpen ? (lang === 'ru' ? 'Скрыть меню' : 'Hide menu') : (lang === 'ru' ? 'Показать меню' : 'Show menu')}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {/* Adaptive title: full → short → shortest */}
        <h1 className="text-base font-semibold hidden lg:block">Xray Admin Panel</h1>
        <h1 className="text-base font-semibold hidden sm:block lg:hidden">Xray UI</h1>
        <h1 className="text-sm font-semibold sm:hidden">Xray</h1>
        
        {/* Version badge - hide on very small screens */}
        <Badge variant="outline" className="text-xs h-4 px-1.5 hidden min-[375px]:inline-flex">
          v2.1
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        {/* Ports Status - show running ports */}
        <PortsStatus />
        
        {/* Status Badges - hide on very small screens */}
        <div className="hidden sm:block">
          <StatusBadges />
        </div>

        {/* Viewport Toggle - hide on very small screens */}
        <div className="hidden min-[400px]:block">
          <ViewportToggle />
        </div>

        {/* Language Toggle - touch-friendly size */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLang}
          title={lang === 'ru' ? 'Switch to English' : 'Переключить на Русский'}
          className="h-10 w-10 min-h-[44px] min-w-[44px]"
        >
          <Globe className="h-5 w-5" />
        </Button>

        {/* Theme Toggle - touch-friendly size */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="h-10 w-10 min-h-[44px] min-w-[44px]"
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
    </header>
  );
}
