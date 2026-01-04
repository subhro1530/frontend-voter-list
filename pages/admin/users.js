import { useState, useEffect } from "react";
import ProtectedRoute from "../../components/ProtectedRoute";
import { adminAPI } from "../../lib/api";
import toast from "react-hot-toast";

export default function AdminUsersPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminUsersContent />
    </ProtectedRoute>
  );
}

function AdminUsersContent() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const loadUsers = () => {
    setLoading(true);
    setError("");
    adminAPI
      .getUsers()
      .then((res) => {
        setUsers(res.users || res || []);
      })
      .catch((err) => {
        setError(err.message || "Failed to load users");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleChangeRole = async (userId, newRole) => {
    setActionLoading(userId);
    try {
      await adminAPI.updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success("Role updated successfully");
    } catch (err) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setActionLoading("");
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (
      !window.confirm(`Are you sure you want to delete user "${userName}"?`)
    ) {
      return;
    }

    setActionLoading(userId);
    try {
      await adminAPI.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User deleted successfully");
    } catch (err) {
      toast.error(err.message || "Failed to delete user");
    } finally {
      setActionLoading("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            User Management
          </h1>
          <p className="text-slate-300">Manage user accounts and permissions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
        >
          + Add Admin
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-neon-400 border-t-transparent"></div>
          </div>
        ) : users.length > 0 ? (
          <div className="table-scroll">
            <table className="w-full text-sm sticky-header">
              <thead className="text-left">
                <tr className="text-slate-200">
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-ink-400/40 hover:bg-ink-100/50"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-neon-500/30 flex items-center justify-center text-neon-100 font-semibold border border-neon-400/50 text-sm">
                          {user.name?.[0]?.toUpperCase() ||
                            user.email?.[0]?.toUpperCase() ||
                            "U"}
                        </div>
                        <span className="font-semibold text-slate-100">
                          {user.name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-200">{user.email}</td>
                    <td className="p-3 text-slate-200">{user.phone || "—"}</td>
                    <td className="p-3">
                      <span
                        className={`badge ${
                          user.role === "admin"
                            ? "bg-neon-500/30 text-neon-100 border-neon-400/50"
                            : "bg-blue-500/30 text-blue-100 border-blue-400/50"
                        }`}
                      >
                        {user.role?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 text-xs">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <select
                          className="text-xs py-1 px-2 rounded-lg bg-ink-200 border border-ink-400"
                          value={user.role}
                          onChange={(e) =>
                            handleChangeRole(user.id, e.target.value)
                          }
                          disabled={actionLoading === user.id}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() =>
                            handleDeleteUser(user.id, user.name || user.email)
                          }
                          disabled={actionLoading === user.id}
                          className="btn btn-secondary text-xs py-1 px-2 text-rose-300 hover:bg-rose-900/30"
                        >
                          {actionLoading === user.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">No users found</div>
        )}
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <AddAdminModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}

function AddAdminModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError("Email and password are required");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await adminAPI.registerAdmin(formData);
      toast.success("Admin user created successfully");
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to create admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-ink-200 rounded-2xl border border-ink-400 shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-ink-400/50">
          <h3 className="text-lg font-semibold text-slate-100">
            Add Admin User
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              placeholder="Enter name"
              value={formData.name}
              onChange={(e) =>
                setFormData((p) => ({ ...p, name: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              placeholder="Enter email"
              value={formData.email}
              onChange={(e) =>
                setFormData((p) => ({ ...p, email: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              placeholder="Enter phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData((p) => ({ ...p, phone: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password">Password *</label>
            <input
              id="password"
              type="password"
              placeholder="Minimum 6 characters"
              value={formData.password}
              onChange={(e) =>
                setFormData((p) => ({ ...p, password: e.target.value }))
              }
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Admin"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
