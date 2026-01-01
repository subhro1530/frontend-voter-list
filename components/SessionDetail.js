import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import VoterFilters from "./VoterFilters";
import VoterTable from "./VoterTable";
import {
  getSession,
  getSessionStatus,
  getSessionVoters,
  getReligionStats,
} from "../lib/api";

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
  const voterController = useRef(null);
  const statusController = useRef(null);
  const [statusInfo, setStatusInfo] = useState(null);
  const [religionStats, setReligionStats] = useState(null);
  const [currentFilters, setCurrentFilters] = useState({});

  const fetchSession = (signal, { silent } = {}) => {
    if (!id) return;
    if (!silent) setLoadingSession(true);
    setErrorSession("");
    getSession(id, signal)
      .then((res) => {
        const data = res.session || res;
        setSession(data);
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
      .then((payload) => {
        const normalized = normalizeStatus(payload);
        setStatusInfo(normalized);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        // keep silent for status errors
      });
  };

  const fetchReligionStats = (signal) => {
    if (!id) return;
    getReligionStats(id, signal)
      .then((data) => {
        setReligionStats(data);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        // Silent fail for religion stats
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal);
    fetchStatus(controller.signal);
    fetchReligionStats(controller.signal);
    return () => {
      controller.abort();
      if (statusController.current) statusController.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchVoters = useCallback(
    (filters) => {
      if (!id) return;
      if (voterController.current) voterController.current.abort();
      const controller = new AbortController();
      voterController.current = controller;
      setLoadingVoters(true);
      setErrorVoters("");
      setCurrentFilters(filters);
      getSessionVoters(id, filters, controller.signal)
        .then((res) => setVoters(res.voters || res))
        .catch((err) => {
          if (err.name === "AbortError") return;
          setErrorVoters(err.message || "Failed to load voters");
        })
        .finally(() => setLoadingVoters(false));
    },
    [id]
  );

  useEffect(() => {
    fetchVoters({});
    return () => {
      if (voterController.current) voterController.current.abort();
    };
  }, [fetchVoters]);

  return (
    <div className="space-y-4 text-slate-100">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <Link
            href="/sessions"
            className="text-sm text-neon-200 hover:text-neon-100"
          >
            ← Back to sessions
          </Link>
          <h1 className="text-2xl font-display font-semibold">Session {id}</h1>
          {session?.original_filename && (
            <div className="text-slate-200/80">{session.original_filename}</div>
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
        <div className="p-3 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700">
          {errorSession}
        </div>
      )}
      {loadingSession && (
        <div className="p-3 text-slate-200">Loading session…</div>
      )}

      {session && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card space-y-3 lg:col-span-2 bg-ink-900/70 border border-ink-400/40">
            <h3 className="text-lg font-semibold text-slate-100">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-200">
              <div>
                <div className="text-slate-400 text-xs">Pages</div>
                <div className="font-semibold text-lg">
                  {session.page_count ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Voters</div>
                <div className="font-semibold text-lg">
                  {session.voter_count ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Created</div>
                <div className="font-semibold">
                  {session.created_at
                    ? new Date(session.created_at).toLocaleString()
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Updated</div>
                <div className="font-semibold">
                  {session.updated_at
                    ? new Date(session.updated_at).toLocaleString()
                    : "—"}
                </div>
              </div>
            </div>
            {session.pages?.length ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-100">
                  Pages
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-200">
                  {session.pages.map((p, idx) => (
                    <span
                      key={`${p.page || idx}`}
                      className="badge bg-ink-700/60 border-ink-500/60"
                    >
                      Page {p.page || idx + 1}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-300">
                No page details available.
              </div>
            )}
            {statusInfo && statusInfo.total > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Processing progress</span>
                  <span>
                    {statusInfo.processed} / {statusInfo.total} pages
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-ink-800 overflow-hidden">
                  <div
                    className="h-full bg-neon-300 transition-all duration-300"
                    style={{ width: `${statusInfo.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="space-y-3" />
        </div>
      )}

      {/* Filtered Results Status */}
      {!loadingVoters && voters.length > 0 && (
        <FilteredStatus
          voterCount={voters.length}
          totalCount={session?.voter_count}
          filters={currentFilters}
          religionStats={religionStats}
        />
      )}

      <VoterFilters
        disabled={loadingVoters}
        onChange={fetchVoters}
        religionStats={religionStats}
        activeFilters={currentFilters}
      />
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

const RELIGION_ICONS = {
  Hindu: "🕉️",
  Muslim: "☪️",
  Christian: "✝️",
  Sikh: "🔯",
  Buddhist: "☸️",
  Jain: "🙏",
  Other: "🌐",
};

function FilteredStatus({ voterCount, totalCount, filters, religionStats }) {
  const activeFilters = Object.entries(filters || {}).filter(
    ([_, v]) => v !== "" && v !== undefined && v !== null
  );

  if (activeFilters.length === 0) return null;

  const religionFilter = filters?.religion;
  const religionStat = religionStats?.stats?.find(
    (s) => s.religion === religionFilter
  );

  return (
    <div className="filtered-status-bar">
      <div className="filtered-status-content">
        <div className="filtered-status-left">
          <span className="filtered-status-icon">🎯</span>
          <span className="filtered-status-text">
            Showing <strong>{voterCount?.toLocaleString()}</strong>
            {totalCount && (
              <>
                {" "}
                of <strong>{totalCount?.toLocaleString()}</strong>
              </>
            )}{" "}
            voters
          </span>
        </div>

        <div className="filtered-status-right">
          {activeFilters.map(([key, value]) => {
            const isReligion = key === "religion";
            const icon = isReligion ? RELIGION_ICONS[value] || "🌐" : null;
            return (
              <span
                key={key}
                className={`filter-tag ${
                  isReligion ? "filter-tag-religion" : ""
                }`}
              >
                {icon && <span className="filter-tag-icon">{icon}</span>}
                <span className="filter-tag-key">{key}:</span>
                <span className="filter-tag-value">{value}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Religion specific stats in filter bar */}
      {religionStat && (
        <div className="religion-filter-detail">
          <span className="text-2xl">{RELIGION_ICONS[religionFilter]}</span>
          <div className="religion-filter-info">
            <span className="religion-filter-name">{religionFilter}</span>
            <span className="religion-filter-stats">
              {religionStat.count?.toLocaleString() ?? 0} voters •{" "}
              {Number(religionStat.percentage || 0).toFixed(1)}% of total
            </span>
          </div>
          <div className="religion-filter-bar-container">
            <div
              className="religion-filter-bar-fill"
              style={{ width: `${religionStat.percentage || 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
