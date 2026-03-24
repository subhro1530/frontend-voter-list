import { useCallback, useEffect, useRef, useState } from "react";
import { userAPI } from "./api";
import {
  normalizePdfErrorMessage,
  sanitizeMassSlipField,
} from "./massVoterSlipUtils";

const DEFAULT_POLL_INTERVAL = 1800;
const MAX_TRANSIENT_POLL_ERRORS = 3;

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function canonicalizeBooth(value) {
  const raw = String(value ?? "").toUpperCase();
  if (!raw) return "";

  const alnum = raw.replace(/[^A-Z0-9]/g, "");
  const match = alnum.match(/(\d{1,4}[A-Z]?)/);
  return match?.[1] || "";
}

function parseBoothFromFilename(filename) {
  const text = String(filename ?? "");
  if (!text) return "";

  const explicitPatterns = [
    /(?:booth|part)\s*(?:no|number|#|:|-)?\s*([0-9]{1,4}\s*[A-Za-z]?)/i,
    /(?:boothno|partno)\s*([0-9]{1,4}\s*[A-Za-z]?)/i,
    /(?:booth|part)[^0-9a-zA-Z]{0,4}([0-9]{1,4}[A-Za-z]?)/i,
  ];

  for (const pattern of explicitPatterns) {
    const hit = text.match(pattern);
    const normalized = canonicalizeBooth(hit?.[1] || "");
    if (normalized) return normalized;
  }

  const fallback = text.match(/\b([0-9]{1,4}[A-Za-z]?)\b/);
  return canonicalizeBooth(fallback?.[1] || "");
}

function resolveBooth(session, responseSession) {
  const boothFromSession = canonicalizeBooth(
    firstNonEmpty(
      session?.booth_no,
      session?.boothNo,
      session?.part_number,
      session?.partNumber,
    ),
  );

  if (boothFromSession) {
    return { boothNo: boothFromSession, boothSource: "session" };
  }

  const boothFromResponse = canonicalizeBooth(
    firstNonEmpty(
      responseSession?.boothNo,
      responseSession?.booth_no,
      responseSession?.partNumber,
      responseSession?.part_number,
    ),
  );

  if (boothFromResponse) {
    return { boothNo: boothFromResponse, boothSource: "response" };
  }

  const boothFromFilename = parseBoothFromFilename(
    firstNonEmpty(
      session?.original_filename,
      session?.originalFilename,
      session?.filename,
    ),
  );

  if (boothFromFilename) {
    return { boothNo: boothFromFilename, boothSource: "filename" };
  }

  return { boothNo: "", boothSource: "missing" };
}

function resolveBoothName(session, responseSession) {
  return firstNonEmpty(
    responseSession?.boothName,
    responseSession?.booth_name,
    session?.booth_name,
    session?.boothName,
  );
}

function normalizeJobStatus(status) {
  const value = String(status || "idle").toLowerCase();
  if (
    [
      "queued",
      "processing",
      "completed",
      "failed",
      "cancelled",
      "idle",
    ].includes(value)
  ) {
    return value;
  }
  return "idle";
}

function extractPayload(data) {
  return data?.data || data || {};
}

function extractJob(data) {
  const payload = extractPayload(data);
  return payload?.job || payload || {};
}

function extractResponseSession(data) {
  const payload = extractPayload(data);
  return payload?.session || payload?.meta?.session || {};
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

function mapStartError(error) {
  const raw = error?.technical || error?.message || "";
  const normalized = normalizePdfErrorMessage(raw);
  const status = Number(error?.status || 0);
  if (status === 400) return "Invalid request. Please verify session metadata.";
  if (status === 403)
    return "You do not have permission to start this mass job.";
  if (status === 404) return "Session not found or this session has no voters.";
  if (status >= 500)
    return (
      normalized || "Server error while starting generation. Please retry."
    );
  return error?.message || "Failed to start session mass generation.";
}

function mapDownloadError(error) {
  const raw = error?.technical || error?.message || "";
  const normalized = normalizePdfErrorMessage(raw);
  const status = Number(error?.status || 0);
  if (status === 409) {
    return "Job is still processing. Please wait for completion.";
  }
  if (status === 410) {
    return "Generated file expired or already downloaded. Please regenerate.";
  }
  if (status === 403) {
    return "You do not have permission to download this file.";
  }
  if (status >= 500) {
    return normalized || "Server error while downloading PDF. Please retry.";
  }
  return error?.message || "Failed to download generated PDF.";
}

function createInitialState(sessionId, session) {
  const booth = resolveBooth(session, null);
  return {
    sessionId: String(sessionId || ""),
    boothNo: booth.boothNo,
    boothName: resolveBoothName(session, null),
    boothSource: booth.boothSource,
    jobId: "",
    status: "idle",
    processed: 0,
    total: 0,
    error: null,
    technicalError: null,
    fileName: "",
    downloadUrl: null,
    isStarting: false,
    isDownloading: false,
  };
}

export default function useSessionMassVoterSlipJob({
  sessionId,
  session,
  pollInterval = DEFAULT_POLL_INTERVAL,
  onWarning,
  onError,
  onSuccess,
} = {}) {
  const [sessionMassSlip, setSessionMassSlip] = useState(() =>
    createInitialState(sessionId, session),
  );

  const pollTimerRef = useRef(null);
  const nextAllowedPollAtRef = useRef(0);
  const transientPollErrorRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const applyJobState = useCallback(
    (job, responseSession) => {
      const booth = resolveBooth(session, responseSession);
      const boothName = resolveBoothName(session, responseSession);

      setSessionMassSlip((prev) => ({
        ...prev,
        sessionId: String(sessionId || prev.sessionId || ""),
        boothNo: booth.boothNo,
        boothSource: booth.boothSource,
        boothName: boothName || prev.boothName || "",
        jobId: String(job?.id || job?.jobId || prev.jobId || ""),
        status: normalizeJobStatus(job?.status || prev.status),
        processed: Number(job?.processed ?? prev.processed ?? 0),
        total: Number(job?.total ?? prev.total ?? 0),
        error: normalizePdfErrorMessage(job?.error || "") || null,
        technicalError: job?.error || prev.technicalError || null,
        fileName: String(job?.fileName || job?.filename || prev.fileName || ""),
        downloadUrl: job?.downloadUrl || prev.downloadUrl || null,
      }));
    },
    [session, sessionId],
  );

  useEffect(() => {
    setSessionMassSlip((prev) => {
      const nextSessionId = String(sessionId || "");
      const booth = resolveBooth(session, null);
      const boothName = resolveBoothName(session, null);

      if (nextSessionId && nextSessionId !== String(prev.sessionId || "")) {
        return createInitialState(nextSessionId, session);
      }

      return {
        ...prev,
        sessionId: nextSessionId || prev.sessionId,
        boothNo: booth.boothNo,
        boothSource: booth.boothSource,
        boothName: boothName || prev.boothName || "",
      };
    });
  }, [session, sessionId]);

  const pollJob = useCallback(
    async (jobIdInput) => {
      if (Date.now() < nextAllowedPollAtRef.current) return;

      const jobId = String(jobIdInput || sessionMassSlip.jobId || "");
      if (!jobId) return;

      try {
        const data = await userAPI.getMassVoterSlipJob(jobId);
        const job = extractJob(data);
        const responseSession = extractResponseSession(data);
        transientPollErrorRef.current = 0;
        nextAllowedPollAtRef.current = 0;
        applyJobState(job, responseSession);

        const status = normalizeJobStatus(job?.status);
        if (status === "completed") {
          stopPolling();
          onSuccess?.("Mass voter slip generation completed.");
        } else if (status === "failed" || status === "cancelled") {
          stopPolling();
          onError?.(job?.error || "Mass generation failed.");
        }
      } catch (error) {
        transientPollErrorRef.current += 1;
        if (transientPollErrorRef.current <= MAX_TRANSIENT_POLL_ERRORS) {
          const backoffMs =
            pollInterval * Math.pow(2, transientPollErrorRef.current - 1);
          nextAllowedPollAtRef.current = Date.now() + backoffMs;
          return;
        }

        stopPolling();
        onWarning?.(
          "Status updates paused after repeated errors. Retry to resume.",
        );
      }
    },
    [
      applyJobState,
      onError,
      onSuccess,
      onWarning,
      pollInterval,
      sessionMassSlip.jobId,
      stopPolling,
    ],
  );

  useEffect(() => {
    const isActive = ["queued", "processing"].includes(sessionMassSlip.status);
    if (!isActive || !sessionMassSlip.jobId) {
      stopPolling();
      return;
    }

    pollTimerRef.current = setInterval(() => {
      pollJob(sessionMassSlip.jobId);
    }, pollInterval);

    return () => stopPolling();
  }, [
    pollInterval,
    pollJob,
    sessionMassSlip.jobId,
    sessionMassSlip.status,
    stopPolling,
  ]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startSessionMassSlip = useCallback(async () => {
    const resolvedSessionId = String(
      sessionId || sessionMassSlip.sessionId || "",
    );
    if (!resolvedSessionId) {
      onError?.("Session ID is missing.");
      return;
    }

    if (["queued", "processing"].includes(sessionMassSlip.status)) {
      return;
    }

    setSessionMassSlip((prev) => ({
      ...prev,
      sessionId: resolvedSessionId,
      isStarting: true,
      error: null,
      technicalError: null,
    }));

    try {
      nextAllowedPollAtRef.current = 0;
      const sanitizedSessionId = sanitizeMassSlipField(resolvedSessionId).value;
      const data =
        await userAPI.startMassVoterSlipForSession(sanitizedSessionId);
      const job = extractJob(data);
      const responseSession = extractResponseSession(data);

      transientPollErrorRef.current = 0;
      applyJobState(job, responseSession);
      onSuccess?.("Mass voter slip generation started.");

      const jobId = String(job?.id || job?.jobId || "");
      if (jobId) {
        await pollJob(jobId);
      }
    } catch (error) {
      const message = mapStartError(error);
      setSessionMassSlip((prev) => ({
        ...prev,
        status: "failed",
        error: message,
        technicalError: error?.technical || error?.message || null,
      }));
      onError?.(message);
    } finally {
      setSessionMassSlip((prev) => ({
        ...prev,
        isStarting: false,
      }));
    }
  }, [
    applyJobState,
    onError,
    onSuccess,
    pollJob,
    sessionId,
    sessionMassSlip.sessionId,
    sessionMassSlip.status,
  ]);

  const retrySessionMassSlip = useCallback(async () => {
    await startSessionMassSlip();
  }, [startSessionMassSlip]);

  const downloadSessionMassSlip = useCallback(async () => {
    const jobId = String(sessionMassSlip.jobId || "");
    if (!jobId) return;

    setSessionMassSlip((prev) => ({
      ...prev,
      isDownloading: true,
    }));

    try {
      const res = await userAPI.downloadMassVoterSlipJob(jobId);
      const finalName =
        sessionMassSlip.fileName || res?.fileName || "voterslips.pdf";
      downloadBlob(res.blob, finalName);
      onSuccess?.("PDF download started.");
    } catch (error) {
      const status = Number(error?.status || 0);
      const message = mapDownloadError(error);

      if (status === 409) {
        await pollJob(jobId);
      }

      setSessionMassSlip((prev) => ({
        ...prev,
        technicalError:
          error?.technical || error?.message || prev.technicalError,
      }));
      onError?.(message);
    } finally {
      setSessionMassSlip((prev) => ({
        ...prev,
        isDownloading: false,
      }));
    }
  }, [
    onError,
    onSuccess,
    pollJob,
    sessionMassSlip.fileName,
    sessionMassSlip.jobId,
  ]);

  return {
    sessionMassSlip,
    startSessionMassSlip,
    retrySessionMassSlip,
    downloadSessionMassSlip,
    pollJob,
    isJobActive: ["queued", "processing"].includes(sessionMassSlip.status),
  };
}
