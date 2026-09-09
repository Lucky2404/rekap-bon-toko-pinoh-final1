import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Database } from "lucide-react";

const empty = { username: "", password: "", full_name: "", role: "user", is_active: true };

export default function Users() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [backups, setBackups] = useState([]);

  const load = () => api.get("/users").then(r => setRows(r.data));
  const loadBackups = () => api.get("/backup").then(r => setBackups(r.data));
  useEffect(() => { load(); loadBackups(); }, []);

  const save = async () => {
    if (!form.username) return toast.error("Username wajib");
    if (!form.id && !form.password) return toast.error("Password wajib untuk user baru");
    try {
      if (form.id) await api.put(`/users/${form.id}`, form);
      else await api.post("/users", form);
      toast.success("User tersimpan"); setOpen(false); setForm(empty); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const remove = async (u) => {
    if (!window.confirm(`Hapus user ${u.username}?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success("Terhapus"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  const doBackup = async () => {
    try { await api.post("/backup"); toast.success("Backup dibuat"); loadBackups(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 border-slate-200 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">Manajemen User</h2>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => { setForm(empty); setOpen(true); }} data-testid="user-add">
              <Plus className="w-4 h-4 mr-2" /> Tambah User
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>{["Username", "Nama", "Role", "Aktif", ""].map(h => <th key={h} className="text-left py-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(u => (
                  <tr key={u.id} className="border-b border-slate-100" data-testid={`user-row-${u.id}`}>
                    <td className="py-2 font-mono font-semibold">{u.username}</td>
                    <td className="py-2">{u.full_name}</td>
                    <td className="py-2"><Badge variant="outline">{u.role}</Badge></td>
                    <td className="py-2">{u.is_active ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Ya</Badge> : <Badge variant="secondary">Non-aktif</Badge>}</td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setForm({ ...u, password: "" }); setOpen(true); }} data-testid={`user-edit-${u.id}`}><Edit className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(u)} data-testid={`user-del-${u.id}`}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5 border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Database className="w-5 h-5" /> Backup</h3>
            <Button onClick={doBackup} size="sm" data-testid="backup-btn">Buat Backup</Button>
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto text-xs">
            {backups.length === 0 && <div className="text-slate-500">Belum ada backup</div>}
            {backups.map(b => (
              <div key={b.name} className="flex justify-between border-b border-slate-100 py-1.5" data-testid={`backup-${b.name}`}>
                <span className="font-mono truncate">{b.name}</span>
                <span className="text-slate-500">{(b.size / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{form.id ? "Edit User" : "Tambah User"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Username</Label><Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={!!form.id} data-testid="user-form-username" /></div>
            <div><Label>Nama Lengkap</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} data-testid="user-form-fullname" /></div>
            <div><Label>Password {form.id && "(kosongkan bila tidak diubah)"}</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} data-testid="user-form-password" /></div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="user-form-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="user">User (view only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} data-testid="user-form-active" />
              Aktif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-teal-600 hover:bg-teal-700" data-testid="user-form-save">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
