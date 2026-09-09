export const rupiah = (n) => {
  const v = Number(n || 0);
  return "Rp " + v.toLocaleString("id-ID", { maximumFractionDigits: 0 });
};

export const shortDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

export const PT_COLOR = {
  MAL: "bg-sky-100 text-sky-800 border-sky-200",
  SJM: "bg-amber-100 text-amber-800 border-amber-200",
  LOGPOND: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "TAYAN 01": "bg-violet-100 text-violet-800 border-violet-200",
  "TAYAN 04": "bg-rose-100 text-rose-800 border-rose-200",
  MSB: "bg-red-100 text-red-800 border-red-200",
};

export const ptClass = (name) =>
  PT_COLOR[name] || "bg-slate-100 text-slate-700 border-slate-200";
