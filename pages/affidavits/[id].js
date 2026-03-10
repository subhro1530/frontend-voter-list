import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import ProtectedRoute from "../../components/ProtectedRoute";
import { affidavitAPI } from "../../lib/api";
import toast from "react-hot-toast";

const CATEGORY_LABELS = {
  candidate_info: { label: "Candidate Information", icon: "👤", color: "blue" },
  proposer_info: {
    label: "Proposer Information",
    icon: "✍️",
    color: "indigo",
  },
  criminal_record: { label: "Criminal Record", icon: "⚖️", color: "rose" },
  office_of_profit: { label: "Office of Profit", icon: "🏛", color: "amber" },
  insolvency: { label: "Insolvency", icon: "💰", color: "orange" },
  foreign_allegiance: {
    label: "Foreign Allegiance",
    icon: "🌍",
    color: "purple",
  },
  disqualification: { label: "Disqualification", icon: "🚫", color: "rose" },
  dismissal_corruption: {
    label: "Dismissal for Corruption",
    icon: "⛔",
    color: "red",
  },
  government_contracts: {
    label: "Government Contracts",
    icon: "📜",
    color: "teal",
  },
  assets_movable: { label: "Movable Assets", icon: "🚗", color: "emerald" },
  assets_immovable: { label: "Immovable Assets", icon: "🏠", color: "green" },
  liabilities: { label: "Liabilities", icon: "💳", color: "yellow" },
  general: { label: "General Information", icon: "📋", color: "slate" },
};

export default function AffidavitDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const result = await affidavitAPI.getSession(id);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleExportDocx = async () => {
    try {
      await affidavitAPI.exportDocx(id, data?.session?.candidate_name);
      toast.success("DOCX downloaded!");
    } catch (err) {
      toast.error("Export failed: " + (err.message || "Unknown error"));
    }
  };

  if (!id) return null;

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["admin"]}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-neon-400 border-t-transparent"></div>
            <p className="text-slate-300">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !data) {
    return (
      <ProtectedRoute allowedRoles={["admin"]}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <span className="text-4xl">⚠️</span>
          <p className="text-rose-300">{error || "Session not found"}</p>
          <Link href="/affidavits" className="btn btn-secondary">
            ← Back to Affidavits
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  const { session, entries, entriesByCategory, tables } = data;

  const tabs = [
    { key: "overview", label: "Overview", icon: "📋" },
    { key: "fields", label: "Extracted Fields", icon: "📝" },
    { key: "tables", label: "Tables", icon: "📊" },
  ];

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link
            href="/affidavits"
            className="hover:text-neon-200 transition-colors font-normal"
          >
            Affidavit Scanner
          </Link>
          <span>/</span>
          <span className="text-slate-300">
            {session.candidate_name || session.original_filename}
          </span>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-50">
              {session.candidate_name ||
                session.original_filename ||
                "Affidavit"}
            </h1>
            <div className="flex flex-wrap gap-2 mt-3">
              {session.party && (
                <span className="badge bg-blue-900/50 text-blue-200 border-blue-700/50">
                  🏛 {session.party}
                </span>
              )}
              {session.constituency && (
                <span className="badge bg-indigo-900/50 text-indigo-200 border-indigo-700/50">
                  📍 {session.constituency}
                </span>
              )}
              {session.state && (
                <span className="badge bg-purple-900/50 text-purple-200 border-purple-700/50">
                  🗺 {session.state}
                </span>
              )}
              <span
                className={`badge ${
                  session.status === "completed"
                    ? "status-completed"
                    : session.status === "processing"
                      ? "status-processing"
                      : session.status === "failed"
                        ? "status-failed"
                        : "status-paused"
                }`}
              >
                {session.status}
              </span>
            </div>
          </div>

          <button
            onClick={handleExportDocx}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-card hover:scale-105 transition-all duration-200 flex items-center gap-2 self-start"
          >
            📥 Export as DOCX
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-ink-200 border border-ink-400 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-fit px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${
                  activeTab === tab.key
                    ? "bg-neon-500/20 text-neon-100 border border-neon-400/50"
                    : "text-slate-400 hover:text-slate-100 hover:bg-ink-100/50"
                }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="metric-card text-center">
              <div className="text-2xl font-bold text-slate-100">
                {session.total_pages}
              </div>
              <div className="text-xs text-slate-400 mt-1">Pages</div>
            </div>
            <div className="metric-card text-center">
              <div className="text-2xl font-bold text-slate-100">
                {entries?.length || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Fields Extracted
              </div>
            </div>
            <div className="metric-card text-center">
              <div className="text-2xl font-bold text-slate-100">
                {tables?.length || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">Tables Found</div>
            </div>
            <div className="metric-card text-center">
              <div className="text-2xl font-bold text-slate-100">
                {Object.keys(entriesByCategory || {}).length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Categories</div>
            </div>
          </div>
        )}

        {/* Tab: Extracted Fields by Category */}
        {activeTab === "fields" && (
          <div className="space-y-6">
            {Object.entries(entriesByCategory || {}).map(
              ([category, fields]) => {
                const meta =
                  CATEGORY_LABELS[category] || CATEGORY_LABELS.general;
                return (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                  >
                    <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                      <span>{meta.icon}</span>
                      {meta.label}
                      <span className="text-xs text-slate-500 font-normal">
                        ({fields.length} fields)
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fields.map((field) => (
                        <div
                          key={field.id}
                          className="flex flex-col p-3 rounded-lg bg-ink-100 border border-ink-400/50"
                        >
                          <span className="text-xs text-slate-400 mb-1">
                            {field.field_name
                              .replace(/([A-Z])/g, " $1")
                              .replace(/_/g, " ")
                              .replace(/^./, (c) => c.toUpperCase())
                              .trim()}
                          </span>
                          <span className="text-slate-100 text-sm font-medium">
                            {field.field_value || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              },
            )}
            {Object.keys(entriesByCategory || {}).length === 0 && (
              <div className="text-center py-16 text-slate-400">
                No extracted fields found in this document.
              </div>
            )}
          </div>
        )}

        {/* Tab: Tables */}
        {activeTab === "tables" && (
          <div className="space-y-6">
            {(tables || []).length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                No tables found in this document.
              </div>
            ) : (
              tables.map((table, idx) => {
                const headers =
                  typeof table.headers === "string"
                    ? JSON.parse(table.headers)
                    : table.headers || [];
                const rows =
                  typeof table.rows_data === "string"
                    ? JSON.parse(table.rows_data)
                    : table.rows_data || [];

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="card"
                  >
                    <h3 className="text-slate-100 font-semibold mb-4">
                      {table.table_title || `Table ${idx + 1}`}
                      <span className="text-xs text-slate-500 ml-2 font-normal">
                        (Page {table.page_number})
                      </span>
                    </h3>
                    <div className="overflow-x-auto table-scroll">
                      <table className="w-full border-collapse">
                        {headers.length > 0 && (
                          <thead>
                            <tr>
                              {headers.map((h, hi) => (
                                <th
                                  key={hi}
                                  className="px-3 py-2 text-left text-xs font-semibold text-slate-300 bg-ink-100 border border-ink-400"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                        )}
                        <tbody>
                          {rows.map((row, ri) => (
                            <tr key={ri} className="hover:bg-ink-100/50">
                              {(Array.isArray(row) ? row : []).map(
                                (cell, ci) => (
                                  <td
                                    key={ci}
                                    className="px-3 py-2 text-sm text-slate-200 border border-ink-400"
                                  >
                                    {cell || "—"}
                                  </td>
                                ),
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
