import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { register } from "../../api/auth";
import { getPublicGeography } from "../../api/public";
import Button from "../../components/Button";
import FeedbackMessage from "../../components/FeedbackMessage";
import PasswordInput from "../../components/PasswordInput";
import { backendError, validatePhone } from "../../utils/validation";

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    district: "",
  });

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [geography, setGeography] = useState(null);

  const districts = geography?.provinces?.flatMap((province) => (
    province.districts?.map((item) => item.name) || []
  )) || [];

  useEffect(() => {
    let ignore = false;
    getPublicGeography()
      .then((data) => {
        if (!ignore) setGeography(data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [name]: "",
    }));
    setError("");
  }

  function validateForm() {
    const errors = {};

    if (formData.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Enter a valid email address.";
    }

    if (formData.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    const phoneError = validatePhone(formData.phone);
    if (phoneError) {
      errors.phone = phoneError;
    }

    if (!formData.district) {
      errors.district = "Please select your district.";
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim() || null,
        district: formData.district,
      });

      navigate("/login");
    } catch (err) {
      setError(backendError(err, "Registration failed. Please check your details."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-blue-50 flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-xl shadow-blue-100 border border-blue-100">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-900">
            Create Account
          </h1>

          <p className="mt-2 text-sm text-blue-700">
            Join FloodGuard to receive flood alerts for your area
          </p>
        </div>

        <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-900">
            Account type: Public User
          </p>

          <p className="mt-1 text-xs text-blue-700">
            Authority, Field Officer, and Administrator roles are assigned
            by an administrator after registration.
          </p>
        </div>

        <FeedbackMessage message={error} onDismiss={() => setError("")} />

        <form
          className="grid gap-5 md:grid-cols-2"
          onSubmit={handleSubmit}
        >
          <div className="md:col-span-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-blue-950"
            >
              Full name
            </label>

            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="Your full name"
            />

            {fieldErrors.name && (
              <p className="mt-2 text-sm text-red-600">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-blue-950"
            >
              Email address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="you@example.com"
            />

            {fieldErrors.email && (
              <p className="mt-2 text-sm text-red-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-blue-950"
            >
              Phone number
            </label>

            <input
              id="phone"
              name="phone"
              type="text"
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{10}"
              autoComplete="tel"
              value={formData.phone}
              onChange={handleChange}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="9812345678"
            />
            {fieldErrors.phone && <p className="mt-2 text-sm text-red-600">{fieldErrors.phone}</p>}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-blue-950"
            >
              Password
            </label>

            <PasswordInput id="password" name="password" value={formData.password} onChange={handleChange} autoComplete="new-password" placeholder="At least 8 characters" minLength={8} maxLength={128} className="mt-2" />

            {fieldErrors.password && (
              <p className="mt-2 text-sm text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="district"
              className="block text-sm font-medium text-blue-950"
            >
              District
            </label>

            <select
              id="district"
              name="district"
              required
              value={formData.district}
              onChange={handleChange}
              className="mt-2 w-full rounded-md border border-blue-200 bg-white px-4 py-3 text-blue-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Select district</option>

              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>

            {fieldErrors.district && (
              <p className="mt-2 text-sm text-red-600">
                {fieldErrors.district}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <Button type="submit" isLoading={isSubmitting} loadingLabel="Creating account..." className="w-full rounded-md bg-blue-700 px-4 py-3 text-base hover:bg-blue-800">Create account</Button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-blue-700 hover:text-blue-900"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
