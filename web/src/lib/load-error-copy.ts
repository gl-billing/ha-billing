export type LoadErrorContext = "tasks" | "billing" | "dashboard" | "generic";

export type LoadErrorKind = "auth" | "quota" | "server" | "timeout" | "network" | "unknown";

export type LoadErrorEmptyState = {
  kind: LoadErrorKind;
  title: string;
  message: string;
  showSignIn: boolean;
  showRetry: boolean;
  retryLabel: string;
};

export function classifyLoadError(message: string, status?: number): LoadErrorKind {
  const text = message.trim().toLowerCase();

  if (status === 401 || text.includes("unauthorized") || text.includes("sign in again") || text.includes("session expired")) {
    return "auth";
  }
  if (status === 429 || text.includes("quota") || text.includes("read limit") || text.includes("60 second")) {
    return "quota";
  }
  if (text.includes("timed out") || text.includes("timeout")) {
    return "timeout";
  }
  if (
    text.includes("failed to fetch") ||
    text.includes("network") ||
    text.includes("offline") ||
    text.includes("connection")
  ) {
    return "network";
  }
  if (
    status === 500 ||
    text.includes("server error") ||
    text.includes("error page") ||
    text.includes("dev server") ||
    text.includes("unexpected server")
  ) {
    return "server";
  }
  return "unknown";
}

const CONTEXT_TITLES: Record<LoadErrorContext, string> = {
  tasks: "Could not load office data",
  billing: "Could not load billing data",
  dashboard: "Could not load firm dashboard",
  generic: "Could not load data"
};

export function resolveLoadErrorEmptyState(
  message: string,
  context: LoadErrorContext,
  options?: { status?: number }
): LoadErrorEmptyState {
  const kind = classifyLoadError(message, options?.status);
  const title = CONTEXT_TITLES[context];

  switch (kind) {
    case "auth":
      return {
        kind,
        title: title || "Sign in required",
        message: message || "Your Google session expired. Sign out and sign in again to reload firm data.",
        showSignIn: true,
        showRetry: true,
        retryLabel: "Try again"
      };
    case "quota":
      return {
        kind,
        title: title || "Google Sheets is busy",
        message:
          message ||
          "Too many spreadsheet reads at once. Wait about 60 seconds, then tap Try again once — avoid opening many tabs at the same time.",
        showSignIn: false,
        showRetry: true,
        retryLabel: "Try again in a minute"
      };
    case "timeout":
      return {
        kind,
        title: title || "Request timed out",
        message:
          message ||
          "The server took too long to respond. Check your connection and try again. Large spreadsheets can take 10–15 seconds on first load.",
        showSignIn: false,
        showRetry: true,
        retryLabel: "Try again"
      };
    case "network":
      return {
        kind,
        title: title || "You appear to be offline",
        message:
          message ||
          "We could not reach the server. Your changes may be queued locally when you post charges or payments. Reconnect and tap Try again.",
        showSignIn: false,
        showRetry: true,
        retryLabel: "Try again"
      };
    case "server":
      return {
        kind,
        title: title || "Server error",
        message:
          message ||
          "The app hit a server error. Refresh the page. If you are on local dev, restart the dev server and clear the .next cache.",
        showSignIn: false,
        showRetry: true,
        retryLabel: "Try again"
      };
    default:
      return {
        kind,
        title: title || CONTEXT_TITLES[context],
        message:
          message ||
          (context === "tasks"
            ? "Something went wrong reading tasks from Google Sheets."
            : "Something went wrong loading data from Google Sheets."),
        showSignIn: true,
        showRetry: true,
        retryLabel: "Try again"
      };
  }
}
