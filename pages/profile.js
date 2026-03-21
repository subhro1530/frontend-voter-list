import { useState, useEffect } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../lib/api";
import toast from "react-hot-toast";

export default function ProfilePage() {
  return (
    <ProtectedRoute allowedRoles={["user", "admin"]}>
      <ProfileContent />
    </ProtectedRoute>
  );
}

function ProfileContent() {
  const { user, isAdmin, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(formData);
      setEditing(false);
    } catch (err) {
      // Error is handled in updateProfile
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || "",
      phone: user?.phone || "",
    });
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            My Profile
          </h1>
          <p className="text-slate-300">
            View and manage your account information
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="card">
        {/* Avatar and Basic Info */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-ink-400/50">
          <div className="h-20 w-20 rounded-2xl bg-neon-500/30 flex items-center justify-center text-neon-100 text-3xl font-bold border border-neon-400/50">
            {user?.name?.[0]?.toUpperCase() ||
              user?.email?.[0]?.toUpperCase() ||
              "U"}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              {user?.name || "User"}
            </h2>
            <p className="text-slate-300">{user?.email}</p>
            <span
              className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                isAdmin
                  ? "bg-neon-500/30 text-neon-100 border border-neon-400/50"
                  : "bg-blue-500/30 text-blue-100 border border-blue-400/50"
              }`}
            >
              {user?.role?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Profile Form */}
        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="Enter your phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProfileField label="Name" value={user?.name} icon="👤" />
              <ProfileField label="Email" value={user?.email} icon="✉️" />
              <ProfileField label="Phone" value={user?.phone} icon="📞" />
              <ProfileField
                label="Member Since"
                value={
                  user?.created_at
                    ? new Date(user.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : null
                }
                icon="📅"
              />
            </div>

            <button
              onClick={() => setEditing(true)}
              className="btn btn-primary"
            >
              ✏️ Edit Profile
            </button>
          </div>
        )}
      </div>

      {/* Account Settings */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          Account Settings
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-ink-100/50 border border-ink-400/30">
            <div>
              <p className="font-semibold text-slate-100">Role</p>
              <p className="text-sm text-slate-400">
                Your account role determines what you can access
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isAdmin
                  ? "bg-neon-500/30 text-neon-100 border border-neon-400/50"
                  : "bg-blue-500/30 text-blue-100 border border-blue-400/50"
              }`}
            >
              {user?.role?.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-ink-100/50 border border-ink-400/30">
            <div>
              <p className="font-semibold text-slate-100">Email</p>
              <p className="text-sm text-slate-400">
                Your email cannot be changed
              </p>
            </div>
            <span className="text-slate-300">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Quick Links based on role */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {isAdmin ? (
            <>
              <QuickAction
                href="/admin/dashboard"
                icon="📊"
                label="Dashboard"
              />
              <QuickAction
                href="/sessions"
                icon="📋"
                label="View Voter Lists"
              />
              <QuickAction href="/upload" icon="📤" label="Upload Voter List" />
              <QuickAction href="/admin/users" icon="👥" label="Manage Users" />
              <QuickAction href="/admin/api-keys" icon="🔑" label="API Keys" />
              <QuickAction href="/admin/stats" icon="📈" label="Statistics" />
            </>
          ) : (
            <>
              <QuickAction href="/search" icon="🔍" label="Search Voters" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value, icon }) {
  return (
    <div className="p-3 rounded-xl bg-ink-100/30 border border-ink-400/30">
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <p className="font-semibold text-slate-100">{value || "—"}</p>
    </div>
  );
}

function QuickAction({ href, icon, label }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 p-3 rounded-xl bg-ink-100/50 border border-ink-400/30 hover:border-neon-400/50 hover:bg-ink-100 transition-all"
    >
      <span className="text-xl">{icon}</span>
      <span className="font-semibold text-slate-100">{label}</span>
    </a>
  );
}
