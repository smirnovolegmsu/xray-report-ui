import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MainLayout } from '@/components/layout/main-layout';

export default function Loading() {
  return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    </MainLayout>
  );
}
