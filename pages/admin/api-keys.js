import { useState, useEffect } from "react";
import ProtectedRoute from "../../components/ProtectedRoute";
import ApiEngineStatus from "../../components/ApiEngineStatus";
import { getApiKeysStatus, resetApiKeys } from "../../lib/api";
import toast from "react-hot-toast";

export default function AdminApiKeysPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminApiKeysContent />
    </ProtectedRoute>
  );
}

function AdminApiKeysContent() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = () => {
    setLoading(true);
    setError("");
    getApiKeysStatus()
      .then((res) => {
        setStatus(res);
      })
      .catch((err) => {
        setError(err.message || "Failed to load API key status");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleReset = async () => {
    if (
      !window.confirm(
        "Are you sure you want to reset all API keys? This will clear all exhausted status."
      )
    ) {
      return;
    }

    setResetting(true);
    try {
      await resetApiKeys();
      toast.success("API keys reset successfully");
      loadStatus();
    } catch (err) {
      toast.error(err.message || "Failed to reset API keys");
    } finally {
      setResetting(false);
    }
  };

  const activePercent = status?.totalKeys
    ? Math.round((status.activeKeys / status.totalKeys) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            API Key Status
          </h1>
          <p className="text-slate-300">
            Monitor and manage Gemini API key usage
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting || loading}
          className="btn btn-secondary"
        >
          {resetting ? "Resetting..." : "🔄 Reset All Keys"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      )}

      {/* Engine Status Dashboard */}
      <ApiEngineStatus showSummary={true} pollInterval={5000} />

      {/* All Exhausted Alert */}
      {status?.allExhausted && (
        <div className="p-4 bg-rose-900/50 text-rose-100 rounded-xl border border-rose-700 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold">All API Keys Exhausted</p>
            <p className="text-sm text-rose-200">
              All Gemini API keys have reached their quota. Reset keys or wait
              for quota renewal.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-neon-400 border-t-transparent"></div>
        </div>
      ) : status ? (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-sm text-slate-400 mb-2">Total Keys</p>
              <p className="text-3xl font-bold text-slate-100">
                {status.totalKeys || 0}
              </p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-slate-400 mb-2">Active Keys</p>
              <p className="text-3xl font-bold text-emerald-400">
                {status.activeKeys || 0}
              </p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-slate-400 mb-2">Exhausted Keys</p>
              <p className="text-3xl font-bold text-rose-400">
                {status.exhaustedKeys || 0}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-200">
                API Key Availability
              </span>
              <span className="text-sm text-slate-400">
                {status.activeKeys || 0} / {status.totalKeys || 0} active
              </span>
            </div>
            <div className="h-4 w-full rounded-full bg-ink-400/50 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  activePercent > 50
                    ? "bg-emerald-500"
                    : activePercent > 25
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${activePercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {activePercent}% of API keys are available for use
            </p>
          </div>

          {/* Keys Table */}
          {status.keys && status.keys.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">
                Key Details
              </h3>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead className="text-left">
                    <tr className="text-slate-200 border-b border-ink-400/50">
                      <th className="p-3">Key Index</th>
                      <th className="p-3">Preview</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Exhausted At</th>
                      <th className="p-3">Last Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.keys.map((key, index) => (
                      <tr
                        key={key.keyIndex ?? index}
                        className="border-b border-ink-400/30 hover:bg-ink-100/30"
                      >
                        <td className="p-3 text-slate-200">
                          #{key.keyIndex ?? index + 1}
                        </td>
                        <td className="p-3 font-mono text-slate-300 text-xs">
                          {key.keyPreview || "••••••••"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`badge ${
                              key.status === "active"
                                ? "bg-emerald-900/50 text-emerald-200 border-emerald-700"
                                : "bg-rose-900/50 text-rose-200 border-rose-700"
                            }`}
                          >
                            {key.status || "unknown"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-xs">
                          {key.exhaustedAt
                            ? new Date(key.exhaustedAt).toLocaleString()
                            : "—"}
                        </td>
                        <td className="p-3 text-rose-300 text-xs max-w-xs truncate">
                          {key.lastError || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card text-center py-8 text-slate-400">
          No API key information available
        </div>
      )}
    </div>
  );
}
