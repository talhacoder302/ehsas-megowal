import { Skeleton } from "@/components/ui/skeleton";

export function MemberFormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Skeleton className="h-4 w-28" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-[32rem] rounded-xl" />
    </div>
  );
}
