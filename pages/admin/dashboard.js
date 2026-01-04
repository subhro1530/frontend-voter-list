import { useState, useEffect } from "react";
import Link from "next/link";
import ProtectedRoute from "../../components/ProtectedRoute";
import { adminAPI, getSessions } from "../../lib/api";

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}

function AdminDashboardContent() {
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalVoters: 0,
    printedSlips: 0,
    totalUsers: 0,
  });
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    // Fetch dashboard stats
    Promise.all([
      adminAPI.getDashboardStats(controller.signal).catch(() => ({})),
      getSessions(controller.signal).catch(() => ({ sessions: [] })),
      adminAPI.getUsers(controller.signal).catch(() => ({ users: [] })),
    ])
      .then(([dashboardStats, sessionsRes, usersRes]) => {
        const sessions = sessionsRes?.sessions || sessionsRes || [];
        const users = usersRes?.users || usersRes || [];

        setStats({
          totalSessions: dashboardStats?.totalSessions ?? sessions.length,
          totalVoters:
            dashboardStats?.totalVoters ??
            sessions.reduce(
              (acc, s) => acc + (parseInt(s.voter_count, 10) || 0),
              0
            ),
          printedSlips: dashboardStats?.printedSlips ?? 0,
          totalUsers: dashboardStats?.totalUsers ?? users.length,
        });

        setRecentSessions(sessions.slice(0, 5));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            Admin Dashboard
          </h1>
          <p className="text-slate-300">
            Overview of your voter list application
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Sessions"
          value={stats.totalSessions}
          icon="📁"
          color="neon"
          loading={loading}
        />
        <StatCard
          title="Total Voters"
          value={stats.totalVoters}
          icon="👥"
          color="blue"
          loading={loading}
        />
        <StatCard
          title="Printed Slips"
          value={stats.printedSlips}
          icon="🖨️"
          color="emerald"
          loading={loading}
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon="👤"
          color="amber"
          loading={loading}
        />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link href="/upload" className="quick-action-btn">
            <span className="text-2xl">📤</span>
            <span>Upload New PDF</span>
          </Link>
          <Link href="/sessions" className="quick-action-btn">
            <span className="text-2xl">📋</span>
            <span>View All Sessions</span>
          </Link>
          <Link href="/admin/users" className="quick-action-btn">
            <span className="text-2xl">👥</span>
            <span>Manage Users</span>
          </Link>
          <Link href="/admin/stats" className="quick-action-btn">
            <span className="text-2xl">📊</span>
            <span>View Statistics</span>
          </Link>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100">
            Recent Sessions
          </h3>
          <Link
            href="/sessions"
            className="text-sm text-neon-200 hover:text-neon-100"
          >
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-neon-400 border-t-transparent"></div>
          </div>
        ) : recentSessions.length > 0 ? (
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-ink-100/50 hover:bg-ink-100 transition-colors border border-ink-400/30"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📄</span>
                  <div>
                    <p className="font-semibold text-slate-100">
                      {session.original_filename || "Untitled PDF"}
                    </p>
                    <p className="text-sm text-slate-400">
                      {session.voter_count || 0} voters •{" "}
                      {session.page_count || 0} pages
                    </p>
                  </div>
                </div>
                <span className={`badge ${getStatusClass(session.status)}`}>
                  {session.status || "pending"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            No sessions yet. Upload a PDF to get started.
          </div>
        )}
      </div>

      {/* Styles */}
      <style jsx>{`
        .quick-action-btn {
          @apply flex flex-col items-center gap-2 p-4 rounded-xl bg-ink-100/50 border border-ink-400/30 
                 hover:border-neon-400/50 hover:bg-ink-100 transition-all text-slate-100 text-sm font-semibold;
        }
      `}</style>
    </div>
  );
}

function StatCard({ title, value, icon, color, loading }) {
  const colorClasses = {
    neon: "from-neon-500/20 to-neon-400/10 border-neon-400/30",
    blue: "from-blue-500/20 to-blue-400/10 border-blue-400/30",
    emerald: "from-emerald-500/20 to-emerald-400/10 border-emerald-400/30",
    amber: "from-amber-500/20 to-amber-400/10 border-amber-400/30",
  };

  return (
    <div
      className={`p-5 rounded-xl bg-gradient-to-br ${colorClasses[color]} border`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="space-y-1">
        {loading ? (
          <div className="h-8 w-16 bg-ink-400/30 rounded animate-pulse"></div>
        ) : (
          <p className="text-2xl font-bold text-slate-100">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        )}
        <p className="text-sm text-slate-400">{title}</p>
      </div>
    </div>
  );
}

function getStatusClass(status) {
  const key = (status || "").toLowerCase();
  if (key.includes("fail")) return "status-failed";
  if (key.includes("process")) return "status-processing";
  if (key.includes("complete")) return "status-completed";
  if (key.includes("paused")) return "status-paused";
  return "status-pending";
}
