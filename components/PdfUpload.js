import { useState } from "react";
import { useRouter } from "next/router";

export default function PdfUpload({ onComplete }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress({ status: "uploading", message: "📤 Uploading PDF..." });

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);

      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setProgress({
          status: "completed",
          message: `✅ Processed ${
            data.pages || data.totalPages || "all"
          } pages successfully!`,
          data,
        });
        if (onComplete) onComplete(data);

        // Navigate to session after a short delay
        const sessionId = data.sessionId || data.session_id || data.id;
        if (sessionId) {
          setTimeout(() => {
            router.push(`/sessions/${sessionId}`);
          }, 1500);
        }
      } else if (res.status === 207) {
        // Partial completion
        setProgress({
          status: "partial",
          message: `⚠️ Processed ${data.processedPages}/${
            data.pages || data.totalPages
          } pages. Some pages pending.`,
          data,
        });
        if (onComplete) onComplete(data);
      } else {
        throw new Error(data.error || data.message || "Upload failed");
      }
    } catch (err) {
      setError(err.message);
      setProgress(null);
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setProgress(null);
    setError(null);
  };

  return (
    <div className="bg-ink-200 rounded-xl shadow-lg p-6 border border-ink-400">
      <h2 className="text-xl font-bold mb-4 text-slate-100 flex items-center gap-2">
        <span>📄</span> Upload Voter List PDF
      </h2>

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          uploading
            ? "border-neon-400/50 bg-neon-500/10"
            : "border-ink-400 hover:border-neon-400/50 hover:bg-ink-100/30"
        }`}
      >
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
          id="pdf-upload"
        />
        <label
          htmlFor="pdf-upload"
          className={`cursor-pointer block ${
            uploading ? "pointer-events-none" : ""
          }`}
        >
          <div className="text-5xl mb-3">{uploading ? "⏳" : "📤"}</div>
          <p className="text-slate-200 font-medium">
            {uploading
              ? "Processing with parallel engines..."
              : "Click to upload PDF"}
          </p>
          <p className="text-sm text-slate-400 mt-2">
            🚀 All 7 engines will process in parallel!
          </p>
        </label>
      </div>

      {progress && (
        <div
          className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
            progress.status === "completed"
              ? "bg-emerald-900/40 border border-emerald-600 text-emerald-100"
              : progress.status === "partial"
              ? "bg-amber-900/40 border border-amber-600 text-amber-100"
              : "bg-blue-900/40 border border-blue-600 text-blue-100"
          }`}
        >
          <span className="text-2xl">
            {progress.status === "completed"
              ? "✅"
              : progress.status === "partial"
              ? "⚠️"
              : "⏳"}
          </span>
          <div className="flex-1">
            <p className="font-medium">{progress.message}</p>
            {progress.data?.sessionId && (
              <p className="text-sm opacity-80 mt-1">
                Session ID:{" "}
                {progress.data.sessionId ||
                  progress.data.session_id ||
                  progress.data.id}
              </p>
            )}
          </div>
          {progress.status !== "uploading" && (
            <button
              onClick={resetUpload}
              className="text-sm px-3 py-1 rounded-lg bg-ink-200 hover:bg-ink-100 transition-colors"
            >
              Upload Another
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-rose-900/40 border border-rose-600 text-rose-100 rounded-lg flex items-center gap-3">
          <span className="text-2xl">❌</span>
          <div className="flex-1">
            <p className="font-medium">Upload Failed</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
          <button
            onClick={resetUpload}
            className="text-sm px-3 py-1 rounded-lg bg-ink-200 hover:bg-ink-100 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
