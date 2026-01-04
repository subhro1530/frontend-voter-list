import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function UnauthorizedPage() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="text-6xl">🚫</div>
        <h1 className="text-3xl font-display font-semibold text-slate-100">
          Access Denied
        </h1>
        <p className="text-slate-300 max-w-md mx-auto">
          You don&apos;t have permission to access this page. This area is
          restricted to authorized users only.
        </p>
        <div className="flex items-center justify-center gap-4">
          {user ? (
            <>
              {isAdmin ? (
                <Link href="/admin/dashboard" className="btn btn-primary">
                  Go to Dashboard
                </Link>
              ) : (
                <Link href="/search" className="btn btn-primary">
                  Go to Search
                </Link>
              )}
            </>
          ) : (
            <Link href="/login" className="btn btn-primary">
              Sign In
            </Link>
          )}
          <Link href="/" className="btn btn-secondary">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
