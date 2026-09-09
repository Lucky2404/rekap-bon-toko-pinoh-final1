import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast, Toaster } from "sonner";
import { Loader2, LogIn } from "lucide-react";

export default function Login() {
  const { user, login, loading } = useAuth();
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await login(u, p);
      toast.success("Berhasil masuk");
      nav("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login gagal");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-teal-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg mb-4">
            <span className="text-2xl font-black">R</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rekap Bon Toko Pinoh</h1>
          <p className="text-sm text-slate-500 mt-1">Sistem akuntansi toko & pelunasan otomatis</p>
        </div>

        <Card className="p-6 shadow-lg border-slate-200">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username" value={u} onChange={(e) => setU(e.target.value)}
                autoFocus data-testid="login-username" placeholder="admin"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password" type="password" value={p} onChange={(e) => setP(e.target.value)}
                data-testid="login-password" placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={loading} data-testid="login-submit">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
              Masuk
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700 mb-1">Akun demo:</div>
            <div>• admin / admin123 (akses penuh)</div>
            <div>• operator / operator123 (rekap & pelunasan)</div>
            <div>• viewer / viewer123 (hanya lihat)</div>
          </div>
        </Card>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
