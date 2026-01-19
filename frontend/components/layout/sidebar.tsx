'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import {
  LayoutDashboard,
  Users,
  Activity,
  Settings,
  FileText,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  {
    href: '/',
    label: { ru: 'Обзор', en: 'Overview' },
    icon: LayoutDashboard,
  },
  {
    href: '/users',
    label: { ru: 'Пользователи', en: 'Users' },
    icon: Users,
  },
  {
    href: '/online',
    label: { ru: 'Live', en: 'Live' },
    icon: Activity,
  },
  {
    href: '/events',
    label: { ru: 'События', en: 'Events' },
    icon: FileText,
  },
  {
    href: '/settings',
    label: { ru: 'Настройки', en: 'Settings' },
    icon: Settings,
  },
];

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, isMobile, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { lang } = useAppStore();

  return (
    <aside
      className={cn(
        'w-64 border-r bg-muted/10 flex flex-col transition-transform duration-300 ease-in-out',
        // Mobile OR force-mobile: fixed, slide from left
        'z-50 h-full',
        // Desktop without force-mobile: relative and always visible
        isMobile ? 'fixed' : 'md:relative',
        isMobile && !isOpen && '-translate-x-full',
        isMobile && isOpen && 'translate-x-0',
        !isMobile && 'relative translate-x-0'
      )}
    >
      {/* Logo & Close Button */}
      <div className="p-6 border-b flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Xray UI
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === 'ru' ? 'Панель управления' : 'Admin Dashboard'}
          </p>
        </div>
        
        {/* Close button (mobile only) */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => isMobile && onClose()} // Close on mobile after click
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'hover:bg-muted hover:shadow-sm'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label[lang]}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>© 2026 Xray UI</span>
          <span className="text-green-500">●</span>
        </div>
      </div>
    </aside>
  );
}
