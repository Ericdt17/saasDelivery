import { Skeleton } from "@/components/ui/skeleton";

interface StatCardSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton component for stat cards
 */
export function StatCardSkeleton({ count = 1, className }: StatCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`stat-card ${className || ''}`}>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </>
  );
}






