import { useState } from "react";
import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Receipt, Store, Building2, CalendarRange,
  Banknote, ShieldCheck, Users, LogOut, Menu, X, DatabaseBackup
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", testId: "nav-dashboard" },
  { to: "/rekap", icon: Receipt, label: "Rekap Bon", testId: "nav-rekap" },
  { to: "/pelunasan", icon: Banknote, label: "Pelunasan", testId: "nav-pelunasan" },
  { to: "/toko", icon: Store, label: "Data Toko", testId: "nav-toko" },
  { to: "/pt", icon: Building2, label: "PT", testId: "nav-pt" },
  { to: "/periode", icon: CalendarRange, label: "Periode", testId: "nav-periode" },
  { to: "/users", icon: Users, label: "User", roles: ["admin"], testId: "nav-users" },
  { to: "/audit", icon: ShieldCheck, label: "Audit Log", roles: ["admin"], testId: "nav-audit" },
  { to: "/backup", icon: DatabaseBackup, label: "Backup Data", roles: ["admin"], testId: "nav-backup" },
];

const roleBadge = (role) => {
  if (role === "admin") return "border-red-300 text-red-700 bg-red-50";
  if (role === "operator") return "border-blue-300 text-blue-700 bg-blue-50";
  return "border-slate-300 text-slate-700 bg-slate-50";
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return <Navigate to="/login" replace />;

  const items = NAV.filter(n => !n.roles || n.roles.includes(user.role));

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transform transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        data-testid="sidebar"
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-teal-400 font-semibold">Rekap Bon</div>
            <div className="text-lg font-bold">Toko Pinoh</div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)} data-testid="sidebar-close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testId}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition ${isActive ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`
              }
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold" data-testid="current-user">{user.full_name || user.username}</div>
              <div className="text-xs text-slate-400">@{user.username}</div>
            </div>
            <Badge variant="outline" className={roleBadge(user.role)} data-testid="user-role">
              {user.role.toUpperCase()}
            </Badge>
          </div>
          <Button variant="secondary" size="sm" className="w-full" onClick={logout} data-testid="logout-btn">
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="sidebar-open">
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">Sistem Rekap Bon</h1>
            <p className="text-xs text-slate-500">Manajemen nota, pelunasan & konfirmasi WhatsApp</p>
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
