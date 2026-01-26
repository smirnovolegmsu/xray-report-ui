'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { RealTimeDashboard } from '@/components/features/live/real-time-dashboard';

export default function OnlinePage() {
  return (
    <MainLayout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-bold tracking-tight">Live Monitoring</h1>
          <p className="text-xs text-muted-foreground">
            Real-time monitoring of currently connected users and system activity
          </p>
        </div>

        <RealTimeDashboard />
      </div>
    </MainLayout>
  );
}
