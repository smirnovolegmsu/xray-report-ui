'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Moon, Sun, Globe, Menu, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { StatusBadges } from './status-badges';
import { ViewportToggle } from './viewport-toggle';

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
        {/* Hamburger Menu Button - shows on mobile OR force-mobile mode */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="force-mobile:block md:force-mobile:block md:hidden h-8 w-8"
          title={sidebarOpen ? 'Close menu' : 'Open menu'}
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>

        <h1 className="text-lg font-semibold hidden sm:block">Xray Admin Panel</h1>
        <h1 className="text-base font-semibold sm:hidden">Xray</h1>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
          v2.1
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Status Badges */}
        <StatusBadges />

        {/* Viewport Toggle */}
        <ViewportToggle />

        {/* Language Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLang}
          title={lang === 'ru' ? 'Switch to English' : 'Переключить на Русский'}
          className="h-8 w-8"
        >
          <Globe className="h-4 w-4" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="h-8 w-8"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
