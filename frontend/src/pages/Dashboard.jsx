import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { rupiah, ptClass, shortDate } from "@/lib/format";
import { FileSpreadsheet, Receipt, CheckCircle2, Clock, TrendingUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [openPt, setOpenPt] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then(r => setStats(r.data)).catch(() => setStats(null));
  }, []);

  const exportExcel = async () => {
    try {
      const res = await api.get("/export/excel", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rekap_Bon.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel berhasil diunduh");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal export");
    }
  };

  if (!stats) return <div className="text-slate-500">Memuat…</div>;

  const cards = [
    { label: "Total Nota", value: stats.total_nota, icon: Receipt, color: "bg-slate-900" },
    { label: "Total Nominal", value: rupiah(stats.total_nominal), icon: TrendingUp, color: "bg-teal-600", mono: true },
    { label: "Sudah Lunas", value: stats.lunas, icon: CheckCircle2, color: "bg-emerald-600" },
    { label: "Belum Lunas", value: stats.belum_lunas, icon: Clock, color: "bg-amber-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">
            Periode aktif: <span className="font-semibold text-slate-800">{stats.periode?.nama || "-"}</span>
          </p>
        </div>
        <Button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700" data-testid="dashboard-export-excel">
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5 border-slate-200" data-testid={`stat-${c.label.toLowerCase().replace(/\s/g, "-")}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{c.label}</div>
                <div className={`mt-2 text-2xl font-bold text-slate-900 ${c.mono ? "font-mono" : ""}`}>{c.value}</div>
              </div>
              <div className={`w-10 h-10 rounded-lg ${c.color} text-white flex items-center justify-center`}>
                <c.icon className="w-5 h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5 border-slate-200">
        <h3 className="text-lg font-semibold tracking-tight text-slate-800 mb-4">Ringkasan per PT</h3>
        {stats.per_pt.length === 0 ? (
          <div className="text-sm text-slate-500">Belum ada data pada periode ini.</div>
        ) : (
          <div className="space-y-3">
            {stats.per_pt.map(p => (
              <div key={p.pt} className="border border-slate-200 rounded-lg overflow-hidden" data-testid={`pt-summary-${p.pt}`}>
                <button
                  onClick={() => setOpenPt(openPt === p.pt ? null : p.pt)}
                  className="w-full flex items-center justify-between gap-3 p-3 hover:bg-slate-50 transition text-left"
                  data-testid={`pt-toggle-${p.pt}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${ptClass(p.pt)}`}>{p.pt}</span>
                    <span className="text-xs text-emerald-700 font-semibold">Lunas {p.count_lunas} · {rupiah(p.total_lunas)}</span>
                    <span className="text-xs text-amber-600 font-semibold">Belum {p.count_belum} · {rupiah(p.total_belum)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{rupiah(p.total)}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition ${openPt === p.pt ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {openPt === p.pt && (
                  <div className="border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                    <NotaGroup title="Sudah Lunas" tone="emerald" pt={p.pt}
                      rows={p.notas.filter(n => n.status === "lunas")} />
                    <NotaGroup title="Belum Lunas" tone="amber" pt={p.pt}
                      rows={p.notas.filter(n => n.status !== "lunas")} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const NotaGroup = ({ title, tone, rows, pt }) => (
  <div className="overflow-x-auto" data-testid={`pt-group-${pt}-${tone === "emerald" ? "lunas" : "belum"}`}>
    <div className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${tone === "emerald" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
      {title} <span className="font-mono font-semibold">({rows.length})</span>
    </div>
    {rows.length === 0 ? (
      <div className="px-3 py-4 text-xs text-slate-400">Tidak ada nota</div>
    ) : (
      <table className="w-full text-xs">
        <thead className="bg-slate-50">
          <tr>{["No. Inv / Nota", "Tgl Invoice", "Nama Toko", "Nominal"].map(h => (
            <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map(n => (
            <tr key={n.nota_id} className="border-t border-slate-100" data-testid={`pt-nota-${pt}-${n.nota_id}`}>
              <td className="px-3 py-2 font-mono font-semibold text-slate-800">{n.no_nota}</td>
              <td className="px-3 py-2 font-mono whitespace-nowrap">{shortDate(n.tanggal)}</td>
              <td className="px-3 py-2">{n.toko}</td>
              <td className="px-3 py-2 font-mono">{rupiah(n.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);
