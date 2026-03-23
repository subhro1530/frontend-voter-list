import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  createSessionsBulk,
  getSessionStatus,
  resumeSession,
} from "../lib/api";
import toast from "react-hot-toast";
import DispatchModeSelector from "./DispatchModeSelector";
import { readStoredDispatchMode } from "../lib/dispatchMode";

const TERMINAL_STATUSES = new Set(["completed", "failed", "paused"]);

function normalizeRunStatus(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();
  if (normalized === "processing") {
    return "processing";
  }
  if (
    normalized === "completed" ||
    normalized === "failed" ||
    normalized === "paused"
  ) {
    return normalized;
  }
  return "failed";
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const converted = value / 1024 ** index;
  return `${converted.toFixed(converted >= 10 ? 0 : 1)} ${units[index]}`;
}

const ResultRow = memo(function ResultRow({
  row,
  pollingStatus,
  onOpen,
  onResume,
  onRetry,
  loading,
}) {
  const status = normalizeRunStatus(row.status);
  const isProcessing =
    String(pollingStatus?.status || "")
      .toLowerCase()
      .trim() === "processing";
  const statusClass =
    status === "completed"
      ? "bg-emerald-900/40 text-emerald-100 border-emerald-600"
      : status === "paused"
        ? "bg-amber-900/40 text-amber-100 border-amber-600"
        : status === "processing"
          ? "bg-sky-900/40 text-sky-100 border-sky-600"
          : "bg-rose-900/40 text-rose-100 border-rose-600";

  return (
    <div className="border border-slate-700 rounded-md p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-100 break-all">
            {row.fileName}
          </div>
          {row.sessionId && (
            <div className="text-xs text-slate-300 break-all">
              Session: {row.sessionId}
            </div>
          )}
        </div>
        <span
          className={`text-xs px-2 py-1 border rounded-full ${statusClass}`}
        >
          {isProcessing ? "processing" : status}
        </span>
      </div>
      {(row.error || row.message || row.details) && (
        <p className="text-xs text-slate-300 whitespace-pre-line">
          {row.error || row.message || row.details}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {row.sessionId && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onOpen(row.sessionId)}
            disabled={loading}
          >
            Open session details
          </button>
        )}
        {status === "paused" && row.sessionId && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onResume(row)}
            disabled={loading}
          >
            Resume
          </button>
        )}
        {status === "failed" && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onRetry(row)}
            disabled={loading}
          >
            Retry single file
          </button>
        )}
      </div>
    </div>
  );
});

export default function UploadForm({ onCreated }) {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [workerCount, setWorkerCount] = useState(null);
  const [dispatchTierHint, setDispatchTierHint] = useState("");
  const [dispatchMode, setDispatchMode] = useState("auto");
  const [isVisible, setIsVisible] = useState(true);
  const [statusBySessionId, setStatusBySessionId] = useState({});
  const uploadControllerRef = useRef(null);

  useEffect(() => {
    setDispatchMode(readStoredDispatchMode());
  }, []);

  useEffect(() => {
    const syncVisibility = () => {
      if (typeof document === "undefined") return;
      setIsVisible(document.visibilityState === "visible");
    };
    syncVisibility();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", syncVisibility);
      return () =>
        document.removeEventListener("visibilitychange", syncVisibility);
    }
    return undefined;
  }, []);

  const selectedFileMap = useMemo(
    () => Object.fromEntries(selectedFiles.map((item) => [item.name, item])),
    [selectedFiles],
  );

  const totalSize = useMemo(
    () => selectedFiles.reduce((acc, file) => acc + Number(file.size || 0), 0),
    [selectedFiles],
  );

  const pollingSessionIds = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            row.sessionId &&
            !TERMINAL_STATUSES.has(normalizeRunStatus(row.status)),
        )
        .map((row) => row.sessionId),
    [rows],
  );

  useEffect(() => {
    if (!isVisible || !pollingSessionIds.length) return undefined;

    let active = true;
    const runPoll = async () => {
      const settled = await Promise.allSettled(
        pollingSessionIds.map(async (sessionId) => {
          const res = await getSessionStatus(sessionId);
          return { sessionId, payload: res };
        }),
      );

      if (!active) return;

      setStatusBySessionId((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const item of settled) {
          if (item.status !== "fulfilled") continue;
          const current =
            item.value.payload?.status || item.value.payload?.state;
          const normalized = String(current || "")
            .toLowerCase()
            .trim();
          const previous = prev[item.value.sessionId]?.status;
          if (normalized && previous !== normalized) {
            changed = true;
            next[item.value.sessionId] = {
              ...item.value.payload,
              status: normalized,
            };
          }
        }
        return changed ? next : prev;
      });

      setRows((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          if (!row.sessionId) return row;
          const latest = settled.find(
            (item) =>
              item.status === "fulfilled" &&
              item.value.sessionId === row.sessionId,
          );
          if (!latest || latest.status !== "fulfilled") return row;
          const current =
            latest.value.payload?.status || latest.value.payload?.state;
          const normalized = String(current || "")
            .toLowerCase()
            .trim();
          if (!normalized) return row;
          if (row.status === normalized) return row;
          changed = true;
          return { ...row, status: normalized };
        });
        return changed ? next : prev;
      });
    };

    runPoll();
    const timer = setInterval(runPoll, 2000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isVisible, pollingSessionIds]);

  const handleFilesChange = (event) => {
    const incoming = Array.from(event.target.files || []);
    const onlyPdf = incoming.filter((file) => {
      const type = String(file?.type || "").toLowerCase();
      const name = String(file?.name || "").toLowerCase();
      return type === "application/pdf" || name.endsWith(".pdf");
    });
    setSelectedFiles(onlyPdf);
  };

  const removeFileByName = (name) => {
    setSelectedFiles((prev) => prev.filter((file) => file.name !== name));
  };

  const buildRowsFromResponse = (response) => {
    const root =
      response?.data && typeof response.data === "object"
        ? response.data
        : response;
    const sessionRows = Array.isArray(root?.sessions)
      ? root.sessions
      : Array.isArray(response?.sessions)
        ? response.sessions
        : [];
    return sessionRows.map((row) => ({
      fileName: row.fileName || "Unknown file",
      sessionId: row.sessionId,
      status: normalizeRunStatus(row.status),
      pages: row.pages,
      processedPages: row.processedPages,
      httpStatus: Number(row.httpStatus || 0),
      error: row.error,
      details: row.details,
      message: row.message,
    }));
  };

  const runBatchUpload = async (filesToUpload) => {
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    try {
      setUploadMessage(
        `Uploading ${filesToUpload.length} file${filesToUpload.length > 1 ? "s" : ""} (${formatBytes(
          filesToUpload.reduce((acc, file) => acc + Number(file.size || 0), 0),
        )}). Please wait...`,
      );

      const response = await createSessionsBulk(filesToUpload, {
        dispatchMode,
        signal: controller.signal,
      });

      const root =
        response?.data && typeof response.data === "object"
          ? response.data
          : response;
      const nextRows = buildRowsFromResponse(response);
      setRows(nextRows);
      setSummary(root?.summary || response?.summary || null);
      setWorkerCount(
        Number.isFinite(Number(root?.workerCount))
          ? Number(root.workerCount)
          : null,
      );

      const tier = String(
        root?.apiKeyStatus?.activeDispatchTier ||
          response?.apiKeyStatus?.activeDispatchTier ||
          "",
      ).toLowerCase();
      setDispatchTierHint(
        tier === "free" ? "Switch to Turbo for faster completion." : "",
      );

      nextRows
        .filter((row) => row.sessionId)
        .forEach((row) => onCreated?.(row.sessionId));

      if (!nextRows.length) {
        setUploadMessage(
          "Upload request finished, but no session rows were returned. Open Voter Lists and click Refresh.",
        );
        toast("Upload completed. Open Voter Lists and click Refresh.");
        return;
      }

      const totalFiles = Number(root?.totalFiles || nextRows.length);
      const createdCount = nextRows.filter((row) => row.sessionId).length;
      setUploadMessage(
        `Upload finished: ${createdCount}/${totalFiles} sessions created. You can open Voter Lists now.`,
      );

      if (Number(response.httpStatus) === 207) {
        toast(
          "Batch completed with partial results. Some files need resume/retry.",
        );
      } else {
        toast.success("All voter lists processed successfully.");
      }

      if (createdCount > 0) {
        setTimeout(() => {
          router.push(`/sessions?fromUpload=1&t=${Date.now()}`);
        }, 900);
      }
    } finally {
      uploadControllerRef.current = null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFiles.length)
      return setError("Please choose at least one PDF file.");
    setError("");
    setUploadMessage("");
    setLoading(true);
    setRows([]);
    setSummary(null);
    setWorkerCount(null);
    setStatusBySessionId({});
    try {
      toast("Creating sessions for selected voter lists...");
      await runBatchUpload(selectedFiles);
    } catch (err) {
      if (err?.name === "AbortError") {
        setError("Batch upload canceled.");
        setUploadMessage("Upload canceled.");
      } else {
        setError(err?.message || "Failed to upload.");
        setUploadMessage("Upload failed. Please review the error and retry.");
      }
    } finally {
      setLoading(false);
    }
  };

  const cancelUpload = () => {
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort();
    }
  };

  const handleOpenSession = (sessionId) => {
    router.push(`/sessions/${sessionId}`);
  };

  const handleResume = async (row) => {
    if (!row.sessionId) return;
    try {
      await resumeSession(row.sessionId, dispatchMode);
      toast.success("Session resume triggered.");
      setRows((prev) =>
        prev.map((item) =>
          item.sessionId === row.sessionId
            ? { ...item, status: "processing" }
            : item,
        ),
      );
    } catch (err) {
      toast.error(err?.message || "Failed to resume session.");
    }
  };

  const handleRetrySingle = async (row) => {
    const file = selectedFileMap[row.fileName];
    if (!file) {
      toast.error("Original file not found in current selection.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await createSessionsBulk([file], {
        dispatchMode,
      });
      const retried = buildRowsFromResponse(response)[0];
      if (!retried) {
        throw new Error("Retry did not return a session row.");
      }
      setRows((prev) =>
        prev.map((item) => (item.fileName === row.fileName ? retried : item)),
      );
      if (retried.sessionId) {
        onCreated?.(retried.sessionId);
      }
      toast.success("Retry submitted.");
    } catch (err) {
      toast.error(err?.message || "Retry failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="upload" className="card space-y-4 text-slate-100">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-50">
            Upload Voter Lists
          </h3>
          <p className="text-sm text-slate-200/80">
            Select multiple PDF files and create one session per file in a
            single batch.
          </p>
        </div>
        <span className="badge border-neon-300 text-neon-100 bg-ink-100/80">
          POST /sessions/bulk
        </span>
      </div>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <DispatchModeSelector value={dispatchMode} onChange={setDispatchMode} />
        <div className="space-y-2">
          <label htmlFor="file">PDF Files</label>
          <input
            id="file"
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFilesChange}
            disabled={loading}
          />
        </div>
        {!!selectedFiles.length && (
          <div className="space-y-2">
            <p className="text-xs text-slate-300">
              {selectedFiles.length} files selected • Total size:{" "}
              {formatBytes(totalSize)}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file) => (
                <span
                  key={file.name}
                  className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-slate-600 bg-slate-900/40 text-xs"
                >
                  <span className="max-w-[260px] truncate" title={file.name}>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    className="text-slate-300 hover:text-white"
                    onClick={() => removeFileByName(file.name)}
                    disabled={loading}
                    aria-label={`Remove ${file.name}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        {error && (
          <div className="p-3 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700 whitespace-pre-line">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating sessions..." : "Start batch upload"}
          </button>
          {loading && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cancelUpload}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      {loading && (
        <p className="text-sm text-slate-200">
          Creating sessions for selected voter lists...
        </p>
      )}
      {!!uploadMessage && (
        <div className="p-3 bg-sky-900/30 border border-sky-700 rounded-lg text-sky-100 text-sm">
          {uploadMessage}
        </div>
      )}
      {dispatchTierHint && (
        <p className="text-sm text-amber-200">{dispatchTierHint}</p>
      )}
      {!!rows.length && (
        <div className="p-3 bg-emerald-900/40 border border-emerald-600 rounded-lg text-emerald-100 space-y-2">
          <div className="font-semibold text-emerald-100">Batch Results</div>
          {summary && (
            <div className="text-xs text-emerald-50 space-y-1">
              <p>
                Completed: {summary.completed || 0} • Paused:{" "}
                {summary.paused || 0} • Failed: {summary.failed || 0}
              </p>
              {Number.isFinite(workerCount) && <p>Workers: {workerCount}</p>}
            </div>
          )}
          <div className="space-y-2">
            {rows.map((row, index) => (
              <ResultRow
                key={`${row.fileName}-${row.sessionId || index}`}
                row={row}
                pollingStatus={
                  row.sessionId ? statusBySessionId[row.sessionId] : undefined
                }
                onOpen={handleOpenSession}
                onResume={handleResume}
                onRetry={handleRetrySingle}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
