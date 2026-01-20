'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
  children,
}: ConfirmDialogProps) {
  const { lang } = useAppStore();

  const defaultConfirmText = lang === 'ru' ? 'Подтвердить' : 'Confirm';
  const defaultCancelText = lang === 'ru' ? 'Отмена' : 'Cancel';

  const Icon = variant === 'destructive' 
    ? AlertTriangle 
    : variant === 'warning' 
      ? AlertCircle 
      : Info;

  const iconColor = variant === 'destructive'
    ? 'text-destructive'
    : variant === 'warning'
      ? 'text-yellow-500'
      : 'text-blue-500';

  const handleConfirm = async () => {
    await onConfirm();
    if (!loading) {
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${iconColor}`} />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {children && (
          <div className="py-4">
            {children}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={loading}>
            {cancelText || defaultCancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={
              variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }
          >
            {loading 
              ? (lang === 'ru' ? 'Загрузка...' : 'Loading...') 
              : (confirmText || defaultConfirmText)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
