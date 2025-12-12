import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import VoterFilters from "./VoterFilters";
import VoterTable from "./VoterTable";
import { getSession, getSessionStatus, getSessionVoters } from "../lib/api";

const statusTone = (status) => {
  const key = (status || "").toLowerCase();
  if (key.includes("fail")) return "status-failed";
  if (key.includes("process")) return "status-processing";
  if (key.includes("complete")) return "status-completed";
  return "status-pending";
};

export default function SessionDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [session, setSession] = useState(null);
  const [voters, setVoters] = useState([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingVoters, setLoadingVoters] = useState(true);
  const [errorSession, setErrorSession] = useState("");
  const [errorVoters, setErrorVoters] = useState("");
  const pollRef = useRef(null);
  const voterController = useRef(null);
  const statusController = useRef(null);
  const [statusInfo, setStatusInfo] = useState(null);

  const fetchSession = (signal, { silent } = {}) => {
    if (!id) return;
    if (!silent) setLoadingSession(true);
    setErrorSession("");
    getSession(id, signal)
      .then((res) => {
        const data = res.session || res;
        setSession(data);
        if (data?.status && data.status.toLowerCase().includes("process")) {
          startPolling();
        } else if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      })
      .catch((err) => setErrorSession(err.message || "Failed to load session"))
      .finally(() => {
        if (!silent) setLoadingSession(false);
      });
  };

  const fetchStatus = (signal) => {
    if (!id) return;
    if (statusController.current) statusController.current.abort();
    const controller = signal ? { signal } : new AbortController();
    if (!signal) statusController.current = controller;
    getSessionStatus(id, controller.signal)
      .then((payload) => setStatusInfo(normalizeStatus(payload)))
      .catch((err) => {
        if (err.name === "AbortError") return;
        // keep silent for status errors
      });
  };

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      fetchSession(undefined, { silent: true });
      fetchStatus();
    }, 2500);
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal);
    fetchStatus(controller.signal);
    return () => {
      controller.abort();
      if (pollRef.current) clearInterval(pollRef.current);
      if (statusController.current) statusController.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchVoters = (filters) => {
    if (!id) return;
    if (voterController.current) voterController.current.abort();
    const controller = new AbortController();
    voterController.current = controller;
    setLoadingVoters(true);
    setErrorVoters("");
    getSessionVoters(id, filters, controller.signal)
      .then((res) => setVoters(res.voters || res))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setErrorVoters(err.message || "Failed to load voters");
      })
      .finally(() => setLoadingVoters(false));
  };

  const filterQuery = useMemo(() => {
    const q = { ...router.query };
    delete q.id;
    return q;
  }, [router.query]);

  useEffect(() => {
    fetchVoters(filterQuery);
    return () => {
      if (voterController.current) voterController.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, JSON.stringify(filterQuery)]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <Link href="/sessions" className="text-sm text-teal-700">
            ← Back to sessions
          </Link>
          <h1 className="text-2xl font-display font-semibold text-slate-900">
            Session {id}
          </h1>
          {session?.original_filename && (
            <div className="text-slate-700">{session.original_filename}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => {
              fetchSession();
              fetchStatus();
            }}
            disabled={loadingSession}
          >
            Refresh
          </button>
          {(session?.status || statusInfo?.statusText) && (
            <span
              className={`badge ${statusTone(
                statusInfo?.statusText || session?.status
              )}`}
            >
              {statusInfo?.statusText || session?.status}
            </span>
          )}
        </div>
      </div>

      {errorSession && (
        <div className="p-3 bg-rose-50 text-rose-800 rounded-lg border border-rose-200">
          {errorSession}
        </div>
      )}
      {loadingSession && (
        <div className="p-3 text-slate-600">Loading session…</div>
      )}

      {session && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card space-y-3 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-700">
              <div>
                <div className="text-slate-500 text-xs">Pages</div>
                <div className="font-semibold text-lg">
                  {session.page_count ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Voters</div>
                <div className="font-semibold text-lg">
                  {session.voter_count ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Created</div>
                <div className="font-semibold">
                  {session.created_at
                    ? new Date(session.created_at).toLocaleString()
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Updated</div>
                <div className="font-semibold">
                  {session.updated_at
                    ? new Date(session.updated_at).toLocaleString()
                    : "—"}
                </div>
              </div>
            </div>
            {session.pages?.length ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-800">
                  Pages
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-700">
                  {session.pages.map((p, idx) => (
                    <span
                      key={`${p.page || idx}`}
                      className="badge bg-sand-100 border-sand-200"
                    >
                      Page {p.page || idx + 1}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">
                No page details available.
              </div>
            )}
            {statusInfo && statusInfo.total > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Processing progress</span>
                  <span>
                    {statusInfo.processed} / {statusInfo.total} pages
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-sand-100 overflow-hidden">
                  <div
                    className="h-full bg-teal-500 transition-all duration-300"
                    style={{ width: `${statusInfo.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="card space-y-2">
              <div className="text-sm text-slate-600">API</div>
              <div className="flex flex-col gap-2">
                <span className="badge bg-teal-50 border-teal-200 text-teal-700">
                  GET /sessions/{id}
                </span>
                <span className="badge bg-teal-50 border-teal-200 text-teal-700">
                  GET /sessions/{id}/voters
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <VoterFilters disabled={loadingVoters} onChange={(q) => fetchVoters(q)} />
      <VoterTable voters={voters} loading={loadingVoters} error={errorVoters} />
    </div>
  );
}

function normalizeStatus(payload) {
  const statusText = payload?.status || payload?.state;
  const processed = payload?.processed_pages ?? payload?.processed ?? 0;
  const total =
    payload?.page_count ??
    payload?.total_pages ??
    payload?.pages ??
    payload?.total ??
    0;
  const percent = total
    ? Math.min(100, Math.round((processed / total) * 100))
    : 0;
  return { statusText, processed, total, percent };
}
