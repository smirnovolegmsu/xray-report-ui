'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Power, Save } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import { XrayConfigViewer } from './xray-config-viewer';

export function XraySettings() {
  const [serverHost, setServerHost] = useState('');
  const [realityPbk, setRealityPbk] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { lang } = useAppStore();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSettings();
      const data = response.data as any;
      
      setServerHost(data.settings?.xray?.server_host || '');
      setRealityPbk(data.settings?.xray?.reality_pbk || '');
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.setSettings({
        xray: {
          server_host: serverHost,
          reality_pbk: realityPbk,
        },
      } as any);
      
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
    if (!confirm(
      lang === 'ru'
        ? 'Перезапустить Xray? Это может привести к кратковременной недоступности.'
        : 'Restart Xray? This may cause brief downtime.'
    )) {
      return;
    }

    try {
      await apiClient.restartXray();
      toast.success(
        lang === 'ru' ? 'Xray перезапущен' : 'Xray restarted'
      );
    } catch (error) {
      toast.error(handleApiError(error));
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
      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">
              {lang === 'ru' ? 'Настройки Xray' : 'Xray Configuration'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {lang === 'ru'
                ? 'Настройте параметры Xray сервера'
                : 'Configure Xray server parameters'}
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serverHost">
                {lang === 'ru' ? 'Server Host (IP/Домен)' : 'Server Host (IP/Domain)'}
              </Label>
              <Input
                id="serverHost"
                value={serverHost}
                onChange={(e) => setServerHost(e.target.value)}
                placeholder="example.com или 1.2.3.4"
              />
              <p className="text-xs text-muted-foreground">
                {lang === 'ru'
                  ? 'IP адрес или доменное имя вашего сервера'
                  : 'IP address or domain name of your server'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="realityPbk">
                {lang === 'ru' ? 'Reality Public Key' : 'Reality Public Key'}
              </Label>
              <Input
                id="realityPbk"
                value={realityPbk}
                onChange={(e) => setRealityPbk(e.target.value)}
                placeholder="Public key..."
              />
              <p className="text-xs text-muted-foreground">
                {lang === 'ru'
                  ? 'Публичный ключ Reality (опционально)'
                  : 'Reality public key (optional)'}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving
                ? (lang === 'ru' ? 'Сохранение...' : 'Saving...')
                : (lang === 'ru' ? 'Сохранить' : 'Save')}
            </Button>

            <Button variant="destructive" onClick={handleRestart}>
              <Power className="w-4 h-4 mr-2" />
              {lang === 'ru' ? 'Перезапустить Xray' : 'Restart Xray'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Xray Config Viewer */}
      <XrayConfigViewer />
    </div>
  );
}
