export async function sharePlainText(options: {
  title: string;
  text: string;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (typeof navigator === "undefined") {
    return { ok: false, message: "Sharing is not available in this environment." };
  }

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: options.title, text: options.text });
      return { ok: true, message: "List shared." };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { ok: false, message: "Share cancelled." };
      }
    }
  }

  if (!navigator.clipboard?.writeText) {
    return { ok: false, message: "Could not copy — clipboard access is unavailable." };
  }

  await navigator.clipboard.writeText(options.text);
  return { ok: true, message: "List copied to clipboard." };
}
