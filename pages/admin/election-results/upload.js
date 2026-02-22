import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { electionResultsAPI } from "../../../lib/api";
import toast from "react-hot-toast";

export default function ElectionResultUploadPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <ElectionResultUploadContent />
    </ProtectedRoute>
  );
}

function ElectionResultUploadContent() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const data = await electionResultsAPI.upload(file);
      setResult(data);
      toast.success("Election result processed successfully!");
    } catch (err) {
      const message = err.message || "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <Link
            href="/admin/election-results"
            className="inline-flex items-center gap-2 text-sm text-neon-200 hover:text-neon-100 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Election Results
          </Link>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            Upload Election Result PDF
          </h1>
        </div>
      </div>

      {/* Instructions Card */}
      <div className="card bg-blue-500/10 border-blue-400/30">
        <h3 className="text-sm font-semibold text-blue-200 mb-2 flex items-center gap-2">
          <span>📋</span> Instructions
        </h3>
        <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
          <li>
            Upload a <strong>Form 20 Final Result Sheet</strong> PDF
          </li>
          <li>
            The system will OCR each page and extract booth-wise candidate votes
          </li>
          <li>
            Processing may take a few minutes for large PDFs (~2 sec/page + OCR
            time)
          </li>
          <li>Maximum file size: 50 MB</li>
        </ul>
      </div>

      {/* Upload Area */}
      <div className="card">
        <div className="space-y-4">
          <div className="border-2 border-dashed border-ink-400/60 rounded-xl p-8 text-center hover:border-neon-400/50 transition-colors">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                setFile(e.target.files[0]);
                setError("");
                setResult(null);
              }}
              className="hidden"
              id="election-pdf-upload"
            />
            <label htmlFor="election-pdf-upload" className="cursor-pointer">
              <div className="text-4xl mb-3">📄</div>
              {file ? (
                <div>
                  <p className="text-slate-100 font-semibold">{file.name}</p>
                  <p className="text-sm text-slate-400 mt-1">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-slate-200 font-semibold">
                    Click to select a PDF file
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    or drag and drop here
                  </p>
                </div>
              )}
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn btn-primary w-full py-3 text-base"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                Processing… (this may take a few minutes)
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>📊</span> Upload & Process
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-rose-900/40 text-rose-100 rounded-lg border border-rose-700">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card border-emerald-500/40 bg-emerald-500/10">
          <h2 className="text-lg font-bold text-emerald-200 mb-4 flex items-center gap-2">
            <span>✅</span> Processing Complete
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-3 rounded-xl bg-ink-100/30 border border-ink-400/30">
              <span className="text-slate-400 text-xs">Constituency</span>
              <p className="font-semibold text-slate-100">
                {result.constituency || "—"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-ink-100/30 border border-ink-400/30">
              <span className="text-slate-400 text-xs">Total Electors</span>
              <p className="font-semibold text-slate-100">
                {result.totalElectors?.toLocaleString() || "—"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-ink-100/30 border border-ink-400/30">
              <span className="text-slate-400 text-xs">Candidates</span>
              <p className="font-semibold text-slate-100">
                {result.candidates?.join(", ") || "—"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-ink-100/30 border border-ink-400/30">
              <span className="text-slate-400 text-xs">Booths / Pages</span>
              <p className="font-semibold text-slate-100">
                {result.totalBooths || "—"} booths · {result.pages || "—"} pages
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() =>
                router.push(`/admin/election-results/${result.sessionId}`)
              }
              className="btn btn-primary"
            >
              View Details
            </button>
            <button
              onClick={() => router.push("/admin/election-results")}
              className="btn btn-secondary"
            >
              Back to List
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
