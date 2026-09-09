import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { rupiah, shortDate, ptClass } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Edit, Filter, X } from "lucide-react";

export default function RekapBon() {
  const { user } = useAuth();
  const canEdit = ["admin", "operator"].includes(user?.role);
  const [notas, setNotas] = useState([]);
  const [tokos, setTokos] = useState([]);
  const [pts, setPts] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [filter, setFilter] = useState({ periode_id: "", pt_id: "", toko_id: "", bulan: "", status: "" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);

  const load = () => {
    const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
    api.get("/nota", { params }).then(r => setNotas(r.data));
  };

  useEffect(() => {
    api.get("/toko").then(r => setTokos(r.data));
    api.get("/pt").then(r => setPts(r.data));
    api.get("/periode").then(r => setPeriodes(r.data));
  }, []);

  useEffect(load, [JSON.stringify(filter)]); // eslint-disable-line

  const startNew = () => {
    setEdit({
      toko_id: "", no_nota: "", tanggal: new Date().toISOString().slice(0, 10),
      periode_id: "", items: [{ barang: "", keterangan: "", no_pp: "", pt_id: "", total: 0 }],
    });
    setOpen(true);
  };

  const startEdit = (n) => {
    setEdit({
      id: n.id, toko_id: String(n.toko.id), no_nota: n.no_nota, tanggal: n.tanggal,
      periode_id: String(n.periode.id),
      items: n.items.map(i => ({ barang: i.barang || "", keterangan: i.keterangan, no_pp: i.no_pp, pt_id: String(i.pt_id), total: i.total })),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!edit.toko_id || !edit.no_nota || !edit.tanggal) {
      toast.error("Toko, No Nota, dan Tanggal wajib diisi"); return;
    }
    if (!edit.items.length) { toast.error("Minimal 1 barang"); return; }
    for (const it of edit.items) {
      if (!it.keterangan || !it.pt_id) { toast.error("Keterangan & PT wajib per barang"); return; }
    }
    const body = {
      toko_id: Number(edit.toko_id), no_nota: edit.no_nota, tanggal: edit.tanggal,
      periode_id: edit.periode_id ? Number(edit.periode_id) : null,
      items: edit.items.map(i => ({
        barang: i.barang || "", keterangan: i.keterangan, no_pp: i.no_pp || "",
        pt_id: Number(i.pt_id), total: Number(i.total || 0),
      })),
    };
    try {
      if (edit.id) await api.put(`/nota/${edit.id}`, body);
      else await api.post("/nota", body);
      toast.success("Nota tersimpan");
      setOpen(false); setEdit(null); load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal simpan");
    }
  };

  const remove = async (n) => {
    if (!window.confirm(`Hapus nota ${n.no_nota}?`)) return;
    try {
      await api.delete(`/nota/${n.id}`, { params: n.status === "lunas" ? { force: true } : {} });
      toast.success("Nota dihapus"); load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal hapus");
    }
  };

  const totalNota = (n) => n.items.reduce((s, i) => s + Number(i.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Rekap Bon</h2>
          <p className="text-sm text-slate-500">{notas.length} nota tersaring</p>
        </div>
        {canEdit && (
          <Button onClick={startNew} className="bg-teal-600 hover:bg-teal-700" data-testid="rekap-add-btn">
            <Plus className="w-4 h-4 mr-2" /> Tambah Nota
          </Button>
        )}
      </div>

      <Card className="p-4 border-slate-200">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-700"><Filter className="w-4 h-4" /> Filter</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Select value={filter.periode_id || "all"} onValueChange={v => setFilter({ ...filter, periode_id: v === "all" ? "" : v })}>
            <SelectTrigger data-testid="filter-periode"><SelectValue placeholder="Periode" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Semua Periode</SelectItem>
              {periodes.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nama}{p.is_active ? " ★" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter.pt_id || "all"} onValueChange={v => setFilter({ ...filter, pt_id: v === "all" ? "" : v })}>
            <SelectTrigger data-testid="filter-pt"><SelectValue placeholder="PT" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Semua PT</SelectItem>
              {pts.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter.toko_id || "all"} onValueChange={v => setFilter({ ...filter, toko_id: v === "all" ? "" : v })}>
            <SelectTrigger data-testid="filter-toko"><SelectValue placeholder="Toko" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Semua Toko</SelectItem>
              {tokos.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="month" value={filter.bulan} onChange={e => setFilter({ ...filter, bulan: e.target.value })} data-testid="filter-bulan" />
          <Select value={filter.status || "all"} onValueChange={v => setFilter({ ...filter, status: v === "all" ? "" : v })}>
            <SelectTrigger data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="belum_lunas">Belum Lunas</SelectItem>
              <SelectItem value="lunas">Lunas</SelectItem>
              <SelectItem value="batal">Batal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-xs table-sticky" data-testid="rekap-table">
            <thead>
              <tr>
                {["No", "Tanggal", "Toko", "No Nota", "Barang", "Keterangan", "PT / No.PP", "Total", "Status", ""].map(h =>
                  <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {notas.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-500 py-8">Belum ada nota</td></tr>
              )}
              {notas.map((n, idx) => (
                <tr key={n.id} className="border-b border-slate-100 hover:bg-slate-50 align-top" data-testid={`nota-row-${n.id}`}>
                  <td className="px-3 py-2 font-mono text-slate-500">{idx + 1}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{shortDate(n.tanggal)}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{n.toko.nama}</td>
                  <td className="px-3 py-2 font-mono">{n.no_nota}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      {n.items.map(it => (
                        <div key={it.id} className="text-slate-800 font-medium" data-testid={`item-barang-cell-${it.id}`}>
                          {it.barang || "-"}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      {n.items.map(it => (
                        <div key={it.id} className="text-slate-600" data-testid={`item-ket-cell-${it.id}`}>
                          {it.keterangan}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      {n.items.map(it => (
                        <div key={it.id} className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${ptClass(it.pt_nama)}`}>{it.pt_nama}</span>
                          {it.no_pp && <span className="text-slate-400 font-mono">#{it.no_pp}</span>}
                          <span className="ml-auto font-mono text-slate-800">{rupiah(it.total)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-slate-900 whitespace-nowrap">{rupiah(totalNota(n))}</td>
                  <td className="px-3 py-2">
                    <Badge className={
                      n.status === "lunas" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                      n.status === "batal" ? "bg-red-100 text-red-800 border-red-200" :
                      "bg-amber-100 text-amber-800 border-amber-200"
                    } variant="outline">
                      {n.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(n)} data-testid={`edit-nota-${n.id}`}><Edit className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(n)} data-testid={`del-nota-${n.id}`}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit Nota" : "Tambah Nota"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Toko</Label>
                  <Select value={edit.toko_id ? String(edit.toko_id) : ""} onValueChange={v => setEdit({ ...edit, toko_id: v })}>
                    <SelectTrigger data-testid="form-toko"><SelectValue placeholder="Pilih toko" /></SelectTrigger>
                    <SelectContent>{tokos.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>No Nota</Label>
                  <Input value={edit.no_nota} onChange={e => setEdit({ ...edit, no_nota: e.target.value })} data-testid="form-no-nota" />
                </div>
                <div>
                  <Label>Tanggal</Label>
                  <Input type="date" value={edit.tanggal} onChange={e => setEdit({ ...edit, tanggal: e.target.value })} data-testid="form-tanggal" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Barang &amp; Keterangan</Label>
                  <Button size="sm" variant="outline" onClick={() =>
                    setEdit({ ...edit, items: [...edit.items, { barang: "", keterangan: "", no_pp: "", pt_id: "", total: 0 }] })
                  } data-testid="add-item-btn"><Plus className="w-4 h-4 mr-1" /> Tambah Barang</Button>
                </div>
                <div className="space-y-2">
                  {edit.items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-start border border-slate-200 rounded-md p-2">
                      <div className="col-span-3">
                        <Input value={it.barang || ""} placeholder="Barang"
                          onChange={e => { const items = [...edit.items]; items[idx].barang = e.target.value; setEdit({ ...edit, items }); }}
                          data-testid={`item-barang-${idx}`} />
                      </div>
                      <div className="col-span-3">
                        <Textarea value={it.keterangan} placeholder="Keterangan" rows={1}
                          onChange={e => { const items = [...edit.items]; items[idx].keterangan = e.target.value; setEdit({ ...edit, items }); }}
                          data-testid={`item-ket-${idx}`} />
                      </div>
                      <div className="col-span-2">
                        <Input value={it.no_pp} placeholder="No.PP"
                          onChange={e => { const items = [...edit.items]; items[idx].no_pp = e.target.value; setEdit({ ...edit, items }); }}
                          data-testid={`item-nopp-${idx}`} />
                      </div>
                      <div className="col-span-1">
                        <Select value={it.pt_id ? String(it.pt_id) : ""} onValueChange={v => {
                          const items = [...edit.items]; items[idx].pt_id = v; setEdit({ ...edit, items });
                        }}>
                          <SelectTrigger data-testid={`item-pt-${idx}`}><SelectValue placeholder="PT" /></SelectTrigger>
                          <SelectContent>{pts.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nama}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input type="number" value={it.total} placeholder="Total"
                          onChange={e => { const items = [...edit.items]; items[idx].total = e.target.value; setEdit({ ...edit, items }); }}
                          data-testid={`item-total-${idx}`} />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button size="icon" variant="ghost" onClick={() => {
                          const items = edit.items.filter((_, i) => i !== idx);
                          setEdit({ ...edit, items });
                        }} data-testid={`item-del-${idx}`}><X className="w-4 h-4 text-red-600" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-right text-sm font-mono font-semibold text-slate-800">
                  Total Nota: {rupiah(edit.items.reduce((s, i) => s + Number(i.total || 0), 0))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-teal-600 hover:bg-teal-700" data-testid="save-nota">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
