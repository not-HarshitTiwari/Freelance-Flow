export default function ClientLedgerLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded mb-8" />
      <div className="flex gap-3 mb-6">
        <div className="h-9 w-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-9 w-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      </div>
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800" />)}
      </div>
    </div>
  );
}
