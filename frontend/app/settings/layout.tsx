'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { 
  Settings, 
  Server, 
  Database, 
  Network, 
  HardDrive, 
  FlaskConical,
  TestTube 
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

const settingsTabs = [
  {
    href: '/settings/xray',
    value: 'xray',
    label: { ru: 'Xray', en: 'Xray' },
    icon: Server,
  },
  {
    href: '/settings/collector',
    value: 'collector',
    label: { ru: 'Collector', en: 'Collector' },
    icon: Database,
  },
  {
    href: '/settings/ports',
    value: 'ports',
    label: { ru: 'Ports', en: 'Ports' },
    icon: Network,
  },
  {
    href: '/settings/system',
    value: 'system',
    label: { ru: 'System', en: 'System' },
    icon: Settings,
  },
  {
    href: '/settings/backups',
    value: 'backups',
    label: { ru: 'Backups', en: 'Backups' },
    icon: HardDrive,
  },
  {
    href: '/settings/tests',
    value: 'tests',
    label: { ru: 'Tests', en: 'Tests' },
    icon: FlaskConical,
  },
];

function SettingsTabs() {
  const pathname = usePathname();
  const { lang } = useAppStore();
  
  // Determine active tab from pathname
  const activeTab = pathname.split('/').pop() || 'xray';

  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
        {settingsTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          
          return (
            <TabsTrigger 
              key={tab.href}
              value={tab.value} 
              className="w-full flex items-center gap-2"
              asChild
            >
              <Link href={tab.href}>
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label[lang]}</span>
              </Link>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang } = useAppStore();

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {lang === 'ru' ? 'Настройки' : 'Settings'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === 'ru'
              ? 'Настройка системы, Xray и сборщика данных'
              : 'Configure system, Xray, and collector settings'}
          </p>
        </div>

        <Suspense fallback={<div className="h-10 bg-muted animate-pulse rounded-md" />}>
          <SettingsTabs />
        </Suspense>

        <div className="space-y-4">
          {children}
        </div>
      </div>
    </MainLayout>
  );
}
