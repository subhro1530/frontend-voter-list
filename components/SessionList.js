import { useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteSession,
  getSessions,
  getSessionStatus,
  stopSession,
  resumeSession,
  renameSession,
} from "../lib/api";

const statusTone = (status) => {
  const key = (status || "").toLowerCase();
  if (key.includes("fail")) return "status-failed";
  if (key.includes("paused") || key.includes("stopped")) return "status-paused";
  if (key.includes("process")) return "status-processing";
  if (key.includes("complete")) return "status-completed";
  return "status-pending";
};

const statusIcon = (status) => {
  const key = (status || "").toLowerCase();
  if (key.includes("fail")) return "❌";
  if (key.includes("paused") || key.includes("stopped")) return "⏸️";
  if (key.includes("process")) return "⏳";
  if (key.includes("complete")) return "✅";
  return "📋";
};

export default function SessionList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [progressMap, setProgressMap] = useState({});
  const [renameModal, setRenameModal] = useState(null);

  const load = () => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getSessions(controller.signal)
      .then((res) => {
        const list = Array.isArray(res?.sessions)
          ? res.sessions
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : null;

        if (!Array.isArray(list)) {
          setSessions([]);
          setError("Unexpected sessions response. Please check the API.");
          return;
        }

        setSessions(list);
        const processing = list.filter((s) =>
          (s?.status || "").toLowerCase().includes("process"),
        );
        if (processing.length) {
          Promise.all(
            processing.map((s) =>
              getSessionStatus(s.id)
                .then((payload) => ({ id: s.id, payload }))
                .catch(() => null),
            ),
          ).then((results) => {
            const next = {};
            results.filter(Boolean).forEach(({ id, payload }) => {
              next[id] = normalizeProgress(payload);
            });
            setProgressMap((prev) => ({ ...prev, ...next }));
          });
        }
      })
      .catch((err) => setError(err.message || "Failed to load sessions"))
      .finally(() => setLoading(false));
    return () => controller.abort();
  };

  useEffect(load, []);

  // Auto-refresh every 5 seconds for processing sessions
  useEffect(() => {
    const hasProcessing = sessions.some((s) =>
      (s?.status || "").toLowerCase().includes("process"),
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      load();
    }, 5000);

    return () => clearInterval(interval);
  }, [sessions]);

  const handleDelete = async (id) => {
    const session = sessions.find((s) => s.id === id);
    if (!window.confirm(`Delete session ${session?.original_filename || id}?`))
      return;
    setActionLoading(id);
    const prev = sessions;
    setSessions((list) => list.filter((s) => s.id !== id));
    try {
      await deleteSession(id);
    } catch (err) {
      setError(err.message || "Delete failed");
      setSessions(prev);
    } finally {
      setActionLoading("");
    }
  };

  const handleStop = async (id) => {
    setActionLoading(id);
    try {
      await stopSession(id);
      load();
    } catch (err) {
      setError(err.message || "Failed to stop session");
    } finally {
      setActionLoading("");
    }
  };

  const handleResume = async (id) => {
    setActionLoading(id);
    try {
      await resumeSession(id);
      load();
    } catch (err) {
      setError(err.message || "Failed to resume session");
    } finally {
      setActionLoading("");
    }
  };

  const handleRename = async (id, newName) => {
    try {
      await renameSession(id, newName);
      setRenameModal(null);
      load();
    } catch (err) {
      setError(err.message || "Failed to rename session");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Sessions</h2>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      {error && (
        <div className="p-3 bg-rose-900/40 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      )}
      {loading && <div className="p-3 text-slate-300">Loading sessions…</div>}
      {!loading && sessions.length === 0 && !error && (
        <div className="p-3 text-slate-400">No sessions yet.</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sessions.map((s) => {
          const status = (s.status || "").toLowerCase();
          const isProcessing = status.includes("process");
          const isPaused =
            status.includes("paused") || status.includes("stopped");
          const isFailed = status.includes("fail");
          const canStop = isProcessing;
          const canResume = isPaused || isFailed;

          return (
            <div key={s.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold text-slate-100 break-all">
                      {s.original_filename || "Untitled PDF"}
                    </div>
                    <button
                      onClick={() => setRenameModal(s)}
                      className="text-slate-400 hover:text-neon-400 transition-colors"
                      title="Rename session"
                    >
                      ✏️
                    </button>
                  </div>
                  <div className="text-xs text-slate-400">ID: {s.id}</div>
                </div>
                <span className={`badge ${statusTone(s.status)}`}>
                  {statusIcon(s.status)} {s.status || "pending"}
                </span>
              </div>
              {s.booth_name && (
                <p className="text-sm text-slate-400">
                  🏢 Booth:{" "}
                  <span className="text-slate-200">{s.booth_name}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                <div>
                  Pages:{" "}
                  <span className="font-semibold">
                    {s.page_count ?? s.pageCount ?? s.total_pages ?? "—"}
                  </span>
                </div>
                <div>
                  Voters:{" "}
                  <span className="font-semibold">
                    {s.voter_count ?? s.voterCount ?? "—"}
                  </span>
                </div>
                <div>
                  Created:{" "}
                  <span className="font-semibold">
                    {s.created_at
                      ? new Date(s.created_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
                <div>
                  Updated:{" "}
                  <span className="font-semibold">
                    {s.updated_at
                      ? new Date(s.updated_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
              </div>
              {(progressMap[s.id] || isProcessing) && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>
                      {isProcessing ? "⏳ Processing..." : "Progress"}
                    </span>
                    <span>
                      {progressMap[s.id]?.processed ?? s.processed_pages ?? 0} /{" "}
                      {progressMap[s.id]?.total ??
                        s.page_count ??
                        s.total_pages ??
                        0}{" "}
                      pages
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-ink-400/50 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isProcessing
                          ? "bg-neon-400 animate-pulse"
                          : "bg-teal-400"
                      }`}
                      style={{ width: `${progressMap[s.id]?.percent ?? 0}%` }}
                    />
                  </div>
                  {isProcessing && (
                    <p className="text-xs text-slate-400">
                      ⏰ ~
                      {((progressMap[s.id]?.total ?? s.page_count ?? 0) -
                        (progressMap[s.id]?.processed ??
                          s.processed_pages ??
                          0)) *
                        30}
                      s remaining (sequential processing)
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link className="btn btn-primary" href={`/sessions/${s.id}`}>
                  View
                </Link>

                {/* Stop button - only for processing sessions */}
                {canStop && (
                  <button
                    className="btn bg-amber-600 hover:bg-amber-500 text-white"
                    onClick={() => handleStop(s.id)}
                    disabled={actionLoading === s.id}
                  >
                    {actionLoading === s.id ? "Stopping…" : "🛑 Stop"}
                  </button>
                )}

                {/* Resume button - for paused/failed sessions */}
                {canResume && (
                  <button
                    className="btn bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={() => handleResume(s.id)}
                    disabled={actionLoading === s.id}
                  >
                    {actionLoading === s.id ? "Resuming…" : "▶️ Resume"}
                  </button>
                )}

                <button
                  className="btn btn-secondary"
                  onClick={() => handleDelete(s.id)}
                  disabled={actionLoading === s.id}
                >
                  {actionLoading === s.id ? "Deleting…" : "🗑️ Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
  const [name, setName] = useState(session.original_filename || "");
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
          ✏️ Rename Session
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

function normalizeProgress(payload) {
  const processed = payload?.processed_pages ?? payload?.processed ?? 0;
  const total =
    payload?.page_count ?? payload?.total_pages ?? payload?.pages ?? 0;
  const percent = total
    ? Math.min(100, Math.round((processed / total) * 100))
    : 0;
  return { processed, total, percent };
}
