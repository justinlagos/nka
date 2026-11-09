const SYMBOL: Record<string, string> = { gbp: "£", usd: "$", eur: "€", ngn: "₦" };

export function money(amount: number | string | null | undefined, currency = "gbp", digits = 0): string {
  const n = typeof amount === "string" ? Number(amount) : amount ?? 0;
  if (!Number.isFinite(n)) return "–";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${sign}${SYMBOL[currency] ?? ""}${abs}`;
}

export function date(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

export function fileSize(bytes: number | null | undefined): string {
  const b = bytes ?? 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function projectRef(n: number | string): string {
  return `NKA-${n}`;
}

// Storage-safe file name: keeps the extension, drops anything odd.
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(-120);
  return cleaned.replace(/^\.+/, "") || "file";
}

export function initials(name: string | null | undefined, email?: string | null): string {
  const source = (name || "").trim() || (email || "").split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}
