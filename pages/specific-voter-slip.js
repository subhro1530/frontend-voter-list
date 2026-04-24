import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import { userAPI } from "../lib/api";
import toast from "react-hot-toast";

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

const POLL_INTERVAL_MS = 1500;
const DEFAULT_OCR_TABLE_COLUMNS = [
  "rowNo",
  "serialNumber",
  "voterId",
  "name",
  "relationName",
  "houseNumber",
  "age",
  "gender",
  "section",
  "partNumber",
  "sourceFileName",
  "sourcePageNumber",
];

function isSupportedFile(file) {
  if (!file) return false;

  const mime = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();

  if (!mime) {
    return (
      name.endsWith(".pdf") ||
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg")
    );
  }

  return ACCEPTED_FILE_TYPES.includes(mime);
}

function isImageFile(file) {
  const mime = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return (
    mime.startsWith("image/") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg")
  );
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const normalized = value / 1024 ** power;
  return `${normalized.toFixed(normalized >= 10 ? 0 : 1)} ${units[power]}`;
}

function makePastedFiles(clipboardData) {
  const items = Array.from(clipboardData?.items || []);
  const pastedFiles = [];

  items.forEach((item, index) => {
    const type = String(item?.type || "").toLowerCase();
    if (!type.startsWith("image/")) return;

    const blob = item.getAsFile();
    if (!blob) return;

    const extension =
      type.includes("jpeg") || type.includes("jpg") ? "jpg" : "png";

    pastedFiles.push(
      new File(
        [blob],
        `pasted-snippet-${Date.now()}-${index + 1}.${extension}`,
        {
          type: blob.type || (extension === "jpg" ? "image/jpeg" : "image/png"),
          lastModified: Date.now(),
        },
      ),
    );
  });

  return pastedFiles;
}

function normalizeStatus(value) {
  const status = String(value || "idle").toLowerCase();
  if (
    [
      "queued",
      "processing",
      "completed",
      "failed",
      "cancelled",
      "idle",
    ].includes(status)
  ) {
    return status;
  }
  return "idle";
}

function normalizeJob(payload) {
  const source = payload?.job || payload || {};
  const id = String(source?.id || source?.jobId || "").trim();
  if (!id) return null;

  return {
    id,
    status: normalizeStatus(source?.status),
    total: Number(source?.total || 0),
    processed: Number(source?.processed || 0),
    downloadUrl: source?.downloadUrl || null,
    error: source?.error || null,
  };
}

function normalizeOcrSummary(ocr) {
  if (!ocr || typeof ocr !== "object") return null;

  return {
    filesReceived: Number(ocr.filesReceived || 0),
    filesAccepted: Number(ocr.filesAccepted || 0),
    pagesProcessed: Number(ocr.pagesProcessed || 0),
    extractedCount: Number(ocr.extractedCount || 0),
    acceptedBeforeDedupeCount: Number(ocr.acceptedBeforeDedupeCount || 0),
    acceptedCount: Number(ocr.acceptedCount || 0),
    skippedUnderAdjudicationCount: Number(
      ocr.skippedUnderAdjudicationCount || 0,
    ),
    duplicateRowsSkipped: Number(ocr.duplicateRowsSkipped || 0),
    failedPages: Number(ocr.failedPages || 0),
  };
}

function normalizeOcrTable(ocr) {
  if (!ocr || typeof ocr !== "object") {
    return {
      columns: DEFAULT_OCR_TABLE_COLUMNS,
      rows: [],
    };
  }

  const columns =
    Array.isArray(ocr.tableColumns) && ocr.tableColumns.length
      ? ocr.tableColumns.map((key) => String(key || "").trim()).filter(Boolean)
      : DEFAULT_OCR_TABLE_COLUMNS;

  const rowsSource = Array.isArray(ocr.tableRows) ? ocr.tableRows : [];

  const rows = rowsSource.map((rawRow, index) => {
    const normalizedRow = {
      id: `${rawRow?.rowNo || index + 1}-${rawRow?.voterId || "row"}-${index}`,
    };

    columns.forEach((columnKey) => {
      normalizedRow[columnKey] = rawRow?.[columnKey] ?? "";
    });

    return normalizedRow;
  });

  return {
    columns,
    rows,
  };
}

function normalizeFailedPages(input) {
  if (!Array.isArray(input)) return [];

  return input.map((item, index) => ({
    id: `${item?.fileName || "file"}-${item?.pageNumber || "na"}-${index}`,
    fileName: String(item?.fileName || "Unknown file"),
    pageNumber:
      item?.pageNumber === null || item?.pageNumber === undefined
        ? null
        : Number(item.pageNumber),
    error: String(item?.error || "Unknown OCR error"),
  }));
}

function mapStartError(error) {
  const status = Number(error?.status || 0);
  if (status === 400) {
    return "Invalid request. Enter Part No and add at least one supported file.";
  }
  if (status === 404) {
    return "No voters could be extracted from these snippets.";
  }
  if (status === 413) {
    return "One or more files are too large. Reduce file size and try again.";
  }
  if (status >= 500) {
    return "Server failed to start OCR or PDF generation. Please retry.";
  }
  return error?.message || "Failed to start specific voter slip generation.";
}

function mapDownloadError(error) {
  const status = Number(error?.status || 0);
  if (status === 409) {
    return "Job is still processing. Please wait for completion.";
  }
  if (status === 404 || status === 410) {
    return "Download already consumed or expired. Start a new generation if needed.";
  }
  if (status >= 500) {
    return "Server failed while preparing download. Please retry.";
  }
  return error?.message || "Failed to download generated PDF.";
}

function triggerDownload(blob, fileName) {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName || "specific-voterslips.pdf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

function formatColumnLabel(key) {
  const text = String(key || "").trim();
  if (!text) return "";

  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCellValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

const statusBadgeClass = {
  idle: "bg-slate-700/60 text-slate-200 border-slate-500/60",
  queued: "bg-amber-900/50 text-amber-100 border-amber-700/60",
  processing: "bg-sky-900/50 text-sky-100 border-sky-700/60",
  completed: "bg-emerald-900/50 text-emerald-100 border-emerald-700/60",
  failed: "bg-rose-900/50 text-rose-100 border-rose-700/60",
  cancelled: "bg-rose-900/50 text-rose-100 border-rose-700/60",
};

const statusLabel = {
  idle: "Idle",
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default function SpecificVoterSlipPage() {
  return (
    <ProtectedRoute allowedRoles={["user", "admin"]}>
      <SpecificVoterSlipContent />
    </ProtectedRoute>
  );
}

function SpecificVoterSlipContent() {
  const [partNo, setPartNo] = useState("");
  const [files, setFiles] = useState([]);
  const [pasteHint, setPasteHint] = useState("");
  const [apiKey, setApiKey] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [ocrSummary, setOcrSummary] = useState(null);
  const [ocrTableColumns, setOcrTableColumns] = useState(
    DEFAULT_OCR_TABLE_COLUMNS,
  );
  const [ocrTableRows, setOcrTableRows] = useState([]);
  const [failedPages, setFailedPages] = useState([]);
  const [job, setJob] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadConsumed, setDownloadConsumed] = useState(false);

  const pollTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const filesRef = useRef([]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const appendFiles = useCallback((incomingFiles, source = "upload") => {
    const sourceList = Array.isArray(incomingFiles)
      ? incomingFiles
      : Array.from(incomingFiles || []);

    if (!sourceList.length) return;

    const valid = [];
    let rejectedCount = 0;

    sourceList.forEach((file) => {
      if (!isSupportedFile(file)) {
        rejectedCount += 1;
        return;
      }

      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      valid.push({
        id,
        file,
        previewUrl: isImageFile(file) ? URL.createObjectURL(file) : "",
      });
    });

    if (!valid.length && rejectedCount) {
      const message =
        "No supported files were added. Use PDF, PNG, JPG, or JPEG.";
      setSubmitError(message);
      toast.error(message);
      return;
    }

    setFiles((prev) => [...prev, ...valid]);
    setSubmitError(null);

    if (rejectedCount) {
      toast("Some files were skipped because they are not supported.", {
        icon: "⚠️",
      });
    }

    if (source === "paste") {
      setPasteHint(
        `${valid.length} image${valid.length > 1 ? "s" : ""} pasted and added.`,
      );
    } else {
      setPasteHint("");
    }
  }, []);

  const removeFile = useCallback((fileId) => {
    setFiles((prev) => {
      const removed = prev.find((entry) => entry.id === fileId);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((entry) => entry.id !== fileId);
    });
  }, []);

  const clearAllFiles = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((entry) => {
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      });
      return [];
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setPasteHint("");
  }, []);

  const pollJob = useCallback(
    async (jobIdInput) => {
      const jobId = String(jobIdInput || job?.id || "").trim();
      if (!jobId) return;

      try {
        const data = await userAPI.getMassVoterSlipJob(jobId);
        const payload = data?.data || data || {};
        const nextJob = normalizeJob(payload);
        if (!nextJob) return;

        setJob((prev) => ({
          ...(prev || {}),
          ...nextJob,
        }));

        if (["completed", "failed", "cancelled"].includes(nextJob.status)) {
          stopPolling();
        }
      } catch (error) {
        const message = error?.message || "Failed to refresh job status.";
        setSubmitError(message);
        stopPolling();
      }
    },
    [job?.id, stopPolling],
  );

  useEffect(() => {
    const onPaste = (event) => {
      if (isSubmitting) return;
      const pastedImages = makePastedFiles(event.clipboardData);
      if (!pastedImages.length) return;

      event.preventDefault();
      appendFiles(pastedImages, "paste");
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [appendFiles, isSubmitting]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      stopPolling();
      filesRef.current.forEach((entry) => {
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      });
    };
  }, [stopPolling]);

  useEffect(() => {
    const active = ["queued", "processing"].includes(job?.status);
    if (!job?.id || !active) {
      stopPolling();
      return;
    }

    pollJob(job.id);
    pollTimerRef.current = setInterval(() => {
      pollJob(job.id);
    }, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [job?.id, job?.status, pollJob, stopPolling]);

  const progressPercent =
    Number(job?.total || 0) > 0
      ? Math.min(
          100,
          Math.round(
            (Number(job.processed || 0) / Number(job.total || 1)) * 100,
          ),
        )
      : 0;

  const handleFileInputChange = (event) => {
    appendFiles(event.target.files, "upload");
    event.target.value = "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!String(partNo || "").trim()) {
      const message = "Enter Part No before starting generation.";
      setSubmitError(message);
      toast.error(message);
      return;
    }

    if (!files.length) {
      const message = "Add screenshot snippets or upload files first.";
      setSubmitError(message);
      toast.error(message);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setDownloadConsumed(false);
    setOcrSummary(null);
    setOcrTableRows([]);
    setOcrTableColumns(DEFAULT_OCR_TABLE_COLUMNS);
    setFailedPages([]);
    setJob(null);

    try {
      const response = await userAPI.startSpecificVoterSlipGeneration({
        partNo: String(partNo || "").trim(),
        files: files.map((entry) => entry.file),
        apiKey: apiKey.trim() || undefined,
      });

      const payload = response?.data || response || {};
      const nextSummary = normalizeOcrSummary(payload?.ocr);
      const nextTable = normalizeOcrTable(payload?.ocr);
      const nextFailedPages = normalizeFailedPages(payload?.failedPages);
      const nextJob = normalizeJob(payload?.job || payload);

      if (payload?.partNo !== undefined && payload?.partNo !== null) {
        setPartNo(String(payload.partNo));
      }

      setOcrSummary(nextSummary);
      setOcrTableColumns(nextTable.columns);
      setOcrTableRows(nextTable.rows);
      setFailedPages(nextFailedPages);
      setJob(nextJob);

      toast.success(
        payload?.message || "Specific voter slip generation started.",
      );
    } catch (error) {
      const mapped = mapStartError(error);
      setSubmitError(mapped);
      toast.error(mapped);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!job?.id || isDownloading || downloadConsumed) return;

    setIsDownloading(true);
    try {
      const res = await userAPI.downloadMassVoterSlipJob(job.id);
      triggerDownload(res.blob, res.fileName || "specific-voterslips.pdf");
      setDownloadConsumed(true);
      toast.success("PDF download started.");

      // Refresh once because endpoint is single-use and backend may clear downloadUrl.
      await pollJob(job.id);
    } catch (error) {
      const message = mapDownloadError(error);
      setSubmitError(message);

      if ([404, 410].includes(Number(error?.status || 0))) {
        setDownloadConsumed(true);
      }
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-slate-100">
          Specific Voter Slip
        </h1>
        <p className="text-slate-300 mt-1">
          Backup flow for missed voters that runs independently of uploaded
          sessions.
        </p>
      </div>

      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">
          Upload Snippets
        </h3>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="specificSlipPartNo">Part No</label>
            <input
              id="specificSlipPartNo"
              type="text"
              value={partNo}
              onChange={(event) => setPartNo(event.target.value)}
              placeholder="Enter Part No (e.g. 42)"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="specificSlipFileInput">Snippet Files</label>
            <input
              id="specificSlipFileInput"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileInputChange}
              disabled={isSubmitting}
              multiple
            />
          </div>

          <div className="rounded-xl border border-ink-400/50 bg-ink-900/40 p-4 space-y-2">
            <p className="text-sm text-slate-100 font-semibold">Paste Zone</p>
            <p className="text-sm text-slate-300">
              This flow is independent of uploaded sessions.
            </p>
            <p className="text-sm text-slate-300">
              Enter the Part No manually before generating slips.
            </p>
            <p className="text-sm text-slate-300">
              Paste multiple voter snippets from clipboard or upload files.
            </p>
            <p className="text-sm text-slate-300">
              Only OCRed voters from these snippets will be used.
            </p>
            <p className="text-xs text-slate-400">
              Keep this page open and press Ctrl+V/Cmd+V repeatedly to append
              pasted images.
            </p>
            {pasteHint && (
              <p className="text-xs text-emerald-300">{pasteHint}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="specificSlipApiKey">
              Gemini API Key (optional)
            </label>
            <input
              id="specificSlipApiKey"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              disabled={isSubmitting}
              placeholder="Use a custom key for this run"
            />
          </div>

          <div className="rounded-xl border border-ink-400/50 bg-ink-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="text-base font-semibold text-slate-100">
                Selected Snippets ({files.length})
              </h4>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearAllFiles}
                disabled={isSubmitting || !files.length}
              >
                Clear All
              </button>
            </div>

            {!files.length ? (
              <p className="text-sm text-slate-400">
                No snippets added yet. Paste screenshots or upload files.
              </p>
            ) : (
              <div className="space-y-2">
                {files.map((entry) => {
                  const isImage = Boolean(entry.previewUrl);
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-ink-500/60 bg-ink-100/30 p-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-16 h-16 rounded-lg border border-ink-500/60 overflow-hidden bg-ink-900/60 flex items-center justify-center flex-shrink-0">
                          {isImage ? (
                            <img
                              src={entry.previewUrl}
                              alt={entry.file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-slate-300 font-semibold">
                              PDF
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm text-slate-100 truncate">
                            {entry.file.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatBytes(entry.file.size)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => removeFile(entry.id)}
                        disabled={isSubmitting}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {submitError && (
            <div className="p-3 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700 text-sm">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              isSubmitting || !files.length || !String(partNo || "").trim()
            }
          >
            {isSubmitting
              ? "Starting generation..."
              : "Start Generating Voter Slips"}
          </button>
        </form>
      </div>

      {ocrSummary && (
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold text-slate-100">OCR Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-slate-200">
            <span>Files received: {ocrSummary.filesReceived}</span>
            <span>Files accepted: {ocrSummary.filesAccepted}</span>
            <span>Pages processed: {ocrSummary.pagesProcessed}</span>
            <span>Extracted voters: {ocrSummary.extractedCount}</span>
            <span>
              Accepted before dedupe: {ocrSummary.acceptedBeforeDedupeCount}
            </span>
            <span>Accepted count: {ocrSummary.acceptedCount}</span>
            <span>
              Skipped adjudication: {ocrSummary.skippedUnderAdjudicationCount}
            </span>
            <span>
              Duplicate rows skipped: {ocrSummary.duplicateRowsSkipped}
            </span>
            <span>Failed pages: {ocrSummary.failedPages}</span>
          </div>
        </div>
      )}

      {(ocrTableRows.length > 0 || ocrSummary) && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-slate-100">
              OCR Extracted Rows
            </h3>
            <span className="text-sm text-slate-300">
              Rows: {ocrTableRows.length}
            </span>
          </div>

          {ocrTableRows.length ? (
            <div className="overflow-x-auto border border-ink-500/50 rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-ink-900/70 text-slate-200">
                  <tr>
                    {ocrTableColumns.map((columnKey) => (
                      <th
                        key={`ocr-col-${columnKey}`}
                        className="px-3 py-2 text-left whitespace-nowrap font-semibold"
                      >
                        {formatColumnLabel(columnKey)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ocrTableRows.map((row, rowIndex) => (
                    <tr
                      key={row.id || `ocr-row-${rowIndex}`}
                      className="border-t border-ink-500/50 odd:bg-ink-100/25"
                    >
                      {ocrTableColumns.map((columnKey) => (
                        <td
                          key={`ocr-cell-${row.id || rowIndex}-${columnKey}`}
                          className="px-3 py-2 whitespace-nowrap text-slate-200"
                        >
                          {formatCellValue(row[columnKey])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No OCR rows returned yet.</p>
          )}
        </div>
      )}

      {failedPages.length > 0 && (
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold text-slate-100">Failed Pages</h3>
          <div className="space-y-2">
            {failedPages.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-rose-700 bg-rose-900/30 p-3 text-sm text-rose-100"
              >
                <p>
                  {item.fileName}
                  {item.pageNumber !== null ? ` • Page ${item.pageNumber}` : ""}
                </p>
                <p className="text-xs text-rose-200 mt-1">{item.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {job?.id && (
        <div className="card space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                Job Progress
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Part No: {partNo || "-"}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Job ID: {job.id}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${statusBadgeClass[job.status] || statusBadgeClass.idle}`}
            >
              {statusLabel[job.status] || "Idle"}
            </span>
          </div>

          <div>
            {job.total > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
                  <span>
                    {job.processed} / {job.total}
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-ink-700/80 overflow-hidden">
                  <div
                    className="h-full bg-neon-300 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-slate-300 mb-2">Processing...</div>
                <div className="h-2.5 rounded-full bg-ink-700/80 overflow-hidden">
                  <div className="h-full w-1/3 bg-neon-300 animate-pulse" />
                </div>
              </>
            )}
          </div>

          {job.error && (
            <div className="p-3 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700 text-sm">
              {job.error}
            </div>
          )}

          {job.status === "completed" && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownload}
                disabled={isDownloading || downloadConsumed || !job.downloadUrl}
              >
                {isDownloading
                  ? "Preparing download..."
                  : downloadConsumed
                    ? "Download Consumed"
                    : "Download PDF"}
              </button>

              {downloadConsumed ? (
                <span className="text-sm text-amber-300">
                  Download link is single-use and has already been consumed.
                </span>
              ) : !job.downloadUrl ? (
                <span className="text-sm text-amber-300">
                  Waiting for backend download URL refresh.
                </span>
              ) : (
                <span className="text-sm text-emerald-300">
                  Completed. Download is ready.
                </span>
              )}
            </div>
          )}

          {["failed", "cancelled"].includes(job.status) && (
            <div className="text-sm text-rose-300">
              Job ended with status {statusLabel[job.status] || job.status}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
