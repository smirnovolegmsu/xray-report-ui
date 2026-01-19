'use client';

import { useEffect, useState, useMemo } from 'react';
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
  Trash2, 
  Power, 
  Link as LinkIcon,
  Edit,
  Eye,
  AlertCircle,
  Globe
} from 'lucide-react';
import { apiClient, handleApiError } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import type { User, UserFilter } from '@/types';
import { EditAliasDialog } from './edit-alias-dialog';
import { UserDetailsSheet } from './user-details-sheet';
import { UserLinkDialog } from './user-link-dialog';

interface UsersTableProps {
  searchQuery: string;
  filter: UserFilter;
  onFilterCountsChange?: (counts: Record<UserFilter, number>) => void;
}

export function UsersTable({ searchQuery, filter, onFilterCountsChange }: UsersTableProps) {
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

  // Helper functions (defined before useMemo)
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb < 1) {
      const mb = bytes / 1024 / 1024;
      return `${Math.round(mb)} MB`;
    }
    return `${gb.toFixed(1)} GB`;
  };

  // Calculate last activity (days since last use)
  const getLastActivityDays = (userStats: any): number => {
    if (!userStats) return 999;
    
    // If we have lastSeenAt timestamp, use it
    if (userStats.lastSeenAt) {
      const lastSeen = new Date(userStats.lastSeenAt);
      const now = new Date();
      const diffMs = now.getTime() - lastSeen.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return diffDays;
    }
    
    // Fallback: if user has traffic in last 7 days, consider active
    // Otherwise estimate based on daysUsed
    if (userStats.totalTrafficBytes > 0) {
      return 0; // Has recent traffic
    }
    
    return userStats.daysUsed > 0 ? 0 : 999;
  };

  // Calculate filter counts and filtered users
  const { filteredUsers, filterCounts } = useMemo(() => {
    if (!users || users.length === 0) {
      return {
        filteredUsers: [],
        filterCounts: {
          all: 0,
          active: 0,
          'low-activity': 0,
          online: 0,
        } as Record<UserFilter, number>
      };
    }
    
    // Helper function to check if user matches filter
    const matchesFilter = (user: User, filterType: UserFilter) => {
      const userStats = stats.get(user.email);
      const trafficMB = (userStats?.totalTrafficBytes || 0) / 1024 / 1024;
      const lastActivityDays = getLastActivityDays(userStats);

      switch (filterType) {
        case 'all':
          return true;
        case 'active':
          // Active: used in last 3 days OR has recent traffic (>= 10MB)
          return (lastActivityDays < 3 || (userStats?.daysUsed || 0) > 0) && trafficMB >= 10;
        case 'low-activity':
          // Low activity: inactive 3+ days OR low traffic (< 10MB)
          const isInactive = lastActivityDays >= 3 && (userStats?.daysUsed || 0) === 0;
          const isLowTraffic = trafficMB < 10;
          return isInactive || isLowTraffic;
        case 'online':
          return userStats?.isOnline === true;
        default:
          return true;
      }
    };

    // Calculate counts for all filters
    const counts: Record<UserFilter, number> = {
      all: users.length,
      active: 0,
      'low-activity': 0,
      online: 0,
    };

    users.forEach((user) => {
      if (matchesFilter(user, 'active')) counts.active++;
      if (matchesFilter(user, 'low-activity')) counts['low-activity']++;
      if (matchesFilter(user, 'online')) counts.online++;
    });

    // Apply search filter
    let filtered = users;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((user) => {
        const userStats = stats.get(user.email);
        return (
          user.email.toLowerCase().includes(query) ||
          userStats?.alias?.toLowerCase().includes(query)
        );
      });
    }

    // Apply tab filter
    filtered = filtered.filter((user) => matchesFilter(user, filter));

    return { filteredUsers: filtered, filterCounts: counts };
  }, [users, stats, searchQuery, filter]);

  // Update parent component with filter counts
  useEffect(() => {
    if (onFilterCountsChange) {
      onFilterCountsChange(filterCounts);
    }
  }, [filterCounts, onFilterCountsChange]);

  // Loading state
  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  // Empty state
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

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{lang === 'ru' ? 'Пользователь' : 'User'}</TableHead>
              <TableHead>{lang === 'ru' ? 'Статус' : 'Status'}</TableHead>
              <TableHead>{lang === 'ru' ? 'Трафик (7д)' : 'Traffic (7d)'}</TableHead>
              <TableHead>{lang === 'ru' ? 'Дней' : 'Days'}</TableHead>
              <TableHead>{lang === 'ru' ? 'ТОП-3 домена' : 'Top 3 Domains'}</TableHead>
              <TableHead className="text-right">
                {lang === 'ru' ? 'Действия' : 'Actions'}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {lang === 'ru' 
                        ? 'Пользователи не найдены' 
                        : 'No users found'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const userStats = stats.get(user.email);
                const trafficMB = (userStats?.totalTrafficBytes || 0) / 1024 / 1024;
                const isLowTraffic = trafficMB < 10;
                const lastActivityDays = getLastActivityDays(userStats);
                const isInactive = lastActivityDays >= 3 && (userStats?.daysUsed || 0) === 0;
                
                return (
                  <TableRow 
                    key={user.uuid}
                    className={`cursor-pointer hover:bg-muted/50 group ${
                      isInactive ? 'opacity-60' : ''
                    }`}
                    onClick={() => setDetailsUser(user)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {user.email}
                        </div>
                        {userStats?.alias && (
                          <div className="text-sm text-muted-foreground">
                            {userStats.alias}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {userStats?.isOnline && (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                            {lang === 'ru' ? 'Онлайн' : 'Online'}
                          </Badge>
                        )}
                        {isInactive && (
                          <Badge variant="outline" className="gap-1 text-orange-600 border-orange-600">
                            <AlertCircle className="w-3 h-3" />
                            {lang === 'ru' ? 'Неактивен 3д+' : 'Inactive 3d+'}
                          </Badge>
                        )}
                        {isLowTraffic && (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            {lang === 'ru' ? '< 10 МБ' : '< 10 MB'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {userStats ? (
                        <span className={`font-medium ${isLowTraffic ? 'text-muted-foreground' : ''}`}>
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {userStats?.top3Domains && userStats.top3Domains.length > 0 ? (
                        <div className="flex flex-col gap-0.5 text-xs">
                          {userStats.top3Domains.slice(0, 3).map((d: any, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
                              <Globe className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[120px]" title={d.domain}>
                                {d.domain}
                              </span>
                              <span className="text-[10px] opacity-70">
                                {formatBytes(d.trafficBytes)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGetLink(user.uuid, user.email);
                          }}
                          title={lang === 'ru' ? 'Получить VLESS ссылку' : 'Get VLESS link'}
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          <span className="hidden lg:inline text-xs">VLESS</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditAliasUser(user);
                          }}
                          title={lang === 'ru' ? 'Изменить имя' : 'Edit name'}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailsUser(user);
                          }}
                          title={lang === 'ru' ? 'Подробнее' : 'View details'}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleKick(user.uuid, user.email);
                          }}
                          title={lang === 'ru' ? 'Отключить сессии' : 'Kick user'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(user.uuid, user.email);
                          }}
                          title={lang === 'ru' ? 'Удалить пользователя' : 'Delete user'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
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
