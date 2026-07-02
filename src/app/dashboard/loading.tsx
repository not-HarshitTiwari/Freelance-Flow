export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-4 w-56 bg-gray-100 dark:bg-gray-800/60 rounded-lg" />
        </div>
        <div className="h-8 w-28 bg-gray-200 dark:bg-gray-800 rounded-lg" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border dark:border-gray-800 p-4 space-y-2 bg-white dark:bg-gray-900">
            <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <div className="h-9 flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-9 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-9 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-9 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      </div>

      {/* List rows skeleton */}
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border dark:border-gray-800 p-4 flex items-center justify-between bg-white dark:bg-gray-900">
            <div className="space-y-1.5">
              <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-28 bg-gray-100 dark:bg-gray-800 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-16 bg-gray-100 dark:bg-gray-800 rounded-full" />
              <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
