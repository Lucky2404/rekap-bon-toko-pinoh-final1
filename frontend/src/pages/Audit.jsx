import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function Audit() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/audit").then(r => setRows(r.data));
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Audit Log</h2>
          <p className="text-sm text-slate-500">{rows.length} aktivitas tercatat</p>
        </div>
        <Button variant="outline" onClick={load} data-testid="audit-refresh"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-xs table-sticky">
            <thead>
              <tr>{["Waktu", "User", "Aksi", "Entitas", "ID", "Detail"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{a.created_at.replace("T", " ").slice(0, 19)}</td>
                  <td className="px-3 py-2 font-semibold">{a.username}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{a.aksi}</Badge></td>
                  <td className="px-3 py-2">{a.entity}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{a.entity_id}</td>
                  <td className="px-3 py-2 text-slate-600">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
