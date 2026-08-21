import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { dashboardPathForRole } from "../../utils/navigation";

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const user = await signIn(formData.email.trim(), formData.password);
      if (!user) throw new Error("Your session could not be established.");
      navigate(dashboardPathForRole(user.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Login failed. Please check your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-blue-50 px-4 py-12">
      <section className="w-full max-w-md rounded-lg border border-blue-100 bg-white p-8 shadow-xl shadow-blue-100">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-900">FloodGuard</h1>
          <p className="mt-2 text-sm text-blue-700">Sign in to access your FloodGuard account</p>
        </div>

        {error && <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-blue-950">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required value={formData.email} onChange={handleChange} className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200" placeholder="you@example.com" />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-blue-950">Password</label>
            <div className="relative mt-2">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={formData.password} onChange={handleChange} className="w-full rounded-md border border-blue-200 px-4 py-3 pr-12 text-blue-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200" placeholder="Enter your password" />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-blue-700" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          New to FloodGuard? <Link to="/register" className="font-semibold text-blue-700 hover:text-blue-900">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
