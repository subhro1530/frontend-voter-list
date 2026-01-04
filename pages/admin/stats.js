import { useState, useEffect } from "react";
import ProtectedRoute from "../../components/ProtectedRoute";
import { adminAPI, getSessions } from "../../lib/api";

export default function AdminStatsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminStatsContent />
    </ProtectedRoute>
  );
}

function AdminStatsContent() {
  const [assemblies, setAssemblies] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedAssembly, setSelectedAssembly] = useState("");
  const [selectedSession, setSelectedSession] = useState("");

  const [religionStats, setReligionStats] = useState(null);
  const [genderStats, setGenderStats] = useState(null);
  const [printStats, setPrintStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getSessions(controller.signal).catch(() => ({ sessions: [] })),
      adminAPI.getStats("prints", {}, controller.signal).catch(() => null),
    ])
      .then(([sessionsRes, prints]) => {
        const sessionsList = sessionsRes?.sessions || sessionsRes || [];
        setSessions(sessionsList);

        // Extract unique assemblies from sessions - handle both string and object formats
        const assemblyValues = sessionsList
          .map((s) => {
            // Handle various API response formats
            if (typeof s.assembly === "object" && s.assembly !== null) {
              return String(s.assembly?.name || s.assembly?.assembly || "");
            }
            if (
              typeof s === "object" &&
              s.assembly === undefined &&
              s.voter_count !== undefined
            ) {
              // This is likely an assembly stats object {assembly: "name", voter_count: 123}
              return null; // Skip these
            }
            return typeof s.assembly === "string" ? s.assembly : null;
          })
          .filter((v) => v && typeof v === "string");
        const uniqueAssemblies = [...new Set(assemblyValues)];
        setAssemblies(uniqueAssemblies);

        setPrintStats(prints);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  // Load religion and gender stats when filters change
  useEffect(() => {
    const controller = new AbortController();
    const query = {};
    if (selectedAssembly) query.assembly = selectedAssembly;
    if (selectedSession) query.sessionId = selectedSession;

    Promise.all([
      adminAPI.getStats("religion", query, controller.signal).catch(() => null),
      adminAPI.getStats("gender", query, controller.signal).catch(() => null),
    ]).then(([religion, gender]) => {
      setReligionStats(religion);
      setGenderStats(gender);
    });

    return () => controller.abort();
  }, [selectedAssembly, selectedSession]);

  const RELIGION_ICONS = {
    Hindu: "🕉️",
    Muslim: "☪️",
    Christian: "✝️",
    Sikh: "🔯",
    Buddhist: "☸️",
    Jain: "🙏",
    Other: "🌐",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            Statistics
          </h1>
          <p className="text-slate-300">
            View voter demographics and print statistics
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="assembly">Assembly</label>
            <select
              id="assembly"
              value={selectedAssembly}
              onChange={(e) => setSelectedAssembly(e.target.value)}
            >
              <option value="">All Assemblies</option>
              {assemblies.map((a, idx) => {
                // Ensure we only render string values
                const assemblyName =
                  typeof a === "string"
                    ? a
                    : String(a?.assembly || a?.name || `Assembly ${idx + 1}`);
                return (
                  <option
                    key={`assembly-${idx}-${assemblyName}`}
                    value={assemblyName}
                  >
                    {assemblyName}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="session">Session (Optional)</label>
            <select
              id="session"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
            >
              <option value="">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.original_filename || `Session ${s.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-neon-400 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* Print Statistics */}
          {printStats && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">
                📊 Print Statistics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <StatBox
                  label="Total Voters"
                  value={printStats.total_voters || 0}
                  color="blue"
                />
                <StatBox
                  label="Printed"
                  value={printStats.printed_count || 0}
                  color="emerald"
                />
                <StatBox
                  label="Not Printed"
                  value={printStats.not_printed_count || 0}
                  color="amber"
                />
              </div>

              {/* Print Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-300">
                  <span>Print Progress</span>
                  <span>
                    {printStats.total_voters
                      ? Math.round(
                          (printStats.printed_count / printStats.total_voters) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-ink-400/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                    style={{
                      width: `${
                        printStats.total_voters
                          ? (printStats.printed_count /
                              printStats.total_voters) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Religion Distribution */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              🛕 Religion Distribution
            </h3>
            {religionStats?.stats && religionStats.stats.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {religionStats.stats.map((stat) => (
                  <div
                    key={stat.religion}
                    className="p-3 rounded-xl bg-ink-100/50 border border-ink-400/30"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">
                        {RELIGION_ICONS[stat.religion] || "🌐"}
                      </span>
                      <span className="text-sm font-semibold text-slate-100 truncate">
                        {stat.religion}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-slate-100">
                      {(stat.count || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-neon-300">
                      {Number(stat.percentage || 0).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">
                No religion data available
              </p>
            )}
          </div>

          {/* Gender Distribution */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              ⚧ Gender Distribution
            </h3>
            {genderStats?.stats && genderStats.stats.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {genderStats.stats.map((stat) => (
                  <div
                    key={stat.gender}
                    className="p-4 rounded-xl bg-ink-100/50 border border-ink-400/30 text-center"
                  >
                    <span className="text-3xl mb-2 block">
                      {stat.gender?.toLowerCase() === "male"
                        ? "👨"
                        : stat.gender?.toLowerCase() === "female"
                        ? "👩"
                        : "🧑"}
                    </span>
                    <p className="text-sm font-semibold text-slate-200 capitalize">
                      {stat.gender || "Unknown"}
                    </p>
                    <p className="text-2xl font-bold text-slate-100 mt-1">
                      {(stat.count || 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-neon-300">
                      {Number(stat.percentage || 0).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">
                No gender data available
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  const colorClasses = {
    blue: "bg-blue-500/20 border-blue-400/30 text-blue-100",
    emerald: "bg-emerald-500/20 border-emerald-400/30 text-emerald-100",
    amber: "bg-amber-500/20 border-amber-400/30 text-amber-100",
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color] || ""}`}>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-2xl font-bold">{(value || 0).toLocaleString()}</p>
    </div>
  );
}
