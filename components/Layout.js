import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Footer from "./Footer";
import LanguageSelector from "./LanguageSelector";
import PageOverviewBanner from "./PageOverviewBanner";

// Tooltip component for helpful descriptions
function Tooltip({ children, text }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-ink-100 border border-ink-400 rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 whitespace-nowrap pointer-events-none">
        <p className="text-xs text-slate-200 font-normal">{text}</p>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-ink-400"></div>
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

export default function Layout({ children, fullWidth = false }) {
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
        <title>sabyasachi.online</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Upload voter PDFs, process with Gemini OCR, and explore voters via Neon-backed API."
        />
      </Head>
      <header className="sticky top-0 z-20 backdrop-blur bg-ink-100/80 border-b border-ink-400/60">
        <div className="w-full px-4 py-3 flex items-center gap-3 lg:gap-4">
          <Link
            href={
              isAuthenticated ? (isAdmin ? "/admin/dashboard" : "/search") : "/"
            }
            className="flex items-center gap-2 text-xl font-display font-semibold text-neon-200 flex-shrink-0"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neon-500/20 text-neon-100 font-bold border border-neon-400/50">
              VL
            </span>
            <span className="hidden sm:inline">sabyasachi.online</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex flex-1 min-w-0 items-center justify-end gap-1 text-sm font-semibold">
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
                          href="/search"
                          tooltip="Search for voters by name, ID, or address"
                        >
                          {t("Search Voters")}
                        </NavLink>
                        <NavLink
                          href="/admin/dashboard"
                          tooltip="View system overview & statistics"
                        >
                          {t("Dashboard")}
                        </NavLink>
                        <NavLink
                          href="/sessions"
                          tooltip="View uploaded voter lists"
                        >
                          {t("Sessions")}
                        </NavLink>
                        <NavLink
                          href="/upload"
                          tooltip="Upload a new voter list PDF"
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
                          <span className="inline-flex items-center gap-1.5">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 3v18h18M7 14l4-4 3 3 5-7"
                              />
                            </svg>
                            {t("Elections")}
                          </span>
                        </NavLink>
                        <NavLink
                          href="/affidavits"
                          tooltip="Fill Form 26 affidavit manually"
                          className="bg-emerald-600/15 border-emerald-500/40"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6M8 4h8a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z"
                              />
                            </svg>
                            {t("Affidavits")}
                          </span>
                        </NavLink>
                        <NavLink
                          href="/nominations"
                          tooltip="Fill Form 2B nomination paper manually"
                          className="bg-amber-600/15 border-amber-500/40"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 6h10M8 10h10M8 14h6M6 4h.01M6 8h.01M6 12h.01M6 16h.01"
                              />
                            </svg>
                            {t("Nominations")}
                          </span>
                        </NavLink>
                        <NavLink
                          href="/agent"
                          tooltip="Ask AI questions about your data"
                          className="bg-purple-600/20 border-purple-500/50"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 7V6a3 3 0 016 0v1m-7 4h8m-8 4h8M5 11h14v6a3 3 0 01-3 3H8a3 3 0 01-3-3v-6z"
                              />
                            </svg>
                            AI
                          </span>
                        </NavLink>
                        <Tooltip text="Interactive constituency map explorer">
                          <Link
                            href="/admin/map"
                            className="nav-link text-xs px-2 py-1.5 whitespace-nowrap flex items-center gap-1 bg-emerald-600/15 border-emerald-500/40"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                              />
                            </svg>
                          </Link>
                        </Tooltip>
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
                          <span className="inline-flex items-center gap-1.5">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 7V6a3 3 0 016 0v1m-7 4h8m-8 4h8M5 11h14v6a3 3 0 01-3 3H8a3 3 0 01-3-3v-6z"
                              />
                            </svg>
                            AI
                          </span>
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
                              <span className="inline-flex items-center gap-2">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5.121 17.804A8 8 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                </svg>
                                {t("My Profile")}
                              </span>
                            </Link>
                            {isAdmin && (
                              <Link
                                href="/admin/dashboard"
                                className="block px-4 py-2 text-sm text-slate-200 hover:bg-ink-100/50 transition-colors"
                                onClick={() => setShowProfileMenu(false)}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M3 3v18h18M7 14l4-4 3 3 5-7"
                                    />
                                  </svg>
                                  {t("Admin Dashboard")}
                                </span>
                              </Link>
                            )}
                            <button
                              onClick={() => {
                                setShowProfileMenu(false);
                                logout();
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-rose-300 hover:bg-rose-900/30 transition-colors"
                            >
                              <span className="inline-flex items-center gap-2">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
                                  />
                                </svg>
                                {t("Sign Out")}
                              </span>
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
            className="lg:hidden ml-auto p-2 text-slate-100 rounded-lg hover:bg-ink-200/50 transition-colors"
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
          <div className="lg:hidden border-t border-ink-400/50 bg-ink-100/95 backdrop-blur">
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
                      <MobileNavLink href="/search">
                        {t("Search Voters")}
                      </MobileNavLink>
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
                        {t("Elections")}
                      </MobileNavLink>
                      <MobileNavLink href="/affidavits">
                        {t("Affidavits")}
                      </MobileNavLink>
                      <MobileNavLink href="/nominations">
                        {t("Nominations")}
                      </MobileNavLink>
                      <MobileNavLink href="/agent">{t("Agent")}</MobileNavLink>
                      <MobileNavLink href="/admin/map">
                        {t("Map Console")}
                      </MobileNavLink>
                    </>
                  ) : (
                    <>
                      <MobileNavLink href="/search">
                        {t("Search Voters")}
                      </MobileNavLink>
                      <MobileNavLink href="/agent">{t("Agent")}</MobileNavLink>
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
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
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
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      <span>Contact Support</span>
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <main
        className={
          fullWidth
            ? "w-full px-4 py-8 pb-20 space-y-6"
            : "mx-auto max-w-6xl px-4 py-8 pb-20 space-y-6"
        }
      >
        <PageOverviewBanner />
        {children}
      </main>
      <footer className="border-t border-ink-400/70 bg-ink-100/80 mb-12">
        <div
          className={
            fullWidth
              ? "w-full px-4 py-6 text-sm text-slate-300"
              : "mx-auto max-w-6xl px-4 py-6 text-sm text-slate-300"
          }
        >
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
                    Voter Lists
                  </a>
                  <span className="text-ink-400">•</span>
                  <a
                    href="/upload"
                    className="hover:text-neon-200 transition-colors"
                  >
                    Upload Voter List
                  </a>
                  <span className="text-ink-400">•</span>
                </>
              )}
              <a
                href="mailto:acodernamedsubhro@gmail.com"
                className="flex items-center gap-1 hover:text-neon-200 transition-colors"
                title="Contact for support"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
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
            <svg
              className="w-7 h-7 text-white group-hover/fab:scale-110 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M9 7V6a3 3 0 016 0v1m-7 4h8m-8 4h8M5 11h14v6a3 3 0 01-3 3H8a3 3 0 01-3-3v-6z"
              />
            </svg>
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
