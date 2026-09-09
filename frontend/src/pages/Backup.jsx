import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DatabaseBackup, Download, Trash2, Plus } from "lucide-react";

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

export default function Backup() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/backup").then(r => setRows(r.data)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try { await api.post("/backup"); toast.success("Backup dibuat"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal backup"); }
    finally { setBusy(false); }
  };

  const download = async (name) => {
    try {
      const res = await api.get(`/backup/download/${name}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup diunduh");
    } catch (e) { toast.error("Gagal unduh backup"); }
  };

  const remove = async (name) => {
    if (!window.confirm(`Hapus backup ${name}?`)) return;
    try { await api.delete(`/backup/${name}`); toast.success("Backup dihapus"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal hapus"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Backup Data</h2>
          <p className="text-sm text-slate-500">Salinan database MongoDB (snapshot JSON). Bisa diunduh dan dihapus kapan saja.</p>
        </div>
        <Button onClick={create} disabled={busy} className="bg-teal-600 hover:bg-teal-700" data-testid="backup-create">
          <Plus className="w-4 h-4 mr-2" /> Buat Backup Sekarang
        </Button>
      </div>

      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="backup-table">
            <thead>
              <tr className="bg-slate-900 text-white">
                {["Nama File", "Ukuran", "Dibuat", "Aksi"].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-semibold text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="text-center text-slate-500 py-10">
                  <DatabaseBackup className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Belum ada backup
                </td></tr>
              )}
              {rows.map(b => (
                <tr key={b.name} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`backup-row-${b.name}`}>
                  <td className="px-4 py-2 font-mono text-xs">{b.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{kb(b.size)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{new Date(b.created).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => download(b.name)} data-testid={`backup-download-${b.name}`}>
                        <Download className="w-3.5 h-3.5 mr-1" /> Unduh
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove(b.name)}
                        className="border-red-200 text-red-600 hover:bg-red-50" data-testid={`backup-delete-${b.name}`}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
