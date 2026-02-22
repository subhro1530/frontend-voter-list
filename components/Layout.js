import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Footer from "./Footer";
import LanguageSelector from "./LanguageSelector";

// Tooltip component for helpful descriptions
function Tooltip({ children, text }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-ink-100 border border-ink-400 rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 whitespace-nowrap pointer-events-none">
        <p className="text-xs text-slate-200 font-normal">{text}</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-ink-400"></div>
      </div>
    </div>
  );
}

// NavLink with optional tooltip
function NavLink({ href, children, tooltip, className = "" }) {
  const link = (
    <Link
      href={href}
      className={`nav-link text-xs px-2 py-1.5 whitespace-nowrap ${className}`}
    >
      {children}
    </Link>
  );

  if (tooltip) {
    return <Tooltip text={tooltip}>{link}</Tooltip>;
  }
  return link;
}

export default function Layout({ children }) {
  const { user, isAuthenticated, isAdmin, logout, isLoading } = useAuth();
  const { t } = useLanguage();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const profileRef = useRef(null);
  const router = useRouter();

  // Close profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setShowMobileMenu(false);
  }, [router.pathname]);

  const isAuthPage = ["/login", "/register"].includes(router.pathname);

  return (
    <div
      className="min-h-screen text-slate-100"
      style={{
        background:
          "radial-gradient(circle at 15% 20%, rgba(140,43,255,0.20), transparent 30%)," +
          "radial-gradient(circle at 80% 0%, rgba(72,104,191,0.25), transparent 25%)," +
          "linear-gradient(135deg, #0f1427 0%, #141b35 35%, #1a2245 70%, #202c58 100%)",
      }}
    >
      <Head>
        <title>{t("Voter List Console")}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Upload voter PDFs, process with Gemini OCR, and explore voters via Neon-backed API."
        />
      </Head>
      <header className="sticky top-0 z-20 backdrop-blur bg-ink-100/80 border-b border-ink-400/60">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link
            href={
              isAuthenticated ? (isAdmin ? "/admin/dashboard" : "/search") : "/"
            }
            className="flex items-center gap-2 text-xl font-display font-semibold text-neon-200"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neon-500/20 text-neon-100 font-bold border border-neon-400/50">
              VL
            </span>
            <span className="hidden sm:inline">{t("Voter List Console")}</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-1 text-sm font-semibold flex-shrink-0">
            {/* Language Selector */}
            <Tooltip text="Change display language">
              <LanguageSelector />
            </Tooltip>

            {!isLoading && (
              <>
                {isAuthenticated ? (
                  <>
                    {isAdmin ? (
                      <>
                        <NavLink
                          href="/admin/dashboard"
                          tooltip="View system overview & statistics"
                        >
                          {t("Dashboard")}
                        </NavLink>
                        <NavLink
                          href="/sessions"
                          tooltip="View uploaded PDF batches"
                        >
                          {t("Sessions")}
                        </NavLink>
                        <NavLink
                          href="/upload"
                          tooltip="Upload new voter list PDFs"
                        >
                          {t("Upload")}
                        </NavLink>
                        <NavLink
                          href="/admin/users"
                          tooltip="Manage user accounts & roles"
                        >
                          {t("Users")}
                        </NavLink>
                        <NavLink
                          href="/admin/api-keys"
                          tooltip="Manage API access keys"
                        >
                          {t("API Keys")}
                        </NavLink>
                        <NavLink
                          href="/admin/stats"
                          tooltip="View detailed analytics & charts"
                        >
                          {t("Stats")}
                        </NavLink>
                        <NavLink
                          href="/admin/election-results"
                          tooltip="View & manage election result sessions"
                        >
                          📊 {t("Elections")}
                        </NavLink>
                        <NavLink
                          href="/agent"
                          tooltip="Ask AI questions about your data"
                          className="bg-purple-600/20 border-purple-500/50"
                        >
                          🤖 AI
                        </NavLink>
                      </>
                    ) : (
                      <>
                        <NavLink
                          href="/search"
                          tooltip="Search for voters by name, ID, or address"
                        >
                          {t("Search Voters")}
                        </NavLink>
                        <NavLink
                          href="/agent"
                          tooltip="Ask AI questions about voter data"
                          className="bg-purple-600/20 border-purple-500/50"
                        >
                          🤖 AI
                        </NavLink>
                      </>
                    )}

                    {/* Profile Dropdown */}
                    <div className="relative ml-1" ref={profileRef}>
                      <Tooltip text="Your account & settings">
                        <button
                          onClick={() => setShowProfileMenu(!showProfileMenu)}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-ink-200 border border-ink-400 hover:border-neon-400 transition-all"
                        >
                          <div className="h-7 w-7 rounded-full bg-neon-500/30 flex items-center justify-center text-neon-100 text-sm font-semibold border border-neon-400/50">
                            {user?.name?.[0]?.toUpperCase() ||
                              user?.email?.[0]?.toUpperCase() ||
                              "U"}
                          </div>
                          <svg
                            className={`w-3 h-3 transition-transform text-slate-400 ${
                              showProfileMenu ? "rotate-180" : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </Tooltip>

                      {showProfileMenu && (
                        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-ink-200 border border-ink-400 shadow-xl z-50 overflow-hidden">
                          <div className="px-4 py-3 border-b border-ink-400/50">
                            <p className="text-sm font-semibold text-slate-100 truncate">
                              {user?.name || "User"}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {user?.email}
                            </p>
                            <span
                              className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                isAdmin
                                  ? "bg-neon-500/30 text-neon-100 border border-neon-400/50"
                                  : "bg-blue-500/30 text-blue-100 border border-blue-400/50"
                              }`}
                            >
                              {user?.role?.toUpperCase()}
                            </span>
                          </div>
                          <div className="py-1">
                            <Link
                              href="/profile"
                              className="block px-4 py-2 text-sm text-slate-200 hover:bg-ink-100/50 transition-colors"
                              onClick={() => setShowProfileMenu(false)}
                            >
                              <span className="mr-2">👤</span> {t("My Profile")}
                            </Link>
                            {isAdmin && (
                              <Link
                                href="/admin/dashboard"
                                className="block px-4 py-2 text-sm text-slate-200 hover:bg-ink-100/50 transition-colors"
                                onClick={() => setShowProfileMenu(false)}
                              >
                                <span className="mr-2">📊</span>{" "}
                                {t("Admin Dashboard")}
                              </Link>
                            )}
                            <button
                              onClick={() => {
                                setShowProfileMenu(false);
                                logout();
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-rose-300 hover:bg-rose-900/30 transition-colors"
                            >
                              <span className="mr-2">🚪</span> {t("Sign Out")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  !isAuthPage && (
                    <>
                      <Link className="btn btn-secondary" href="/login">
                        {t("Sign In")}
                      </Link>
                      <Link className="btn btn-primary" href="/register">
                        {t("Register")}
                      </Link>
                    </>
                  )
                )}
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="xl:hidden p-2 text-slate-100 rounded-lg hover:bg-ink-200/50 transition-colors"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {showMobileMenu ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="xl:hidden border-t border-ink-400/50 bg-ink-100/95 backdrop-blur">
            <div className="px-4 py-4 space-y-2">
              {/* Mobile Language Selector */}
              <div className="px-3 py-2 mb-3">
                <LanguageSelector className="w-full" />
              </div>

              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-ink-200/50 rounded-xl">
                    <div className="h-10 w-10 rounded-full bg-neon-500/30 flex items-center justify-center text-neon-100 font-semibold border border-neon-400/50">
                      {user?.name?.[0]?.toUpperCase() ||
                        user?.email?.[0]?.toUpperCase() ||
                        "U"}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100">
                        {user?.name || user?.email?.split("@")[0]}
                      </p>
                      <p className="text-xs text-slate-400">
                        {user?.role?.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {isAdmin ? (
                    <>
                      <MobileNavLink href="/admin/dashboard">
                        {t("Dashboard")}
                      </MobileNavLink>
                      <MobileNavLink href="/sessions">
                        {t("Sessions")}
                      </MobileNavLink>
                      <MobileNavLink href="/upload">
                        {t("Upload")}
                      </MobileNavLink>
                      <MobileNavLink href="/admin/users">
                        {t("Users")}
                      </MobileNavLink>
                      <MobileNavLink href="/admin/api-keys">
                        {t("API Keys")}
                      </MobileNavLink>
                      <MobileNavLink href="/admin/stats">
                        {t("Stats")}
                      </MobileNavLink>
                      <MobileNavLink href="/admin/election-results">
                        📊 {t("Elections")}
                      </MobileNavLink>
                      <MobileNavLink href="/agent">
                        🤖 {t("Agent")}
                      </MobileNavLink>
                    </>
                  ) : (
                    <>
                      <MobileNavLink href="/search">
                        {t("Search Voters")}
                      </MobileNavLink>
                      <MobileNavLink href="/agent">
                        🤖 {t("Agent")}
                      </MobileNavLink>
                    </>
                  )}

                  <MobileNavLink href="/profile">
                    {t("My Profile")}
                  </MobileNavLink>

                  <button
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-rose-300 hover:bg-rose-900/30 rounded-lg transition-colors"
                  >
                    {t("Sign Out")}
                  </button>

                  {/* Contact/Help Link */}
                  <div className="mt-3 pt-3 border-t border-ink-400/50">
                    <a
                      href="mailto:acodernamedsubhro@gmail.com"
                      className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-neon-200 hover:bg-ink-200/30 rounded-lg transition-colors"
                    >
                      <span>📧</span>
                      <span>Contact Support</span>
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <MobileNavLink href="/login">{t("Sign In")}</MobileNavLink>
                  <MobileNavLink href="/register">
                    {t("Register")}
                  </MobileNavLink>

                  {/* Contact/Help Link */}
                  <div className="mt-3 pt-3 border-t border-ink-400/50">
                    <a
                      href="mailto:acodernamedsubhro@gmail.com"
                      className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-neon-200 hover:bg-ink-200/30 rounded-lg transition-colors"
                    >
                      <span>📧</span>
                      <span>Contact Support</span>
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 pb-20 space-y-6">
        {children}
      </main>
      <footer className="border-t border-ink-400/70 bg-ink-100/80 mb-12">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-300">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-center sm:text-left">
              Powered by Gemini OCR → Neon → Next.js
            </span>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {isAuthenticated && isAdmin && (
                <>
                  <a
                    href="/sessions"
                    className="hover:text-neon-200 transition-colors"
                  >
                    Sessions
                  </a>
                  <span className="text-ink-400">•</span>
                  <a
                    href="/upload"
                    className="hover:text-neon-200 transition-colors"
                  >
                    Upload
                  </a>
                  <span className="text-ink-400">•</span>
                </>
              )}
              <a
                href="mailto:acodernamedsubhro@gmail.com"
                className="flex items-center gap-1 hover:text-neon-200 transition-colors"
                title="Contact for support"
              >
                <span>📧</span>
                <span className="hidden sm:inline">Support</span>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Sticky Footer with Credits */}
      <Footer />

      {/* Floating AI Agent Button with tooltip */}
      {isAuthenticated && (
        <div className="fixed bottom-20 right-4 z-40 group/fab">
          <Link
            href="/agent"
            className="w-14 h-14 bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center text-2xl hover:scale-110 hover:shadow-xl hover:shadow-purple-500/40 transition-all"
          >
            <span className="group-hover/fab:scale-110 transition-transform">
              🤖
            </span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-ink-100 animate-pulse"></span>
          </Link>
          {/* Tooltip on hover */}
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-ink-100 border border-ink-400 rounded-lg shadow-xl opacity-0 invisible group-hover/fab:opacity-100 group-hover/fab:visible transition-all duration-200 whitespace-nowrap pointer-events-none">
            <p className="text-sm text-white font-medium">AI Assistant</p>
            <p className="text-xs text-slate-400">
              Ask questions about voter data
            </p>
            <div className="absolute left-full top-1/2 -translate-y-1/2 -ml-1 border-4 border-transparent border-l-ink-400"></div>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileNavLink({ href, children }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-slate-100 hover:bg-ink-200/50 rounded-lg transition-colors"
    >
      {children}
    </Link>
  );
}
