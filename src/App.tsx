import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./shared/components/AppLayout";
import { ProtectedRoute } from "./shared/components/ProtectedRoute";
import Login from "./pages/Login";
import DashboardGeral from "./pages/DashboardGeral";
import LojaDetalhe from "./pages/LojaDetalhe";
import Configuracoes from "./pages/Configuracoes";
import ChecklistDashboard from "./modules/checklist/pages/ChecklistDashboard";
import ChecklistList from "./modules/checklist/pages/ChecklistList";
import ChecklistLojas from "./modules/checklist/pages/ChecklistLojas";
import ChecklistTecnicos from "./modules/checklist/pages/ChecklistTecnicos";
import ChecklistImportacoes from "./modules/checklist/pages/ChecklistImportacoes";
import ChecklistProcessamento from "./modules/checklist/pages/ChecklistProcessamento";
import ChecklistConferencia from "./modules/checklist/pages/ChecklistConferencia";
import ChecklistUsuarios from "./modules/checklist/pages/ChecklistUsuarios";
import ChecklistDetalhe from "./modules/checklist/pages/ChecklistDetalhe";
import LojasMapa from "./pages/LojasMapa";
import PredialDashboard from "./modules/predial/pages/PredialDashboard";
import OrdensServico from "./modules/predial/pages/OrdensServico";
import CustosLoja from "./modules/predial/pages/CustosLoja";
import Materiais from "./modules/predial/pages/Materiais";
import Prestadoras from "./modules/predial/pages/Prestadoras";
import PredialTecnicos from "./modules/predial/pages/PredialTecnicos";
import PredialImportacoes from "./modules/predial/pages/PredialImportacoes";
import OrdemServicoDetalhe from "./modules/predial/pages/OrdemServicoDetalhe";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Rota pública */}
          <Route path="/login" element={<Login />} />

          {/* Rotas protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardGeral />} />

            {/* Checklist AC */}
            <Route path="/checklist" element={<ChecklistDashboard />} />
            <Route path="/checklist/checklists" element={<ChecklistList />} />
            <Route path="/checklist/lojas" element={<ChecklistLojas />} />
            <Route path="/checklist/tecnicos" element={<ChecklistTecnicos />} />
            <Route path="/checklist/importacoes" element={<ChecklistImportacoes />} />
            <Route path="/checklist/checklists/:id" element={<ChecklistDetalhe />} />
            <Route path="/checklist/processamento" element={<ChecklistProcessamento />} />
            <Route path="/checklist/conferencia" element={<ChecklistConferencia />} />
            <Route path="/checklist/usuarios" element={<ChecklistUsuarios />} />

            {/* Manutenção Predial */}
            <Route path="/predial" element={<PredialDashboard />} />
            <Route path="/predial/ordens-servico" element={<OrdensServico />} />
            <Route path="/predial/ordens-servico/:id" element={<OrdemServicoDetalhe />} />
            <Route path="/predial/custos" element={<CustosLoja />} />
            <Route path="/predial/materiais" element={<Materiais />} />
            <Route path="/predial/prestadoras" element={<Prestadoras />} />
            <Route path="/predial/tecnicos" element={<PredialTecnicos />} />
            <Route path="/predial/importacoes" element={<PredialImportacoes />} />

            {/* Lojas */}
            <Route path="/lojas" element={<LojasMapa />} />
            <Route path="/lojas/:id" element={<LojaDetalhe />} />

            {/* Configurações */}
            <Route path="/configuracoes" element={<Configuracoes />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
