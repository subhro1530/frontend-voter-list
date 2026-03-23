import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { userAPI } from "./api";

const DEFAULT_POLL_INTERVAL = 1800;
const MAX_TRANSIENT_POLL_ERRORS = 3;
const MASS_SLIP_FILTERS_STORAGE_KEY = "mass-slip-filters-v1";
const MASS_PRINT_QUERY = {
  layout: "vertical",
  slipsPerPage: "4",
};

const MASS_START_LAYOUT_PAYLOADS = [
  {
    layout: "vertical",
    slipsPerPage: 4,
  },
  {
    slipsPerPage: 4,
  },
  {},
];

function buildSessionScopePayload(filtersInput = {}) {
  const sessionId = String(filtersInput?.sessionId || "").trim();
  const voterSessionId = String(
    filtersInput?.voterSessionId || sessionId || "",
  ).trim();
  const sourceSessionId = String(
    filtersInput?.sourceSessionId || sessionId || "",
  ).trim();

  const databaseName = String(
    filtersInput?.databaseName ||
      filtersInput?.database ||
      filtersInput?.dbName ||
      filtersInput?.db ||
      "",
  ).trim();

  const collectionName = String(
    filtersInput?.collectionName ||
      filtersInput?.collection ||
      filtersInput?.sourceCollection ||
      filtersInput?.sessionCollection ||
      "",
  ).trim();

  return {
    sessionId,
    session_id: sessionId,
    voterSessionId,
    sourceSessionId,
    databaseName,
    database: databaseName,
    dbName: databaseName,
    collectionName,
    collection: collectionName,
    sourceCollection: collectionName,
  };
}

function readRememberedFilters() {
  if (typeof window === "undefined") {
    return {
      boothNo: "",
      sessionId: "",
      assembly: "",
      section: "",
    };
  }

  try {
    const raw = localStorage.getItem(MASS_SLIP_FILTERS_STORAGE_KEY);
    if (!raw) {
      return {
        boothNo: "",
        sessionId: "",
        assembly: "",
        section: "",
      };
    }

    const parsed = JSON.parse(raw);
    return {
      boothNo: String(parsed?.boothNo || ""),
      sessionId: String(parsed?.sessionId || ""),
      assembly: String(parsed?.assembly || ""),
      section: String(parsed?.section || ""),
    };
  } catch {
    return {
      boothNo: "",
      sessionId: "",
      assembly: "",
      section: "",
    };
  }
}

const initialState = {
  filters: {
    ...readRememberedFilters(),
  },
  jobId: "",
  status: "idle",
  processed: 0,
  total: 0,
  error: null,
  technicalError: null,
  downloadUrl: null,
  fileName: "",
  startedAt: null,
  finishedAt: null,
};

function normalizePdfErrorMessage(message = "") {
  const raw = String(message || "");
  const lower = raw.toLowerCase();
  const hasEncodingError =
    lower.includes("winansi") ||
    lower.includes("cannot encode") ||
    lower.includes("font") ||
    lower.includes("glyph");

  if (!hasEncodingError) return raw;

  const charMatch = raw.match(/cannot encode\s+"(.+?)"/i);
  const offendingChar = charMatch?.[1];
  const suffix = offendingChar
    ? ` Problematic character: "${offendingChar}".`
    : "";

  return `PDF generation failed due to font encoding on backend.${suffix} Please use a Unicode-capable embedded font (Arial/Helvetica Unicode equivalent) and sanitize unsupported characters before writing text.`;
}

function mapStartError(error) {
  const status = Number(error?.status || 0);

  if (status === 400) {
    return {
      message: "Please provide at least one filter (Booth No recommended).",
      technical: error?.technical || error?.message || "Bad request",
    };
  }

  if (status === 404) {
    return {
      message: "No voters found for selected filters.",
      technical: error?.technical || error?.message || "No voters found",
    };
  }

  if (status >= 500) {
    const normalized = normalizePdfErrorMessage(
      error?.technical || error?.message || "Server error",
    );
    return {
      message:
        normalized !== (error?.technical || error?.message || "")
          ? normalized
          : "Something went wrong while starting generation.",
      technical: error?.technical || error?.message || "Server error",
    };
  }

  return {
    message: error?.message || "Failed to start mass voter slip generation.",
    technical: error?.technical || error?.message || "Unknown error",
  };
}

function mapDownloadError(error) {
  const status = Number(error?.status || 0);

  if (status === 409) {
    return {
      message: "Job still processing. Please wait.",
      technical: error?.technical || error?.message || "Conflict",
    };
  }

  if (status >= 500) {
    const normalized = normalizePdfErrorMessage(
      error?.technical || error?.message || "Server error",
    );
    return {
      message:
        normalized !== (error?.technical || error?.message || "")
          ? normalized
          : "Something went wrong while downloading PDF.",
      technical: error?.technical || error?.message || "Server error",
    };
  }

  return {
    message: error?.message || "Failed to download generated PDF.",
    technical: error?.technical || error?.message || "Unknown error",
  };
}

function downloadBlob(blob, fileName) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName || "voterslips.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

export default function useMassVoterSlipJob({
  pollInterval = DEFAULT_POLL_INTERVAL,
  onWarning,
  onError,
  onSuccess,
} = {}) {
  const [massSlip, setMassSlip] = useState(initialState);
  const [isStarting, setIsStarting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPollingPaused, setIsPollingPaused] = useState(false);

  const pollTimerRef = useRef(null);
  const transientPollErrorRef = useRef(0);
  const startDebounceRef = useRef(0);

  const activeJob = useMemo(
    () => ["queued", "processing"].includes(massSlip.status),
    [massSlip.status],
  );

  const updateFilters = useCallback((patch) => {
    setMassSlip((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        ...patch,
      },
    }));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const remembered = {
        boothNo: massSlip.filters.boothNo || "",
        sessionId: massSlip.filters.sessionId || "",
        assembly: massSlip.filters.assembly || "",
        section: massSlip.filters.section || "",
      };
      localStorage.setItem(
        MASS_SLIP_FILTERS_STORAGE_KEY,
        JSON.stringify(remembered),
      );
    } catch {
      // Ignore localStorage write issues.
    }
  }, [
    massSlip.filters.assembly,
    massSlip.filters.boothNo,
    massSlip.filters.sessionId,
    massSlip.filters.section,
  ]);

  const applyJobToState = useCallback((job, filtersFallback) => {
    if (!job) return;
    const normalizedJobError = normalizePdfErrorMessage(job.error || "");

    setMassSlip((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        ...(filtersFallback || {}),
      },
      jobId: job.id || prev.jobId,
      status: job.status || prev.status,
      processed: Number(job.processed || 0),
      total: Number(job.total || 0),
      error: normalizedJobError || null,
      technicalError: job.error || null,
      downloadUrl: job.downloadUrl || null,
      fileName: job.fileName || prev.fileName || "",
      startedAt: job.startedAt || prev.startedAt,
      finishedAt: job.finishedAt || prev.finishedAt,
    }));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    const jobId = massSlip.jobId;
    if (!jobId) return;

    try {
      const res = await userAPI.getMassVoterSlipJob(jobId);
      const job = res?.job || res;
      transientPollErrorRef.current = 0;
      applyJobToState(job);

      if (job?.status === "completed") {
        stopPolling();
        setIsPollingPaused(false);
        onSuccess?.("Completed. Ready to download.");
      } else if (job?.status === "failed") {
        stopPolling();
        setIsPollingPaused(false);
        onError?.(
          normalizePdfErrorMessage(job?.error || "") ||
            "Mass generation failed.",
        );
      }
    } catch (error) {
      transientPollErrorRef.current += 1;
      if (transientPollErrorRef.current <= MAX_TRANSIENT_POLL_ERRORS) return;

      stopPolling();
      setIsPollingPaused(true);
      onWarning?.(
        "Status updates paused after repeated errors. Click Retry Status.",
      );
    }
  }, [
    applyJobToState,
    massSlip.jobId,
    onError,
    onSuccess,
    onWarning,
    stopPolling,
  ]);

  useEffect(() => {
    if (!massSlip.jobId || !activeJob || isPollingPaused) {
      stopPolling();
      return undefined;
    }

    pollTimerRef.current = setInterval(pollStatus, pollInterval);
    return () => stopPolling();
  }, [
    activeJob,
    isPollingPaused,
    massSlip.jobId,
    pollInterval,
    pollStatus,
    stopPolling,
  ]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startJob = useCallback(
    async (filtersInput) => {
      const now = Date.now();
      if (now - startDebounceRef.current < 1000 || isStarting || activeJob) {
        return;
      }
      startDebounceRef.current = now;

      setIsStarting(true);
      setIsPollingPaused(false);
      transientPollErrorRef.current = 0;

      const basePayload = {
        ...buildSessionScopePayload(filtersInput),
        boothNo: filtersInput?.boothNo || "",
        partNumber: filtersInput?.boothNo || "",
        assembly: filtersInput?.assembly || "",
        section: filtersInput?.section || "",
      };

      Object.keys(basePayload).forEach((key) => {
        if (!basePayload[key]) delete basePayload[key];
      });

      try {
        let res;
        let lastErr;

        for (const layoutPatch of MASS_START_LAYOUT_PAYLOADS) {
          try {
            const payload = {
              ...basePayload,
              ...layoutPatch,
            };
            res = await userAPI.startMassVoterSlipGeneration(payload);
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            const status = Number(err?.status || 0);
            if (status !== 400 && status !== 422) {
              throw err;
            }
          }
        }

        if (!res && lastErr) {
          throw lastErr;
        }

        const job = res?.job || res;

        applyJobToState(job, filtersInput);
        await pollStatus();
      } catch (error) {
        const mapped = mapStartError(error);
        setMassSlip((prev) => ({
          ...prev,
          filters: {
            ...prev.filters,
            ...filtersInput,
          },
          status: "failed",
          error: mapped.message,
          technicalError: mapped.technical,
        }));
        onError?.(mapped.message);
      } finally {
        setIsStarting(false);
      }
    },
    [activeJob, applyJobToState, isStarting, onError, pollStatus],
  );

  const retryStatus = useCallback(async () => {
    transientPollErrorRef.current = 0;
    setIsPollingPaused(false);
    await pollStatus();
  }, [pollStatus]);

  const restartJob = useCallback(async () => {
    await startJob(massSlip.filters);
  }, [massSlip.filters, startJob]);

  const downloadGeneratedPdf = useCallback(async () => {
    if (!massSlip.jobId) return;

    setIsDownloading(true);
    try {
      let res;
      let lastErr;

      const downloadVariants = [MASS_PRINT_QUERY, {}];
      for (const query of downloadVariants) {
        try {
          res = await userAPI.downloadMassVoterSlipJob(
            massSlip.jobId,
            undefined,
            query,
          );
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          const status = Number(err?.status || 0);
          if (status !== 400 && status !== 404 && status !== 422) {
            throw err;
          }
        }
      }

      if (!res && lastErr) {
        throw lastErr;
      }

      const finalName = massSlip.fileName || res.fileName || "voterslips.pdf";
      downloadBlob(res.blob, finalName);
    } catch (error) {
      const mapped = mapDownloadError(error);
      onError?.(mapped.message);
      setMassSlip((prev) => ({
        ...prev,
        technicalError: mapped.technical,
      }));
    } finally {
      setIsDownloading(false);
    }
  }, [massSlip.fileName, massSlip.jobId, onError]);

  return {
    massSlip,
    isStarting,
    isDownloading,
    isPollingPaused,
    activeJob,
    updateFilters,
    startJob,
    retryStatus,
    restartJob,
    pollStatus,
    downloadGeneratedPdf,
  };
}
