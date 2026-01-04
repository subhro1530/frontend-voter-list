import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }) {
  const { user, isAuthenticated, isAdmin, logout, isLoading } = useAuth();
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
        <title>Voter List Console</title>
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
            <span className="hidden sm:inline">Voter List Console</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-3 text-sm font-semibold">
            {!isLoading && (
              <>
                {isAuthenticated ? (
                  <>
                    {isAdmin ? (
                      <>
                        <Link className="nav-link" href="/admin/dashboard">
                          Dashboard
                        </Link>
                        <Link className="nav-link" href="/sessions">
                          Sessions
                        </Link>
                        <Link className="nav-link" href="/upload">
                          Upload
                        </Link>
                        <Link className="nav-link" href="/admin/users">
                          Users
                        </Link>
                        <Link className="nav-link" href="/admin/api-keys">
                          API Keys
                        </Link>
                        <Link className="nav-link" href="/admin/stats">
                          Stats
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link className="nav-link" href="/search">
                          Search Voters
                        </Link>
                      </>
                    )}

                    {/* Profile Dropdown */}
                    <div className="relative" ref={profileRef}>
                      <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-ink-200 border border-ink-400 hover:border-neon-400 transition-all"
                      >
                        <div className="h-8 w-8 rounded-full bg-neon-500/30 flex items-center justify-center text-neon-100 font-semibold border border-neon-400/50">
                          {user?.name?.[0]?.toUpperCase() ||
                            user?.email?.[0]?.toUpperCase() ||
                            "U"}
                        </div>
                        <span className="hidden lg:inline text-slate-100 max-w-[100px] truncate">
                          {user?.name || user?.email?.split("@")[0]}
                        </span>
                        <svg
                          className={`w-4 h-4 transition-transform ${
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
                              <span className="mr-2">👤</span> My Profile
                            </Link>
                            {isAdmin && (
                              <Link
                                href="/admin/dashboard"
                                className="block px-4 py-2 text-sm text-slate-200 hover:bg-ink-100/50 transition-colors"
                                onClick={() => setShowProfileMenu(false)}
                              >
                                <span className="mr-2">📊</span> Admin Dashboard
                              </Link>
                            )}
                            <button
                              onClick={() => {
                                setShowProfileMenu(false);
                                logout();
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-rose-300 hover:bg-rose-900/30 transition-colors"
                            >
                              <span className="mr-2">🚪</span> Sign Out
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
                        Sign In
                      </Link>
                      <Link className="btn btn-primary" href="/register">
                        Register
                      </Link>
                    </>
                  )
                )}
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-slate-100"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
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
          <div className="md:hidden border-t border-ink-400/50 bg-ink-100/95 backdrop-blur">
            <div className="px-4 py-4 space-y-2">
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
                        Dashboard
                      </MobileNavLink>
                      <MobileNavLink href="/sessions">Sessions</MobileNavLink>
                      <MobileNavLink href="/upload">Upload PDF</MobileNavLink>
                      <MobileNavLink href="/admin/users">Users</MobileNavLink>
                      <MobileNavLink href="/admin/api-keys">
                        API Keys
                      </MobileNavLink>
                      <MobileNavLink href="/admin/stats">
                        Statistics
                      </MobileNavLink>
                    </>
                  ) : (
                    <MobileNavLink href="/search">Search Voters</MobileNavLink>
                  )}

                  <MobileNavLink href="/profile">My Profile</MobileNavLink>

                  <button
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-rose-300 hover:bg-rose-900/30 rounded-lg transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <MobileNavLink href="/login">Sign In</MobileNavLink>
                  <MobileNavLink href="/register">Register</MobileNavLink>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">{children}</main>
      <footer className="border-t border-ink-400/70 bg-ink-100/80">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>Powered by Gemini OCR → Neon → Next.js</span>
          <div className="flex gap-3">
            {isAuthenticated && isAdmin && (
              <>
                <a href="/sessions">Sessions</a>
                <a href="/upload">Upload</a>
              </>
            )}
          </div>
        </div>
      </footer>
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
