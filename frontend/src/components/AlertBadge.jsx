const styles = {
  safe: "bg-green-100 text-green-800 ring-green-200",
  watch: "bg-yellow-100 text-yellow-800 ring-yellow-200",
  warning: "bg-orange-100 text-orange-800 ring-orange-200",
  emergency: "bg-red-100 text-red-800 ring-red-200",
};

export default function AlertBadge({ level = "safe" }) {
  const normalizedLevel = String(level || "safe").toLowerCase();
  const badgeStyle = styles[normalizedLevel] || styles.safe;

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${badgeStyle}`}
    >
      {normalizedLevel}
    </span>
  );
}
