import { useEffect, useMemo, useRef, useState } from "react";
import { getApiKeysStatus, getSessionStatus } from "./api";
import {
  extractDispatchTier,
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
  pollIntervalMs = 5000,
}) {
  const [statusSnapshot, setStatusSnapshot] = useState(null);
  const [dispatchTier, setDispatchTier] = useState();
  const [loading, setLoading] = useState(true);
  const [pollError, setPollError] = useState("");
  const [isPolling, setIsPolling] = useState(false);

  const retryAttemptRef = useRef(0);
  const timerRef = useRef(
    /** @type {ReturnType<typeof setTimeout> | null} */ (null),
  );

  const shouldPoll = useMemo(() => {
    if (!enabled) return false;
    if (!sessionId) return true;
    if (!sessionStatus) return true;
    if (isTerminalSessionStatus(sessionStatus)) return false;
    return isProcessingSessionStatus(sessionStatus);
  }, [enabled, sessionId, sessionStatus]);

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

      if (!shouldPoll) {
        setIsPolling(false);
        setLoading(false);
        return;
      }

      setIsPolling(true);

      const controller = new AbortController();

      try {
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
          const latestTier = extractDispatchTier(latestSessionStatus);
          if (latestTier) setDispatchTier(latestTier);

          if (isTerminalSessionStatus(latestStatusText)) {
            setIsPolling(false);
            setLoading(false);
            return;
          }
        }

        const payload = await getApiKeysStatus(controller.signal);
        const normalized = normalizeApiKeysStatus(payload);
        setStatusSnapshot(normalized);
        setDispatchTier((prev) => prev || normalized.activeDispatchTier);
        setPollError("");
        setLoading(false);
        retryAttemptRef.current = 0;
        scheduleNext(pollIntervalMs);
      } catch (error) {
        if (cancelled || error?.name === "AbortError") return;

        const delay =
          RETRY_DELAYS_MS[
            Math.min(retryAttemptRef.current, RETRY_DELAYS_MS.length - 1)
          ] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        retryAttemptRef.current += 1;

        setPollError(error?.message || "Failed to fetch engine status");
        setLoading(false);
        scheduleNext(delay);
      }
    };

    tick();

    return () => {
      cancelled = true;
      cleanupTimer();
    };
  }, [enabled, pollIntervalMs, sessionId, shouldPoll]);

  return {
    statusSnapshot,
    dispatchTier,
    loading,
    pollError,
    isPolling,
  };
}
