import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import ProtectedRoute from "../../components/ProtectedRoute";
import { affidavitAPI } from "../../lib/api";
import toast from "react-hot-toast";

export default function AffidavitScanner() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeUpload, setActiveUpload] = useState(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await affidavitAPI.getSessions();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Poll active upload progress
  useEffect(() => {
    if (!activeUpload?.sessionId || activeUpload.status !== "processing")
      return;
    const interval = setInterval(async () => {
      try {
        const data = await affidavitAPI.getSessionStatus(
          activeUpload.sessionId,
        );
        setActiveUpload((prev) => ({ ...prev, ...data }));
        if (data.status !== "processing") {
          clearInterval(interval);
          fetchSessions();
        }
      } catch {
        // continue polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeUpload?.sessionId, activeUpload?.status, fetchSessions]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const data = await affidavitAPI.upload(file);
      setActiveUpload({
        sessionId: data.sessionId,
        totalPages: data.totalPages,
        processedPages: 0,
        status: "processing",
      });
      setFile(null);
      toast.success("Affidavit uploaded! Processing started...");
    } catch (err) {
      setError(err.message || "Upload failed");
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this affidavit session?")) return;
    try {
      await affidavitAPI.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Session deleted");
    } catch (err) {
      toast.error(err.message || "Delete failed");
    }
  };

  const handleStop = async (id) => {
    try {
      await affidavitAPI.stopSession(id);
      setActiveUpload(null);
      fetchSessions();
      toast.success("Processing stopped");
    } catch (err) {
      toast.error(err.message || "Stop failed");
    }
  };

  const handleExportDocx = async (id, candidateName) => {
    try {
      await affidavitAPI.exportDocx(id, candidateName);
      toast.success("DOCX downloaded!");
    } catch (err) {
      toast.error("Export failed: " + (err.message || "Unknown error"));
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.candidate_name || "").toLowerCase().includes(q) ||
      (s.party || "").toLowerCase().includes(q) ||
      (s.constituency || "").toLowerCase().includes(q) ||
      (s.original_filename || "").toLowerCase().includes(q)
    );
  });

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-50 flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-2xl border border-emerald-400/50 shadow-card">
              📋
            </span>
            Affidavit Scanner
          </h1>
          <p className="text-slate-400 mt-2 ml-14">
            Upload nomination papers &amp; affidavits. AI extracts all data and
            exports to Word.
          </p>
        </motion.div>

        {/* Upload Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <h2 className="text-lg font-semibold text-slate-100 mb-4">
            Upload Affidavit PDF
          </h2>

          <div className="flex flex-col sm:flex-row gap-4">
            <label
              className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200
                ${
                  file
                    ? "border-emerald-400/50 bg-emerald-500/10"
                    : "border-ink-400 hover:border-neon-400/50 hover:bg-ink-100/50"
                }`}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
              />
              {file ? (
                <>
                  <span className="text-3xl mb-2">✅</span>
                  <span className="text-emerald-300 font-medium">
                    {file.name}
                  </span>
                  <span className="text-sm text-emerald-400/50 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </>
              ) : (
                <>
                  <span className="text-4xl mb-3 opacity-50">📄</span>
                  <span className="text-slate-400 text-sm">
                    Drop PDF here or click to browse
                  </span>
                </>
              )}
            </label>

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className={`px-8 py-4 rounded-xl font-semibold transition-all duration-200 self-end sm:self-center
                ${
                  file && !uploading
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-card hover:scale-105"
                    : "bg-ink-200 text-slate-500 cursor-not-allowed border border-ink-400"
                }`}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                "🔬 Scan & Extract"
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-rose-900/30 border border-rose-700/50 text-rose-200 text-sm">
              {error}
            </div>
          )}
        </motion.div>

        {/* Active processing card */}
        <AnimatePresence>
          {activeUpload && activeUpload.status === "processing" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="card bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-blue-700/40"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-100 font-semibold flex items-center gap-2">
                  <svg
                    className="animate-spin w-5 h-5 text-blue-400"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Processing Affidavit...
                </h3>
                <button
                  onClick={() => handleStop(activeUpload.sessionId)}
                  className="px-4 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-sm transition-colors border border-rose-700/40"
                >
                  ⏹ Stop
                </button>
              </div>

              <div className="w-full bg-ink-100 rounded-full h-3 mb-2 border border-ink-400">
                <div
                  className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${activeUpload.totalPages ? (activeUpload.processedPages / activeUpload.totalPages) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-sm text-slate-400">
                <span>
                  Page {activeUpload.processedPages || 0} of{" "}
                  {activeUpload.totalPages || "?"}
                </span>
                <span>{activeUpload.fieldCount || 0} fields extracted</span>
              </div>
              {activeUpload.candidateName && (
                <div className="mt-2 text-sm text-emerald-300">
                  Candidate detected:{" "}
                  <strong>{activeUpload.candidateName}</strong>
                  {activeUpload.party && ` (${activeUpload.party})`}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by candidate, party, constituency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3"
            />
          </div>
          <button
            onClick={fetchSessions}
            className="btn btn-secondary px-4 py-3"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Sessions Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-neon-400 border-t-transparent mx-auto mb-4"></div>
            Loading sessions...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-5xl opacity-30 block mb-4">📋</span>
            <p className="text-slate-400">
              No affidavit sessions yet. Upload one above!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group card hover:border-ink-300 transition-all duration-300"
              >
                {/* Status badge */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`badge ${
                      session.status === "completed"
                        ? "status-completed"
                        : session.status === "processing"
                          ? "status-processing"
                          : session.status === "failed"
                            ? "status-failed"
                            : "status-paused"
                    }`}
                  >
                    {session.status === "processing" && "⏳ "}
                    {session.status === "completed" && "✅ "}
                    {session.status === "failed" && "❌ "}
                    {session.status === "paused" && "⏸ "}
                    {session.status}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(session.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Candidate info */}
                <h3 className="text-slate-100 font-semibold mb-1 truncate">
                  {session.candidate_name ||
                    session.original_filename ||
                    "Untitled"}
                </h3>
                {session.party && (
                  <p className="text-sm text-slate-400 mb-1 truncate">
                    🏛 {session.party}
                  </p>
                )}
                {session.constituency && (
                  <p className="text-sm text-slate-500 mb-3 truncate">
                    📍 {session.constituency}
                  </p>
                )}

                {/* Metrics */}
                <div className="flex gap-3 mb-4 text-xs text-slate-500">
                  <span>📄 {session.total_pages} pages</span>
                  <span>📝 {session.field_count || 0} fields</span>
                  <span>📊 {session.table_count || 0} tables</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/affidavits/${session.id}`}
                    className="flex-1 text-center px-3 py-2 rounded-lg bg-neon-500/10 text-neon-200 hover:bg-neon-500/20 text-sm font-medium transition-colors border border-neon-400/30"
                  >
                    View Details
                  </Link>
                  {session.status === "completed" && (
                    <button
                      onClick={() =>
                        handleExportDocx(session.id, session.candidate_name)
                      }
                      className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-sm font-medium transition-colors border border-emerald-400/30"
                      title="Export DOCX"
                    >
                      📥 DOCX
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(session.id)}
                    className="px-3 py-2 rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-sm transition-colors border border-rose-400/30"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
