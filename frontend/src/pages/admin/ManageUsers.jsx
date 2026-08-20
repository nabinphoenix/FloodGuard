import { useEffect, useMemo, useState } from "react";
import { Search, Shield, User, MapPin } from "lucide-react";
import { getUsers, updateUserRole } from "../../api/admin";
import AdminLayout from "../../components/AdminLayout";

const roles = ["public", "field_officer", "authority", "admin"];

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    async function loadUsers() {
      try {
        setUsers(await getUsers());
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load users.");
      } finally {
        setIsLoading(false);
      }
    }

    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const text = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesText =
        !text ||
        user.name?.toLowerCase().includes(text) ||
        user.email?.toLowerCase().includes(text) ||
        user.district?.toLowerCase().includes(text);
      const matchesRole = !roleFilter || user.role === roleFilter;
      return matchesText && matchesRole;
    });
  }, [users, query, roleFilter]);

  async function handleRoleChange(userId, role) {
    setUpdatingId(userId);
    setError("");
    setMessage("");

    try {
      const updated = await updateUserRole(userId, role);
      setUsers((current) =>
        current.map((user) => (user.id === userId ? { ...user, role: updated.role } : user))
      );
      setMessage("User role updated successfully.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update user role.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <AdminLayout title="Manage Users">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink-primary tracking-tight">Manage System Users</h1>
        <p className="mt-2 text-ink-secondary">Review user accounts, update roles, and manage permissions.</p>
      </div>

      <div className="mb-8 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-ink-secondary">
            <Search size={18} />
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, or district..."
            className="w-full rounded-xl border border-ink-border bg-white pl-11 pr-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm"
          />
        </div>
        <div className="relative md:w-64">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-ink-secondary">
            <Shield size={18} />
          </div>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="w-full rounded-xl border border-ink-border bg-white pl-11 pr-10 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm appearance-none font-medium"
          >
            <option value="">All Roles</option>
            {roles.map((role) => (
              <option key={role} value={role} className="capitalize">
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-ink-secondary">
             <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>

      {error && <div className="mb-6 rounded-lg border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm text-flood-emergency font-medium">{error}</div>}
      {message && <div className="mb-6 rounded-lg border border-flood-safe/20 bg-flood-safe/10 px-4 py-3 text-sm text-flood-safe font-medium">{message}</div>}

      <div className="overflow-hidden rounded-xl border border-ink-border bg-surface-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-border text-sm">
            <thead className="bg-surface-bg text-left text-xs uppercase tracking-wider text-ink-secondary font-semibold">
              <tr>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Alert Preferences</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4">Role Designation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-border bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent"></div>
                      <p className="text-ink-secondary font-medium">Loading user data...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-surface-bg flex items-center justify-center text-ink-secondary">
                        <User size={24} />
                      </div>
                      <p className="text-ink-primary font-medium text-lg">No users found</p>
                      <p className="text-ink-secondary">Try adjusting your search query or role filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-lg">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-ink-primary">{user.name}</p>
                          <p className="text-xs text-ink-secondary">{user.email}</p>
                          {user.phone && <p className="text-xs text-ink-secondary mt-0.5">{user.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-ink-primary font-medium">
                        <MapPin size={16} className="text-brand opacity-70" />
                        {user.district || <span className="text-ink-secondary italic">Not set</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 flex-wrap max-w-[150px]">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${user.email_alerts ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                          Email: {user.email_alerts ? "ON" : "OFF"}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${user.sms_alerts ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          SMS: {user.sms_alerts ? "ON" : "OFF"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-ink-secondary font-medium">{formatDate(user.created_at)}</td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        disabled={updatingId === user.id}
                        onChange={(event) => handleRoleChange(user.id, event.target.value)}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold capitalize outline-none transition-colors shadow-sm focus:ring-2 focus:ring-brand/20 disabled:opacity-50 cursor-pointer ${
                          user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200 focus:border-purple-500' :
                          user.role === 'authority' ? 'bg-blue-50 text-blue-700 border-blue-200 focus:border-blue-500' :
                          user.role === 'field_officer' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:border-emerald-500' :
                          'bg-white text-gray-700 border-gray-300 focus:border-brand'
                        }`}
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
