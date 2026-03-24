import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import ProtectedRoute from "../components/ProtectedRoute";
import { VoterImage } from "../components/VoterSlip";
import toast from "react-hot-toast";
import HelpBanner from "../components/HelpBanner";
import VoterSlipCalibrationPanel from "../components/VoterSlipCalibrationPanel";
import { useAuth } from "../context/AuthContext";
import { userAPI, getSessions } from "../lib/api";
import useMassVoterSlipJob from "../lib/useMassVoterSlipJob";

function getPartOptionValue(part) {
  if (part === null || part === undefined) return "";
  if (typeof part === "string" || typeof part === "number") {
    return String(part).trim();
  }

  const candidates = [
    part.part_number,
    part.partNumber,
    part.part_no,
    part.partNo,
    part.booth_no,
    part.boothNo,
    part.booth_number,
    part.boothNumber,
    part.number,
    part.value,
  ];

  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (text) return text;
  }

  return "";
}

function normalizePartOptions(list) {
  const source = Array.isArray(list) ? list : [];
  const seen = new Set();
  const normalized = [];

  source.forEach((item) => {
    const value = getPartOptionValue(item);
    if (!value) return;

    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(value);
  });

  return normalized.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

export default function SearchPage() {
  return (
    <ProtectedRoute allowedRoles={["user", "admin"]}>
      <SearchContent />
    </ProtectedRoute>
  );
}

function SearchContent() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [assemblies, setAssemblies] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [parts, setParts] = useState([]);
  const [loadingAssemblies, setLoadingAssemblies] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingParts, setLoadingParts] = useState(false);

  const [filters, setFilters] = useState({
    assembly: "",
    partNumber: "",
    name: "",
    voterId: "",
    section: "",
    relationName: "",
  });

  const [voters, setVoters] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMassPanel, setShowMassPanel] = useState(false);
  const [massParts, setMassParts] = useState([]);
  const [loadingMassParts, setLoadingMassParts] = useState(false);
  const [singleDownloadLoadingByVoterId, setSingleDownloadLoadingByVoterId] =
    useState({});

  const {
    massSlip,
    isStarting,
    isDownloading,
    isPollingPaused,
    activeJob,
    updateFilters,
    startJob,
    retryStatus,
    restartJob,
    downloadGeneratedPdf,
  } = useMassVoterSlipJob({
    onWarning: (message) => toast(message, { icon: "⚠️" }),
    onError: (message) => toast.error(message),
    onSuccess: (message) => toast.success(message),
  });

  // Fetch assemblies on mount
  useEffect(() => {
    const controller = new AbortController();
    userAPI
      .getAssemblies(controller.signal)
      .then((res) => {
        setAssemblies(res.assemblies || res || []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to load assemblies:", err);
        }
      })
      .finally(() => setLoadingAssemblies(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getSessions(controller.signal)
      .then((res) => {
        setSessions(res?.sessions || res || []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to load sessions:", err);
          setSessions([]);
        }
      })
      .finally(() => setLoadingSessions(false));

    return () => controller.abort();
  }, []);

  // Fetch parts when assembly changes
  useEffect(() => {
    if (!filters.assembly) {
      setParts([]);
      return;
    }

    const controller = new AbortController();
    setLoadingParts(true);
    userAPI
      .getParts(filters.assembly, controller.signal)
      .then((res) => {
        setParts(normalizePartOptions(res.parts || res || []));
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to load parts:", err);
        }
      })
      .finally(() => setLoadingParts(false));

    return () => controller.abort();
  }, [filters.assembly]);

  useEffect(() => {
    if (!massSlip.filters.assembly) {
      setMassParts([]);
      return;
    }

    const controller = new AbortController();
    setLoadingMassParts(true);

    userAPI
      .getParts(massSlip.filters.assembly, controller.signal)
      .then((res) => {
        setMassParts(normalizePartOptions(res.parts || res || []));
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to load mass booth list:", err);
        }
      })
      .finally(() => setLoadingMassParts(false));

    return () => controller.abort();
  }, [massSlip.filters.assembly]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key === "assembly") {
      setFilters((prev) => ({ ...prev, partNumber: "" }));
    }
  };

  const searchVoters = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError("");

      const query = {
        ...filters,
        page,
        limit: pagination.limit,
      };

      // Remove empty values
      Object.keys(query).forEach((key) => {
        if (!query[key] && query[key] !== 0) delete query[key];
      });

      try {
        const res = await userAPI.searchVoters(query);
        setVoters(res.voters || []);
        setPagination(
          res.pagination || {
            page,
            limit: 50,
            total: res.voters?.length || 0,
            totalPages: 1,
          },
        );
      } catch (err) {
        setError(err.message || "Failed to search voters");
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit],
  );

  const handleSearch = (e) => {
    e?.preventDefault();
    searchVoters(1);
  };

  const handlePageChange = (newPage) => {
    searchVoters(newPage);
  };

  const handleVoterClick = (voterId) => {
    router.push(`/voter/${voterId}`);
  };

  const triggerPdfDownload = (blob, fileName) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "voterslip.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  };

  const handleSingleSlipDownload = useCallback(async (voter) => {
    const voterKey = String(voter?.id || voter?.voter_id || "");
    if (!voterKey) {
      toast.error("Missing voter identifier for slip download.");
      return;
    }

    setSingleDownloadLoadingByVoterId((prev) => ({
      ...prev,
      [voterKey]: true,
    }));

    try {
      let res;
      if (voter?.id) {
        res = await userAPI.downloadVoterSlipById(voter.id);
      } else {
        res = await userAPI.downloadVoterSlipByQueryId(voter.voter_id);
      }

      const defaultName = `voterslip-${voter.voter_id || voter.id || "download"}.pdf`;
      triggerPdfDownload(res.blob, res.fileName || defaultName);
      toast.success("Voter slip download started.");
    } catch (err) {
      const message = err?.message || "Failed to download voter slip.";
      toast.custom((t) => (
        <div className="rounded-lg border border-rose-700 bg-rose-900 text-rose-100 p-3 shadow-lg max-w-sm">
          <p className="text-sm">{message}</p>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-rose-700 hover:bg-rose-600"
              onClick={() => {
                toast.dismiss(t.id);
                handleSingleSlipDownload(voter);
              }}
            >
              Retry
            </button>
          </div>
        </div>
      ));
    } finally {
      setSingleDownloadLoadingByVoterId((prev) => ({
        ...prev,
        [voterKey]: false,
      }));
    }
  }, []);

  const handleMassStart = async (e) => {
    e.preventDefault();
    await startJob(massSlip.filters);
  };

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
    massSlip.total > 0
      ? Math.min(100, Math.round((massSlip.processed / massSlip.total) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            Search Voters
          </h1>
          <p className="text-slate-300">
            Search and find voter information across assemblies
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Filters</h3>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Assembly */}
            <div className="space-y-2">
              <label htmlFor="assembly">🏛️ Assembly</label>
              <select
                id="assembly"
                value={filters.assembly}
                onChange={(e) => handleFilterChange("assembly", e.target.value)}
                disabled={loadingAssemblies}
              >
                <option value="">All Assemblies</option>
                {assemblies.map((a, idx) => {
                  // Handle both string and object formats for assemblies
                  const assemblyName =
                    typeof a === "string"
                      ? a
                      : String(a?.name || a?.assembly || "");
                  const assemblyKey =
                    typeof a === "string" ? a : a?.id || a?.name || idx;
                  if (!assemblyName) return null;
                  return (
                    <option key={`asm-${assemblyKey}`} value={assemblyName}>
                      {assemblyName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Part Number */}
            <div className="space-y-2">
              <label htmlFor="partNumber">🧩 Part Number</label>
              <select
                id="partNumber"
                value={filters.partNumber}
                onChange={(e) =>
                  handleFilterChange("partNumber", e.target.value)
                }
                disabled={!filters.assembly || loadingParts}
              >
                <option value="">All Parts</option>
                {parts.map((partValue) => (
                  <option key={`search-part-${partValue}`} value={partValue}>
                    Part {partValue}
                  </option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label htmlFor="name">🔎 Name</label>
              <input
                id="name"
                type="text"
                placeholder="Enter name"
                value={filters.name}
                onChange={(e) => handleFilterChange("name", e.target.value)}
              />
            </div>

            {/* Voter ID */}
            <div className="space-y-2">
              <label htmlFor="voterId">🪪 Voter ID</label>
              <input
                id="voterId"
                type="text"
                placeholder="Enter voter ID"
                value={filters.voterId}
                onChange={(e) => handleFilterChange("voterId", e.target.value)}
              />
            </div>

            {/* Section */}
            <div className="space-y-2">
              <label htmlFor="section">📍 Section</label>
              <input
                id="section"
                type="text"
                placeholder="Enter section"
                value={filters.section}
                onChange={(e) => handleFilterChange("section", e.target.value)}
              />
            </div>

            {/* Relation Name */}
            <div className="space-y-2">
              <label htmlFor="relationName">👨‍👩‍👧 Father/Husband Name</label>
              <input
                id="relationName"
                type="text"
                placeholder="Enter relation name"
                value={filters.relationName}
                onChange={(e) =>
                  handleFilterChange("relationName", e.target.value)
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Searching..." : "Search"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setFilters({
                  assembly: "",
                  partNumber: "",
                  name: "",
                  voterId: "",
                  section: "",
                  relationName: "",
                });
                setVoters([]);
              }}
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      {/* Mass Voter Slip Generation */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              Mass Voter Slip PDF
            </h3>
            <p className="text-sm text-slate-300">
              Generate one combined PDF by booth or filters without leaving this
              page.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Uses backend voter slip template from the active server layout.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Download requests prefer vertical print layout (4 slips/page).
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowMassPanel((prev) => !prev)}
          >
            {showMassPanel ? "Hide Panel" : "Open Mass Generate"}
          </button>
        </div>

        {showMassPanel && (
          <form onSubmit={handleMassStart} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label htmlFor="massAssembly">🏛️ Assembly</label>
                <select
                  id="massAssembly"
                  value={massSlip.filters.assembly}
                  onChange={(e) =>
                    updateFilters({ assembly: e.target.value, boothNo: "" })
                  }
                  disabled={loadingAssemblies}
                >
                  <option value="">
                    {loadingAssemblies
                      ? "Loading assemblies..."
                      : "Select assembly"}
                  </option>
                  {assemblies.map((a, idx) => {
                    const assemblyName =
                      typeof a === "string"
                        ? a
                        : String(a?.name || a?.assembly || "");
                    const assemblyKey =
                      typeof a === "string" ? a : a?.id || a?.name || idx;
                    if (!assemblyName) return null;
                    return (
                      <option
                        key={`mass-asm-${assemblyKey}`}
                        value={assemblyName}
                      >
                        {assemblyName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="massSession">🗂️ Voter List (optional)</label>
                <select
                  id="massSession"
                  value={massSlip.filters.sessionId || ""}
                  onChange={(e) =>
                    updateFilters({ sessionId: e.target.value.trim() })
                  }
                  disabled={loadingSessions}
                >
                  <option value="">
                    {loadingSessions
                      ? "Loading voter lists..."
                      : "All voter lists"}
                  </option>
                  {sessions.map((s, idx) => {
                    const sessionId = String(s?.id || s?._id || "");
                    if (!sessionId) return null;
                    const sessionLabel =
                      s?.name || s?.title || `Voter List ${sessionId}`;
                    return (
                      <option
                        key={`mass-session-${sessionId}-${idx}`}
                        value={sessionId}
                      >
                        {sessionLabel}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="massBoothNo">🧩 Booth No (recommended)</label>
                <input
                  id="massBoothNo"
                  type="text"
                  placeholder="Enter booth number"
                  value={massSlip.filters.boothNo}
                  onChange={(e) =>
                    updateFilters({ boothNo: e.target.value.trim() })
                  }
                  list="mass-booth-options"
                />
                <datalist id="mass-booth-options">
                  {massParts.map((partValue) => {
                    return (
                      <option key={`mass-booth-${partValue}`} value={partValue}>
                        Booth {partValue}
                      </option>
                    );
                  })}
                </datalist>
                {loadingMassParts && massSlip.filters.assembly && (
                  <p className="text-xs text-slate-400">
                    Loading booth suggestions...
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="massSection">📍 Section (optional)</label>
                <input
                  id="massSection"
                  type="text"
                  placeholder="Section"
                  value={massSlip.filters.section}
                  onChange={(e) =>
                    updateFilters({ section: e.target.value.trim() })
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isStarting || activeJob}
              >
                {isStarting ? "Starting generation..." : "Start Mass Generate"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowMassPanel(false)}
              >
                Close
              </button>
              {activeJob && (
                <span className="text-sm text-amber-300">
                  One active job is running. Wait for completion before starting
                  another.
                </span>
              )}
            </div>
          </form>
        )}

        {massSlip.jobId && (
          <div className="rounded-xl border border-ink-400/50 bg-ink-900/40 p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-100">
                  Mass Job Progress
                </h4>
                <p className="text-sm text-slate-300">
                  {massSlip.filters.boothNo
                    ? `Generating slips for booth ${massSlip.filters.boothNo}...`
                    : "Starting generation..."}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Booth No: {massSlip.filters.boothNo || "Not specified"}
                </p>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Job ID: {massSlip.jobId}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${statusBadgeClass[massSlip.status] || statusBadgeClass.idle}`}
              >
                {statusLabel[massSlip.status] || "Idle"}
              </span>
            </div>

            <div>
              {massSlip.total > 0 ? (
                <>
                  <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
                    <span>
                      {massSlip.processed} / {massSlip.total}
                    </span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-ink-700/80 overflow-hidden">
                    <div
                      className="h-full bg-neon-300 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-slate-300 mb-2">
                    Processing...
                  </div>
                  <div className="h-2.5 rounded-full bg-ink-700/80 overflow-hidden">
                    <div className="h-full w-1/3 bg-neon-300 animate-pulse" />
                  </div>
                </>
              )}
            </div>

            {massSlip.status === "completed" && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={downloadGeneratedPdf}
                  disabled={isDownloading}
                >
                  {isDownloading ? "Preparing download..." : "Download PDF"}
                </button>
                <span className="text-sm text-emerald-300">
                  Completed. Ready to download.
                </span>
              </div>
            )}

            {massSlip.status === "failed" && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-rose-700 bg-rose-900/40 text-rose-100">
                  {massSlip.error || "Mass generation failed."}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={restartJob}
                  disabled={isStarting || activeJob}
                >
                  Restart with Previous Filters
                </button>
              </div>
            )}

            {isPollingPaused && activeJob && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-amber-300">
                  Live updates paused due to network issues.
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={retryStatus}
                >
                  Retry Status
                </button>
              </div>
            )}

            {massSlip.technicalError && (
              <details className="text-xs text-slate-300 bg-ink-900/60 rounded-lg border border-ink-500/40 p-3">
                <summary className="cursor-pointer text-slate-200">
                  Technical details
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px]">
                  {massSlip.technicalError}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>

      {isAdmin && <VoterSlipCalibrationPanel />}

      {/* Error */}
      {error && (
        <div className="p-3 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      )}

      {/* Results */}
      {voters.length > 0 && (
        <div className="card space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-100">
              Results ({pagination.total || voters.length} voters)
            </h3>
            <div className="text-sm text-slate-400">
              Page {pagination.page} of {pagination.totalPages || 1}
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="voter-cards-mobile">
            {voters.map((voter) => (
              <div
                key={`mobile-${voter.id || voter.voter_id}`}
                className="voter-card-mobile"
                onClick={() => handleVoterClick(voter.id || voter.voter_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  handleVoterClick(voter.id || voter.voter_id)
                }
              >
                <div className="voter-card-mobile-header">
                  <VoterImage voter={voter} size="medium" />
                  <div className="voter-card-mobile-info">
                    <h4 className="voter-card-mobile-name">
                      {voter.name || "—"}
                    </h4>
                    <p className="voter-card-mobile-id font-mono">
                      {voter.voter_id || "—"}
                    </p>
                  </div>
                  <div className="voter-card-mobile-badge">
                    <span className="text-xs capitalize">
                      {voter.gender || "—"}
                    </span>
                    <span className="text-sm font-bold">
                      {voter.age ?? "—"}
                    </span>
                  </div>
                </div>
                <div className="voter-card-mobile-details">
                  <div className="voter-card-mobile-detail">
                    <span className="detail-icon">🏠</span>
                    <span className="detail-label">House:</span>
                    <span className="detail-value">
                      {voter.house_number || "—"}
                    </span>
                  </div>
                  <div className="voter-card-mobile-detail">
                    <span className="detail-icon">👨‍👧</span>
                    <span className="detail-label">Father:</span>
                    <span className="detail-value truncate">
                      {voter.relation_name || "—"}
                    </span>
                  </div>
                </div>
                <div className="voter-card-mobile-footer">
                  <span className="text-xs text-slate-400">
                    Serial #{voter.serial_number || "—"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary text-xs py-1 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSingleSlipDownload(voter);
                      }}
                      disabled={
                        !!singleDownloadLoadingByVoterId[
                          String(voter.id || voter.voter_id)
                        ]
                      }
                    >
                      {singleDownloadLoadingByVoterId[
                        String(voter.id || voter.voter_id)
                      ]
                        ? "Downloading..."
                        : "Download Slip"}
                    </button>
                    <span className="btn-view-mobile">View & Print →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="table-scroll voter-table-desktop">
            <table className="w-full text-sm sticky-header">
              <thead className="text-left">
                <tr className="text-slate-200">
                  <th className="p-2">Photo</th>
                  <th className="p-2">Serial</th>
                  <th className="p-2">Voter ID</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Father/Husband</th>
                  <th className="p-2">House #</th>
                  <th className="p-2">Age</th>
                  <th className="p-2">Gender</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {voters.map((voter) => (
                  <tr
                    key={voter.id || voter.voter_id}
                    className="border-b border-ink-400/40 hover:bg-ink-100/50 cursor-pointer transition-colors"
                    onClick={() => handleVoterClick(voter.id || voter.voter_id)}
                  >
                    <td className="p-2">
                      <VoterImage voter={voter} size="small" />
                    </td>
                    <td className="p-2 text-slate-200">
                      {voter.serial_number || "—"}
                    </td>
                    <td className="p-2 text-slate-200 font-mono text-xs">
                      {voter.voter_id || "—"}
                    </td>
                    <td className="p-2 font-semibold text-slate-100">
                      {voter.name || "—"}
                    </td>
                    <td className="p-2 text-slate-200">
                      {voter.relation_name || "—"}
                    </td>
                    <td className="p-2 text-slate-200">
                      {voter.house_number || "—"}
                    </td>
                    <td className="p-2 text-slate-200">{voter.age ?? "—"}</td>
                    <td className="p-2 text-slate-200 capitalize">
                      {voter.gender || "—"}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="btn btn-secondary text-xs py-1 px-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSingleSlipDownload(voter);
                          }}
                          disabled={
                            !!singleDownloadLoadingByVoterId[
                              String(voter.id || voter.voter_id)
                            ]
                          }
                        >
                          {singleDownloadLoadingByVoterId[
                            String(voter.id || voter.voter_id)
                          ]
                            ? "Downloading..."
                            : "Download Slip"}
                        </button>
                        <button
                          className="btn btn-primary text-xs py-1 px-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVoterClick(voter.id || voter.voter_id);
                          }}
                        >
                          <span className="mr-1">🖨️</span> View & Print
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-slate-300">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary"
                  disabled={pagination.page === 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-primary"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Results */}
      {!loading && voters.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            No Results
          </h3>
          <p className="text-slate-300 mb-4">
            Use the filters above to search for voters
          </p>
          <div className="text-sm text-slate-400 max-w-md mx-auto">
            <p className="mb-2">
              💡 <strong>Tips:</strong>
            </p>
            <ul className="text-left space-y-1">
              <li>• Select an assembly first to narrow down results</li>
              <li>• Try searching by Voter ID for exact matches</li>
              <li>
                • Use partial names if you&apos;re unsure of exact spelling
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Help Banner */}
      <HelpBanner className="print-hide" />
    </div>
  );
}
