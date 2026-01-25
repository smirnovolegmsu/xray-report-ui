'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';

interface EditAliasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    uuid: string;
    email: string;
    alias?: string;
  };
  onSuccess: () => void;
}

export function EditAliasDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EditAliasDialogProps) {
  const [alias, setAlias] = useState(user.alias || '');
  const [loading, setLoading] = useState(false);
  const { lang } = useAppStore();

  const handleSave = async () => {
    try {
      setLoading(true);
      await apiClient.updateUserAlias(user.uuid, alias);
      toast.success(
        lang === 'ru' ? 'Alias обновлён' : 'Alias updated'
      );
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {lang === 'ru' ? 'Изменить имя пользователя' : 'Edit User Alias'}
          </DialogTitle>
          <DialogDescription>
            {lang === 'ru'
              ? `Email: ${user.email}`
              : `Email: ${user.email}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="alias">
              {lang === 'ru' ? 'Имя (Alias)' : 'Alias'}
            </Label>
            <Input
              id="alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={
                lang === 'ru' ? 'Введите имя' : 'Enter alias'
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {lang === 'ru' ? 'Отмена' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading
              ? (lang === 'ru' ? 'Сохранение...' : 'Saving...')
              : (lang === 'ru' ? 'Сохранить' : 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
