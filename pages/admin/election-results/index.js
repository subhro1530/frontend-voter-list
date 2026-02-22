import { useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { electionResultsAPI } from "../../../lib/api";
import toast from "react-hot-toast";

export default function ElectionResultListPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <ElectionResultListContent />
    </ProtectedRoute>
  );
}

function ElectionResultListContent() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [renameModal, setRenameModal] = useState(null);

  const loadSessions = () => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    electionResultsAPI
      .getSessions(controller.signal)
      .then((data) => {
        setSessions(data.sessions || []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load election result sessions");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  };

  useEffect(loadSessions, []);

  const handleDelete = async (id) => {
    const session = sessions.find((s) => s.id === id);
    if (
      !window.confirm(
        `Delete election result "${session?.constituency || session?.original_filename || id}"?`,
      )
    )
      return;
    setActionLoading(id);
    try {
      await electionResultsAPI.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Election result session deleted");
    } catch (err) {
      toast.error(err.message || "Delete failed");
    } finally {
      setActionLoading("");
    }
  };

  const handleExport = async (id) => {
    try {
      toast.loading("Downloading Excel...", { id: "excel-download" });
      await electionResultsAPI.exportExcel(id);
      toast.success("Excel downloaded!", { id: "excel-download" });
    } catch (err) {
      toast.error(err.message || "Export failed", { id: "excel-download" });
    }
  };

  const handleRename = async (id, newName) => {
    try {
      await electionResultsAPI.renameSession(id, newName);
      setRenameModal(null);
      toast.success("Session renamed");
      loadSessions();
    } catch (err) {
      toast.error(err.message || "Rename failed");
    }
  };

  const statusTone = (status) => {
    const key = (status || "").toLowerCase();
    if (key.includes("fail")) return "status-failed";
    if (key.includes("process")) return "status-processing";
    if (key.includes("complete")) return "status-completed";
    return "status-pending";
  };

  const statusIcon = (status) => {
    const key = (status || "").toLowerCase();
    if (key.includes("fail")) return "❌";
    if (key.includes("process")) return "⏳";
    if (key.includes("complete")) return "✅";
    return "📋";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            📊 Election Results
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage Form 20 election result sessions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={loadSessions}
            disabled={loading}
          >
            Refresh
          </button>
          <Link
            href="/admin/election-results/upload"
            className="btn btn-primary"
          >
            + Upload New
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-rose-900/40 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-neon-400 border-t-transparent"></div>
            <p className="text-slate-300">
              Loading election result sessions...
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && sessions.length === 0 && !error && (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            No election results yet
          </h3>
          <p className="text-slate-400 mb-6">
            Upload a Form 20 election result PDF to get started.
          </p>
          <Link
            href="/admin/election-results/upload"
            className="btn btn-primary inline-flex"
          >
            Upload Election Result
          </Link>
        </div>
      )}

      {/* Sessions Grid */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((s) => (
            <div key={s.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-100 break-all">
                      {s.constituency || s.original_filename || "Untitled"}
                    </h2>
                    <button
                      onClick={() => setRenameModal(s)}
                      className="text-slate-400 hover:text-neon-400 transition-colors flex-shrink-0"
                      title="Rename session"
                    >
                      ✏️
                    </button>
                  </div>
                  {s.original_filename && s.constituency && (
                    <p className="text-xs text-slate-500">
                      {s.original_filename}
                    </p>
                  )}
                </div>
                <span className={`badge ${statusTone(s.status)}`}>
                  {statusIcon(s.status)} {s.status || "pending"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                <div>
                  Booths:{" "}
                  <span className="font-semibold">{s.booth_count || "—"}</span>
                </div>
                <div>
                  Candidates:{" "}
                  <span className="font-semibold">
                    {s.candidate_count || "—"}
                  </span>
                </div>
                <div>
                  Electors:{" "}
                  <span className="font-semibold">
                    {s.total_electors?.toLocaleString() || "—"}
                  </span>
                </div>
                <div>
                  Pages:{" "}
                  <span className="font-semibold">
                    {s.processed_pages ?? "—"}/{s.total_pages ?? "—"}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                Created:{" "}
                {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/election-results/${s.id}`}
                  className="btn btn-primary text-xs py-1.5 px-3"
                >
                  👁️ View
                </Link>
                <Link
                  href={`/admin/election-results/stats/${s.id}`}
                  className="btn btn-secondary text-xs py-1.5 px-3"
                >
                  📈 Stats
                </Link>
                <button
                  onClick={() => handleExport(s.id)}
                  className="btn bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-1.5 px-3"
                  disabled={actionLoading === s.id}
                >
                  📥 Excel
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="btn btn-secondary text-xs py-1.5 px-3"
                  disabled={actionLoading === s.id}
                >
                  {actionLoading === s.id ? "Deleting…" : "🗑️ Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <RenameModal
          session={renameModal}
          onClose={() => setRenameModal(null)}
          onRename={handleRename}
        />
      )}
    </div>
  );
}

function RenameModal({ session, onClose, onRename }) {
  const [name, setName] = useState(
    session.constituency || session.original_filename || "",
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onRename(session.id, name.trim());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-ink-200 border border-ink-400 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-slate-100 mb-4">
          ✏️ Rename Election Result Session
        </h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-ink-100 border border-ink-400 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-400"
            placeholder="Enter new name"
            autoFocus
          />
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-ink-400 rounded-lg text-slate-300 hover:bg-ink-100 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-neon-500 text-white rounded-lg hover:bg-neon-400 transition-colors disabled:opacity-50"
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
