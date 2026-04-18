import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { userAPI } from "./api";

export const NEXT_BOOTH_DELAY_MS = 15000;
const POLL_INTERVAL_MS = 1200;
const MAX_TRANSIENT_RETRIES_PER_BOOTH = 2;
const RETRY_BACKOFF_BASE_MS = 1200;
const LOOP_TICK_MS = 250;
const STOP_ERROR_CODE = "SEQUENTIAL_STOP";

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

function toStringArray(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => String(item ?? "").trim()).filter(Boolean);
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

  if (combined.includes("08p01")) return true;

  const networkHints = [
    "network",
    "timeout",
    "timed out",
    "etimedout",
    "econnreset",
    "connection reset",
    "socket hang up",
    "fetch failed",
    "temporarily unavailable",
  ];

  return networkHints.some((hint) => combined.includes(hint));
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
    downloaded: safeItems.filter((item) => item.status === "downloaded").length,
    failed: safeItems.filter((item) => item.status === "failed").length,
    skipped: safeItems.filter((item) => item.status === "skipped").length,
  };
}

const initialState = {
  rangeInput: "",
  isRunning: false,
  isPaused: false,
  currentBooth: null,
  cooldownMsRemaining: 0,
  items: [],
  totals: {
    total: 0,
    downloaded: 0,
    failed: 0,
    skipped: 0,
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

  const ensureRunActive = useCallback((runToken) => {
    if (stopRequestedRef.current || runTokenRef.current !== runToken) {
      throw createStopError();
    }
  }, []);

  const waitForResume = useCallback(
    async (runToken) => {
      while (pauseRequestedRef.current) {
        ensureRunActive(runToken);
        await sleep(LOOP_TICK_MS);
      }

      ensureRunActive(runToken);
    },
    [ensureRunActive],
  );

  const waitWithControl = useCallback(
    async (ms, runToken, { trackCooldown = false } = {}) => {
      let remaining = Math.max(0, Number(ms) || 0);

      if (trackCooldown) {
        syncState((prev) => ({
          ...prev,
          cooldownMsRemaining: remaining,
        }));
      }

      while (remaining > 0) {
        await waitForResume(runToken);

        const tick = Math.min(LOOP_TICK_MS, remaining);
        await sleep(tick);
        remaining -= tick;

        if (trackCooldown) {
          syncState((prev) => ({
            ...prev,
            cooldownMsRemaining: remaining,
          }));
        }
      }

      if (trackCooldown) {
        syncState((prev) => ({
          ...prev,
          cooldownMsRemaining: 0,
        }));
      }
    },
    [syncState, waitForResume],
  );

  const pollJobUntilTerminal = useCallback(
    async (jobId, boothNo, runToken) => {
      while (true) {
        await waitForResume(runToken);

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

        updateItem(boothNo, (item) => ({
          ...item,
          jobId,
          status: "processing",
          statusText:
            status === "queued"
              ? "Queued"
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

        await waitWithControl(POLL_INTERVAL_MS, runToken);
      }
    },
    [updateItem, waitForResume, waitWithControl],
  );

  const downloadCompletedJob = useCallback(
    async (jobId, boothNo, runToken) => {
      while (true) {
        await waitForResume(runToken);

        try {
          const response = await userAPI.downloadMassVoterSlipJob(jobId);
          const fileName =
            firstNonEmpty(response?.fileName, `booth-${boothNo}.pdf`) ||
            `booth-${boothNo}.pdf`;
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
    [pollJobUntilTerminal, waitForResume],
  );

  const processBooth = useCallback(
    async (boothNo, runToken) => {
      for (
        let retryCount = 0;
        retryCount <= MAX_TRANSIENT_RETRIES_PER_BOOTH;
        retryCount += 1
      ) {
        await waitForResume(runToken);

        const attempt = retryCount + 1;

        updateItem(boothNo, (item) => ({
          ...item,
          status: "processing",
          attempts: attempt,
          statusText: `Attempt ${attempt}/${MAX_TRANSIENT_RETRIES_PER_BOOTH + 1}`,
          error: null,
        }));

        try {
          let item = getItem(boothNo);
          if (!item?.sessionId) {
            updateItem(boothNo, (current) => ({
              ...current,
              status: "skipped",
              statusText: "No matching session",
              error: current.error || "No matching session found for booth.",
            }));
            return "skipped";
          }

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
              status: "processing",
              statusText: "Job started",
            }));
          }

          await pollJobUntilTerminal(jobId, boothNo, runToken);
          const fileName = await downloadCompletedJob(jobId, boothNo, runToken);

          updateItem(boothNo, (current) => ({
            ...current,
            status: "downloaded",
            statusText: `Downloaded ${fileName}`,
            error: null,
          }));

          return "downloaded";
        } catch (error) {
          if (isStopError(error)) {
            throw error;
          }

          const currentItem = getItem(boothNo);
          const transient = isTransientError(error);
          const hasRetryLeft = retryCount < MAX_TRANSIENT_RETRIES_PER_BOOTH;

          if (error?.status === 410 && currentItem?.status === "downloaded") {
            return "downloaded";
          }

          if (!transient || !hasRetryLeft) {
            const failure = mapBoothFailureStatus(error);
            updateItem(boothNo, (item) => ({
              ...item,
              status: failure.finalStatus,
              statusText: failure.statusText,
              error: toUserMessage(error, "Booth processing failed."),
            }));
            return failure.finalStatus;
          }

          const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, retryCount);
          const retryDelayMs = Math.max(NEXT_BOOTH_DELAY_MS, backoffMs);

          updateItem(boothNo, (item) => ({
            ...item,
            jobId: error?.resetJobId ? null : item.jobId,
            status: "processing",
            statusText: `Retrying in ${Math.ceil(retryDelayMs / 1000)}s`,
            error: toUserMessage(error, "Transient failure."),
          }));

          await waitWithControl(retryDelayMs, runToken, {
            trackCooldown: true,
          });
        }
      }

      updateItem(boothNo, (item) => ({
        ...item,
        status: "failed",
        statusText: "Failed after retries",
        error: item.error || "Booth processing failed.",
      }));

      return "failed";
    },
    [
      downloadCompletedJob,
      getItem,
      pollJobUntilTerminal,
      updateItem,
      waitForResume,
      waitWithControl,
    ],
  );

  const runBoothSequence = useCallback(
    async (boothOrder, runToken) => {
      try {
        for (let index = 0; index < boothOrder.length; index += 1) {
          const boothNo = boothOrder[index];
          const item = getItem(boothNo);
          if (!item) continue;

          if (item.status === "downloaded" || item.status === "skipped") {
            continue;
          }

          await waitForResume(runToken);

          syncState((prev) => ({
            ...prev,
            currentBooth: boothNo,
          }));

          const result = await processBooth(boothNo, runToken);
          const hasNext = index < boothOrder.length - 1;

          if (hasNext && (result === "downloaded" || result === "failed")) {
            await waitWithControl(NEXT_BOOTH_DELAY_MS, runToken, {
              trackCooldown: true,
            });
          }
        }
      } catch (error) {
        if (!isStopError(error)) {
          onError?.(toUserMessage(error, "Sequential booth run failed."));
        }
      } finally {
        if (runTokenRef.current === runToken) {
          pauseRequestedRef.current = false;
          stopRequestedRef.current = false;

          syncState((prev) => {
            const totals = computeTotals(prev.items);
            if (totals.total > 0) {
              onSuccess?.(
                `Run finished. Downloaded ${totals.downloaded}, failed ${totals.failed}, skipped ${totals.skipped}.`,
              );
            }

            return {
              ...prev,
              isRunning: false,
              isPaused: false,
              currentBooth: null,
              cooldownMsRemaining: 0,
              totals,
            };
          });
        }
      }
    },
    [
      getItem,
      onError,
      onSuccess,
      processBooth,
      syncState,
      waitForResume,
      waitWithControl,
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
      const boothOrder = items
        .filter((item) => item.status === "pending")
        .map((item) => item.boothNo);

      if (!boothOrder.length) {
        syncState((prev) => ({
          ...prev,
          isRunning: false,
          isPaused: false,
          currentBooth: null,
          cooldownMsRemaining: 0,
        }));
        onWarning?.("No booth with matching session found in this range.");
        return;
      }

      stopRequestedRef.current = false;
      pauseRequestedRef.current = false;
      const runToken = runTokenRef.current + 1;
      runTokenRef.current = runToken;

      onSuccess?.(runLabel);
      void runBoothSequence(boothOrder, runToken);
    },
    [onSuccess, onWarning, runBoothSequence, syncState],
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
      currentBooth: null,
      cooldownMsRemaining: 0,
      items,
      totals: computeTotals(items),
    }));

    beginRun(items, `Auto download started for range ${parsed.normalized}.`);
  }, [beginRun, onError, resolveSessionsForRange, syncState]);

  const pauseAutoDownload = useCallback(() => {
    if (!stateRef.current.isRunning || stateRef.current.isPaused) return;

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
        if (item.status !== "processing") return item;
        return {
          ...item,
          status: "failed",
          statusText: "Stopped by user",
          error: item.error || "Stopped by user",
        };
      });

      return {
        ...prev,
        isRunning: false,
        isPaused: false,
        currentBooth: null,
        cooldownMsRemaining: 0,
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
      currentBooth: null,
      cooldownMsRemaining: 0,
      items: refreshedItems,
      totals: computeTotals(refreshedItems),
    }));

    beginRun(refreshedItems, "Retrying failed booths.");
  }, [beginRun, onWarning, syncState]);

  const nextBoothNo = useMemo(() => {
    return (
      autoState.items.find((item) => item.status === "pending")?.boothNo || null
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
