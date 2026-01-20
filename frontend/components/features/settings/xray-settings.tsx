'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Power, Save, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { CardLoadingSpinner } from '@/components/ui/loading-spinner';
import type { Settings } from '@/types';
import { handleApiError } from '@/lib/utils';
import { XrayConfigViewer } from './xray-config-viewer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Validation helpers
const isValidHostname = (value: string): boolean => {
  if (!value) return true; // Empty is allowed
  // IP address pattern
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // Domain pattern
  const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (ipPattern.test(value)) {
    // Validate IP octets
    const octets = value.split('.').map(Number);
    return octets.every(o => o >= 0 && o <= 255);
  }
  
  return domainPattern.test(value);
};

const isValidPublicKey = (value: string): boolean => {
  if (!value) return true; // Empty is allowed
  // Base64url pattern (43-44 chars for x25519 public key)
  return /^[A-Za-z0-9_-]{43,44}$/.test(value);
};

export function XraySettings() {
  const [serverHost, setServerHost] = useState('');
  const [realityPbk, setRealityPbk] = useState('');
  const [initialServerHost, setInitialServerHost] = useState('');
  const [initialRealityPbk, setInitialRealityPbk] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartStatus, setRestartStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const { lang } = useAppStore();

  useEffect(() => {
    loadSettings();
  }, []);

  // Clear restart status after 5 seconds
  useEffect(() => {
    if (restartStatus !== 'idle') {
      const timer = setTimeout(() => setRestartStatus('idle'), 5000);
      return () => clearTimeout(timer);
    }
  }, [restartStatus]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSettings();
      const data = response.data as Settings;
      
      const host = data.xray?.server_host || '';
      const pbk = data.xray?.reality_pbk || '';
      
      setServerHost(host);
      setRealityPbk(pbk);
      setInitialServerHost(host);
      setInitialRealityPbk(pbk);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  // Check if values have changed
  const isDirty = useMemo(() => {
    return serverHost !== initialServerHost || realityPbk !== initialRealityPbk;
  }, [serverHost, realityPbk, initialServerHost, initialRealityPbk]);

  // Validation
  const hostError = useMemo(() => {
    if (!serverHost) return null;
    if (!isValidHostname(serverHost)) {
      return lang === 'ru' 
        ? 'Некорректный IP адрес или домен' 
        : 'Invalid IP address or domain';
    }
    return null;
  }, [serverHost, lang]);

  const pbkError = useMemo(() => {
    if (!realityPbk) return null;
    if (!isValidPublicKey(realityPbk)) {
      return lang === 'ru'
        ? 'Некорректный формат публичного ключа (должен быть base64url, 43-44 символа)'
        : 'Invalid public key format (should be base64url, 43-44 characters)';
    }
    return null;
  }, [realityPbk, lang]);

  const hasErrors = Boolean(hostError || pbkError);

  const handleSave = async () => {
    if (hasErrors) {
      toast.error(lang === 'ru' ? 'Исправьте ошибки перед сохранением' : 'Fix errors before saving');
      return;
    }

    try {
      setSaving(true);
      await apiClient.setSettings({
        xray: {
          server_host: serverHost,
          reality_pbk: realityPbk,
        },
      } as any);
      
      // Update initial values
      setInitialServerHost(serverHost);
      setInitialRealityPbk(realityPbk);
      
      toast.success(
        lang === 'ru' ? 'Настройки сохранены' : 'Settings saved'
      );
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    setShowRestartConfirm(false);
    setRestarting(true);
    setRestartStatus('idle');

    try {
      await apiClient.restartXray();
      setRestartStatus('success');
      toast.success(
        lang === 'ru' ? 'Xray успешно перезапущен' : 'Xray restarted successfully'
      );
    } catch (error) {
      setRestartStatus('error');
      toast.error(handleApiError(error));
    } finally {
      setRestarting(false);
    }
  };

  const handleDiscard = () => {
    setServerHost(initialServerHost);
    setRealityPbk(initialRealityPbk);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <CardLoadingSpinner />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {lang === 'ru' ? 'Настройки Xray' : 'Xray Configuration'}
                {isDirty && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    <Circle className="w-2 h-2 mr-1 fill-current" />
                    {lang === 'ru' ? 'Не сохранено' : 'Unsaved'}
                  </Badge>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">
                {lang === 'ru'
                  ? 'Настройте параметры Xray сервера для генерации ссылок подключения'
                  : 'Configure Xray server parameters for connection link generation'}
              </p>
            </div>
            
            {/* Restart status indicator */}
            {restartStatus !== 'idle' && (
              <Badge 
                variant={restartStatus === 'success' ? 'default' : 'destructive'}
                className="shrink-0"
              >
                {restartStatus === 'success' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {lang === 'ru' ? 'Перезапущен' : 'Restarted'}
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {lang === 'ru' ? 'Ошибка' : 'Error'}
                  </>
                )}
              </Badge>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serverHost" className="flex items-center gap-2">
                {lang === 'ru' ? 'Server Host (IP/Домен)' : 'Server Host (IP/Domain)'}
                {hostError && <AlertCircle className="w-3 h-3 text-destructive" />}
              </Label>
              <Input
                id="serverHost"
                value={serverHost}
                onChange={(e) => setServerHost(e.target.value)}
                placeholder="example.com или 1.2.3.4"
                className={hostError ? 'border-destructive' : ''}
              />
              {hostError ? (
                <p className="text-xs text-destructive">{hostError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {lang === 'ru'
                    ? 'IP адрес или доменное имя вашего сервера (используется для генерации ссылок)'
                    : 'IP address or domain name of your server (used for link generation)'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="realityPbk" className="flex items-center gap-2">
                {lang === 'ru' ? 'Reality Public Key' : 'Reality Public Key'}
                {pbkError && <AlertCircle className="w-3 h-3 text-destructive" />}
              </Label>
              <Input
                id="realityPbk"
                value={realityPbk}
                onChange={(e) => setRealityPbk(e.target.value)}
                placeholder="Public key..."
                className={pbkError ? 'border-destructive' : ''}
              />
              {pbkError ? (
                <p className="text-xs text-destructive">{pbkError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {lang === 'ru'
                    ? 'Публичный ключ Reality (если не указан, будет получен автоматически из приватного ключа)'
                    : 'Reality public key (if not specified, will be derived from private key)'}
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-3 flex-wrap">
            <Button 
              onClick={handleSave} 
              disabled={saving || hasErrors || !isDirty}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving
                ? (lang === 'ru' ? 'Сохранение...' : 'Saving...')
                : (lang === 'ru' ? 'Сохранить' : 'Save')}
            </Button>

            {isDirty && (
              <Button variant="outline" onClick={handleDiscard}>
                {lang === 'ru' ? 'Отменить изменения' : 'Discard changes'}
              </Button>
            )}

            <div className="flex-1" />

            <Button 
              variant="destructive" 
              onClick={() => setShowRestartConfirm(true)}
              disabled={restarting}
            >
              <Power className="w-4 h-4 mr-2" />
              {restarting
                ? (lang === 'ru' ? 'Перезапуск...' : 'Restarting...')
                : (lang === 'ru' ? 'Перезапустить Xray' : 'Restart Xray')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Xray Config Viewer */}
      <XrayConfigViewer />

      {/* Restart Confirmation Dialog */}
      <ConfirmDialog
        open={showRestartConfirm}
        onOpenChange={setShowRestartConfirm}
        title={lang === 'ru' ? 'Перезапустить Xray?' : 'Restart Xray?'}
        description={
          lang === 'ru'
            ? 'Это может привести к кратковременной недоступности VPN соединений. Все текущие подключения будут разорваны.'
            : 'This may cause brief VPN downtime. All current connections will be dropped.'
        }
        variant="warning"
        confirmText={lang === 'ru' ? 'Перезапустить' : 'Restart'}
        onConfirm={handleRestart}
      />
    </div>
  );
}
