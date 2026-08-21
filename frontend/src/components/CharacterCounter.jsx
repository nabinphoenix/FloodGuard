export default function CharacterCounter({ value, maxLength, minLength = 0 }) {
  const length = value?.length || 0;
  const nearLimit = length >= maxLength * 0.9;
  const belowMinimum = minLength > 0 && length > 0 && length < minLength;

  return (
    <p className={`mt-1 text-xs ${nearLimit || belowMinimum ? "font-semibold text-amber-700" : "text-ink-secondary"}`} aria-live="polite">
      {length} / {maxLength} characters{minLength > 0 ? ` · Minimum ${minLength}` : ""}
    </p>
  );
}
