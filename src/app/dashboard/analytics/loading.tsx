export default function AnalyticsLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded mb-8" />
      <div className="flex gap-2 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />)}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />)}
      </div>
      <div className="h-72 rounded-xl bg-gray-100 dark:bg-gray-800 mb-6" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}
