"use client";

import { useCallback, useRef, useState } from "react";
import type { FirmStatusVariant } from "@/lib/firm-status-report";

export function useFirmStatusReport() {
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState<FirmStatusVariant>("ok");
  const variantRef = useRef<FirmStatusVariant>("ok");

  const setReport = useCallback((nextMessage: string, nextVariant: FirmStatusVariant) => {
    variantRef.current = nextVariant;
    setMessage(nextMessage);
    setVariant(nextVariant);
  }, []);

  const reportProcessing = useCallback(
    (nextMessage: string) => setReport(nextMessage, "processing"),
    [setReport]
  );

  const reportSuccess = useCallback((nextMessage: string) => setReport(nextMessage, "ok"), [setReport]);

  const reportError = useCallback((nextMessage: string) => setReport(nextMessage, "error"), [setReport]);

  const reportWarn = useCallback((nextMessage: string) => setReport(nextMessage, "warn"), [setReport]);

  const clear = useCallback(() => {
    variantRef.current = "ok";
    setMessage("");
    setVariant("ok");
  }, []);

  const clearUnlessProcessing = useCallback(() => {
    if (variantRef.current === "processing") return;
    clear();
  }, [clear]);

  /** Shared handler for child forms and panels. */
  const onStatus = useCallback(
    (nextMessage: string, isError?: boolean, isProcessing?: boolean) => {
      if (isProcessing) reportProcessing(nextMessage);
      else if (isError) reportError(nextMessage);
      else reportSuccess(nextMessage);
    },
    [reportError, reportProcessing, reportSuccess]
  );

  return {
    message,
    variant,
    variantRef,
    reportProcessing,
    reportSuccess,
    reportError,
    reportWarn,
    clear,
    clearUnlessProcessing,
    onStatus
  };
}
