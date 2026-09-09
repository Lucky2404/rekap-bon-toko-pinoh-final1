import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import RekapBon from "@/pages/RekapBon";
import TokoPage from "@/pages/Toko";
import PTPage from "@/pages/PT";
import Periode from "@/pages/Periode";
import Pelunasan from "@/pages/Pelunasan";
import Audit from "@/pages/Audit";
import Users from "@/pages/Users";
import Backup from "@/pages/Backup";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/rekap" element={<RekapBon />} />
            <Route path="/pelunasan" element={<Pelunasan />} />
            <Route path="/toko" element={<TokoPage />} />
            <Route path="/pt" element={<PTPage />} />
            <Route path="/periode" element={<Periode />} />
            <Route path="/users" element={<AdminOnly><Users /></AdminOnly>} />
            <Route path="/audit" element={<AdminOnly><Audit /></AdminOnly>} />
            <Route path="/backup" element={<AdminOnly><Backup /></AdminOnly>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
