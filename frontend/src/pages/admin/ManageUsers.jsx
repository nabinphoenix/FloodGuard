import { useEffect, useMemo, useState } from "react";

import { getUsers, updateUserRole } from "../../api/admin";

const roles = ["citizen", "authority", "admin"];

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
      setMessage("User role updated.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update user role.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-950">Manage Users</h1>
          <p className="mt-1 text-sm text-slate-600">Review users and assign application roles.</p>
        </div>

        <div className="mb-6 grid gap-3 rounded-lg border border-blue-100 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, or district"
            className="rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
          />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-md border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="mb-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

        <div className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-blue-50 text-sm">
              <thead className="bg-blue-50 text-left text-xs uppercase tracking-wide text-blue-900">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">District</th>
                  <th className="px-5 py-3">Alerts</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-8 text-center text-slate-500">Loading users...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-8 text-center text-slate-500">No users match your filters.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        {user.phone && <p className="text-xs text-slate-500">{user.phone}</p>}
                      </td>
                      <td className="px-5 py-4 text-slate-700">{user.district || "-"}</td>
                      <td className="px-5 py-4 text-slate-700">
                        Email {user.email_alerts ? "on" : "off"} / SMS {user.sms_alerts ? "on" : "off"}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{formatDate(user.created_at)}</td>
                      <td className="px-5 py-4">
                        <select
                          value={user.role}
                          disabled={updatingId === user.id}
                          onChange={(event) => handleRoleChange(user.id, event.target.value)}
                          className="rounded-md border border-blue-200 bg-white px-3 py-2 capitalize outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
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
      </section>
    </main>
  );
}
