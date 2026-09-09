import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Star, Archive, CheckCircle2, Edit, Trash2, ArchiveRestore } from "lucide-react";
import { shortDate } from "@/lib/format";

export default function Periode() {
  const { user } = useAuth();
  const canEdit = ["admin", "operator"].includes(user?.role);
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ nama: "", tanggal_mulai: today, tanggal_selesai: today, is_active: true });

  const load = () => api.get("/periode").then(r => setRows(r.data));
  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditId(null);
    setForm({ nama: "", tanggal_mulai: today, tanggal_selesai: today, is_active: true });
    setOpen(true);
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setForm({ nama: p.nama, tanggal_mulai: p.tanggal_mulai, tanggal_selesai: p.tanggal_selesai, is_active: p.is_active });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nama) return toast.error("Nama periode wajib");
    try {
      if (editId) {
        await api.put(`/periode/${editId}`, form);
        toast.success("Periode diperbarui");
      } else {
        await api.post("/periode", form);
        toast.success("Periode tersimpan. Periode lama diarsipkan.");
      }
      setOpen(false); setEditId(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Hapus periode ${p.nama}?`)) return;
    try { await api.delete(`/periode/${p.id}`); toast.success("Periode dihapus"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal hapus"); }
  };

  const toggleArchive = async (p) => {
    try {
      const { data } = await api.post(`/periode/${p.id}/archive`);
      toast.success(data.is_archived ? "Periode diarsipkan" : "Arsip dibatalkan");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const activate = async (p) => {
    if (!window.confirm(`Aktifkan periode ${p.nama}? Periode aktif saat ini akan diarsipkan.`)) return;
    try { await api.post(`/periode/${p.id}/activate`); toast.success("Aktif"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Periode</h2>
          <p className="text-sm text-slate-500">Periode aktif akan digunakan untuk semua nota baru.</p>
        </div>
        {canEdit && (
          <Button onClick={startNew} className="bg-teal-600 hover:bg-teal-700" data-testid="periode-add">
            <Plus className="w-4 h-4 mr-2" /> Periode Baru
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(p => (
          <Card key={p.id} className={`p-4 border-slate-200 ${p.is_active ? "ring-2 ring-teal-500" : ""}`} data-testid={`periode-card-${p.id}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-slate-900">{p.nama}</div>
                <div className="text-xs text-slate-500 font-mono">
                  {shortDate(p.tanggal_mulai)} — {shortDate(p.tanggal_selesai)}
                </div>
              </div>
              {p.is_active ? (
                <Badge className="bg-teal-100 text-teal-800 border-teal-200"><Star className="w-3 h-3 mr-1" /> Aktif</Badge>
              ) : p.is_archived ? (
                <Badge variant="outline" className="text-slate-600"><Archive className="w-3 h-3 mr-1" /> Arsip</Badge>
              ) : (
                <Badge variant="outline">Draft</Badge>
              )}
            </div>
            {canEdit && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {!p.is_active && (
                  <Button size="sm" variant="outline" onClick={() => activate(p)} data-testid={`periode-activate-${p.id}`}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Aktifkan
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => startEdit(p)} data-testid={`periode-edit-${p.id}`}>
                  <Edit className="w-4 h-4 mr-1" /> Edit
                </Button>
                {!p.is_active && (
                  <Button size="sm" variant="outline" onClick={() => toggleArchive(p)} data-testid={`periode-archive-${p.id}`}>
                    {p.is_archived ? <><ArchiveRestore className="w-4 h-4 mr-1" /> Buka Arsip</> : <><Archive className="w-4 h-4 mr-1" /> Arsipkan</>}
                  </Button>
                )}
                {isAdmin && !p.is_active && (
                  <Button size="sm" variant="outline" onClick={() => remove(p)}
                    className="border-red-200 text-red-600 hover:bg-red-50" data-testid={`periode-del-${p.id}`}>
                    <Trash2 className="w-4 h-4 mr-1" /> Hapus
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{editId ? "Edit Periode" : "Periode Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama Periode</Label><Input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Contoh: Periode Juli 2026" data-testid="periode-form-nama" /></div>
            <div><Label>Tanggal Mulai</Label><Input type="date" value={form.tanggal_mulai} onChange={e => setForm({ ...form, tanggal_mulai: e.target.value })} data-testid="periode-form-mulai" /></div>
            <div><Label>Tanggal Selesai</Label><Input type="date" value={form.tanggal_selesai} onChange={e => setForm({ ...form, tanggal_selesai: e.target.value })} data-testid="periode-form-selesai" /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} data-testid="periode-form-active" />
              Aktifkan segera (periode lama akan diarsipkan)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-teal-600 hover:bg-teal-700" data-testid="periode-form-save">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
