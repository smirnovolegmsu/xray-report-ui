'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { apiClient, handleApiError } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { lang } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error(lang === 'ru' ? 'Введите email' : 'Enter email');
      return;
    }

    try {
      setLoading(true);
      await apiClient.addUser(email.trim());
      
      toast.success(
        lang === 'ru' 
          ? `Пользователь ${email} добавлен` 
          : `User ${email} added`
      );
      
      setEmail('');
      setOpen(false);
      
      // Trigger page refresh to reload users list
      window.location.reload();
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          {lang === 'ru' ? 'Добавить пользователя' : 'Add User'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {lang === 'ru' ? 'Добавить нового пользователя' : 'Add New User'}
          </DialogTitle>
          <DialogDescription>
            {lang === 'ru' 
              ? 'Введите email для нового пользователя. UUID будет сгенерирован автоматически.' 
              : 'Enter an email for the new user. UUID will be generated automatically.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Email
            </label>
            <Input
              type="text"
              placeholder={lang === 'ru' ? 'user@example.com' : 'user@example.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {lang === 'ru' 
                ? 'Используется как идентификатор пользователя' 
                : 'Used as user identifier'}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {lang === 'ru' ? 'Отмена' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {lang === 'ru' ? 'Создание...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {lang === 'ru' ? 'Создать' : 'Create'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
