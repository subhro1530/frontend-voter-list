import { useState, useEffect, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import ProtectedRoute from "../../components/ProtectedRoute";
import { adminAPI, getSessions, getApiKeysStatus } from "../../lib/api";
import { useLanguage } from "../../context/LanguageContext";

export default function AdminStatsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminStatsContent />
    </ProtectedRoute>
  );
}

// Color palettes for charts
const RELIGION_COLORS = {
  Hindu: "#f59e0b",
  Muslim: "#10b981",
  Christian: "#3b82f6",
  Sikh: "#8b5cf6",
  Buddhist: "#ec4899",
  Jain: "#06b6d4",
  Other: "#6b7280",
};

const GENDER_COLORS = {
  Male: "#3b82f6",
  Female: "#ec4899",
  Other: "#8b5cf6",
  Unknown: "#6b7280",
};

function AdminStatsContent() {
  const { t } = useLanguage();
  const [assemblies, setAssemblies] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedAssembly, setSelectedAssembly] = useState("");
  const [selectedSession, setSelectedSession] = useState("");

  const [religionStats, setReligionStats] = useState(null);
  const [genderStats, setGenderStats] = useState(null);
  const [printStats, setPrintStats] = useState(null);
  const [apiKeyStatus, setApiKeyStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getSessions(controller.signal).catch(() => ({ sessions: [] })),
      adminAPI.getStats("prints", {}, controller.signal).catch(() => null),
      getApiKeysStatus(controller.signal).catch(() => null),
    ])
      .then(([sessionsRes, prints, apiStatus]) => {
        const sessionsList = sessionsRes?.sessions || sessionsRes || [];
        setSessions(sessionsList);

        // Extract unique assemblies from sessions
        const assemblyValues = sessionsList
          .map((s) => {
            if (typeof s.assembly === "object" && s.assembly !== null) {
              return String(s.assembly?.name || s.assembly?.assembly || "");
            }
            return typeof s.assembly === "string" ? s.assembly : null;
          })
          .filter((v) => v && typeof v === "string");
        const uniqueAssemblies = [...new Set(assemblyValues)];
        setAssemblies(uniqueAssemblies);

        setPrintStats(prints);
        setApiKeyStatus(apiStatus);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  // Refresh API key status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      getApiKeysStatus()
        .then(setApiKeyStatus)
        .catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
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

  // Aggregate gender stats to fix duplicates (case-insensitive merge)
  const aggregatedGenderStats = useMemo(() => {
    if (!genderStats?.stats || genderStats.stats.length === 0) return [];

    const genderMap = {};
    let total = 0;

    genderStats.stats.forEach((stat) => {
      // Normalize gender name (capitalize first letter)
      const rawGender = (stat.gender || "Unknown").trim();
      const normalizedGender =
        rawGender.charAt(0).toUpperCase() + rawGender.slice(1).toLowerCase();

      // Map variations to standard names
      let key = normalizedGender;
      if (["M", "Male", "Masculine", "पुरुष", "পুরুষ"].includes(rawGender)) {
        key = "Male";
      } else if (
        ["F", "Female", "Feminine", "महिला", "মহিলা"].includes(rawGender)
      ) {
        key = "Female";
      } else if (!["Male", "Female"].includes(normalizedGender)) {
        key = normalizedGender === "Unknown" ? "Unknown" : "Other";
      }

      const count = parseInt(stat.count, 10) || 0;
      genderMap[key] = (genderMap[key] || 0) + count;
      total += count;
    });

    // Convert to array with percentages
    return Object.entries(genderMap).map(([gender, count]) => ({
      gender,
      count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(1) : "0.0",
    }));
  }, [genderStats]);

  // Aggregate religion stats similarly
  const aggregatedReligionStats = useMemo(() => {
    if (!religionStats?.stats || religionStats.stats.length === 0) return [];

    const religionMap = {};
    let total = 0;

    religionStats.stats.forEach((stat) => {
      const rawReligion = (stat.religion || "Other").trim();
      // Normalize common religion names
      let key = rawReligion;
      const lowerReligion = rawReligion.toLowerCase();

      if (lowerReligion.includes("hindu")) key = "Hindu";
      else if (
        lowerReligion.includes("muslim") ||
        lowerReligion.includes("islam")
      )
        key = "Muslim";
      else if (lowerReligion.includes("christ")) key = "Christian";
      else if (lowerReligion.includes("sikh")) key = "Sikh";
      else if (lowerReligion.includes("buddh")) key = "Buddhist";
      else if (lowerReligion.includes("jain")) key = "Jain";
      else if (
        !["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain"].includes(
          rawReligion,
        )
      )
        key = "Other";

      const count = parseInt(stat.count, 10) || 0;
      religionMap[key] = (religionMap[key] || 0) + count;
      total += count;
    });

    return Object.entries(religionMap).map(([religion, count]) => ({
      religion,
      count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(1) : "0.0",
    }));
  }, [religionStats]);

  const RELIGION_ICONS = {
    Hindu: "🕉️",
    Muslim: "☪️",
    Christian: "✝️",
    Sikh: "🔯",
    Buddhist: "☸️",
    Jain: "🙏",
    Other: "🌐",
  };

  // Calculate API key availability
  const apiAvailability = useMemo(() => {
    if (!apiKeyStatus) return { available: 0, total: 0, percentage: 0 };

    // Handle different response formats
    const engines = apiKeyStatus.engines || apiKeyStatus.apiKeys || [];
    const total = apiKeyStatus.total || engines.length || 0;
    const available =
      apiKeyStatus.available ||
      apiKeyStatus.active ||
      engines.filter(
        (e) =>
          e.status === "active" || e.status === "idle" || e.status === "ready",
      ).length ||
      0;

    return {
      available,
      total,
      percentage: total > 0 ? Math.round((available / total) * 100) : 0,
    };
  }, [apiKeyStatus]);

  // Calculate overall totals
  const overallStats = useMemo(() => {
    const totalVoters = sessions.reduce(
      (acc, s) => acc + (parseInt(s.voter_count, 10) || 0),
      0,
    );
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(
      (s) => s.status === "completed" || s.status === "done",
    ).length;

    return { totalVoters, totalSessions, completedSessions };
  }, [sessions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            📊 {t("Statistics")}
          </h1>
          <p className="text-slate-300">
            {t("View voter demographics and print statistics")}
          </p>
        </div>
      </div>

      {/* API Key Availability */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-100">
            🔑 {t("API Key Availability")}
          </h3>
          <span className="text-slate-200 font-semibold">
            {apiAvailability.available} / {apiAvailability.total} {t("active")}
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-ink-400/50 overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              apiAvailability.percentage > 50
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                : apiAvailability.percentage > 20
                  ? "bg-gradient-to-r from-amber-500 to-amber-400"
                  : "bg-gradient-to-r from-rose-500 to-rose-400"
            }`}
            style={{ width: `${apiAvailability.percentage}%` }}
          />
        </div>
        <p className="text-sm text-slate-400">
          {apiAvailability.percentage}% {t("of API keys are available for use")}
        </p>
      </div>

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-neon-500/20 to-neon-400/10 border-neon-400/30">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📁</span>
            <div>
              <p className="text-sm text-slate-300">{t("Total Sessions")}</p>
              <p className="text-2xl font-bold text-slate-100">
                {overallStats.totalSessions}
              </p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-blue-500/20 to-blue-400/10 border-blue-400/30">
          <div className="flex items-center gap-3">
            <span className="text-3xl">👥</span>
            <div>
              <p className="text-sm text-slate-300">{t("Total Voters")}</p>
              <p className="text-2xl font-bold text-slate-100">
                {overallStats.totalVoters.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-emerald-500/20 to-emerald-400/10 border-emerald-400/30">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✅</span>
            <div>
              <p className="text-sm text-slate-300">Completed Voter Lists</p>
              <p className="text-2xl font-bold text-slate-100">
                {overallStats.completedSessions}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          🔍 {t("Filters")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="assembly">{t("Assembly")}</label>
            <select
              id="assembly"
              value={selectedAssembly}
              onChange={(e) => setSelectedAssembly(e.target.value)}
            >
              <option value="">{t("All Assemblies")}</option>
              {assemblies.map((a, idx) => (
                <option key={`assembly-${idx}`} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="session">{t("Session")} (Optional)</label>
            <select
              id="session"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
            >
              <option value="">{t("All Sessions")}</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.original_filename || `Voter List ${s.id}`}
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
                🖨️ {t("Print Statistics")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <StatBox
                  label={t("Total Voters")}
                  value={printStats.total_voters || 0}
                  color="blue"
                />
                <StatBox
                  label={t("Printed")}
                  value={printStats.printed_count || 0}
                  color="emerald"
                />
                <StatBox
                  label={t("Not Printed")}
                  value={printStats.not_printed_count || 0}
                  color="amber"
                />
              </div>

              {/* Print Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-300">
                  <span>{t("Print Progress")}</span>
                  <span>
                    {printStats.total_voters
                      ? Math.round(
                          (printStats.printed_count / printStats.total_voters) *
                            100,
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

          {/* Religion Distribution with Chart */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              🛕 {t("Religion Distribution")}
            </h3>
            {aggregatedReligionStats.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={aggregatedReligionStats}
                        dataKey="count"
                        nameKey="religion"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ religion, percentage }) =>
                          `${religion} (${percentage}%)`
                        }
                        labelLine={true}
                      >
                        {aggregatedReligionStats.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={RELIGION_COLORS[entry.religion] || "#6b7280"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #475569",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#f1f5f9" }}
                        itemStyle={{ color: "#f1f5f9" }}
                        formatter={(value) => [
                          value.toLocaleString(),
                          t("Total Voters"),
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {aggregatedReligionStats.map((stat) => (
                    <div
                      key={stat.religion}
                      className="p-3 rounded-xl bg-ink-100/50 border border-ink-400/30"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">
                          {RELIGION_ICONS[stat.religion] || "🌐"}
                        </span>
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {t(stat.religion)}
                        </span>
                      </div>
                      <p className="text-lg font-bold text-slate-100">
                        {stat.count.toLocaleString()}
                      </p>
                      <p className="text-xs text-neon-300">
                        {stat.percentage}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">
                {t("No religion data available")}
              </p>
            )}
          </div>

          {/* Gender Distribution with Chart */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              ⚧ {t("Gender Distribution")}
            </h3>
            {aggregatedGenderStats.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aggregatedGenderStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis
                        dataKey="gender"
                        stroke="#94a3b8"
                        tick={{ fill: "#94a3b8" }}
                      />
                      <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #475569",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#f1f5f9" }}
                        itemStyle={{ color: "#f1f5f9" }}
                        formatter={(value) => [
                          value.toLocaleString(),
                          t("Total Voters"),
                        ]}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {aggregatedGenderStats.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={GENDER_COLORS[entry.gender] || "#6b7280"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {aggregatedGenderStats.map((stat) => (
                    <div
                      key={stat.gender}
                      className="p-4 rounded-xl bg-ink-100/50 border border-ink-400/30 text-center"
                      style={{
                        borderColor: `${
                          GENDER_COLORS[stat.gender] || "#6b7280"
                        }40`,
                        background: `linear-gradient(135deg, ${
                          GENDER_COLORS[stat.gender] || "#6b7280"
                        }10, transparent)`,
                      }}
                    >
                      <span className="text-3xl mb-2 block">
                        {stat.gender === "Male"
                          ? "👨"
                          : stat.gender === "Female"
                            ? "👩"
                            : "🧑"}
                      </span>
                      <p className="text-sm font-semibold text-slate-200 capitalize">
                        {t(stat.gender)}
                      </p>
                      <p className="text-2xl font-bold text-slate-100 mt-1">
                        {stat.count.toLocaleString()}
                      </p>
                      <p className="text-sm text-neon-300">
                        {stat.percentage}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">
                {t("No gender data available")}
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
