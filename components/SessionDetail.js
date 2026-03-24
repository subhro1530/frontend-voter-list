import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import VoterFilters from "./VoterFilters";
import VoterTable from "./VoterTable";
import ApiEngineStatus from "./ApiEngineStatus";
import toast from "react-hot-toast";
import {
  getSession,
  getSessionStatus,
  getSessionVoters,
  getReligionStats,
  stopSession,
  resumeSession,
  renameSession,
  patchSessionMetadata,
  userAPI,
  electionResultsAPI,
} from "../lib/api";
import useSessionMassVoterSlipJob from "../lib/useSessionMassVoterSlipJob";
import { useAuth } from "../context/AuthContext";
import DispatchModeSelector from "./DispatchModeSelector";
import { readStoredDispatchMode } from "../lib/dispatchMode";
import {
  extractAutomaticRetryRounds,
  extractDispatchTier,
  formatAutomaticRetryRounds,
} from "../lib/engineStatusMapper";

const VOTER_FILTER_KEYS = [
  "voterId",
  "relationName",
  "partNumber",
  "houseNumber",
  "serialNumber",
  "minAge",
  "maxAge",
  "name",
  "section",
  "assembly",
  "gender",
  "religion",
];

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function sanitizeFilterPayload(raw = {}) {
  const output = {};
  VOTER_FILTER_KEYS.forEach((key) => {
    const value = raw?.[key];
    if (value === "" || value === undefined || value === null) return;
    output[key] = value;
  });
  return output;
}

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

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function canonicalizeBooth(value) {
  const raw = String(value ?? "").toUpperCase();
  if (!raw) return "";
  const alnum = raw.replace(/[^A-Z0-9]/g, "");
  const match = alnum.match(/(\d{1,4}[A-Z]?)/);
  return match?.[1] || "";
}

function normalizeAssemblyOptions(list) {
  const source = Array.isArray(list) ? list : [];
  const seen = new Set();
  const normalized = [];

  source.forEach((item) => {
    const value =
      typeof item === "string"
        ? item
        : firstNonEmpty(item?.name, item?.assembly, item?.value);
    const text = String(value || "").trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(text);
  });

  return normalized.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

function normalizePartOptions(list) {
  const source = Array.isArray(list) ? list : [];
  const seen = new Set();
  const normalized = [];

  source.forEach((item) => {
    const value =
      typeof item === "string" || typeof item === "number"
        ? String(item)
        : firstNonEmpty(
            item?.part_number,
            item?.partNumber,
            item?.part_no,
            item?.partNo,
            item?.booth_no,
            item?.boothNo,
            item?.booth_number,
            item?.boothNumber,
            item?.number,
            item?.value,
          );

    const canonical = canonicalizeBooth(value);
    if (!canonical) return;
    const key = canonical.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(canonical);
  });

  return normalized.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

export default function SessionDetail() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { id } = router.query;
  const [session, setSession] = useState(null);
  const [voters, setVoters] = useState([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingVoters, setLoadingVoters] = useState(true);
  const [errorSession, setErrorSession] = useState("");
  const [errorVoters, setErrorVoters] = useState("");
  const voterController = useRef(null);
  const voterRequestSeqRef = useRef(0);
  const lastVoterQueryRef = useRef({ filters: {}, page: 1, limit: 25 });
  const initializedFromQueryRef = useRef(false);
  const statusController = useRef(null);
  const [statusInfo, setStatusInfo] = useState(null);
  const [dispatchTierUsed, setDispatchTierUsed] = useState();
  const [religionStats, setReligionStats] = useState(null);
  const [currentFilters, setCurrentFilters] = useState({});
  const [voterPagination, setVoterPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [actionLoading, setActionLoading] = useState("");
  const [renameModal, setRenameModal] = useState(false);
  const [dispatchMode, setDispatchMode] = useState("auto");
  const [isTabVisible, setIsTabVisible] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState !== "hidden";
  });
  const [fixMetadataOpen, setFixMetadataOpen] = useState(false);
  const [sessionScopedAssemblies, setSessionScopedAssemblies] = useState([]);
  const [sessionScopedParts, setSessionScopedParts] = useState([]);
  const [loadingSessionScopedAssemblies, setLoadingSessionScopedAssemblies] =
    useState(false);
  const [loadingSessionScopedParts, setLoadingSessionScopedParts] =
    useState(false);

  const {
    sessionMassSlip,
    startSessionMassSlip,
    retrySessionMassSlip,
    downloadSessionMassSlip,
    isJobActive,
  } = useSessionMassVoterSlipJob({
    sessionId: id,
    session,
    onWarning: (message) => toast(message, { icon: "⚠️" }),
    onError: (message) => toast.error(message),
    onSuccess: (message) => toast.success(message),
  });

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

  const refreshLinkedElectionData = useCallback(async () => {
    if (!id) return;
    try {
      await electionResultsAPI.getLinkedElectionResultsFromVoterSession(id);
    } catch {
      // Keep silent; linking may not exist for all sessions.
    }
  }, [id]);

  const loadSessionScopedAssemblies = useCallback(
    (signal) => {
      if (!id) return Promise.resolve([]);
      setLoadingSessionScopedAssemblies(true);

      return userAPI
        .getAssemblies({ signal, sessionId: id })
        .then((res) => {
          const normalized = normalizeAssemblyOptions(
            res?.assemblies || res || [],
          );
          setSessionScopedAssemblies(normalized);
          return normalized;
        })
        .catch((err) => {
          if (err?.name !== "AbortError") {
            setSessionScopedAssemblies([]);
          }
          return [];
        })
        .finally(() => setLoadingSessionScopedAssemblies(false));
    },
    [id],
  );

  const loadSessionScopedParts = useCallback(
    (assembly, signal) => {
      const assemblyValue = String(assembly || "").trim();
      if (!id || !assemblyValue) {
        setSessionScopedParts([]);
        return Promise.resolve([]);
      }

      setLoadingSessionScopedParts(true);
      return userAPI
        .getParts(assemblyValue, { signal, sessionId: id })
        .then((res) => {
          const normalized = normalizePartOptions(res?.parts || res || []);
          setSessionScopedParts(normalized);
          return normalized;
        })
        .catch((err) => {
          if (err?.name !== "AbortError") {
            setSessionScopedParts([]);
          }
          return [];
        })
        .finally(() => setLoadingSessionScopedParts(false));
    },
    [id],
  );

  const fetchStatus = (signal) => {
    if (!id) return;
    if (statusController.current) statusController.current.abort();
    const controller = signal ? { signal } : new AbortController();
    if (!signal) statusController.current = controller;
    getSessionStatus(id, controller.signal)
      .then((payload) => {
        const normalized = normalizeStatus(payload);
        setStatusInfo(normalized);
        const latestTier = extractDispatchTier(payload);
        if (latestTier) setDispatchTierUsed(latestTier);
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
    setDispatchMode(readStoredDispatchMode());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const onVisibilityChange = () => {
      setIsTabVisible(document.visibilityState !== "hidden");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal);
    fetchStatus(controller.signal);
    fetchReligionStats(controller.signal);
    loadSessionScopedAssemblies(controller.signal).then((assemblies) => {
      const currentAssembly = firstNonEmpty(
        session?.assembly_name,
        session?.assembly,
        session?.constituency,
      );
      const preferredAssembly = currentAssembly || assemblies?.[0] || "";
      if (preferredAssembly) {
        loadSessionScopedParts(preferredAssembly, controller.signal);
      }
    });

    return () => {
      controller.abort();
      if (statusController.current) statusController.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const assemblyFromSession = firstNonEmpty(
      session?.assembly_name,
      session?.assembly,
      session?.constituency,
    );
    if (!assemblyFromSession) return;

    const controller = new AbortController();
    loadSessionScopedParts(assemblyFromSession, controller.signal);
    return () => controller.abort();
  }, [
    loadSessionScopedParts,
    session?.assembly,
    session?.assembly_name,
    session?.constituency,
  ]);

  // Auto-polling for live status updates (every 2 seconds while visible)
  useEffect(() => {
    if (!id) return;
    if (!isTabVisible) return;

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
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [id, isTabVisible, statusInfo?.statusText, session?.status]);

  const syncVoterQueryState = useCallback(
    (page, limit) => {
      if (!router?.replace) return;
      router.replace(
        {
          pathname: router.pathname,
          query: {
            ...router.query,
            page: String(page),
            limit: String(limit),
          },
        },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  const fetchVoters = useCallback(
    ({
      filters = currentFilters,
      page = voterPagination.page,
      limit = voterPagination.limit,
      syncQuery = true,
    } = {}) => {
      if (!id) return;
      if (voterController.current) voterController.current.abort();

      const controller = new AbortController();
      voterController.current = controller;
      const requestId = ++voterRequestSeqRef.current;

      const safeFilters = sanitizeFilterPayload(filters);
      const safePage = parsePositiveInt(page, 1);
      const safeLimit = parsePositiveInt(limit, 25);
      const query = {
        ...safeFilters,
        page: safePage,
        limit: safeLimit,
      };

      lastVoterQueryRef.current = {
        filters: safeFilters,
        page: safePage,
        limit: safeLimit,
      };

      setLoadingVoters(true);
      setErrorVoters("");
      setCurrentFilters(safeFilters);
      if (syncQuery) syncVoterQueryState(safePage, safeLimit);

      getSessionVoters(id, query, controller.signal)
        .then((res) => {
          if (requestId !== voterRequestSeqRef.current) return;

          const resVoters = res?.voters || [];
          const resPagination = res?.pagination || {};
          const normalizedPagination = {
            page: parsePositiveInt(resPagination.page, safePage),
            limit: parsePositiveInt(resPagination.limit, safeLimit),
            total: Number(resPagination.total || resVoters.length || 0),
            totalPages: Number(resPagination.totalPages || 0),
          };

          if (
            normalizedPagination.totalPages > 0 &&
            normalizedPagination.page > normalizedPagination.totalPages
          ) {
            fetchVoters({
              filters: safeFilters,
              page: 1,
              limit: normalizedPagination.limit,
            });
            return;
          }

          setVoters(resVoters);
          setVoterPagination(normalizedPagination);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          if (requestId !== voterRequestSeqRef.current) return;
          setErrorVoters(err.message || "Failed to load voters");
        })
        .finally(() => {
          if (requestId === voterRequestSeqRef.current) {
            setLoadingVoters(false);
          }
        });
    },
    [
      currentFilters,
      id,
      router,
      syncVoterQueryState,
      voterPagination.limit,
      voterPagination.page,
    ],
  );

  const handleFilterSearch = useCallback(
    (filters) => {
      fetchVoters({ filters, page: 1, limit: voterPagination.limit });
    },
    [fetchVoters, voterPagination.limit],
  );

  const handleVoterPageChange = useCallback(
    (nextPage) => {
      fetchVoters({ filters: currentFilters, page: nextPage });
    },
    [currentFilters, fetchVoters],
  );

  const handleVoterLimitChange = useCallback(
    (nextLimit) => {
      fetchVoters({
        filters: currentFilters,
        page: voterPagination.page,
        limit: nextLimit,
      });
    },
    [currentFilters, fetchVoters, voterPagination.page],
  );

  const retryVoterFetch = useCallback(() => {
    const lastQuery = lastVoterQueryRef.current;
    fetchVoters({
      filters: lastQuery.filters,
      page: lastQuery.page,
      limit: lastQuery.limit,
    });
  }, [fetchVoters]);

  useEffect(() => {
    if (!router.isReady || initializedFromQueryRef.current) return;

    const initialPage = parsePositiveInt(router.query.page, 1);
    const initialLimit = parsePositiveInt(router.query.limit, 25);
    initializedFromQueryRef.current = true;

    fetchVoters({
      filters: {},
      page: initialPage,
      limit: initialLimit,
      syncQuery: false,
    });

    return () => {
      if (voterController.current) voterController.current.abort();
    };
  }, [fetchVoters, router.isReady, router.query.limit, router.query.page]);

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
      const response = await resumeSession(id, dispatchMode);
      const rounds = extractAutomaticRetryRounds(response);
      const retryText = formatAutomaticRetryRounds(rounds);
      toast.success(
        retryText ? `Session resumed. ${retryText}` : "Session resumed.",
      );
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

  const statusBadgeClass = {
    idle: "bg-slate-700/60 text-slate-200 border-slate-500/60",
    queued: "bg-amber-900/50 text-amber-100 border-amber-700/60",
    processing: "bg-sky-900/50 text-sky-100 border-sky-700/60",
    completed: "bg-emerald-900/50 text-emerald-100 border-emerald-700/60",
    failed: "bg-rose-900/50 text-rose-100 border-rose-700/60",
    cancelled: "bg-rose-900/50 text-rose-100 border-rose-700/60",
  };

  const statusLabel = {
    idle: "Idle",
    queued: "Queued",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  };

  const progressPercent =
    sessionMassSlip.total > 0
      ? Math.min(
          100,
          Math.round((sessionMassSlip.processed / sessionMassSlip.total) * 100),
        )
      : 0;

  return (
    <div className="space-y-4 text-slate-100">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <Link
            href="/sessions"
            className="text-sm text-neon-200 hover:text-neon-100"
          >
            ← Back to voter lists
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
          <DispatchModeSelector
            compact
            value={dispatchMode}
            onChange={setDispatchMode}
          />
          {isAdmin && (
            <button
              className="btn btn-secondary"
              onClick={() => setFixMetadataOpen(true)}
              disabled={!id}
            >
              Fix Session Metadata
            </button>
          )}
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

      {fixMetadataOpen && session && isAdmin && (
        <FixSessionMetadataModal
          sessionId={id}
          session={session}
          assemblies={sessionScopedAssemblies}
          parts={sessionScopedParts}
          loadingAssemblies={loadingSessionScopedAssemblies}
          loadingParts={loadingSessionScopedParts}
          onAssemblyChange={(assembly, signal) =>
            loadSessionScopedParts(assembly, signal)
          }
          onClose={() => setFixMetadataOpen(false)}
          onSaved={async (savedMetadata) => {
            const controller = new AbortController();
            await Promise.all([
              loadSessionScopedAssemblies(controller.signal),
              fetchSession(controller.signal, { silent: true }),
            ]);

            const refreshedAssembly = firstNonEmpty(
              savedMetadata?.assemblyName,
              savedMetadata?.assembly,
              session?.assembly_name,
              session?.assembly,
              session?.constituency,
            );
            if (refreshedAssembly) {
              await loadSessionScopedParts(
                refreshedAssembly,
                controller.signal,
              );
            }

            await refreshLinkedElectionData();
          }}
        />
      )}

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
            <div className="rounded-lg border border-ink-400/40 bg-ink-100/30 px-3 py-2 text-sm text-slate-200">
              Dispatch tier used:{" "}
              {dispatchTierUsed === "paid" ? "PAID" : "FREE"}
            </div>
          </div>
          <div className="space-y-3">
            <ApiEngineStatus
              sessionId={id}
              sessionStatus={statusInfo?.statusText || session?.status}
              pollInterval={4000}
              dispatchMode={dispatchMode}
              onDispatchTierChange={setDispatchTierUsed}
            />
          </div>
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

      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              Session Mass Voter Slips
            </h3>
            <p className="text-sm text-slate-300">
              Generate voter slips for this exact session without any extra
              filters.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Session ID: {sessionMassSlip.sessionId || id || "—"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Canonical booth: {sessionMassSlip.boothNo || "Not resolved"}
              {sessionMassSlip.boothSource
                ? ` (${sessionMassSlip.boothSource})`
                : ""}
            </p>
            {sessionMassSlip.boothName && (
              <p className="text-xs text-slate-400 mt-1">
                Booth name: {sessionMassSlip.boothName}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={startSessionMassSlip}
            disabled={sessionMassSlip.isStarting || isJobActive}
          >
            {sessionMassSlip.isStarting
              ? "Starting..."
              : "Generate Session Voter Slips PDF"}
          </button>
        </div>

        {sessionMassSlip.boothSource === "missing" && (
          <div className="p-3 rounded-lg border border-amber-700 bg-amber-900/30 text-amber-100 text-sm">
            Booth number missing for this session. Please verify session file
            name or reprocess metadata.
          </div>
        )}

        {sessionMassSlip.jobId && (
          <div className="rounded-xl border border-ink-400/50 bg-ink-900/40 p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-100">
                  Mass Job Progress
                </h4>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Job ID: {sessionMassSlip.jobId}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${statusBadgeClass[sessionMassSlip.status] || statusBadgeClass.idle}`}
              >
                {statusLabel[sessionMassSlip.status] || "Idle"}
              </span>
            </div>

            {sessionMassSlip.status === "queued" && (
              <div className="text-sm text-amber-300">
                Queued. Waiting to start...
              </div>
            )}

            {(sessionMassSlip.status === "processing" ||
              sessionMassSlip.status === "completed") && (
              <div>
                <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
                  <span>
                    {sessionMassSlip.processed} / {sessionMassSlip.total}
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-ink-700/80 overflow-hidden">
                  <div
                    className="h-full bg-neon-300 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {sessionMassSlip.status === "completed" && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={downloadSessionMassSlip}
                  disabled={sessionMassSlip.isDownloading}
                >
                  {sessionMassSlip.isDownloading
                    ? "Preparing download..."
                    : "Download PDF"}
                </button>
              </div>
            )}

            {sessionMassSlip.status === "failed" && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-rose-700 bg-rose-900/40 text-rose-100">
                  {sessionMassSlip.error || "Mass generation failed."}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={retrySessionMassSlip}
                  disabled={sessionMassSlip.isStarting || isJobActive}
                >
                  Restart with Previous Filters
                </button>
                {sessionMassSlip.technicalError && (
                  <details className="text-xs text-slate-300 bg-ink-900/60 rounded-lg border border-ink-500/40 p-3">
                    <summary className="cursor-pointer text-slate-200">
                      Technical details
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px]">
                      {sessionMassSlip.technicalError}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <VoterFilters
        disabled={loadingVoters}
        onChange={handleFilterSearch}
        religionStats={religionStats}
        activeFilters={currentFilters}
      />
      <VoterTable
        voters={voters}
        loading={loadingVoters}
        error={errorVoters}
        pagination={voterPagination}
        onPageChange={handleVoterPageChange}
        onLimitChange={handleVoterLimitChange}
        onRetry={retryVoterFetch}
      />
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
  return {
    statusText,
    processed,
    total,
    percent,
    voterCount,
    dispatchTier: extractDispatchTier(payload),
  };
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

function FixSessionMetadataModal({
  sessionId,
  session,
  assemblies,
  parts,
  loadingAssemblies,
  loadingParts,
  onAssemblyChange,
  onClose,
  onSaved,
}) {
  const [assemblyName, setAssemblyName] = useState(
    firstNonEmpty(
      session?.assembly_name,
      session?.assembly,
      session?.constituency,
    ),
  );
  const [boothNo, setBoothNo] = useState(
    firstNonEmpty(
      canonicalizeBooth(session?.booth_no),
      canonicalizeBooth(session?.boothNo),
      canonicalizeBooth(session?.part_number),
      canonicalizeBooth(session?.partNumber),
    ),
  );
  const [boothName, setBoothName] = useState(
    firstNonEmpty(session?.booth_name, session?.boothName),
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    const assemblyValue = String(assemblyName || "").trim();
    if (assemblyValue) {
      onAssemblyChange(assemblyValue, controller.signal);
    }
    return () => controller.abort();
  }, [assemblyName, onAssemblyChange]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    const normalizedBooth = canonicalizeBooth(boothNo);
    const nextErrors = {};

    if (!assemblyName.trim()) {
      nextErrors.assemblyName = "Assembly name is required.";
    }

    if (!normalizedBooth) {
      nextErrors.boothNo = "Booth number is required (example: 7, 119, 119A).";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      await patchSessionMetadata(sessionId, {
        assemblyName: assemblyName.trim(),
        assembly: assemblyName.trim(),
        boothNo: normalizedBooth,
        booth_no: normalizedBooth,
        boothName: boothName.trim(),
        booth_name: boothName.trim(),
      });

      toast.success("Session metadata updated.");
      await onSaved?.({
        assemblyName: assemblyName.trim(),
        assembly: assemblyName.trim(),
        boothNo: normalizedBooth,
        boothName: boothName.trim(),
      });
      onClose();
    } catch (err) {
      const status = Number(err?.status || 0);
      if (status === 400) {
        setFieldErrors((prev) => ({
          ...prev,
          boothNo:
            err?.message ||
            "Invalid booth format. Use values like 7, 119, or 119A.",
        }));
      } else if (status === 404) {
        setFormError("Session no longer exists. Please refresh and retry.");
      } else if (status === 403) {
        setFormError("You do not have permission to edit session metadata.");
      } else {
        setFormError(err?.message || "Failed to update session metadata.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-ink-200 border border-ink-400 rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100">
            Fix Session Metadata
          </h3>
          <p className="text-xs text-slate-400 mt-1">Session: {sessionId}</p>
        </div>

        {formError && (
          <div className="p-3 bg-rose-900/40 text-rose-100 rounded-lg border border-rose-700 text-sm">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="fixAssemblyName"
              className="text-sm font-medium text-slate-200"
            >
              Assembly Name
            </label>
            <select
              id="fixAssemblyName"
              value={assemblyName}
              onChange={(e) => setAssemblyName(e.target.value)}
              className="w-full px-3 py-2 bg-ink-100 border border-ink-400 rounded-lg text-slate-100 placeholder:text-slate-500"
              disabled={loadingAssemblies}
            >
              <option value="">
                {loadingAssemblies
                  ? "Loading session assemblies..."
                  : "Select assembly"}
              </option>
              {assemblies.map((name) => (
                <option key={`assembly-option-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {fieldErrors.assemblyName && (
              <p className="text-xs text-rose-300">
                {fieldErrors.assemblyName}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="fixBoothNo"
              className="text-sm font-medium text-slate-200"
            >
              Booth No
            </label>
            <input
              id="fixBoothNo"
              type="text"
              list="session-booth-options"
              value={boothNo}
              onChange={(e) => setBoothNo(e.target.value)}
              placeholder={
                loadingParts ? "Loading booth options..." : "e.g. 7, 119, 119A"
              }
              className="w-full px-3 py-2 bg-ink-100 border border-ink-400 rounded-lg text-slate-100 placeholder:text-slate-500"
            />
            <datalist id="session-booth-options">
              {parts.map((partNo) => (
                <option key={`booth-option-${partNo}`} value={partNo} />
              ))}
            </datalist>
            {fieldErrors.boothNo && (
              <p className="text-xs text-rose-300">{fieldErrors.boothNo}</p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="fixBoothName"
              className="text-sm font-medium text-slate-200"
            >
              Booth Name (optional)
            </label>
            <input
              id="fixBoothName"
              type="text"
              value={boothName}
              onChange={(e) => setBoothName(e.target.value)}
              placeholder="Optional booth label"
              className="w-full px-3 py-2 bg-ink-100 border border-ink-400 rounded-lg text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="flex gap-3 pt-1">
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
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Metadata"}
            </button>
          </div>
        </form>
      </div>
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
