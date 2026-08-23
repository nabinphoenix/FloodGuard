import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  KeyRound,
  MapPin,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react";

import {
  createUser,
  deleteUser,
  getUsers,
  resetUserPassword,
  updateUser,
  updateUserRole,
} from "../../api/admin";
import AdminLayout from "../../components/AdminLayout";
import AdminPagination from "../../components/AdminPagination";
import ConfirmDialog from "../../components/ConfirmDialog";
import FeedbackMessage from "../../components/FeedbackMessage";
import { backendError, validatePhone } from "../../utils/validation";

const roles = ["public", "field_officer", "authority", "admin"];
const ITEMS_PER_PAGE = 5;

const emptyUser = {
  name: "",
  email: "",
  phone: "",
  district: "",
  password: "",
  role: "public",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function roleLabel(role) {
  return role.replaceAll("_", " ");
}

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const [modal, setModal] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState(emptyUser);
  const [resetPassword, setResetPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmation, setConfirmation] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  async function loadUsers() {
    setIsLoading(true);
    try {
      setUsers(await getUsers());
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load users.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
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
      return matchesText && (!roleFilter || user.role === roleFilter);
    });
  }, [users, query, roleFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const paginatedUsers = useMemo(
    () => filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredUsers, currentPage],
  );
  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  function closeModal() {
    setModal(null);
    setSelectedUser(null);
    setFormData(emptyUser);
    setResetPassword("");
  }

  function openCreate() {
    setError("");
    setFormData(emptyUser);
    setModal("create");
  }

  function openView(user) {
    setError("");
    setSelectedUser(user);
    setModal("view");
  }

  function openEdit(user) {
    setError("");
    setSelectedUser(user);
    setFormData({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      district: user.district || "",
    });
    setModal("edit");
  }

  function openReset(user) {
    setError("");
    setSelectedUser(user);
    setResetPassword("");
    setModal("reset");
  }

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  }

  function replaceUser(updated) {
    setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
    setSelectedUser(updated);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const nextFieldErrors = {};
    if (formData.name.trim().length < 2) nextFieldErrors.name = "Name must be at least 2 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) nextFieldErrors.email = "Enter a valid email address.";
    const phoneError = validatePhone(formData.phone);
    if (phoneError) nextFieldErrors.phone = phoneError;
    if (modal === "create" && formData.password.length < 8) nextFieldErrors.password = "Password must be at least 8 characters.";
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        district: formData.district.trim() || null,
      };
      if (modal === "create") {
        const created = await createUser({ ...payload, password: formData.password, role: formData.role });
        setUsers((current) => [created, ...current]);
        setCurrentPage(1);
        setMessage("User created successfully.");
      } else {
        const updated = await updateUser(selectedUser.id, payload);
        replaceUser(updated);
        setMessage(updated.email !== selectedUser.email && updated.email_alerts === false ? "User updated. Email alerts were disabled and must be enabled again by the user." : "User updated successfully.");
      }
      closeModal();
    } catch (err) {
      setError(backendError(err, "Could not save the user."));
    } finally {
      setIsSaving(false);
    }
  }
  async function handleRoleChange(userId, role) {
    setWorkingId(userId);
    setError("");
    setMessage("");
    try {
      replaceUser(await updateUserRole(userId, role));
      setMessage("User role updated successfully.");
    } catch (err) {
      setError(backendError(err, "Could not update user role."));
      await loadUsers();
    } finally {
      setWorkingId(null);
    }
  }

  async function handleReset(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);
    try {
      replaceUser(await resetUserPassword(selectedUser.id, resetPassword));
      closeModal();
      setMessage("Password reset successfully.");
    } catch (err) {
      setError(backendError(err, "Could not reset the password."));
    } finally {
      setIsSaving(false);
    }
  }

  function requestDelete(user) {
    setError("");
    setConfirmation(user);
  }

  async function confirmDelete() {
    const user = confirmation;
    if (!user) return;
    setWorkingId(user.id);
    setError("");
    setMessage("");
    try {
      await deleteUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setMessage("User deleted successfully.");
    } catch (err) {
      setError(backendError(err, "Could not delete the user."));
    } finally {
      setWorkingId(null);
      setConfirmation(null);
    }
  }
  return (
    <AdminLayout title="Manage Users">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-primary">Manage System Users</h1>
          <p className="mt-2 text-ink-secondary">Create accounts, manage roles, and protect historical records.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-gradientEnd px-4 py-3 font-bold text-white shadow-md transition hover:shadow-lg">
          <Plus size={18} /> Add User
        </button>
      </div>

      <div className="mb-8 flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-4 text-ink-secondary" size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email, or district..." className="w-full rounded-xl border border-ink-border bg-white py-3 pl-11 pr-4 shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>
        <div className="relative md:w-64">
          <Shield className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-4 text-ink-secondary" size={18} />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="w-full appearance-none rounded-xl border border-ink-border bg-white py-3 pl-11 pr-10 font-medium capitalize shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
            <option value="">All Roles</option>
            {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
          </select>
        </div>
      </div>

      <FeedbackMessage message={error} />
      <FeedbackMessage message={message} type="success" />

      <div className="overflow-hidden rounded-xl border border-ink-border bg-surface-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-border text-sm">
            <thead className="bg-surface-bg text-left text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              <tr><th className="px-6 py-4">User Details</th><th className="px-6 py-4">Location</th><th className="px-6 py-4">Email Alerts</th><th className="px-6 py-4">Joined</th><th className="px-6 py-4">Role</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-border bg-white">
              {isLoading ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center"><div className="flex flex-col items-center gap-3"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" /><p className="font-medium text-ink-secondary">Loading user data...</p></div></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center"><User className="mx-auto text-ink-secondary" size={28} /><p className="mt-3 text-lg font-medium text-ink-primary">No users found</p></td></tr>
              ) : paginatedUsers.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-lg font-bold text-brand">{user.name.charAt(0).toUpperCase()}</div><div><p className="font-bold text-ink-primary">{user.name}</p><p className="text-xs text-ink-secondary">{user.email}</p>{user.phone && <p className="mt-0.5 text-xs text-ink-secondary">{user.phone}</p>}</div></div></td>
                  <td className="px-6 py-4"><div className="flex items-center gap-1.5 font-medium text-ink-primary"><MapPin size={16} className="text-brand opacity-70" />{user.district || <span className="italic text-ink-secondary">Not set</span>}</div></td>
                  <td className="px-6 py-4"><span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${user.email_alert_status === "confirmed" ? "bg-green-100 text-green-800" : user.email_alert_status === "pending" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>{user.email_alert_status === "confirmed" ? "Confirmed" : user.email_alert_status === "pending" ? "Pending" : "Disabled"}</span></td>
                  <td className="px-6 py-4 font-medium text-ink-secondary">{formatDate(user.created_at)}</td>
                  <td className="px-6 py-4"><select value={user.role} disabled={workingId === user.id} onChange={(event) => handleRoleChange(user.id, event.target.value)} className="rounded-lg border border-ink-border bg-white px-3 py-1.5 text-sm font-semibold capitalize shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50">{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></td>
                  <td className="px-6 py-4"><div className="flex justify-end gap-1"><button type="button" title="View user" onClick={() => openView(user)} className="rounded-lg p-2 text-brand hover:bg-brand/10"><Eye size={17} /></button><button type="button" title="Edit user" onClick={() => openEdit(user)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Pencil size={17} /></button><button type="button" title="Reset password" onClick={() => openReset(user)} className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"><KeyRound size={17} /></button><button type="button" title="Delete user" disabled={workingId === user.id} onClick={() => requestDelete(user)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={17} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredUsers.length}
          pageSize={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between"><div><h2 className="text-xl font-bold capitalize text-ink-primary">{modal === "view" ? "User details" : modal === "reset" ? "Reset password" : modal === "create" ? "Add user" : "Edit user"}</h2><p className="mt-1 text-sm text-ink-secondary">{selectedUser?.email || "Create a managed FloodGuard account."}</p></div><button type="button" onClick={closeModal} className="rounded-lg p-2 text-ink-secondary hover:bg-slate-100"><X size={20} /></button></div>
            <FeedbackMessage message={error} />
            {modal === "view" && selectedUser && <div className="grid gap-4 sm:grid-cols-2">{[["Name", selectedUser.name], ["Email", selectedUser.email], ["Phone", selectedUser.phone || "Not set"], ["District", selectedUser.district || "Not set"], ["Role", roleLabel(selectedUser.role)], ["Joined", formatDate(selectedUser.created_at)], ["Email alerts", roleLabel(selectedUser.email_alert_status || "disabled")]].map(([label, value]) => <div key={label} className="rounded-xl border border-ink-border bg-surface-bg p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">{label}</p><p className="mt-1 font-semibold capitalize text-ink-primary">{value}</p></div>)}</div>}
            {modal === "reset" && <form onSubmit={handleReset} className="space-y-4"><p className="text-sm text-ink-secondary">Set a new password for this account. The password is never displayed after saving.</p><label className="block text-sm font-semibold text-ink-primary">New password<input type="password" required minLength="8" maxLength="128" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" /></label><button disabled={isSaving} className="w-full rounded-lg bg-brand px-4 py-3 font-bold text-white disabled:opacity-60">{isSaving ? "Resetting..." : "Reset password"}</button></form>}
            {(modal === "create" || modal === "edit") && <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-ink-primary">Full name<input required minLength="2" value={formData.name} onChange={(event) => updateField("name", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />{fieldErrors.name && <span className="mt-1 block text-xs font-normal text-red-600">{fieldErrors.name}</span>}</label><label className="text-sm font-semibold text-ink-primary">Email<input required type="email" value={formData.email} onChange={(event) => updateField("email", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />{fieldErrors.email && <span className="mt-1 block text-xs font-normal text-red-600">{fieldErrors.email}</span>}</label><label className="text-sm font-semibold text-ink-primary">Phone<input type="text" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" value={formData.phone} onChange={(event) => updateField("phone", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />{fieldErrors.phone && <span className="mt-1 block text-xs font-normal text-red-600">{fieldErrors.phone}</span>}</label><label className="text-sm font-semibold text-ink-primary">District<input value={formData.district} onChange={(event) => updateField("district", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" /></label>{modal === "create" && <><label className="text-sm font-semibold text-ink-primary">Initial password<input required type="password" minLength="8" value={formData.password} onChange={(event) => updateField("password", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />{fieldErrors.password && <span className="mt-1 block text-xs font-normal text-red-600">{fieldErrors.password}</span>}</label><label className="text-sm font-semibold text-ink-primary">Role<select value={formData.role} onChange={(event) => updateField("role", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border bg-white px-4 py-3 capitalize outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label></>}<p className="rounded-lg border border-ink-border bg-surface-bg p-4 text-sm text-ink-secondary sm:col-span-2">Email alerts are controlled by the user from Profile &amp; Alerts. New accounts start disabled, and changing an email address disables alerts until the user enables them again.</p><button disabled={isSaving} className="rounded-lg bg-brand px-4 py-3 font-bold text-white sm:col-span-2 disabled:opacity-60">{isSaving ? "Saving..." : modal === "create" ? "Create user" : "Save changes"}</button></form>}
          </div>
        </div>
      )}
      <ConfirmDialog open={Boolean(confirmation)} title="Delete user?" description={confirmation ? `Are you sure you want to delete ${confirmation.name}? This action cannot be undone.` : ""} confirmLabel="Delete User" onCancel={() => setConfirmation(null)} onConfirm={confirmDelete} isConfirming={workingId === confirmation?.id} danger />
    </AdminLayout>
  );
}
