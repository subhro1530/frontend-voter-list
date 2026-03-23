import { useEffect, useMemo, useRef, useState } from "react";
import {
  getApiKeysDispatchStatus,
  getApiKeysStatus,
  getSessionStatus,
} from "./api";
import {
  extractDispatchTier,
  extractPaidFallbackActive,
  isProcessingSessionStatus,
  isTerminalSessionStatus,
  normalizeApiKeysStatus,
} from "./engineStatusMapper";

const RETRY_DELAYS_MS = [2000, 4000, 8000];
const MAX_DELAY_MS = 30000;

export function useEngineStatusPolling({
  sessionId,
  sessionStatus,
  enabled = true,
  isAdmin = false,
  pollIntervalMs = 5000,
}) {
  const [statusSnapshot, setStatusSnapshot] = useState(null);
  const [dispatchTier, setDispatchTier] = useState();
  const [paidFallbackActive, setPaidFallbackActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pollError, setPollError] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState !== "hidden";
  });

  const retryAttemptRef = useRef(0);
  const timerRef = useRef(
    /** @type {ReturnType<typeof setTimeout> | null} */ (null),
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const onVisibilityChange = () => {
      setIsTabVisible(document.visibilityState !== "hidden");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const shouldPoll = useMemo(() => {
    if (!enabled) return false;
    if (!isTabVisible) return false;
    if (!sessionId) return true;
    if (!sessionStatus) return true;
    if (isTerminalSessionStatus(sessionStatus)) return false;
    return isProcessingSessionStatus(sessionStatus);
  }, [enabled, isTabVisible, sessionId, sessionStatus]);

  useEffect(() => {
    let cancelled = false;

    const cleanupTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleNext = (delayMs) => {
      cleanupTimer();
      timerRef.current = setTimeout(tick, Math.min(delayMs, MAX_DELAY_MS));
    };

    const tick = async () => {
      if (cancelled || !enabled) return;

      setIsPolling(Boolean(shouldPoll));

      const controller = new AbortController();

      try {
        let tierFromSession;

        if (sessionId) {
          const latestSessionStatus = await getSessionStatus(
            sessionId,
            controller.signal,
          );
          const latestStatusText =
            latestSessionStatus?.status ||
            latestSessionStatus?.state ||
            latestSessionStatus?.processingStatus ||
            "";
          tierFromSession = extractDispatchTier(latestSessionStatus);

          if (isTerminalSessionStatus(latestStatusText)) {
            setIsPolling(false);
            setLoading(false);
            return;
          }
        }

        const dispatchPayload = await getApiKeysDispatchStatus(
          controller.signal,
        );

        let normalized;
        if (isAdmin) {
          try {
            const statusPayload = await getApiKeysStatus(controller.signal);
            normalized = normalizeApiKeysStatus(statusPayload);
          } catch (statusError) {
            const dispatchTierFromDispatch =
              tierFromSession || extractDispatchTier(dispatchPayload);
            if (dispatchTierFromDispatch) {
              setDispatchTier(dispatchTierFromDispatch);
            }
            setPaidFallbackActive(
              extractPaidFallbackActive(dispatchPayload) ||
                dispatchTierFromDispatch === "paid",
            );
            throw statusError;
          }
        } else {
          normalized = normalizeApiKeysStatus(dispatchPayload);
        }

        let nextDispatchTier =
          tierFromSession || extractDispatchTier(dispatchPayload);

        if (!nextDispatchTier && extractPaidFallbackActive(dispatchPayload)) {
          nextDispatchTier = "paid";
        }

        if (!nextDispatchTier) {
          nextDispatchTier = normalized.activeDispatchTier;
        }

        setPaidFallbackActive(
          extractPaidFallbackActive(dispatchPayload) ||
            nextDispatchTier === "paid",
        );

        setStatusSnapshot(normalized);
        setDispatchTier(nextDispatchTier);
        setPollError("");
        setLoading(false);
        retryAttemptRef.current = 0;

        if (shouldPoll) {
          scheduleNext(pollIntervalMs);
        }
      } catch (error) {
        if (cancelled || error?.name === "AbortError") return;

        const delay =
          RETRY_DELAYS_MS[
            Math.min(retryAttemptRef.current, RETRY_DELAYS_MS.length - 1)
          ] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        retryAttemptRef.current += 1;

        setPollError(error?.message || "Failed to fetch engine status");
        setLoading(false);
        if (shouldPoll) {
          scheduleNext(delay);
        }
      }
    };

    tick();

    return () => {
      cancelled = true;
      cleanupTimer();
    };
  }, [enabled, isTabVisible, pollIntervalMs, sessionId, shouldPoll]);

  return {
    statusSnapshot,
    dispatchTier,
    paidFallbackActive,
    loading,
    pollError,
    isPolling,
  };
}
