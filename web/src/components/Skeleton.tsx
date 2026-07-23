"use client";

type Props = {
  lines?: number;
  className?: string;
};

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer ${className}`.trim()} aria-hidden />;
}

export function Skeleton({ lines = 3, className = "" }: Props) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer key={i} className="h-10 border border-line" />
      ))}
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Shimmer key={i} className="h-16 border border-line" />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <Shimmer className="h-4 w-32" />
        <MetricSkeleton />
      </div>
      <div className="card space-y-2">
        <Shimmer className="h-4 w-28" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-14 border border-line" />
        ))}
      </div>
    </div>
  );
}

/** Tasks / My work initial load — hero, stat tiles, item cards. */
export function TasksWorkSkeleton() {
  return (
    <div className="space-y-4">
      <div className="view-hero space-y-2.5">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-9 w-56 max-w-full border border-line" />
        <Shimmer className="h-4 w-72 max-w-full" />
      </div>
      <div className="today-work-stats space-y-3 p-3 sm:p-4">
        <Shimmer className="h-3 w-28" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="h-14 border border-line" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-[4.5rem] border border-line" />
        ))}
      </div>
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="space-y-4 pl-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Shimmer key={i} className="h-16 border border-line" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="firm-ledger-table-wrap">
      <div className="space-y-0 overflow-hidden border border-line">
        <Shimmer className="h-10" />
        {Array.from({ length: rows }).map((_, i) => (
          <Shimmer key={i} className="h-12 border-t border-line" />
        ))}
      </div>
    </div>
  );
}

/** Calendar month grid while tasks data loads. */
export function CalendarViewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="view-hero space-y-2">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-8 w-48 max-w-full border border-line" />
      </div>
      <div className="card space-y-3 p-3">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Shimmer key={`head-${i}`} className="h-6" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Shimmer key={`cell-${i}`} className="h-14 border border-line" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-16 border border-line" />
        ))}
      </div>
    </div>
  );
}

/** All-items search + list while loading. */
export function AllItemsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="view-hero space-y-2">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-8 w-40 max-w-full border border-line" />
      </div>
      <div className="card space-y-3">
        <Shimmer className="h-10 w-full border border-line" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer key={i} className="h-8 w-24 border border-line" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-[4.5rem] border border-line" />
        ))}
      </div>
    </div>
  );
}
