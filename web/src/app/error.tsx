"use client";

type Props = {
  error: Error & { digest?: string };
  reset?: () => void;
};

function retry(reset?: () => void) {
  if (typeof reset === "function") {
    reset();
    return;
  }
  window.location.reload();
}

export default function Error({ error, reset }: Props) {
  return (
    <div className="page-loading min-h-[50vh]">
      <p className="page-loading__title">Something went wrong</p>
      <p className="mt-2 max-w-md text-sm text-muted">{error.message || "The page could not load."}</p>
      <button type="button" className="btn-primary mt-5 max-w-[200px] text-sm" onClick={() => retry(reset)}>
        Try again
      </button>
    </div>
  );
}
