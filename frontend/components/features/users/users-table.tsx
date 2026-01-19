'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  Trash2, 
  Power, 
  Link as LinkIcon,
  Copy,
  CheckCircle2,
  XCircle,
  Edit,
  Eye
} from 'lucide-react';
import { apiClient, handleApiError } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import type { User } from '@/types';
import { EditAliasDialog } from './edit-alias-dialog';
import { UserDetailsSheet } from './user-details-sheet';
import { UserLinkDialog } from './user-link-dialog';

export function UsersTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editAliasUser, setEditAliasUser] = useState<User | null>(null);
  const [detailsUser, setDetailsUser] = useState<User | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [userLink, setUserLink] = useState<{ email: string; link: string } | null>(null);
  const { lang } = useAppStore();

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUsers();
      setUsers(response.data.users || []);
      
      // Load stats for all users
      try {
        const statsResponse = await apiClient.getUserStats();
        const statsMap = new Map();
        if (statsResponse.data.users) {
          statsResponse.data.users.forEach((stat: any) => {
            statsMap.set(stat.email, stat);
          });
        }
        setStats(statsMap);
      } catch (statsError) {
        console.warn('Failed to load user stats:', statsError);
      }
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = async (uuid: string, email: string) => {
    if (!confirm(lang === 'ru' 
      ? `Удалить пользователя ${email}?` 
      : `Delete user ${email}?`
    )) {
      return;
    }

    try {
      await apiClient.deleteUser(uuid);
      toast.success(lang === 'ru' ? 'Пользователь удалён' : 'User deleted');
      loadUsers();
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };

  const handleKick = async (uuid: string, email: string) => {
    if (!confirm(lang === 'ru' 
      ? `Отключить ${email} от всех активных сессий?` 
      : `Kick ${email} from all active sessions?`
    )) {
      return;
    }

    try {
      await apiClient.kickUser(uuid);
      toast.success(lang === 'ru' ? 'Пользователь отключён' : 'User kicked');
    } catch (error) {
      toast.error(handleApiError(error));
    }
  };

  const handleGetLink = async (uuid: string, email: string) => {
    try {
      const response = await apiClient.getUserLink(uuid);
      const link = response.data.link;
      
      // Show dialog with QR code
      setUserLink({ email, link });
      setLinkDialogOpen(true);
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

  if (users.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Trash2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {lang === 'ru' ? 'Нет пользователей' : 'No users yet'}
          </h3>
          <p className="text-muted-foreground">
            {lang === 'ru' 
              ? 'Добавьте первого пользователя, чтобы начать' 
              : 'Add your first user to get started'}
          </p>
        </div>
      </Card>
    );
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb < 1) {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(1)} MB`;
    }
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === 'ru' ? 'Email / Имя' : 'Email / Name'}</TableHead>
              <TableHead>{lang === 'ru' ? 'Статус' : 'Status'}</TableHead>
              <TableHead>{lang === 'ru' ? 'Трафик (7д)' : 'Traffic (7d)'}</TableHead>
              <TableHead>{lang === 'ru' ? 'Дней использования' : 'Days Used'}</TableHead>
              <TableHead className="text-right">
                {lang === 'ru' ? 'Действия' : 'Actions'}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const userStats = stats.get(user.email);
              return (
                <TableRow 
                  key={user.uuid}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setDetailsUser(user)}
                >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="space-y-1">
                  <div className="font-medium">{user.email}</div>
                  {userStats?.alias && (
                    <div className="text-sm text-muted-foreground">
                      {userStats.alias}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={user.enabled ? 'default' : 'secondary'}
                    className="gap-1"
                  >
                    {user.enabled ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        {lang === 'ru' ? 'Активен' : 'Active'}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        {lang === 'ru' ? 'Отключён' : 'Disabled'}
                      </>
                    )}
                  </Badge>
                  {userStats?.isOnline && (
                    <Badge variant="outline" className="gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      {lang === 'ru' ? 'Онлайн' : 'Online'}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {userStats ? (
                  <span className="font-medium">
                    {formatBytes(userStats.totalTrafficBytes || 0)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {userStats ? (
                  <span className="font-medium">{userStats.daysUsed || 0}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setDetailsUser(user)}
                      className="gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      {lang === 'ru' ? 'Подробнее' : 'View Details'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setEditAliasUser(user)}
                      className="gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      {lang === 'ru' ? 'Изменить имя' : 'Edit Alias'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleGetLink(user.uuid, user.email)}
                      className="gap-2"
                    >
                      <LinkIcon className="w-4 h-4" />
                      {lang === 'ru' ? 'Получить VLESS' : 'Get VLESS Link'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleKick(user.uuid, user.email)}
                      className="gap-2"
                    >
                      <Power className="w-4 h-4" />
                      {lang === 'ru' ? 'Отключить (Kick)' : 'Kick User'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(user.uuid, user.email)}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      {lang === 'ru' ? 'Удалить' : 'Delete'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>

    {editAliasUser && (
      <EditAliasDialog
        open={!!editAliasUser}
        onOpenChange={(open) => !open && setEditAliasUser(null)}
        user={editAliasUser}
        onSuccess={loadUsers}
      />
    )}

    {detailsUser && (
      <UserDetailsSheet
        open={!!detailsUser}
        onOpenChange={(open) => !open && setDetailsUser(null)}
        user={detailsUser}
      />
    )}

    {userLink && (
      <UserLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        link={userLink.link}
        email={userLink.email}
      />
    )}
  </>
  );
}
