import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export default function PasswordInput({
  id,
  name,
  value,
  onChange,
  autoComplete,
  placeholder,
  required = true,
  minLength,
  maxLength,
  className = "",
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={showPassword ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        value={value}
        onChange={onChange}
        className={`w-full rounded-md border border-blue-200 px-4 py-3 pr-12 text-blue-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200 ${className}`}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShowPassword((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-blue-700"
        aria-label={showPassword ? "Hide password" : "Show password"}
        aria-pressed={showPassword}
      >
        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}
