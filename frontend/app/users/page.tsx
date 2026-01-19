import { MainLayout } from '@/components/layout/main-layout';
import { UsersTable } from '@/components/features/users/users-table';
import { AddUserDialog } from '@/components/features/users/add-user-dialog';

export default function UsersPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground mt-2">
              Manage user accounts and access
            </p>
          </div>
          
          <AddUserDialog />
        </div>
        
        <UsersTable />
      </div>
    </MainLayout>
  );
}
