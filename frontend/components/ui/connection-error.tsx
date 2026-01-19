'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  AlertTriangle, 
  RefreshCw, 
  Server, 
  Wifi,
  WifiOff,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ConnectionErrorProps {
  onRetry?: () => void;
  error?: string;
}

export function ConnectionError({ onRetry, error }: ConnectionErrorProps) {
  const [isRestarting, setIsRestarting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [restartStatus, setRestartStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      await apiClient.ping();
      // Connection restored
      if (onRetry) {
        onRetry();
      } else {
        window.location.reload();
      }
    } catch {
      setStatusMessage('Сервер по-прежнему недоступен');
    } finally {
      setIsChecking(false);
    }
  };

  const handleRestartBackend = async () => {
    setIsRestarting(true);
    setRestartStatus('idle');
    setStatusMessage('Перезапуск сервисов...');
    
    try {
      // Try to restart via API
      await apiClient.restartSystem();
      setRestartStatus('success');
      setStatusMessage('Команда перезапуска отправлена. Подождите 10 секунд...');
      
      // Wait and check
      setTimeout(() => {
        checkConnection();
      }, 10000);
    } catch {
      // If API fails, we can't restart remotely
      setRestartStatus('error');
      setStatusMessage('Не удалось перезапустить. Попробуйте обновить страницу.');
    } finally {
      setIsRestarting(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <div className="text-center space-y-6">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <WifiOff className="w-10 h-10 text-destructive" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Нет соединения с сервером</h1>
            <p className="text-muted-foreground">
              Бэкенд сервис временно недоступен. Попробуйте перезапустить или обновить страницу.
            </p>
          </div>

          {/* Error details */}
          {error && (
            <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground font-mono">
              {error}
            </div>
          )}

          {/* Status message */}
          {statusMessage && (
            <div className={`p-3 rounded-lg text-sm flex items-center justify-center gap-2 ${
              restartStatus === 'success' 
                ? 'bg-green-500/10 text-green-600' 
                : restartStatus === 'error'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground'
            }`}>
              {restartStatus === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {restartStatus === 'error' && <AlertTriangle className="w-4 h-4" />}
              {statusMessage}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button 
              onClick={handleRefresh}
              variant="default"
              className="w-full gap-2"
              disabled={isChecking}
            >
              {isChecking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Обновить страницу
            </Button>

            <Button 
              onClick={handleRestartBackend}
              variant="outline"
              className="w-full gap-2"
              disabled={isRestarting}
            >
              {isRestarting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Server className="w-4 h-4" />
              )}
              Перезапустить сервисы
            </Button>

            <Button 
              onClick={checkConnection}
              variant="ghost"
              className="w-full gap-2"
              disabled={isChecking}
            >
              <Wifi className="w-4 h-4" />
              Проверить соединение
            </Button>
          </div>

          {/* Help text */}
          <p className="text-xs text-muted-foreground">
            Если проблема сохраняется, проверьте SSH доступ к серверу и перезапустите сервисы вручную:
            <code className="block mt-2 p-2 bg-muted rounded text-left">
              sudo systemctl restart xray-report-ui xray-nextjs-ui
            </code>
          </p>
        </div>
      </Card>
    </div>
  );
}
