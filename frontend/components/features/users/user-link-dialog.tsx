'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAppStore } from '@/lib/store';

interface UserLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: string;
  email: string;
}

export function UserLinkDialog({ open, onOpenChange, link, email }: UserLinkDialogProps) {
  const [copied, setCopied] = useState(false);
  const { lang } = useAppStore();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {lang === 'ru' ? 'VLESS ссылка' : 'VLESS Link'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {email}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR Code */}
          <div className="flex justify-center p-4 bg-white rounded-lg">
            <QRCodeSVG 
              value={link} 
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {lang === 'ru' ? 'Ссылка:' : 'Link:'}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all max-h-20 overflow-y-auto">
                {link}
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground">
            {lang === 'ru' ? (
              <>
                <p className="font-medium mb-1">Инструкция:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Отсканируйте QR код в приложении V2Ray</li>
                  <li>Или скопируйте ссылку вручную</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-medium mb-1">Instructions:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Scan QR code in V2Ray app</li>
                  <li>Or copy link manually</li>
                </ul>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
