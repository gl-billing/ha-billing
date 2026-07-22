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
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, Helvetica, sans-serif",
          background: "#f6f6f4",
          color: "#0a0a0a"
        }}
      >
        <div style={{ maxWidth: "32rem", margin: "4rem auto", padding: "0 1.25rem" }}>
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#454545"
            }}
          >
            Hernandez &amp; Associates
          </p>
          <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.35rem", fontWeight: 800 }}>Desk could not load</h1>
          <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5, color: "#454545" }}>
            {error.message || "An unexpected error occurred. Try again or return to Office Hub."}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1.25rem" }}>
            <button
              type="button"
              onClick={() => retry(reset)}
              style={{
                padding: "0.55rem 1rem",
                border: "1px solid #0a0a0a",
                background: "#0a0a0a",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Try again
            </button>
            <a
              href="/office-hub"
              style={{
                padding: "0.55rem 1rem",
                border: "1px solid #0a0a0a",
                background: "transparent",
                color: "#0a0a0a",
                fontWeight: 700,
                textDecoration: "none"
              }}
            >
              Office Hub
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
