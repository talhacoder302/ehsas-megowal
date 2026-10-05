import { ListPageSkeleton } from "@/components/manage/list-page-skeleton";

export default function PaymentsLoading() {
  return <ListPageSkeleton summary={false} rows={7} />;
}
