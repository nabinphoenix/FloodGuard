import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { resetPassword } from "../../api/auth";
import PasswordInput from "../../components/PasswordInput";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(token ? "" : "This password reset link is invalid or has expired.");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) {
      setError("This password reset link is invalid or has expired.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await resetPassword(token, newPassword);
      setMessage(response.message || "Password reset successful.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.detail || "This password reset link is invalid or has expired.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-blue-50 px-4 py-12">
      <section className="w-full max-w-md rounded-lg border border-blue-100 bg-white p-8 shadow-xl shadow-blue-100">
        <div className="text-center"><h1 className="text-3xl font-bold text-blue-900">Set a new password</h1><p className="mt-2 text-sm leading-6 text-blue-700">Choose a new password for your FloodGuard account.</p></div>
        {message && <div className="mt-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm leading-6 text-green-800" role="status">{message} <Link to="/login" className="font-bold underline">Sign in</Link></div>}
        {error && <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}
        {!message && <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div><label htmlFor="new-password" className="block text-sm font-medium text-blue-950">New password</label><PasswordInput id="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} className="mt-2" /></div>
          <div><label htmlFor="confirm-password" className="block text-sm font-medium text-blue-950">Confirm new password</label><PasswordInput id="confirm-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} className="mt-2" /></div>
          <button type="submit" disabled={isSubmitting || !token} className="w-full rounded-md bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300">{isSubmitting ? "Updating..." : "Update password"}</button>
        </form>}
        <p className="mt-6 text-center text-sm text-slate-600"><Link to="/forgot-password" className="font-semibold text-blue-700 hover:text-blue-900">Request a new reset link</Link></p>
      </section>
    </main>
  );
}
