import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Edit, Trash2 } from "lucide-react";
import { ptClass } from "@/lib/format";

export default function PTPage() {
  const { user } = useAuth();
  const canEdit = ["admin", "operator"].includes(user?.role);
  const canDel = user?.role === "admin";
  const [rows, setRows] = useState([]);
  const [nama, setNama] = useState("");
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/pt").then(r => setRows(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!nama.trim()) return;
    try {
      if (editing) await api.put(`/pt/${editing.id}`, { nama });
      else await api.post("/pt", { nama });
      setNama(""); setEditing(null); toast.success("Tersimpan"); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Hapus PT ${p.nama}?`)) return;
    try { await api.delete(`/pt/${p.id}`); toast.success("Terhapus"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">PT (Perusahaan)</h2>
        <p className="text-sm text-slate-500">{rows.length} PT terdaftar</p>
      </div>

      {canEdit && (
        <Card className="p-4 border-slate-200 flex gap-2 items-end max-w-xl">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-600">Nama PT</label>
            <Input value={nama} onChange={e => setNama(e.target.value)} placeholder="Contoh: MAL" data-testid="pt-input" />
          </div>
          <Button onClick={save} className="bg-teal-600 hover:bg-teal-700" data-testid="pt-save">
            <Plus className="w-4 h-4 mr-1" /> {editing ? "Update" : "Tambah"}
          </Button>
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setNama(""); }}>Batal</Button>}
        </Card>
      )}

      <Card className="p-4 border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {rows.map(p => (
            <div key={p.id} className={`p-3 rounded-lg border flex items-center justify-between ${ptClass(p.nama)}`} data-testid={`pt-item-${p.id}`}>
              <div className="font-semibold">{p.nama}</div>
              <div className="flex gap-1">
                {canEdit && <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setNama(p.nama); }} data-testid={`pt-edit-${p.id}`}><Edit className="w-4 h-4" /></Button>}
                {canDel && <Button size="icon" variant="ghost" onClick={() => remove(p)} data-testid={`pt-del-${p.id}`}><Trash2 className="w-4 h-4 text-red-700" /></Button>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
