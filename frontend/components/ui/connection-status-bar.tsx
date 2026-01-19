'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, RefreshCw, Clock, Server } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';

interface ConnectionIssue {
  type: 'slow' | 'error' | 'overloaded' | 'timeout';
  message: string;
  details?: string;
  estimatedTime?: number; // секунды
}

interface ConnectionStatusBarProps {
  isVisible: boolean;
  onDismiss?: () => void;
}

export function ConnectionStatusBar({ isVisible, onDismiss }: ConnectionStatusBarProps) {
  const [issue, setIssue] = useState<ConnectionIssue | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { lang } = useAppStore();

  useEffect(() => {
    if (!isVisible) {
      setIssue(null);
      setDismissed(false);
      return;
    }

    const detectIssue = async () => {
      const startTime = Date.now();
      try {
        const response = await apiClient.ping();
        const responseTime = Date.now() - startTime;

        // Определяем проблему на основе времени ответа
        if (responseTime > 5000) {
          setIssue({
            type: 'slow',
            message: lang === 'ru' 
              ? 'Медленное подключение к серверу' 
              : 'Slow server connection',
            details: lang === 'ru'
              ? `Время ответа: ${(responseTime / 1000).toFixed(1)}с`
              : `Response time: ${(responseTime / 1000).toFixed(1)}s`,
            estimatedTime: Math.ceil(responseTime / 1000),
          });
        } else if (responseTime > 2000) {
          setIssue({
            type: 'slow',
            message: lang === 'ru'
              ? 'Подключение замедлено'
              : 'Connection slowed down',
            details: lang === 'ru'
              ? `Время ответа: ${(responseTime / 1000).toFixed(1)}с`
              : `Response time: ${(responseTime / 1000).toFixed(1)}s`,
          });
        } else {
          // Проверяем ресурсы сервера
          try {
            const resources = await apiClient.getSystemResources();
            const data = resources.data as any;
            if (data) {
              if (data.cpu > 80 || data.ram > 85) {
                setIssue({
                  type: 'overloaded',
                  message: lang === 'ru'
                    ? 'Сервер перегружен'
                    : 'Server overloaded',
                  details: lang === 'ru'
                    ? `CPU: ${data.cpu?.toFixed(0)}%, RAM: ${data.ram?.toFixed(0)}%`
                    : `CPU: ${data.cpu?.toFixed(0)}%, RAM: ${data.ram?.toFixed(0)}%`,
                });
              }
            }
          } catch {
            // Игнорируем ошибку проверки ресурсов
          }
        }
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        if (responseTime > 10000) {
          setIssue({
            type: 'timeout',
            message: lang === 'ru'
              ? 'Таймаут подключения'
              : 'Connection timeout',
            details: lang === 'ru'
              ? 'Сервер не отвечает в течение 10 секунд'
              : 'Server not responding for 10 seconds',
            estimatedTime: 15,
          });
        } else {
          setIssue({
            type: 'error',
            message: lang === 'ru'
              ? 'Ошибка подключения'
              : 'Connection error',
            details: error?.message || (lang === 'ru' ? 'Не удалось подключиться к серверу' : 'Failed to connect to server'),
          });
        }
      }
    };

    detectIssue();
    const interval = setInterval(detectIssue, 10000); // Проверка каждые 10 секунд
    return () => clearInterval(interval);
  }, [isVisible, lang]);

  const handleRetry = async () => {
    setLoading(true);
    try {
      await apiClient.ping();
      setIssue(null);
    } catch {
      // Ошибка уже обработана в detectIssue
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible || dismissed || !issue) {
    return null;
  }

  const getAlertVariant = () => {
    switch (issue.type) {
      case 'overloaded':
        return 'destructive';
      case 'timeout':
      case 'error':
        return 'destructive';
      case 'slow':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-4 left-4 right-4 z-50 max-w-2xl mx-auto"
      >
        <Card className={`shadow-lg border-2 p-4 ${
          issue.type === 'overloaded' || issue.type === 'timeout' || issue.type === 'error'
            ? 'border-destructive bg-destructive/10'
            : 'border-orange-500 bg-orange-500/10'
        }`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
              issue.type === 'overloaded' || issue.type === 'timeout' || issue.type === 'error'
                ? 'text-destructive'
                : 'text-orange-500'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm">
                  {issue.message}
                </h4>
                {issue.estimatedTime && (
                  <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{issue.estimatedTime}с
                  </span>
                )}
              </div>
              {issue.details && (
                <p className="text-sm text-muted-foreground">
                  {issue.details}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRetry}
                disabled={loading}
                className="h-8"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDismissed(true);
                    onDismiss();
                  }}
                  className="h-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
