import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { rupiah, shortDate, ptClass } from "@/lib/format";
import { Upload, Send, FileText, ImageIcon, X, ExternalLink, Download, RefreshCw } from "lucide-react";

export default function Pelunasan() {
  const { user } = useAuth();
  const canEdit = ["admin", "operator"].includes(user?.role);
  const [pts, setPts] = useState([]);
  const [notas, setNotas] = useState([]);
  const [selectedPt, setSelectedPt] = useState("");
  const [selectedNota, setSelectedNota] = useState(null);
  const [buktiFiles, setBuktiFiles] = useState([]);
  const [pinkFiles, setPinkFiles] = useState([]);
  const [catatan, setCatatan] = useState("");
  const [pelunasans, setPelunasans] = useState([]);
  const [waPayload, setWaPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tpl, setTpl] = useState("");
  const [tplMeta, setTplMeta] = useState({ placeholders: [], default: "" });
  const [tplOpen, setTplOpen] = useState(false);
  const [tplSaving, setTplSaving] = useState(false);

  useEffect(() => {
    api.get("/pt").then(r => setPts(r.data));
    api.get("/settings/wa-template").then(r => {
      setTpl(r.data.template);
      setTplMeta({ placeholders: r.data.placeholders, default: r.data.default });
    });
    loadPelunasan();
  }, []);

  const saveTpl = async () => {
    setTplSaving(true);
    try {
      await api.put("/settings/wa-template", new URLSearchParams({ template: tpl }));
      toast.success("Format chat disimpan");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal simpan format");
    } finally { setTplSaving(false); }
  };

  useEffect(() => {
    if (!selectedPt) { setNotas([]); return; }
    api.get("/nota", { params: { pt_id: selectedPt, status: "belum_lunas" } })
      .then(r => setNotas(r.data));
  }, [selectedPt]);

  const loadPelunasan = () => api.get("/pelunasan").then(r => setPelunasans(r.data));

  const nominalNota = () => {
    if (!selectedNota) return 0;
    return selectedNota.items.filter(i => i.pt_id === Number(selectedPt)).reduce((s, i) => s + Number(i.total || 0), 0);
  };

  const bulanFromDate = (iso) => {
    if (!iso) return "";
    const b = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const [y, m] = iso.split("-");
    return `${b[Number(m)-1]} ${y}`;
  };

  const submit = async () => {
    if (!selectedNota || !selectedPt) return toast.error("Pilih PT & nota");
    if (pinkFiles.length === 0) return toast.error("Wajib upload nota pink");
    setLoading(true);
    const fd = new FormData();
    fd.append("nota_id", selectedNota.id);
    fd.append("pt_id", selectedPt);
    fd.append("nominal", nominalNota());
    fd.append("catatan", catatan);
    buktiFiles.forEach(f => fd.append("bukti_transfer", f));
    pinkFiles.forEach(f => fd.append("nota_pink", f));
    try {
      const { data } = await api.post("/pelunasan", fd);
      toast.success("Pelunasan tersimpan. Menyiapkan WhatsApp…");
      await prepareWa(data.id);
      setSelectedNota(null); setBuktiFiles([]); setPinkFiles([]); setCatatan("");
      loadPelunasan();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal");
    } finally { setLoading(false); }
  };

  const prepareWa = async (pelunasanId) => {
    try {
      const { data } = await api.post(`/pelunasan/${pelunasanId}/whatsapp`, new FormData());
      setWaPayload(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal siapkan WhatsApp");
    }
  };

  const sendWa = async () => {
    if (!waPayload) return;
    window.open(waPayload.wa_link, "_blank");
    try {
      await api.post(`/whatsapp/log/${waPayload.log_id}/status`, new URLSearchParams({ status: "success" }));
    } catch { /* non-blocking */ }
    toast.success("WhatsApp dibuka — pesan teks sudah terisi, tinggal tekan Kirim.");
    setWaPayload(null);
  };

  const retryWa = async (p) => { await prepareWa(p.id); };

  const openFile = async (f) => {
    try {
      const res = await api.get(`/pelunasan/file/${f.id}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
    } catch (e) {
      toast.error("Gagal membuka file");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Pelunasan</h2>
        <p className="text-sm text-slate-500">Pilih PT → pilih nota → upload → kirim pesan WhatsApp.</p>
      </div>

      {canEdit && (
        <Card className="p-4 border-slate-200" data-testid="wa-template-card">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white bg-emerald-600">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">Pesan WhatsApp</div>
                <div className="text-xs text-slate-500">Pesan teks otomatis terisi saat kirim. Atur formatnya di sini.</div>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setTplOpen(!tplOpen)} data-testid="wa-template-toggle">
              <FileText className="w-3.5 h-3.5 mr-1" /> Format Chat
            </Button>
          </div>
          {tplOpen && (
            <div className="mt-4 p-4 bg-slate-50 rounded-md space-y-3" data-testid="wa-template-editor">
              <div>
                <Label>Format Pesan WhatsApp</Label>
                <Textarea rows={5} value={tpl} onChange={e => setTpl(e.target.value)}
                  className="mt-1 font-mono text-xs bg-white" data-testid="wa-template-input" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tplMeta.placeholders.map(ph => (
                  <button key={ph} type="button"
                    onClick={() => setTpl(t => t + ph)}
                    className="px-2 py-0.5 rounded bg-white border border-slate-300 text-[11px] font-mono hover:bg-teal-50 hover:border-teal-400"
                    data-testid={`wa-template-ph-${ph.replace(/[{}]/g, "")}`}>{ph}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={tplSaving}
                  onClick={saveTpl} data-testid="wa-template-save">Simpan Format</Button>
                <Button size="sm" variant="outline" onClick={() => setTpl(tplMeta.default)}
                  data-testid="wa-template-reset">Kembalikan Default</Button>
              </div>
              <p className="text-[11px] text-slate-500">
                Placeholder akan diganti otomatis saat pengiriman. Format ini dipakai untuk semua pesan WhatsApp.
              </p>
            </div>
          )}
        </Card>
      )}

      {canEdit && (
        <Card className="p-5 border-slate-200 space-y-5">
          {/* Step 1: PT */}
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">Langkah 1 — Pilih PT</div>
            <div className="flex gap-2 flex-wrap">
              {pts.map(p => (
                <Button key={p.id}
                  variant={String(p.id) === selectedPt ? "default" : "outline"}
                  className={String(p.id) === selectedPt ? "bg-teal-600 hover:bg-teal-700" : ""}
                  onClick={() => { setSelectedPt(String(p.id)); setSelectedNota(null); }}
                  data-testid={`pel-pt-${p.id}`}>{p.nama}</Button>
              ))}
            </div>
          </div>

          {/* Step 2: Nota */}
          {selectedPt && (
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">Langkah 2 — Pilih Nota Belum Lunas</div>
              {notas.length === 0 ? <div className="text-sm text-slate-500">Tidak ada nota belum lunas untuk PT ini.</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                  {notas.map(n => (
                    <button key={n.id}
                      onClick={() => setSelectedNota(n)}
                      className={`text-left p-3 rounded-md border transition ${selectedNota?.id === n.id ? "border-teal-600 bg-teal-50 ring-2 ring-teal-500" : "border-slate-200 hover:bg-slate-50"}`}
                      data-testid={`pel-nota-${n.id}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="font-mono text-xs text-slate-500">{shortDate(n.tanggal)}</div>
                          <div className="font-semibold text-slate-800">{n.no_nota}</div>
                          <div className="text-xs text-slate-600">{n.toko.nama}</div>
                        </div>
                        <div className="text-right font-mono text-sm font-semibold">
                          {rupiah(n.items.filter(i => i.pt_id === Number(selectedPt)).reduce((s, i) => s + Number(i.total || 0), 0))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Detail + Upload */}
          {selectedNota && (
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="text-xs uppercase font-bold tracking-wider text-slate-500">Langkah 3 — Detail & Upload</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Info label="Toko" val={selectedNota.toko.nama} />
                <Info label="Bank" val={selectedNota.toko.bank} />
                <Info label="Rekening" val={selectedNota.toko.rekening} mono />
                <Info label="A.n" val={selectedNota.toko.atas_nama} />
                <Info label="WhatsApp" val={selectedNota.toko.whatsapp} mono />
                <Info label="Bulan" val={bulanFromDate(selectedNota.tanggal)} />
                <Info label="PT" val={pts.find(p => p.id === Number(selectedPt))?.nama || ""} />
                <Info label="Nominal" val={rupiah(nominalNota())} mono strong />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileDrop label="Bukti Transfer (opsional)" files={buktiFiles} setFiles={setBuktiFiles} testId="upload-bukti" />
                <FileDrop label="Nota Pink (JPG/PNG/PDF, bisa banyak)" files={pinkFiles} setFiles={setPinkFiles} testId="upload-pink" multiple />
              </div>

              <div>
                <Label>Catatan (opsional)</Label>
                <Textarea value={catatan} onChange={e => setCatatan(e.target.value)} data-testid="pel-catatan" />
              </div>

              <Button onClick={submit} disabled={loading} className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto" data-testid="pel-submit">
                <Upload className="w-4 h-4 mr-2" /> Simpan Pelunasan & Siapkan WhatsApp
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* WhatsApp payload panel */}
      {waPayload && (
        <Card className="p-5 border-emerald-300 bg-emerald-50" data-testid="wa-panel">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-emerald-900">Siap dikirim ke {waPayload.phone}</div>
              <div className="text-xs text-emerald-800 mt-1">{waPayload.note}</div>
              <div className="mt-3 p-3 bg-white rounded border border-emerald-200 text-sm text-slate-700 whitespace-pre-wrap">{waPayload.pesan}</div>
              <div className="mt-4 flex gap-2 flex-wrap">
                <Button onClick={sendWa} className="bg-emerald-600 hover:bg-emerald-700" data-testid="wa-send">
                  <ExternalLink className="w-4 h-4 mr-2" /> Buka WhatsApp
                </Button>
                <Button variant="outline" onClick={() => setWaPayload(null)}>Tutup</Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* History */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Riwayat Pelunasan</h3>
          <span className="text-xs text-slate-500">{pelunasans.length} entri</span>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs table-sticky">
            <thead>
              <tr>{["Tgl", "PT", "Nota", "Toko", "Bulan", "Nominal", "File", "Aksi"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {pelunasans.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500 py-8">Belum ada pelunasan</td></tr>}
              {pelunasans.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`pel-row-${p.id}`}>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{shortDate(p.tanggal_pelunasan)}</td>
                  <td className="px-3 py-2"><span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${ptClass(p.pt.nama)}`}>{p.pt.nama}</span></td>
                  <td className="px-3 py-2 font-mono">{p.nota.no_nota}</td>
                  <td className="px-3 py-2">{p.nota.toko}</td>
                  <td className="px-3 py-2">{p.bulan}</td>
                  <td className="px-3 py-2 font-mono font-semibold">{rupiah(p.nominal)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {p.files.map(f => (
                        <button key={f.id} onClick={() => openFile(f)}
                          className="text-teal-700 hover:underline flex items-center gap-1 text-left"
                          data-testid={`pel-file-open-${f.id}`}>
                          <Download className="w-3 h-3" /> {f.original_name}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => retryWa(p)} data-testid={`pel-wa-${p.id}`}><RefreshCw className="w-3 h-3 mr-1" /> WA</Button>
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

const Info = ({ label, val, mono, strong }) => (
  <div>
    <div className="text-xs uppercase font-semibold text-slate-500">{label}</div>
    <div className={`${mono ? "font-mono" : ""} ${strong ? "font-bold text-lg text-slate-900" : "text-slate-800"}`}>{val || "-"}</div>
  </div>
);

const FileDrop = ({ label, files, setFiles, testId, multiple = true }) => (
  <div>
    <Label>{label}</Label>
    <label className="mt-1 block cursor-pointer border-2 border-dashed border-slate-300 rounded-md p-4 text-center hover:bg-slate-50 transition">
      <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
      <span className="text-xs text-slate-500">Klik untuk memilih file</span>
      <input type="file" multiple={multiple} className="hidden" accept="image/*,application/pdf"
        onChange={e => setFiles(Array.from(e.target.files || []))} data-testid={testId} />
    </label>
    {files.length > 0 && (
      <div className="mt-2 space-y-1">
        {files.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-xs bg-slate-100 p-1.5 rounded">
            {f.type.includes("pdf") ? <FileText className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
            <span className="flex-1 truncate">{f.name}</span>
            <button onClick={() => setFiles(files.filter((_, x) => x !== i))}><X className="w-3.5 h-3.5 text-red-600" /></button>
          </div>
        ))}
      </div>
    )}
  </div>
);
