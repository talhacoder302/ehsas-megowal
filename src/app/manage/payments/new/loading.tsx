import { Skeleton } from "@/components/ui/skeleton";

export default function ReceivePaymentLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
