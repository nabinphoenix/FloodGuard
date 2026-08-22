import { useState } from "react";
import { Link } from "react-router-dom";

import { forgotPassword } from "../../api/auth";

const GENERIC_MESSAGE =
  "If an account exists for this email and password recovery is enabled, check your inbox for reset instructions.";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const response = await forgotPassword(email.trim());
      setMessage(response.message || GENERIC_MESSAGE);
    } catch (err) {
      setError(err.response?.data?.detail || "We could not process that request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-blue-50 px-4 py-12">
      <section className="w-full max-w-md rounded-lg border border-blue-100 bg-white p-8 shadow-xl shadow-blue-100">
        <div className="text-center"><h1 className="text-3xl font-bold text-blue-900">Forgot password?</h1><p className="mt-2 text-sm leading-6 text-blue-700">Enter your account email. If password recovery is enabled and confirmed, FloodGuard will send the reset link to your inbox.</p></div>
        {message && <div className="mt-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm leading-6 text-green-800" role="status">{message}</div>}
        {error && <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}
        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div><label htmlFor="forgot-email" className="block text-sm font-medium text-blue-950">Email address</label><input id="forgot-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200" placeholder="you@example.com" /></div>
          <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300">{isSubmitting ? "Sending..." : "Send reset link"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600"><Link to="/login" className="font-semibold text-blue-700 hover:text-blue-900">Return to sign in</Link></p>
      </section>
    </main>
  );
}
