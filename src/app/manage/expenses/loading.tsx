import { ListPageSkeleton } from "@/components/manage/list-page-skeleton";

export default function ExpensesLoading() {
  return <ListPageSkeleton summary={false} rows={5} />;
}
