import { Skeleton } from "@/components/ui/skeleton";

export default function ReceiptLoading() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-[28rem] rounded-2xl" />
      <div className="grid gap-2 sm:grid-cols-2">
        <Skeleton className="h-11 rounded-lg sm:col-span-2" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
    </div>
  );
}
