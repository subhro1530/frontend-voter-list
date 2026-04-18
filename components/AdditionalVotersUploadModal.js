import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { uploadAdditionalSessionVoters } from "../lib/api";
import { DISPATCH_MODES, normalizeDispatchMode } from "../lib/dispatchMode";

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

function toTextList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function inferSourceType(file) {
  const mime = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();

  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime.startsWith("image/") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg")
  ) {
    return "image";
  }

  return null;
}

function isSupportedFile(file) {
  const sourceType = inferSourceType(file);
  if (!sourceType) return false;

  const mime = String(file?.type || "").toLowerCase();
  if (!mime) return true;

  return SUPPORTED_MIME_TYPES.has(mime);
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

function getClipboardImageFile(clipboardData) {
  const items = Array.from(clipboardData?.items || []);

  for (const item of items) {
    const type = String(item?.type || "").toLowerCase();
    if (!type.startsWith("image/")) continue;

    const blob = item.getAsFile();
    if (!blob) continue;

    const extension =
      type.includes("jpeg") || type.includes("jpg") ? "jpg" : "png";
    const filename = `pasted-voter-page-${Date.now()}.${extension}`;

    return new File([blob], filename, {
      type: blob.type || (extension === "jpg" ? "image/jpeg" : "image/png"),
      lastModified: Date.now(),
    });
  }

  return null;
}

function normalizeResult(payload, httpStatus) {
  const summary = payload?.summary || {};
  const skippedPayload = payload?.skipped || {};

  const existing = toTextList(skippedPayload.existing);
  const duplicateInUpload = toTextList(skippedPayload.duplicateInUpload);
  const invalid = toTextList(skippedPayload.invalid);

  if (!existing.length && !duplicateInUpload.length && !invalid.length) {
    const fallbackSkipped = toTextList(payload?.skippedSerialNumbers);
    if (fallbackSkipped.length) {
      invalid.push(...fallbackSkipped);
    }
  }

  const isPartial = Number(httpStatus) === 207;

  return {
    status: isPartial ? "partial" : "completed",
    summary: {
      pagesProcessed: Number(summary.pagesProcessed || 0),
      extractedCount: Number(summary.extractedCount || 0),
      insertedCount: Number(summary.insertedCount || 0),
      skippedExistingCount: Number(summary.skippedExistingCount || 0),
      skippedDuplicateInUploadCount: Number(
        summary.skippedDuplicateInUploadCount || 0,
      ),
      skippedInvalidCount: Number(summary.skippedInvalidCount || 0),
    },
    skipped: {
      existing,
      duplicateInUpload,
      invalid,
    },
  };
}

function mapUploadError(error) {
  const status = Number(error?.status || 0);

  if (status === 400) {
    return "Invalid file type or OCR mode. Please upload PDF/PNG/JPG/JPEG and retry.";
  }

  if (status === 404) {
    return "Session not found. Refresh and try again.";
  }

  if (status === 409) {
    return "This session is currently processing another job. Please wait and retry.";
  }

  if (status === 413) {
    return "File is too large for upload. Try a smaller file.";
  }

  if (status === 429) {
    return "OCR key limit reached. Please switch key/mode or try again later.";
  }

  if (status === 500) {
    return "Additional voter processing failed on server. Please retry.";
  }

  return error?.message || "Failed to upload additional voters.";
}

export default function AdditionalVotersUploadModal({
  sessionId,
  sessionLabel,
  onClose,
  onSuccess,
}) {
  const [file, setFile] = useState(null);
  const [sourceType, setSourceType] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [dispatchMode, setDispatchMode] = useState("paid-only");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [pasteHint, setPasteHint] = useState("");
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);

  const previewUrl = useMemo(() => {
    if (!file || sourceType !== "image") return "";
    return URL.createObjectURL(file);
  }, [file, sourceType]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const setSelectedFile = (nextFile) => {
    if (!nextFile) {
      setFile(null);
      setSourceType(null);
      return;
    }

    if (!isSupportedFile(nextFile)) {
      const unsupportedMessage =
        "Unsupported file type. Please upload PDF, PNG, JPG, or JPEG.";
      setError(unsupportedMessage);
      toast.error(unsupportedMessage);
      return;
    }

    setFile(nextFile);
    setSourceType(inferSourceType(nextFile));
    setError("");
    setResult(null);
  };

  useEffect(() => {
    const onPasteWindow = (event) => {
      if (isUploading) return;

      const imageFile = getClipboardImageFile(event.clipboardData);
      if (imageFile) {
        event.preventDefault();
        setSelectedFile(imageFile);
        setPasteHint("Screenshot image pasted from clipboard.");
        return;
      }

      setPasteHint(
        "Clipboard has no image. Copy a screenshot and press Ctrl+V/Cmd+V again.",
      );
    };

    window.addEventListener("paste", onPasteWindow);
    return () => window.removeEventListener("paste", onPasteWindow);
  }, [isUploading]);

  const handleFileInputChange = (event) => {
    const picked = event.target.files?.[0] || null;
    setSelectedFile(picked);
    setPasteHint("");
  };

  const clearFileSelection = () => {
    setFile(null);
    setSourceType(null);
    setPasteHint("");
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const hasSkippedItems =
    Number(result?.summary?.skippedExistingCount || 0) > 0 ||
    Number(result?.summary?.skippedDuplicateInUploadCount || 0) > 0 ||
    Number(result?.summary?.skippedInvalidCount || 0) > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isUploading) return;

    if (!sessionId) {
      const message =
        "Session id is missing. Please close and reopen this dialog.";
      setError(message);
      toast.error(message);
      return;
    }

    if (!file) {
      const message = "Select a file or paste a screenshot image first.";
      setError(message);
      toast.error(message);
      return;
    }

    setIsUploading(true);
    setError("");
    setPasteHint("");
    setResult(null);

    try {
      const response = await uploadAdditionalSessionVoters(sessionId, file, {
        apiKey: apiKey.trim() || undefined,
        dispatchMode: normalizeDispatchMode(dispatchMode || "paid-only"),
      });

      const normalizedResult = normalizeResult(response, response?.httpStatus);
      setResult(normalizedResult);

      if (normalizedResult.status === "partial") {
        toast("Additional voters processed with partial results.", {
          icon: "⚠️",
        });
      } else {
        toast.success("Additional voters appended successfully.");
      }

      await onSuccess?.({
        response,
        result: normalizedResult,
      });
    } catch (uploadError) {
      const message = mapUploadError(uploadError);
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-ink-200 border border-ink-400 rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 text-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Upload Additional Voters</h3>
            <p className="text-xs text-slate-400 mt-1 break-all">
              Session: {sessionLabel || sessionId}
            </p>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 border border-ink-400 rounded-lg text-slate-300 hover:bg-ink-100"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </button>
        </div>

        <div className="rounded-lg border border-ink-400/50 bg-ink-100/30 p-3 text-sm text-slate-200">
          <ul className="list-disc pl-5 space-y-1">
            <li>Existing voters will not be modified.</li>
            <li>Duplicate SL No entries are skipped automatically.</li>
            <li>You can upload PDF or paste screenshot image.</li>
            <li>Recommended upload size: 1-2 voter pages.</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="additionalVotersFile" className="text-sm">
              File
            </label>
            <input
              id="additionalVotersFile"
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg"
              onChange={handleFileInputChange}
              disabled={isUploading}
            />
          </div>

          <div className="rounded-lg border border-ink-400/40 bg-ink-900/40 px-3 py-2">
            <p className="text-sm text-slate-200">
              Paste screenshot here with Ctrl+V / Cmd+V while this modal is
              open.
            </p>
            {pasteHint && (
              <p className="text-xs text-slate-300 mt-1">{pasteHint}</p>
            )}
          </div>

          {file && (
            <div className="rounded-lg border border-ink-400/50 bg-ink-900/40 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-ink-500 bg-ink-100/30 text-xs">
                  {sourceType === "pdf" ? "PDF" : "Image"} • {file.name} •{" "}
                  {formatBytes(file.size)}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={clearFileSelection}
                  disabled={isUploading}
                >
                  Remove File
                </button>
              </div>

              {sourceType === "image" && previewUrl && (
                <div className="w-full max-w-sm rounded-lg overflow-hidden border border-ink-500/50">
                  <img
                    src={previewUrl}
                    alt="Pasted or selected voter page preview"
                    className="w-full h-auto"
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="additionalVotersApiKey" className="text-sm">
                Gemini API Key (optional)
              </label>
              <input
                id="additionalVotersApiKey"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Use custom key for this upload"
                disabled={isUploading}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="additionalVotersDispatchMode" className="text-sm">
                OCR Processing Mode (optional)
              </label>
              <select
                id="additionalVotersDispatchMode"
                value={dispatchMode}
                onChange={(event) => setDispatchMode(event.target.value)}
                disabled={isUploading}
              >
                {DISPATCH_MODES.map((modeOption) => (
                  <option key={modeOption.value} value={modeOption.value}>
                    {modeOption.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isUploading || !file}
            >
              {isUploading ? "Uploading and appending..." : "Upload and Append"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </button>
          </div>
        </form>

        {isUploading && (
          <div className="p-3 bg-sky-900/30 border border-sky-700 rounded-lg text-sky-100 text-sm">
            Upload in progress. Please wait...
          </div>
        )}

        {result && (
          <div className="p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg text-emerald-100 space-y-3">
            <p className="font-semibold">
              {result.status === "partial"
                ? "Completed with partial results"
                : "Completed"}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs sm:text-sm">
              <span>Pages processed: {result.summary.pagesProcessed}</span>
              <span>Extracted: {result.summary.extractedCount}</span>
              <span>Inserted: {result.summary.insertedCount}</span>
              <span>
                Skipped existing: {result.summary.skippedExistingCount}
              </span>
              <span>
                Skipped duplicate in upload:{" "}
                {result.summary.skippedDuplicateInUploadCount}
              </span>
              <span>Skipped invalid: {result.summary.skippedInvalidCount}</span>
            </div>

            {hasSkippedItems && (
              <details className="rounded-md border border-emerald-700/40 bg-emerald-900/20 p-2 text-xs sm:text-sm">
                <summary className="cursor-pointer select-none">
                  Show skipped SL No lists
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <div className="font-semibold">Existing in session</div>
                    <p className="break-words">
                      {result.skipped.existing.length
                        ? result.skipped.existing.join(", ")
                        : "None"}
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold">Duplicate inside upload</div>
                    <p className="break-words">
                      {result.skipped.duplicateInUpload.length
                        ? result.skipped.duplicateInUpload.join(", ")
                        : "None"}
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold">
                      Invalid or missing SL No
                    </div>
                    <p className="break-words">
                      {result.skipped.invalid.length
                        ? result.skipped.invalid.join(", ")
                        : "None"}
                    </p>
                  </div>
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
