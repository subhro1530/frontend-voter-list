import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { userAPI } from "./api";

export const MAX_PARALLEL_BOOTHS = 3;
export const POLL_INTERVAL_MS = 1200;
export const RETRY_LIMIT = 2;
export const START_STAGGER_MS = 500;

// Backward-compatible export for older UI references.
export const NEXT_BOOTH_DELAY_MS = START_STAGGER_MS;

const RETRY_BACKOFF_BASE_MS = 800;
const LOOP_TICK_MS = 250;
const BACKPRESSURE_WINDOW_MS = 12000;
const BACKPRESSURE_HOLD_MS = 25000;
const BACKPRESSURE_RESTORE_STEP_MS = 10000;
const STOP_ERROR_CODE = "PARALLEL_STOP";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function extractPayload(data) {
  return data?.data || data || {};
}

function extractJob(data) {
  const payload = extractPayload(data);
  return payload?.job || payload || {};
}

function extractJobId(data) {
  const job = extractJob(data);
  return String(job?.id || job?.jobId || "").trim();
}

function normalizeJobStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "queued") return "queued";
  if (value === "processing") return "processing";
  if (value === "completed") return "completed";
  if (value === "failed" || value === "cancelled") return "failed";
  return "idle";
}

function normalizeQueuePosition(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.floor(numeric);
}

function normalizeBoothNumberValue(value) {
  if (value === null || value === undefined) return "";

  const text = String(value).trim();
  if (!text) return "";

  const direct = Number.parseInt(text, 10);
  if (Number.isFinite(direct) && direct > 0) {
    return String(direct);
  }

  const match = text.match(/\d+/);
  if (!match) return "";
  const parsed = Number.parseInt(match[0], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return String(parsed);
}

function extractSessionBoothNumber(session = {}) {
  const raw =
    session?.booth_no ??
    session?.boothNo ??
    session?.booth_number ??
    session?.boothNumber ??
    session?.part_number ??
    session?.partNumber ??
    "";

  return normalizeBoothNumberValue(raw);
}

function buildBoothDownloadFileName(boothNo) {
  const normalizedBoothNo =
    normalizeBoothNumberValue(boothNo) ||
    String(boothNo || "").trim() ||
    "unknown";
  return `voterslip-booth-${normalizedBoothNo}.pdf`;
}

function extractSessionId(session = {}) {
  const id = firstNonEmpty(session?.id, session?._id, session?.sessionId);
  return id || "";
}

function resolveSessionMapByBooth(sessions = []) {
  const map = new Map();

  (Array.isArray(sessions) ? sessions : []).forEach((session) => {
    const boothNo = extractSessionBoothNumber(session);
    const sessionId = extractSessionId(session);

    if (!boothNo || !sessionId) return;
    if (map.has(boothNo)) return;
    map.set(boothNo, sessionId);
  });

  return map;
}

function toUserMessage(error, fallback) {
  return firstNonEmpty(error?.message, fallback || "Unexpected error");
}

function createStopError() {
  const error = new Error("Stopped");
  error.code = STOP_ERROR_CODE;
  return error;
}

function isStopError(error) {
  return error?.code === STOP_ERROR_CODE;
}

function isTransientError(error) {
  const status = Number(error?.status || 0);
  if (status === 500 || status === 503) return true;

  const combined = `${error?.message || ""} ${error?.technical || ""}`
    .trim()
    .toLowerCase();

  if (!combined) return false;

  const transientHints = [
    "08p01",
    "network",
    "timeout",
    "timed out",
    "etimedout",
    "econnreset",
    "connection reset",
    "socket hang up",
    "fetch failed",
    "temporarily unavailable",
    "too many connections",
    "deadlock",
    "remaining connection slots",
  ];

  return transientHints.some((hint) => combined.includes(hint));
}

function mapBoothFailureStatus(error) {
  const status = Number(error?.status || 0);

  if (status === 404) {
    return {
      finalStatus: "skipped",
      statusText: "No matching session/voters",
    };
  }

  if (status === 400) {
    return {
      finalStatus: "failed",
      statusText: "Invalid booth/session request",
    };
  }

  if (status === 410) {
    return {
      finalStatus: "failed",
      statusText: "Download artifact already removed",
    };
  }

  return {
    finalStatus: "failed",
    statusText: "Failed after retries",
  };
}

function downloadBlob(blob, fileName) {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName || "voterslip.pdf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

export function normalizeBoothRangeInput(rawValue) {
  const collapsed = String(rawValue ?? "")
    .trim()
    .replace(/\s+/g, " ");

  if (!collapsed) {
    return {
      normalized: "",
      start: 0,
      end: 0,
      requestedBooths: 0,
      error: "Booth Range is required.",
    };
  }

  const match = collapsed.match(/^(\d{1,4})(?:\s*(?:-|to)\s*(\d{1,4}))?$/i);
  if (!match) {
    return {
      normalized: "",
      start: 0,
      end: 0,
      requestedBooths: 0,
      error: "Use range formats like 1-50, 5 to 20, or 12.",
    };
  }

  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2] || match[1], 10);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 1 ||
    end < 1
  ) {
    return {
      normalized: "",
      start: 0,
      end: 0,
      requestedBooths: 0,
      error: "Booth numbers must be positive integers.",
    };
  }

  if (start > end) {
    return {
      normalized: "",
      start,
      end,
      requestedBooths: 0,
      error: "Range start must be less than or equal to range end.",
    };
  }

  return {
    normalized: `${start}-${end}`,
    start,
    end,
    requestedBooths: end - start + 1,
    error: "",
  };
}

function buildBoothItemsFromRange(parsedRange, sessions) {
  const map = resolveSessionMapByBooth(sessions);
  const items = [];

  for (let booth = parsedRange.start; booth <= parsedRange.end; booth += 1) {
    const boothNo = String(booth);
    const sessionId = map.get(boothNo) || null;

    if (sessionId) {
      items.push({
        boothNo,
        sessionId,
        jobId: null,
        queuePosition: null,
        status: "pending",
        attempts: 0,
        statusText: "Pending",
        error: null,
      });
      continue;
    }

    items.push({
      boothNo,
      sessionId: null,
      jobId: null,
      queuePosition: null,
      status: "skipped",
      attempts: 0,
      statusText: "No matching session",
      error: "No matching session found for booth.",
    });
  }

  return items;
}

function computeTotals(items = []) {
  const safeItems = Array.isArray(items) ? items : [];

  return {
    total: safeItems.length,
    processing: safeItems.filter((item) => item.status === "processing").length,
    downloaded: safeItems.filter((item) => item.status === "downloaded").length,
    failed: safeItems.filter((item) => item.status === "failed").length,
    skipped: safeItems.filter((item) => item.status === "skipped").length,
    pending: safeItems.filter((item) => item.status === "pending").length,
  };
}

const initialState = {
  rangeInput: "",
  isRunning: false,
  isPaused: false,
  isStopping: false,
  currentBooth: null,
  cooldownMsRemaining: 0,
  dispatchParallelLimit: MAX_PARALLEL_BOOTHS,
  configuredMaxParallel: MAX_PARALLEL_BOOTHS,
  items: [],
  totals: {
    total: 0,
    processing: 0,
    downloaded: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
  },
};

export default function useBoothRangeZipJob({
  resolveSessionsForRange,
  onWarning,
  onError,
  onSuccess,
} = {}) {
  const [autoState, setAutoState] = useState(initialState);
  const [validationError, setValidationError] = useState("");

  const stateRef = useRef(initialState);
  const runTokenRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const pauseRequestedRef = useRef(false);

  const dispatchTargetRef = useRef(MAX_PARALLEL_BOOTHS);
  const transientFailureEventsRef = useRef([]);
  const backpressureHoldUntilRef = useRef(0);
  const nextRestoreAtRef = useRef(0);

  const syncState = useCallback((updater) => {
    setAutoState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      stateRef.current = next;
      return next;
    });
  }, []);

  const updateItems = useCallback(
    (updater) => {
      syncState((prev) => {
        const nextItems = updater(prev.items);
        return {
          ...prev,
          items: nextItems,
          totals: computeTotals(nextItems),
        };
      });
    },
    [syncState],
  );

  const getItem = useCallback((boothNo) => {
    return (
      stateRef.current.items.find((item) => item.boothNo === boothNo) || null
    );
  }, []);

  const updateItem = useCallback(
    (boothNo, updater) => {
      updateItems((items) =>
        items.map((item) => {
          if (item.boothNo !== boothNo) return item;
          if (typeof updater === "function") {
            return updater(item);
          }
          return {
            ...item,
            ...updater,
          };
        }),
      );
    },
    [updateItems],
  );

  const resetBackpressure = useCallback(() => {
    dispatchTargetRef.current = MAX_PARALLEL_BOOTHS;
    transientFailureEventsRef.current = [];
    backpressureHoldUntilRef.current = 0;
    nextRestoreAtRef.current = 0;
  }, []);

  const ensureRunToken = useCallback((runToken) => {
    if (runTokenRef.current !== runToken) {
      throw createStopError();
    }
  }, []);

  const sleepWithRunToken = useCallback(
    async (ms, runToken, { breakOnStop = false } = {}) => {
      let remaining = Math.max(0, Number(ms) || 0);
      while (remaining > 0) {
        ensureRunToken(runToken);
        if (breakOnStop && stopRequestedRef.current) {
          return;
        }

        const tick = Math.min(LOOP_TICK_MS, remaining);
        await sleep(tick);
        remaining -= tick;
      }
    },
    [ensureRunToken],
  );

  const updateDispatchIndicators = useCallback(
    (target, cooldownMs = 0) => {
      const normalizedTarget = Math.max(
        1,
        Math.min(MAX_PARALLEL_BOOTHS, Number(target) || 1),
      );
      const normalizedCooldown = Math.max(
        0,
        Math.ceil(Number(cooldownMs) || 0),
      );

      syncState((prev) => {
        if (
          prev.dispatchParallelLimit === normalizedTarget &&
          prev.configuredMaxParallel === MAX_PARALLEL_BOOTHS &&
          prev.cooldownMsRemaining === normalizedCooldown
        ) {
          return prev;
        }

        return {
          ...prev,
          dispatchParallelLimit: normalizedTarget,
          configuredMaxParallel: MAX_PARALLEL_BOOTHS,
          cooldownMsRemaining: normalizedCooldown,
        };
      });
    },
    [syncState],
  );

  const registerTransientFailure = useCallback(
    (boothNo) => {
      const now = Date.now();
      const cutoff = now - BACKPRESSURE_WINDOW_MS;

      const nextEvents = transientFailureEventsRef.current.filter(
        (event) => event.ts >= cutoff,
      );
      nextEvents.push({ ts: now, boothNo });
      transientFailureEventsRef.current = nextEvents;

      const uniqueBooths = new Set(
        nextEvents.map((event) => event.boothNo).filter(Boolean),
      );

      if (uniqueBooths.size < 2) {
        return;
      }

      if (
        dispatchTargetRef.current === 1 &&
        backpressureHoldUntilRef.current > now
      ) {
        return;
      }

      dispatchTargetRef.current = 1;
      backpressureHoldUntilRef.current = now + BACKPRESSURE_HOLD_MS;
      nextRestoreAtRef.current = backpressureHoldUntilRef.current;

      updateDispatchIndicators(1, BACKPRESSURE_HOLD_MS);
      onWarning?.(
        "Transient errors detected across multiple active booths. Dispatch throttled to 1 booth temporarily.",
      );
    },
    [onWarning, updateDispatchIndicators],
  );

  const advanceBackpressure = useCallback(() => {
    const now = Date.now();
    let target = dispatchTargetRef.current;

    if (backpressureHoldUntilRef.current > now) {
      updateDispatchIndicators(target, backpressureHoldUntilRef.current - now);
      return;
    }

    if (
      nextRestoreAtRef.current > 0 &&
      now >= nextRestoreAtRef.current &&
      target < MAX_PARALLEL_BOOTHS
    ) {
      target += 1;
      dispatchTargetRef.current = target;
      nextRestoreAtRef.current =
        target < MAX_PARALLEL_BOOTHS ? now + BACKPRESSURE_RESTORE_STEP_MS : 0;

      if (target >= MAX_PARALLEL_BOOTHS) {
        transientFailureEventsRef.current = [];
      }
    }

    const cooldownMs =
      target < MAX_PARALLEL_BOOTHS && nextRestoreAtRef.current > now
        ? nextRestoreAtRef.current - now
        : 0;

    updateDispatchIndicators(target, cooldownMs);
  }, [updateDispatchIndicators]);

  const pollJobUntilTerminal = useCallback(
    async (jobId, boothNo, runToken) => {
      while (true) {
        ensureRunToken(runToken);

        let data;
        try {
          data = await userAPI.getMassVoterSlipJob(jobId);
        } catch (error) {
          const wrapped = new Error(toUserMessage(error, "Polling failed."));
          wrapped.status = Number(error?.status || 0);
          wrapped.technical = error?.technical || error?.message || "";
          wrapped.stage = "poll";
          throw wrapped;
        }

        const job = extractJob(data);
        const status = normalizeJobStatus(job?.status);
        const processed = Number(job?.processed || 0);
        const total = Number(job?.total || 0);
        const queuePosition = normalizeQueuePosition(job?.queuePosition);

        updateItem(boothNo, (item) => ({
          ...item,
          jobId,
          queuePosition,
          status: "processing",
          statusText:
            status === "queued"
              ? queuePosition !== null
                ? `Queued (#${queuePosition})`
                : "Queued"
              : `Processing ${processed} / ${total || "?"}`,
        }));

        if (status === "completed") {
          return job;
        }

        if (status === "failed") {
          const wrapped = new Error(
            firstNonEmpty(job?.error, "Booth job failed on backend."),
          );
          wrapped.status = 500;
          wrapped.technical = firstNonEmpty(job?.error, "");
          wrapped.stage = "job-terminal";
          wrapped.resetJobId = true;
          throw wrapped;
        }

        await sleepWithRunToken(POLL_INTERVAL_MS, runToken);
      }
    },
    [ensureRunToken, sleepWithRunToken, updateItem],
  );

  const downloadCompletedJob = useCallback(
    async (jobId, boothNo, runToken) => {
      while (true) {
        ensureRunToken(runToken);

        try {
          const response = await userAPI.downloadMassVoterSlipJob(jobId);
          const fileName = buildBoothDownloadFileName(boothNo);
          downloadBlob(response.blob, fileName);
          return fileName;
        } catch (error) {
          const status = Number(error?.status || 0);

          if (status === 409) {
            await pollJobUntilTerminal(jobId, boothNo, runToken);
            continue;
          }

          const wrapped = new Error(toUserMessage(error, "Download failed."));
          wrapped.status = status;
          wrapped.technical = error?.technical || error?.message || "";
          wrapped.stage = "download";
          throw wrapped;
        }
      }
    },
    [ensureRunToken, pollJobUntilTerminal],
  );

  const processBooth = useCallback(
    async (boothNo, runToken) => {
      const maxAttempts = RETRY_LIMIT + 1;

      for (
        let attemptIndex = 0;
        attemptIndex < maxAttempts;
        attemptIndex += 1
      ) {
        ensureRunToken(runToken);

        const attempt = attemptIndex + 1;
        const item = getItem(boothNo);

        if (!item?.sessionId) {
          updateItem(boothNo, (current) => ({
            ...current,
            status: "skipped",
            statusText: "No matching session",
            error: current.error || "No matching session found for booth.",
            queuePosition: null,
          }));
          return "skipped";
        }

        updateItem(boothNo, (current) => ({
          ...current,
          status: "processing",
          attempts: attempt,
          statusText: `Attempt ${attempt}/${maxAttempts}`,
          error: null,
          queuePosition: null,
        }));

        try {
          let jobId = String(item.jobId || "").trim();

          if (!jobId) {
            const started = await userAPI.startMassVoterSlipForSession(
              item.sessionId,
            );
            jobId = extractJobId(started);
            if (!jobId) {
              const missingJobError = new Error(
                "Could not start booth job (missing job id).",
              );
              missingJobError.status = 500;
              missingJobError.stage = "start";
              throw missingJobError;
            }

            updateItem(boothNo, (current) => ({
              ...current,
              jobId,
              queuePosition: null,
              status: "processing",
              statusText: "Job started",
            }));
          }

          await pollJobUntilTerminal(jobId, boothNo, runToken);
          const fileName = await downloadCompletedJob(jobId, boothNo, runToken);

          updateItem(boothNo, (current) => ({
            ...current,
            status: "downloaded",
            queuePosition: null,
            statusText: `Downloaded ${fileName}`,
            error: null,
          }));

          return "downloaded";
        } catch (error) {
          if (isStopError(error)) {
            throw error;
          }

          const transient = isTransientError(error);
          const hasRetryLeft = attemptIndex < RETRY_LIMIT;

          if (
            error?.status === 410 &&
            getItem(boothNo)?.status === "downloaded"
          ) {
            return "downloaded";
          }

          if (transient) {
            registerTransientFailure(boothNo);
          }

          if (transient && hasRetryLeft && !stopRequestedRef.current) {
            const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, attemptIndex);
            const currentItem = getItem(boothNo);
            updateItem(boothNo, (current) => ({
              ...current,
              jobId: error?.resetJobId
                ? null
                : currentItem?.jobId || current.jobId,
              queuePosition: null,
              status: "processing",
              statusText: `Transient error. Retry in ${Math.ceil(backoffMs / 1000)}s`,
              error: toUserMessage(error, "Transient failure."),
            }));

            await sleepWithRunToken(backoffMs, runToken, { breakOnStop: true });
            continue;
          }

          const failure = mapBoothFailureStatus(error);
          updateItem(boothNo, (current) => ({
            ...current,
            status: failure.finalStatus,
            queuePosition: null,
            statusText: failure.statusText,
            error: toUserMessage(error, "Booth processing failed."),
          }));
          return failure.finalStatus;
        }
      }

      updateItem(boothNo, (current) => ({
        ...current,
        status: "failed",
        queuePosition: null,
        statusText: "Failed after retries",
        error: current.error || "Booth processing failed.",
      }));

      return "failed";
    },
    [
      downloadCompletedJob,
      ensureRunToken,
      getItem,
      pollJobUntilTerminal,
      registerTransientFailure,
      sleepWithRunToken,
      updateItem,
    ],
  );

  const runBoothQueue = useCallback(
    async (runToken) => {
      const activeWorkers = new Map();
      let nextDispatchAllowedAt = 0;

      const launchBoothWorker = (boothNo) => {
        updateItem(boothNo, (item) => ({
          ...item,
          status: "processing",
          statusText: item.attempts > 0 ? item.statusText : "Queued for start",
          error: item.status === "failed" ? null : item.error,
          queuePosition: null,
        }));

        const worker = processBooth(boothNo, runToken)
          .catch((error) => {
            if (isStopError(error)) return;

            updateItem(boothNo, (item) => ({
              ...item,
              status: "failed",
              queuePosition: null,
              statusText: "Unexpected worker failure",
              error: toUserMessage(error, "Unexpected worker failure."),
            }));
          })
          .finally(() => {
            activeWorkers.delete(boothNo);
          });

        activeWorkers.set(boothNo, worker);
      };

      try {
        while (runTokenRef.current === runToken) {
          advanceBackpressure();

          const snapshot = stateRef.current;
          const pendingBooths = snapshot.items
            .filter((item) => item.status === "pending" && item.sessionId)
            .map((item) => item.boothNo);

          const canDispatch =
            !pauseRequestedRef.current && !stopRequestedRef.current;
          const dispatchLimit = canDispatch ? dispatchTargetRef.current : 0;

          if (
            canDispatch &&
            activeWorkers.size < dispatchLimit &&
            pendingBooths.length > 0 &&
            Date.now() >= nextDispatchAllowedAt
          ) {
            launchBoothWorker(pendingBooths[0]);
            nextDispatchAllowedAt = Date.now() + START_STAGGER_MS;
          }

          const currentProcessingBooth = stateRef.current.items.find(
            (item) => item.status === "processing",
          )?.boothNo;

          if (stateRef.current.currentBooth !== currentProcessingBooth) {
            syncState((prev) => ({
              ...prev,
              currentBooth: currentProcessingBooth || null,
            }));
          }

          const hasPendingWork = stateRef.current.items.some(
            (item) => item.status === "pending" && item.sessionId,
          );

          if (stopRequestedRef.current && activeWorkers.size === 0) {
            break;
          }

          if (
            !stopRequestedRef.current &&
            !hasPendingWork &&
            activeWorkers.size === 0
          ) {
            break;
          }

          await sleepWithRunToken(LOOP_TICK_MS, runToken);
        }
      } catch (error) {
        if (!isStopError(error)) {
          onError?.(toUserMessage(error, "Parallel booth run failed."));
        }
      } finally {
        await Promise.allSettled(Array.from(activeWorkers.values()));

        if (runTokenRef.current === runToken) {
          const wasStopped = stopRequestedRef.current;
          pauseRequestedRef.current = false;
          stopRequestedRef.current = false;
          resetBackpressure();

          let finalTotals = null;

          syncState((prev) => {
            const nextItems = prev.items.map((item) => {
              if (!wasStopped || item.status !== "pending") return item;
              return {
                ...item,
                status: "skipped",
                statusText: "Stopped before dispatch",
                error: item.error || "Stopped by user",
              };
            });

            finalTotals = computeTotals(nextItems);

            return {
              ...prev,
              isRunning: false,
              isPaused: false,
              isStopping: false,
              currentBooth: null,
              cooldownMsRemaining: 0,
              dispatchParallelLimit: MAX_PARALLEL_BOOTHS,
              configuredMaxParallel: MAX_PARALLEL_BOOTHS,
              items: nextItems,
              totals: finalTotals,
            };
          });

          if (finalTotals?.total > 0) {
            const summary = `Downloaded ${finalTotals.downloaded}, failed ${finalTotals.failed}, skipped ${finalTotals.skipped}.`;
            if (wasStopped) {
              onWarning?.(`Run stopped. ${summary}`);
            } else {
              onSuccess?.(`Run finished. ${summary}`);
            }
          }
        }
      }
    },
    [
      advanceBackpressure,
      onError,
      onSuccess,
      onWarning,
      processBooth,
      resetBackpressure,
      sleepWithRunToken,
      syncState,
      updateItem,
    ],
  );

  const updateRangeInput = useCallback(
    (value) => {
      const nextValue = String(value ?? "");
      setValidationError("");
      syncState((prev) => ({
        ...prev,
        rangeInput: nextValue,
      }));
    },
    [syncState],
  );

  const beginRun = useCallback(
    (items, runLabel) => {
      const hasPendingDispatchableBooth = items.some(
        (item) => item.status === "pending" && item.sessionId,
      );

      if (!hasPendingDispatchableBooth) {
        syncState((prev) => ({
          ...prev,
          isRunning: false,
          isPaused: false,
          isStopping: false,
          currentBooth: null,
          cooldownMsRemaining: 0,
          dispatchParallelLimit: MAX_PARALLEL_BOOTHS,
          configuredMaxParallel: MAX_PARALLEL_BOOTHS,
        }));
        onWarning?.("No booth with matching session found in this range.");
        return;
      }

      resetBackpressure();
      stopRequestedRef.current = false;
      pauseRequestedRef.current = false;
      dispatchTargetRef.current = MAX_PARALLEL_BOOTHS;

      const runToken = runTokenRef.current + 1;
      runTokenRef.current = runToken;

      onSuccess?.(runLabel);
      void runBoothQueue(runToken);
    },
    [onSuccess, onWarning, resetBackpressure, runBoothQueue, syncState],
  );

  const startAutoDownload = useCallback(async () => {
    if (stateRef.current.isRunning) return;

    const parsed = normalizeBoothRangeInput(stateRef.current.rangeInput);
    if (parsed.error) {
      setValidationError(parsed.error);
      return;
    }

    setValidationError("");

    let sessions;
    try {
      sessions = await Promise.resolve(resolveSessionsForRange?.());
    } catch (error) {
      onError?.(toUserMessage(error, "Failed to resolve sessions for range."));
      return;
    }

    const items = buildBoothItemsFromRange(parsed, sessions || []);

    syncState((prev) => ({
      ...prev,
      rangeInput: parsed.normalized,
      isRunning: true,
      isPaused: false,
      isStopping: false,
      currentBooth: null,
      cooldownMsRemaining: 0,
      dispatchParallelLimit: MAX_PARALLEL_BOOTHS,
      configuredMaxParallel: MAX_PARALLEL_BOOTHS,
      items,
      totals: computeTotals(items),
    }));

    beginRun(items, `Auto download started for range ${parsed.normalized}.`);
  }, [beginRun, onError, resolveSessionsForRange, syncState]);

  const pauseAutoDownload = useCallback(() => {
    if (
      !stateRef.current.isRunning ||
      stateRef.current.isPaused ||
      stateRef.current.isStopping
    ) {
      return;
    }

    pauseRequestedRef.current = true;
    syncState((prev) => ({
      ...prev,
      isPaused: true,
    }));
  }, [syncState]);

  const resumeAutoDownload = useCallback(() => {
    if (!stateRef.current.isRunning || !stateRef.current.isPaused) return;

    pauseRequestedRef.current = false;
    syncState((prev) => ({
      ...prev,
      isPaused: false,
    }));
  }, [syncState]);

  const stopAutoDownload = useCallback(() => {
    if (!stateRef.current.isRunning) return;

    stopRequestedRef.current = true;
    pauseRequestedRef.current = false;

    syncState((prev) => {
      const nextItems = prev.items.map((item) => {
        if (item.status !== "pending") return item;
        return {
          ...item,
          status: "skipped",
          statusText: "Stopped before dispatch",
          error: item.error || "Stopped by user",
        };
      });

      return {
        ...prev,
        isPaused: false,
        isStopping: true,
        items: nextItems,
        totals: computeTotals(nextItems),
      };
    });
  }, [syncState]);

  const retryFailedBooths = useCallback(() => {
    if (stateRef.current.isRunning) return;

    const failedBooths = stateRef.current.items
      .filter((item) => item.status === "failed")
      .map((item) => item.boothNo);

    if (!failedBooths.length) {
      onWarning?.("No failed booths to retry.");
      return;
    }

    const refreshedItems = stateRef.current.items.map((item) => {
      if (item.status !== "failed") return item;
      return {
        ...item,
        jobId: null,
        queuePosition: null,
        attempts: 0,
        status: "pending",
        statusText: "Pending retry",
        error: null,
      };
    });

    syncState((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      isStopping: false,
      currentBooth: null,
      cooldownMsRemaining: 0,
      dispatchParallelLimit: MAX_PARALLEL_BOOTHS,
      configuredMaxParallel: MAX_PARALLEL_BOOTHS,
      items: refreshedItems,
      totals: computeTotals(refreshedItems),
    }));

    beginRun(refreshedItems, "Retrying failed booths.");
  }, [beginRun, onWarning, syncState]);

  const nextBoothNo = useMemo(() => {
    return (
      autoState.items.find(
        (item) => item.status === "pending" && item.sessionId,
      )?.boothNo || null
    );
  }, [autoState.items]);

  useEffect(() => {
    stateRef.current = autoState;
  }, [autoState]);

  return {
    autoState,
    validationError,
    nextBoothNo,
    updateRangeInput,
    startAutoDownload,
    pauseAutoDownload,
    resumeAutoDownload,
    stopAutoDownload,
    retryFailedBooths,
  };
}
