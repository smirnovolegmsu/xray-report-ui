'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { XraySettings } from '@/components/features/settings/xray-settings';
import { CollectorSettings } from '@/components/features/settings/collector-settings';
import { SystemSettings } from '@/components/features/settings/system-settings';
import { BackupsSettings } from '@/components/features/settings/backups-settings';
import { PortsSettings } from '@/components/features/settings/ports-settings';

function SettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const defaultTab = tabParam || 'xray';

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure system, Xray, and collector settings
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="xray">Xray</TabsTrigger>
            <TabsTrigger value="collector">Collector</TabsTrigger>
            <TabsTrigger value="ports">Ports</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="backups">Backups</TabsTrigger>
          </TabsList>

          <TabsContent value="xray" className="space-y-4">
            <XraySettings />
          </TabsContent>

          <TabsContent value="collector" className="space-y-4">
            <CollectorSettings />
          </TabsContent>

          <TabsContent value="ports" className="space-y-4">
            <PortsSettings />
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <SystemSettings />
          </TabsContent>

          <TabsContent value="backups" className="space-y-4">
            <BackupsSettings />
      </TabsContent>
    </Tabs>
  </div>
</MainLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
