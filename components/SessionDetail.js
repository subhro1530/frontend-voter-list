import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import VoterFilters from "./VoterFilters";
import VoterTable from "./VoterTable";
import ApiEngineStatus from "./ApiEngineStatus";
import {
  getSession,
  getSessionStatus,
  getSessionVoters,
  getReligionStats,
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

function getBoothValue(voter) {
  return (
    voter?.part_number ??
    voter?.partNumber ??
    voter?.booth_no ??
    voter?.boothNo ??
    voter?.booth_number ??
    voter?.boothNumber ??
    ""
  );
}

function getSerialValue(voter) {
  return (
    voter?.serial_number ??
    voter?.serialNumber ??
    voter?.sno ??
    voter?.sl_no ??
    voter?.slNo ??
    ""
  );
}

function extractLeadingNumber(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^\d+/);
  return match ? Number(match[0]) : null;
}

function compareNumericLike(a, b) {
  const aNum = Number(a);
  const bNum = Number(b);
  const aIsNum = Number.isFinite(aNum);
  const bIsNum = Number.isFinite(bNum);
  if (aIsNum && bIsNum) return aNum - bNum;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortVotersBySerial(voterList = []) {
  return [...voterList].sort((a, b) => {
    const bySerial = compareNumericLike(getSerialValue(a), getSerialValue(b));
    if (bySerial !== 0) return bySerial;

    const boothA = getBoothValue(a);
    const boothB = getBoothValue(b);
    const boothANum = extractLeadingNumber(boothA);
    const boothBNum = extractLeadingNumber(boothB);

    const bothBoothsHaveLeadingNumber =
      boothANum !== null && boothBNum !== null;
    const byBooth = bothBoothsHaveLeadingNumber
      ? boothANum - boothBNum
      : compareNumericLike(boothA, boothB);
    if (byBooth !== 0) return byBooth;

    return String(a?.name || "").localeCompare(
      String(b?.name || ""),
      undefined,
      {
        sensitivity: "base",
      },
    );
  });
}

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
  const [actionLoading, setActionLoading] = useState("");
  const [renameModal, setRenameModal] = useState(false);

  const fetchSession = (signal, { silent } = {}) => {
    if (!id) return;
    if (!silent) setLoadingSession(true);
    setErrorSession("");
    getSession(id, signal)
      .then((res) => {
        const data = res.session || res;
        // Normalize field names from different backend versions
        const normalizedSession = {
          ...data,
          page_count:
            data.page_count ??
            data.pageCount ??
            data.pages?.length ??
            data.totalPages ??
            null,
          voter_count:
            data.voter_count ??
            data.voterCount ??
            data.totalVoters ??
            data.voters?.length ??
            null,
          status: data.status ?? data.state ?? null,
          created_at: data.created_at ?? data.createdAt ?? null,
          updated_at: data.updated_at ?? data.updatedAt ?? null,
          original_filename:
            data.original_filename ??
            data.originalFilename ??
            data.filename ??
            null,
        };
        setSession(normalizedSession);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setErrorSession(err.message || "Failed to load session");
      })
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

  // Auto-polling for live status updates (every 5 seconds)
  useEffect(() => {
    if (!id) return;

    // Only poll if session is still processing
    const shouldPoll = () => {
      const status = (
        statusInfo?.statusText ||
        session?.status ||
        ""
      ).toLowerCase();
      return (
        status.includes("process") ||
        status.includes("pending") ||
        status.includes("upload")
      );
    };

    if (!shouldPoll()) return;

    const pollInterval = setInterval(() => {
      const controller = new AbortController();

      // Silent fetch - no loading spinners
      fetchSession(controller.signal, { silent: true });
      fetchStatus(controller.signal);

      // Also refresh voters silently if filters are empty
      if (Object.keys(currentFilters).length === 0) {
        getSessionVoters(id, {}, controller.signal)
          .then((res) => setVoters(sortVotersBySerial(res.voters || res)))
          .catch(() => {}); // Silent fail
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [id, statusInfo?.statusText, session?.status, currentFilters]);

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
        .then((res) => setVoters(sortVotersBySerial(res.voters || res)))
        .catch((err) => {
          if (err.name === "AbortError") return;
          setErrorVoters(err.message || "Failed to load voters");
        })
        .finally(() => setLoadingVoters(false));
    },
    [id],
  );

  useEffect(() => {
    fetchVoters({});
    return () => {
      if (voterController.current) voterController.current.abort();
    };
  }, [fetchVoters]);

  const handleStop = async () => {
    setActionLoading("stop");
    try {
      await stopSession(id);
      fetchSession();
      fetchStatus();
    } catch (err) {
      setErrorSession(err.message || "Failed to stop session");
    } finally {
      setActionLoading("");
    }
  };

  const handleResume = async () => {
    setActionLoading("resume");
    try {
      await resumeSession(id);
      fetchSession();
      fetchStatus();
    } catch (err) {
      setErrorSession(err.message || "Failed to resume session");
    } finally {
      setActionLoading("");
    }
  };

  const handleRename = async (newName) => {
    try {
      await renameSession(id, newName);
      setRenameModal(false);
      fetchSession();
    } catch (err) {
      setErrorSession(err.message || "Failed to rename session");
    }
  };

  const currentStatus = (
    statusInfo?.statusText ||
    session?.status ||
    ""
  ).toLowerCase();
  const isProcessing = currentStatus.includes("process");
  const isPaused =
    currentStatus.includes("paused") || currentStatus.includes("stopped");
  const isFailed = currentStatus.includes("fail");
  const canStop = isProcessing;
  const canResume = isPaused || isFailed;

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-semibold">
              Session {id}
            </h1>
            <button
              onClick={() => setRenameModal(true)}
              className="text-slate-400 hover:text-neon-400 transition-colors"
              title="Rename session"
            >
              ✏️
            </button>
          </div>
          {session?.original_filename && (
            <div className="text-slate-200/80">{session.original_filename}</div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stop button */}
          {canStop && (
            <button
              className="btn bg-amber-600 hover:bg-amber-500 text-white"
              onClick={handleStop}
              disabled={actionLoading === "stop"}
            >
              {actionLoading === "stop" ? "Stopping…" : "🛑 Stop"}
            </button>
          )}

          {/* Resume button */}
          {canResume && (
            <button
              className="btn bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={handleResume}
              disabled={actionLoading === "resume"}
            >
              {actionLoading === "resume" ? "Resuming…" : "▶️ Resume"}
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => {
              fetchSession();
              fetchStatus();
            }}
            disabled={loadingSession}
          >
            🔄 Refresh
          </button>
          {(session?.status || statusInfo?.statusText) && (
            <span
              className={`badge ${statusTone(
                statusInfo?.statusText || session?.status,
              )}`}
            >
              {statusIcon(statusInfo?.statusText || session?.status)}{" "}
              {statusInfo?.statusText || session?.status}
            </span>
          )}
        </div>
      </div>

      {/* Rename Modal */}
      {renameModal && session && (
        <RenameModal
          currentName={session.original_filename}
          onClose={() => setRenameModal(false)}
          onRename={handleRename}
        />
      )}

      {/* API Engine Status */}
      <ApiEngineStatus
        sessionId={id}
        sessionStatus={statusInfo?.statusText || session?.status}
        onResume={() => {
          fetchSession();
          fetchStatus();
          fetchVoters({});
        }}
      />

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
                  {session.page_count ?? statusInfo?.total ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Voters</div>
                <div className="font-semibold text-lg">
                  {session.voter_count ??
                    statusInfo?.voterCount ??
                    voters.length ??
                    "—"}
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
  const statusText =
    payload?.status || payload?.state || payload?.processingStatus;
  const processed =
    payload?.processed_pages ??
    payload?.processedPages ??
    payload?.processed ??
    payload?.completedPages ??
    0;
  const total =
    payload?.page_count ??
    payload?.pageCount ??
    payload?.total_pages ??
    payload?.totalPages ??
    payload?.pages ??
    payload?.total ??
    0;
  const voterCount =
    payload?.voter_count ??
    payload?.voterCount ??
    payload?.totalVoters ??
    payload?.voters ??
    0;
  const percent = total
    ? Math.min(100, Math.round((processed / total) * 100))
    : 0;
  return { statusText, processed, total, percent, voterCount };
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
    ([_, v]) => v !== "" && v !== undefined && v !== null,
  );

  if (activeFilters.length === 0) return null;

  const religionFilter = filters?.religion;
  const religionStat = religionStats?.stats?.find(
    (s) => s.religion === religionFilter,
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

function RenameModal({ currentName, onClose, onRename }) {
  const [name, setName] = useState(currentName || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onRename(name.trim());
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
