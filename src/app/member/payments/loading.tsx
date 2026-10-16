import { ListPageSkeleton } from "@/components/manage/list-page-skeleton";

export default function Loading() {
  return <ListPageSkeleton summary={false} rows={4} />;
}
