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

export default function GlobalError({ error, reset }: Props) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="page-loading min-h-screen">
          <p className="page-loading__title">HA Office could not load</p>
          <p className="mt-2 max-w-md text-sm text-muted">{error.message || "An unexpected error occurred."}</p>
          <button
            type="button"
            className="btn-primary mt-5 max-w-[200px] text-sm"
            onClick={() => retry(reset)}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
