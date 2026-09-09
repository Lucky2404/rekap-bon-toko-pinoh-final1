import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Edit, Trash2, Sparkles, MessageSquare, Check, X } from "lucide-react";

const empty = { nama: "", rekening: "", bank: "", atas_nama: "", whatsapp: "", sapaan: "Bapak", alamat: "" };

export default function TokoPage() {
  const { user } = useAuth();
  const canEdit = ["admin", "operator"].includes(user?.role);
  const canDel = user?.role === "admin";
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [sapaanList, setSapaanList] = useState([]);
  const [sapaanOpen, setSapaanOpen] = useState(false);

  const load = () => api.get("/toko").then(r => setRows(r.data));
  const loadSapaan = () => api.get("/sapaan").then(r => setSapaanList(r.data));
  useEffect(() => { load(); loadSapaan(); }, []);

  const detectBank = async () => {
    if (!form.rekening) return;
    const r = await api.get("/bank/detect", { params: { rekening: form.rekening } });
    if (r.data.bank) {
      setForm(f => ({ ...f, bank: r.data.bank }));
      toast.info(`Deteksi: ${r.data.bank} (silakan konfirmasi manual)`);
    } else {
      toast.warning("Bank tidak terdeteksi, isi manual");
    }
  };

  const save = async () => {
    if (!form.nama) return toast.error("Nama toko wajib");
    try {
      if (form.id) await api.put(`/toko/${form.id}`, form);
      else await api.post("/toko", form);
      toast.success("Toko tersimpan"); setOpen(false); setForm(empty); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const remove = async (t) => {
    if (!window.confirm(`Hapus toko ${t.nama}?`)) return;
    try { await api.delete(`/toko/${t.id}`); toast.success("Terhapus"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Data Toko</h2>
          <p className="text-sm text-slate-500">{rows.length} toko terdaftar</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setSapaanOpen(true)} data-testid="sapaan-manage-open">
              <MessageSquare className="w-4 h-4 mr-2" /> Kelola Sapaan
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => { setForm(empty); setOpen(true); }} className="bg-teal-600 hover:bg-teal-700" data-testid="toko-add">
              <Plus className="w-4 h-4 mr-2" /> Tambah Toko
            </Button>
          )}
        </div>
      </div>

      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-xs table-sticky">
            <thead>
              <tr>{["Toko", "Rekening", "Bank", "A.n", "WhatsApp", "Sapaan", "Alamat", ""].map(h =>
                <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500 py-8">Belum ada toko</td></tr>}
              {rows.map(t => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`toko-row-${t.id}`}>
                  <td className="px-3 py-2 font-medium text-slate-800">{t.nama}</td>
                  <td className="px-3 py-2 font-mono">{t.rekening}</td>
                  <td className="px-3 py-2">{t.bank}</td>
                  <td className="px-3 py-2">{t.atas_nama}</td>
                  <td className="px-3 py-2 font-mono">{t.whatsapp}</td>
                  <td className="px-3 py-2">{t.sapaan}</td>
                  <td className="px-3 py-2 max-w-xs truncate">{t.alamat}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {canEdit && <Button size="icon" variant="ghost" onClick={() => { setForm(t); setOpen(true); }} data-testid={`toko-edit-${t.id}`}><Edit className="w-4 h-4" /></Button>}
                      {canDel && <Button size="icon" variant="ghost" onClick={() => remove(t)} data-testid={`toko-del-${t.id}`}><Trash2 className="w-4 h-4 text-red-600" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "Edit Toko" : "Tambah Toko"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Nama Toko</Label><Input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} data-testid="toko-form-nama" /></div>
            <div>
              <Label>Rekening</Label>
              <div className="flex gap-2">
                <Input value={form.rekening} onChange={e => setForm({ ...form, rekening: e.target.value })} data-testid="toko-form-rekening" />
                <Button variant="outline" size="icon" onClick={detectBank} title="Deteksi bank" data-testid="detect-bank"><Sparkles className="w-4 h-4" /></Button>
              </div>
            </div>
            <div><Label>Bank</Label><Input value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} data-testid="toko-form-bank" /></div>
            <div><Label>Atas Nama</Label><Input value={form.atas_nama} onChange={e => setForm({ ...form, atas_nama: e.target.value })} data-testid="toko-form-atasnama" /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} placeholder="08xx / 62xx" onChange={e => setForm({ ...form, whatsapp: e.target.value })} data-testid="toko-form-wa" /></div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Sapaan</Label>
                {canEdit && <button type="button" onClick={() => setSapaanOpen(true)} className="text-[11px] text-teal-700 hover:underline" data-testid="sapaan-manage-inline">Kelola</button>}
              </div>
              <Select value={form.sapaan} onValueChange={v => setForm({ ...form, sapaan: v })}>
                <SelectTrigger data-testid="toko-form-sapaan"><SelectValue placeholder="Pilih sapaan" /></SelectTrigger>
                <SelectContent>
                  {sapaanList.map(s => <SelectItem key={s.id} value={s.nama}>{s.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Alamat</Label><Textarea value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} data-testid="toko-form-alamat" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-teal-600 hover:bg-teal-700" data-testid="toko-form-save">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SapaanManager open={sapaanOpen} setOpen={setSapaanOpen} list={sapaanList} reload={loadSapaan} canDel={canDel} />
    </div>
  );
}

const SapaanManager = ({ open, setOpen, list, reload, canDel }) => {
  const [newNama, setNewNama] = useState("");
  const [editId, setEditId] = useState(null);
  const [editNama, setEditNama] = useState("");

  const add = async () => {
    if (!newNama.trim()) return toast.error("Isi sapaan dulu");
    try { await api.post("/sapaan", { nama: newNama.trim() }); setNewNama(""); toast.success("Sapaan ditambah"); reload(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const saveEdit = async (id) => {
    if (!editNama.trim()) return toast.error("Isi sapaan dulu");
    try { await api.put(`/sapaan/${id}`, { nama: editNama.trim() }); setEditId(null); toast.success("Sapaan diperbarui"); reload(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Hapus sapaan "${s.nama}"?`)) return;
    try { await api.delete(`/sapaan/${s.id}`); toast.success("Sapaan dihapus"); reload(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader><DialogTitle>Kelola Sapaan</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Sapaan baru, mis. Toko / Sdr" value={newNama}
              onChange={e => setNewNama(e.target.value)}
              onKeyDown={e => e.key === "Enter" && add()} data-testid="sapaan-new-input" />
            <Button onClick={add} className="bg-teal-600 hover:bg-teal-700" data-testid="sapaan-add-btn"><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto border border-slate-200 rounded-md">
            {list.length === 0 && <div className="text-center text-slate-500 py-6 text-sm">Belum ada sapaan</div>}
            {list.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2" data-testid={`sapaan-row-${s.id}`}>
                {editId === s.id ? (
                  <>
                    <Input value={editNama} onChange={e => setEditNama(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveEdit(s.id)} className="h-8" data-testid={`sapaan-edit-input-${s.id}`} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(s.id)} data-testid={`sapaan-edit-save-${s.id}`}><Check className="w-4 h-4 text-emerald-600" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(null)}><X className="w-4 h-4 text-slate-500" /></Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-800">{s.nama}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditId(s.id); setEditNama(s.nama); }} data-testid={`sapaan-edit-${s.id}`}><Edit className="w-4 h-4" /></Button>
                    {canDel && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(s)} data-testid={`sapaan-del-${s.id}`}><Trash2 className="w-4 h-4 text-red-600" /></Button>}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
