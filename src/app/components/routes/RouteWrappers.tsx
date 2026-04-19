import { Component, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useAppLayout } from "../layout/AppLayout";
import { usePet } from "../../contexts/PetContext";

// ---------------------------------------------------------------------------
// Shared loader
// ---------------------------------------------------------------------------

function ScreenLoader({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="mx-auto mb-4 size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
        <p className="text-base font-bold text-slate-900 dark:text-white">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error boundary for the feed / historial view
// ---------------------------------------------------------------------------

class FeedErrorBoundary extends Component<
  { onReset: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[Pessy] Error en vista Historial:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F0FAF9] flex flex-col items-center justify-center px-6 text-center gap-4">
          <p className="text-slate-500 text-sm font-medium max-w-xs">
            Hubo un problema al cargar el historial. Podés volver al inicio sin perder tu sesión.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset();
            }}
            className="px-6 py-3 bg-[#074738] text-white rounded-[14px] font-bold text-sm shadow-[0_4px_12px_rgba(26,155,125,0.3)] active:scale-[0.97] transition-transform"
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Lazy imports
// ---------------------------------------------------------------------------

const Header = lazy(() =>
  import("../shared/Header.tsx").then((m) => ({ default: m.Header }))
);
const Timeline = lazy(() =>
  import("../medical/Timeline.tsx").then((m) => ({ default: m.Timeline }))
);
const MonthSummary = lazy(() =>
  import("../medical/MonthSummary.tsx").then((m) => ({ default: m.MonthSummary }))
);
const ActionTray = lazy(() =>
  import("../medical/ActionTray.tsx").then((m) => ({ default: m.ActionTray }))
);
const AppointmentsScreen = lazy(() =>
  import("../appointments/AppointmentsScreen.tsx").then((m) => ({
    default: m.AppointmentsScreen,
  }))
);
const MedicationsScreen = lazy(() =>
  import("../medical/MedicationsScreen.tsx").then((m) => ({
    default: m.MedicationsScreen,
  }))
);
const LostPetFeed = lazy(() =>
  import("../community/LostPetFeed.tsx").then((m) => ({
    default: m.LostPetFeed,
  }))
);
const ReportLostPet = lazy(() =>
  import("../community/ReportLostPet.tsx").then((m) => ({
    default: m.ReportLostPet,
  }))
);
const RecommendationFeed = lazy(() =>
  import("../lifestyle/RecommendationFeed.tsx").then((m) => ({
    default: m.RecommendationFeed,
  }))
);
const UserProfileScreen = lazy(() =>
  import("../settings/UserProfileScreen.tsx").then((m) => ({
    default: m.UserProfileScreen,
  }))
);
const IdentidadScreen = lazy(() =>
  import("../identity/IdentidadScreen").then((m) => ({ default: m.IdentidadScreen }))
);
const VetSearchScreen = lazy(() =>
  import("../vet/VetSearchScreen").then((m) => ({ default: m.VetSearchScreen }))
);
const RutinasScreen = lazy(() =>
  import("../rutinas/RutinasScreen").then((m) => ({ default: m.RutinasScreen }))
);
const TiendaScreen = lazy(() =>
  import("../tienda/TiendaScreen").then((m) => ({ default: m.TiendaScreen }))
);
const CuidadosScreen = lazy(() =>
  import("../cuidados/CuidadosScreen").then((m) => ({ default: m.CuidadosScreen }))
);
const ComunidadScreen = lazy(() =>
  import("../comunidad/ComunidadScreen").then((m) => ({ default: m.ComunidadScreen }))
);
const VetDoctorProfile = lazy(() =>
  import("../vet/VetDoctorProfile")
);

// ---------------------------------------------------------------------------
// 1. HistorialRoute — Timeline + MonthSummary + ActionTray
// ---------------------------------------------------------------------------

function HistorialRoute() {
  const navigate = useNavigate();
  const { activePet } = usePet();
  const { openExportReport, openPetSelector } = useAppLayout();

  const headerPet = activePet
    ? { name: activePet.name, photo: activePet.photo, species: activePet.breed || "" }
    : undefined;

  const timelinePet = activePet
    ? { name: activePet.name, photo: activePet.photo }
    : undefined;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
      <Suspense fallback={<ScreenLoader label="Cargando historial..." />}>
        <Header activePet={headerPet} onPetClick={openPetSelector} />
        <FeedErrorBoundary onReset={() => navigate("/inicio")}>
          <main className="flex-1 px-4 space-y-6 mt-4">
            <Timeline activePet={timelinePet} onExportReport={openExportReport} />
            <MonthSummary />
            <ActionTray />
          </main>
        </FeedErrorBoundary>
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. TurnosRoute — AppointmentsScreen
// ---------------------------------------------------------------------------

function TurnosRoute() {
  const navigate = useNavigate();

  return (
    <Suspense fallback={<ScreenLoader label="Cargando turnos..." />}>
      <AppointmentsScreen onBack={() => navigate("/inicio")} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// 3. TratamientosRoute — MedicationsScreen
// ---------------------------------------------------------------------------

function TratamientosRoute() {
  const navigate = useNavigate();

  return (
    <Suspense fallback={<ScreenLoader label="Cargando tratamientos..." />}>
      <MedicationsScreen onBack={() => navigate("/inicio")} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// 4. ComunidadRoute — ComunidadScreen (static timeline MVP)
// ---------------------------------------------------------------------------

function ComunidadRoute() {
  return (
    <Suspense fallback={<ScreenLoader label="Cargando comunidad..." />}>
      <ComunidadScreen />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// 5. ReportarPerdidoRoute — ReportLostPet
// ---------------------------------------------------------------------------

function ReportarPerdidoRoute() {
  const navigate = useNavigate();

  return (
    <Suspense fallback={<ScreenLoader label="Cargando reporte..." />}>
      <ReportLostPet
        onBack={() => navigate("/comunidad")}
        onSuccess={() => navigate("/comunidad")}
      />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// 6. ExplorarRoute — RecommendationFeed
// ---------------------------------------------------------------------------

function ExplorarRoute() {
  const navigate = useNavigate();

  return (
    <Suspense fallback={<ScreenLoader label="Cargando explorar..." />}>
      <RecommendationFeed onBack={() => navigate("/inicio")} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// 7. PerfilRoute — UserProfileScreen
// ---------------------------------------------------------------------------

function PerfilRoute() {
  const navigate = useNavigate();

  return (
    <Suspense fallback={<ScreenLoader label="Cargando perfil..." />}>
      <UserProfileScreen onBack={() => navigate("/inicio")} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// 8-10. Ecosistema Digital — placeholders (Lovable handoff)
// ---------------------------------------------------------------------------
// TODO: reemplazar ComingSoon con el componente real cuando llegue de Lovable.
// Rutas ya registradas en routesV2.tsx: /identidad · /rutinas-eco · /cuidados

function ComingSoon({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F0FAF9] flex flex-col items-center justify-center px-6 pb-24">
      <div className="size-16 rounded-[16px] bg-[#E3DFFF] flex items-center justify-center mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h1 className="text-xl font-bold text-[#074738]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {title}
      </h1>
      <p className="text-sm text-[#6B7280] mt-2 text-center">Esta pantalla está en desarrollo.</p>
      <button
        type="button"
        onClick={() => navigate("/inicio")}
        className="mt-6 px-6 py-3 rounded-[14px] bg-[#074738] text-white text-sm font-bold"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        Volver al inicio
      </button>
    </div>
  );
}

function IdentidadRoute() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<ScreenLoader label="Cargando identidad..." />}>
      <IdentidadScreen onBack={() => navigate("/inicio")} />
    </Suspense>
  );
}

function RutinasEcoRoute() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<ScreenLoader label="Cargando rutinas..." />}>
      <RutinasScreen onBack={() => navigate(-1)} />
    </Suspense>
  );
}

function CuidadosRoute() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<ScreenLoader label="Cargando bienestar..." />}>
      <CuidadosScreen onBack={() => navigate(-1)} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// BuscarVetRoute — VetSearchScreen (pet owner searches for vets)
// ---------------------------------------------------------------------------

function BuscarVetRoute() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<ScreenLoader label="Cargando veterinarios..." />}>
      <VetSearchScreen onBack={() => navigate("/inicio")} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// TiendaRoute — TiendaScreen
// ---------------------------------------------------------------------------

export function TiendaRoute() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-[#F0FAF9]"><div className="size-8 rounded-full border-2 border-[#074738] border-t-transparent animate-spin" /></div>}>
      <TiendaScreen onBack={() => navigate(-1)} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// VetDoctorProfileRoute
// ---------------------------------------------------------------------------

export function VetDoctorProfileRoute() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<ScreenLoader label="Cargando perfil del veterinario..." />}>
      <VetDoctorProfile onBack={() => navigate(-1)} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// RutinasHubRoute — vida diaria + recomendaciones embrión
// ---------------------------------------------------------------------------

export async function RutinasHubRoute() {
  const { RutinasHub } = await import("../rutinas/RutinasHub");
  return { Component: () => <RutinasHub onBack={() => window.history.back()} /> };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  HistorialRoute,
  TurnosRoute,
  TratamientosRoute,
  ComunidadRoute,
  ReportarPerdidoRoute,
  ExplorarRoute,
  PerfilRoute,
  IdentidadRoute,
  RutinasEcoRoute,
  CuidadosRoute,
  BuscarVetRoute,
};
