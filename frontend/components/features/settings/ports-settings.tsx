'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, Wifi, WifiOff, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface PortInfo {
  port: number;
  name: string;
  type: string;
  status: string;
  host: string;
}

interface PortsData {
  ports: PortInfo[];
  current: {
    port: number;
    host: string;
    url: string;
  };
  timestamp: string;
}

export function PortsSettings() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [current, setCurrent] = useState<PortsData['current'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPorts();
  }, []);

  const loadPorts = async () => {
    try {
      setRefreshing(true);
      const response = await apiClient.getPortsStatus();
      if (response.data && response.data.ok) {
        setPorts(response.data.ports || []);
        setCurrent(response.data.current);
      } else {
        toast.error('Failed to load ports status');
      }
    } catch (error) {
      toast.error('Error loading ports status');
      console.error('Failed to load ports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ports & Services</h2>
          <p className="text-sm text-muted-foreground">
            View running services and their ports
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadPorts}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Current service info */}
      {current && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Server className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                Current Backend Service
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Flask Backend running on <span className="font-mono">{current.host}:{current.port}</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600 dark:text-blue-400">
                  Active
                </Badge>
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  {current.url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Ports list */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3">Running Services</h3>
        
        {ports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No services detected</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ports.map((port) => (
              <div
                key={port.port}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {port.status === 'running' ? (
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                      <Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
                      <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                  )}
                  
                  <div>
                    <div className="font-semibold text-sm">{port.name}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{port.host}:{port.port}</span>
                      <span className="mx-2">•</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {port.type}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Badge
                  variant={port.status === 'running' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {port.status === 'running' ? 'Running' : 'Stopped'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Info card */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>8787</strong> - Main Flask Backend (API)</p>
            <p><strong>3000</strong> - Next.js Development Server (Frontend)</p>
            <p><strong>5000</strong> - Production Build Server</p>
            <p className="text-[10px] pt-2 border-t border-border/50 mt-2">
              Status refreshes automatically every 10 seconds
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
