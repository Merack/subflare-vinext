import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className={`h-32 rounded-xl ${index === 0 ? "col-span-2 lg:col-span-1" : ""}`} />
        ))}
      </div>
    </div>
  );
}
