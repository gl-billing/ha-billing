"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SameWindowLink } from "@/components/SameWindowLink";
import { FirmPublicContactDetails } from "@/components/FirmPublicContactDetails";

/**
 * Staff-facing copy stays generic. A one-shot beacon notifies admins in the background.
 */
export function SignInHelpClient() {
  const params = useSearchParams();
  const email = (params.get("e") || params.get("email") || "").trim();
  const from = (params.get("from") || "").trim() || "link";
  const sent = useRef(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const body = JSON.stringify({
      email: email || undefined,
      source: from,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined
    });
    void fetch("/api/help/signin-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    })
      .then((res) => setStatus(res.ok ? "ok" : "err"))
      .catch(() => setStatus("err"));
  }, [email, from]);

  return (
    <div className="login-page__body" style={{ textAlign: "left" }}>
      <header className="login-page__head" style={{ textAlign: "center" }}>
        <p className="login-page__eyebrow">Sign-in help</p>
        <p className="login-page__subtitle">
          {status === "err"
            ? "Please try the steps below."
            : "Please try these steps, then open the app again."}
        </p>
      </header>

      <ol style={{ margin: "0 0 1.25rem", paddingLeft: "1.2rem", lineHeight: 1.55, fontSize: "0.9rem", color: "var(--muted)" }}>
        <li>Use Safari on iPhone, or Chrome/Safari on desktop.</li>
        <li>Open the firm app link (not an old bookmark to another office system).</li>
        <li>Choose your authorized Google account — the email your office listed for you.</li>
        <li>Approve Google permissions when asked, then continue.</li>
      </ol>

      <SameWindowLink
        href="/login?chooseAccount=1"
        className="login-page__cta"
        style={{ display: "block", textAlign: "center" }}
      >
        Try signing in again
      </SameWindowLink>

      <p style={{ marginTop: "1rem", fontSize: "0.82rem", color: "var(--muted)", textAlign: "center" }}>
        {email ? `Signed request for ${email}` : "If this keeps happening, contact the office secretary."}
      </p>

      <div style={{ marginTop: "1.25rem" }}>
        <FirmPublicContactDetails />
      </div>
    </div>
  );
}
