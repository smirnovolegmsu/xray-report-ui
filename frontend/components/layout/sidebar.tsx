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
        'w-64 border-r bg-background flex flex-col transition-transform duration-300 ease-in-out',
        // z-index: must be higher than all page content and overlay
        'z-[100] h-full',
        // Mobile: fixed positioning with slide animation
        isMobile && 'fixed inset-y-0 left-0 shadow-2xl',
        isMobile && !isOpen && '-translate-x-full',
        isMobile && isOpen && 'translate-x-0',
        // Desktop: relative positioning, always visible
        !isMobile && 'relative translate-x-0',
        // Mobile: fixed positioning
        isMobile && 'fixed top-0 left-0 bottom-0 max-w-[256px]'
      )}
    >
      {/* Logo & Close Button */}
      <div className="p-4 border-b">
        <div className="min-w-0">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
            Xray UI
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {lang === 'ru' ? 'Панель управления' : 'Admin Dashboard'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => {
                // Close sidebar on mobile after navigation
                if (isMobile) {
                  // Small delay to allow navigation to start
                  setTimeout(() => onClose(), 100);
                }
              }}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all min-h-[44px]',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'hover:bg-muted hover:shadow-sm'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="font-medium text-sm">{item.label[lang]}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>© 2026 Xray UI</span>
          <span className="text-green-500 text-xs">●</span>
        </div>
      </div>
    </aside>
  );
}
