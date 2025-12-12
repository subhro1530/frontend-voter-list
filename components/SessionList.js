import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteSession, getSessions, getSessionStatus } from "../lib/api";

const statusTone = (status) => {
  const key = (status || "").toLowerCase();
  if (key.includes("fail")) return "status-failed";
  if (key.includes("process")) return "status-processing";
  if (key.includes("complete")) return "status-completed";
  return "status-pending";
};

export default function SessionList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState("");
  const [progressMap, setProgressMap] = useState({});

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
          (s?.status || "").toLowerCase().includes("process")
        );
        if (processing.length) {
          Promise.all(
            processing.map((s) =>
              getSessionStatus(s.id)
                .then((payload) => ({ id: s.id, payload }))
                .catch(() => null)
            )
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

  const handleDelete = async (id) => {
    const session = sessions.find((s) => s.id === id);
    if (!window.confirm(`Delete session ${session?.original_filename || id}?`))
      return;
    setDeleting(id);
    const prev = sessions;
    setSessions((list) => list.filter((s) => s.id !== id));
    try {
      await deleteSession(id);
    } catch (err) {
      setError(err.message || "Delete failed");
      setSessions(prev);
    } finally {
      setDeleting("");
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
        {sessions.map((s) => (
          <div key={s.id} className="card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="text-lg font-semibold text-slate-100 break-all">
                  {s.original_filename || "Untitled PDF"}
                </div>
                <div className="text-xs text-slate-400">ID: {s.id}</div>
              </div>
              <span className={`badge ${statusTone(s.status)}`}>
                {s.status || "pending"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
              <div>
                Pages:{" "}
                <span className="font-semibold">{s.page_count ?? "—"}</span>
              </div>
              <div>
                Voters:{" "}
                <span className="font-semibold">{s.voter_count ?? "—"}</span>
              </div>
              <div>
                Created:{" "}
                <span className="font-semibold">
                  {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}
                </span>
              </div>
              <div>
                Updated:{" "}
                <span className="font-semibold">
                  {s.updated_at ? new Date(s.updated_at).toLocaleString() : "—"}
                </span>
              </div>
            </div>
            {progressMap[s.id] && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Processing</span>
                  <span>
                    {progressMap[s.id].processed} / {progressMap[s.id].total}{" "}
                    pages
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-sand-300 overflow-hidden">
                  <div
                    className="h-full bg-teal-300 transition-all duration-300"
                    style={{ width: `${progressMap[s.id].percent}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Link className="btn btn-primary" href={`/sessions/${s.id}`}>
                View
              </Link>
              <button
                className="btn btn-secondary"
                onClick={() => handleDelete(s.id)}
                disabled={deleting === s.id}
              >
                {deleting === s.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ))}
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
