import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "../../components/ProtectedRoute";
import { adminAPI, getApiKeysStatus, getSessions } from "../../lib/api";
import { useLanguage } from "../../context/LanguageContext";

const DASHBOARD_SLIDES = [
  {
    src: "/dashboard/slider/eci-top-slide-01.png",
    alt: "Election portal operations banner",
    title: "National Electoral Service Operations",
    subtitle:
      "Unified command view for voter lists, records, and processing health.",
  },
  {
    src: "/dashboard/slider/eci-top-slide-02.png",
    alt: "Election data management banner",
    title: "Secure Data Administration",
    subtitle:
      "Track every upload, validate extraction quality, and supervise output.",
  },
  {
    src: "/dashboard/slider/eci-top-slide-03.png",
    alt: "Election analytics banner",
    title: "Live Monitoring and Insight",
    subtitle:
      "Access voter list throughput, API readiness, and usage statistics instantly.",
  },
];

const SCHEMES = [
  {
    title: "System Reliability Program",
    description:
      "Ensure uninterrupted processing through live API capacity monitoring.",
    image: "/dashboard/schemes/system-reliability-program.png",
  },
  {
    title: "Digital Record Integrity",
    description:
      "Maintain traceable and auditable records for all imported election documents.",
    image: "/dashboard/schemes/digital-record-integrity.png",
  },
  {
    title: "Electoral Access Services",
    description:
      "Deliver quick voter data access through structured search and retrieval workflows.",
    image: "/dashboard/schemes/electoral-access-services.png",
  },
  {
    title: "Constituency Intelligence",
    description:
      "Support data-led decisions with validated constituency-level analytics tools.",
    image: "/dashboard/schemes/constituency-intelligence.png",
  },
];

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}

function AdminDashboardContent() {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalVoters: 0,
    printedSlips: 0,
    totalUsers: 0,
  });
  const [recentSessions, setRecentSessions] = useState([]);
  const [apiKeyStatus, setApiKeyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      adminAPI.getDashboardStats(controller.signal).catch(() => ({})),
      getSessions(controller.signal).catch(() => ({ sessions: [] })),
      adminAPI.getUsers(controller.signal).catch(() => ({ users: [] })),
      getApiKeysStatus(controller.signal).catch(() => null),
    ])
      .then(([dashboardStats, sessionsRes, usersRes, apiStatus]) => {
        const sessions = sessionsRes?.sessions || sessionsRes || [];
        const users = usersRes?.users || usersRes || [];

        setStats({
          totalSessions: dashboardStats?.totalSessions ?? sessions.length,
          totalVoters:
            dashboardStats?.totalVoters ??
            sessions.reduce(
              (acc, s) => acc + (parseInt(s.voter_count, 10) || 0),
              0,
            ),
          printedSlips: dashboardStats?.printedSlips ?? 0,
          totalUsers: dashboardStats?.totalUsers ?? users.length,
        });

        setRecentSessions(sessions.slice(0, 5));
        setApiKeyStatus(apiStatus);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      getApiKeysStatus()
        .then(setApiKeyStatus)
        .catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % DASHBOARD_SLIDES.length);
    }, 5000);

    return () => clearInterval(slideInterval);
  }, []);

  const apiAvailability = useMemo(() => {
    if (!apiKeyStatus) return { available: 0, total: 0, percentage: 0 };

    const engines =
      apiKeyStatus.engines || apiKeyStatus.apiKeys || apiKeyStatus.keys || [];
    const total =
      apiKeyStatus.totalKeys || apiKeyStatus.total || engines.length || 0;
    const available =
      apiKeyStatus.activeKeys ||
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

  return (
    <div className="space-y-6">
      <section className="eci-dashboard-hero">
        {DASHBOARD_SLIDES.map((slide, index) => (
          <article
            key={slide.src}
            className={`eci-slide ${index === activeSlide ? "eci-slide-active" : ""}`}
            aria-hidden={index !== activeSlide}
          >
            <img src={slide.src} alt={slide.alt} className="eci-slide-image" />
            <div className="eci-slide-overlay" />
            <div className="eci-slide-content">
              <p className="eci-kicker">Election Commission Dashboard</p>
              <h2 className="eci-slide-title">{slide.title}</h2>
              <p className="eci-slide-subtitle">{slide.subtitle}</p>
            </div>
          </article>
        ))}
        <div
          className="eci-slide-dots"
          role="tablist"
          aria-label="Dashboard highlights"
        >
          {DASHBOARD_SLIDES.map((slide, index) => (
            <button
              key={slide.src}
              className={`eci-dot ${index === activeSlide ? "eci-dot-active" : ""}`}
              onClick={() => setActiveSlide(index)}
              aria-label={`Show slide ${index + 1}`}
              aria-selected={index === activeSlide}
              role="tab"
              type="button"
            />
          ))}
        </div>
      </section>

      <section className="eci-scheme-strip" aria-label="Programs and schemes">
        {SCHEMES.map((scheme) => (
          <article key={scheme.title} className="eci-scheme-card">
            <img
              src={scheme.image}
              alt={scheme.title}
              className="eci-scheme-image"
            />
            <div className="eci-scheme-overlay" />
            <div className="eci-scheme-content">
              <h3>{scheme.title}</h3>
              <p>{scheme.description}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <MiniIcon type="key" />
            <span>{t("API Key Availability")}</span>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("Total Sessions")}
          value={stats.totalSessions}
          icon="folder"
          color="neon"
          loading={loading}
        />
        <StatCard
          title={t("Total Voters")}
          value={stats.totalVoters}
          icon="users"
          color="blue"
          loading={loading}
        />
        <StatCard
          title={t("Printed Slips")}
          value={stats.printedSlips}
          icon="print"
          color="emerald"
          loading={loading}
        />
        <StatCard
          title={t("Total Users")}
          value={stats.totalUsers}
          icon="user"
          color="amber"
          loading={loading}
        />
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          {t("Quick Actions")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link href="/upload" className="quick-action-btn">
            <MiniIcon type="upload" />
            <span>{t("Upload New PDF")}</span>
          </Link>
          <Link href="/sessions" className="quick-action-btn">
            <MiniIcon type="list" />
            <span>{t("View All Sessions")}</span>
          </Link>
          <Link href="/admin/users" className="quick-action-btn">
            <MiniIcon type="users" />
            <span>{t("Manage Users")}</span>
          </Link>
          <Link href="/admin/stats" className="quick-action-btn">
            <MiniIcon type="chart" />
            <span>{t("View Statistics")}</span>
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100">
            {t("Recent Sessions")}
          </h3>
          <Link
            href="/sessions"
            className="text-sm text-neon-200 hover:text-neon-100"
          >
            {t("View all")} →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-neon-400 border-t-transparent" />
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
                  <span className="h-10 w-10 rounded-lg bg-neon-500/20 border border-neon-400/30 inline-flex items-center justify-center">
                    <MiniIcon type="document" />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">
                      {session.original_filename || "Untitled PDF"}
                    </p>
                    <p className="text-sm text-slate-400">
                      {session.voter_count || 0} {t("voters")} •{" "}
                      {session.page_count || 0} {t("pages")}
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
            {t("No sessions yet. Upload a PDF to get started.")}
          </div>
        )}
      </div>

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
        <span className="h-10 w-10 rounded-lg bg-black/20 border border-white/20 inline-flex items-center justify-center text-slate-50">
          <MiniIcon type={icon} />
        </span>
      </div>
      <div className="space-y-1">
        {loading ? (
          <div className="h-8 w-16 bg-ink-400/30 rounded animate-pulse" />
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

function MiniIcon({ type }) {
  const icons = {
    key: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 7a4 4 0 11-7.874 1H3v4h4v3h3v3h4l2-2v-4.126A4.002 4.002 0 0115 7z"
      />
    ),
    folder: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    ),
    users: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2m17 0h1v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    ),
    print: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 9V4h12v5M6 18h12v2H6zm-2-3h16a2 2 0 002-2v-2a2 2 0 00-2-2H4a2 2 0 00-2 2v2a2 2 0 002 2z"
      />
    ),
    user: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5.121 17.804A8 8 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    ),
    upload: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2m-4-6l-4-4m0 0L8 10m4-4v12"
      />
    ),
    list: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
      />
    ),
    chart: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3v18h18M7 14l4-4 3 3 5-7"
      />
    ),
    document: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6M8 4h8a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z"
      />
    ),
  };

  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {icons[type] || icons.chart}
    </svg>
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
