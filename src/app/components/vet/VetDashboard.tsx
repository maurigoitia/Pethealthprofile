import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { VetBottomNav } from "./VetBottomNav";
import { VetPatientList } from "./VetPatientList";
import { VetConsultationView } from "./VetConsultationView";
import { VetProfileScreen } from "./VetProfileScreen";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VetProfile {
  fullName: string;
  specialty: string;
  matricula: string;
  verified: boolean;
  patientsCount: number;
}

interface Consultation {
  id: string;
  petName: string;
  tutorName: string;
  reason: string;
  status: "pending" | "in_progress" | "completed";
  date: string;
}

interface DashboardStats {
  today: number;
  pending: number;
}

type TabId = "home" | "patients" | "profile";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, string> = {
  pending:     "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed:   "bg-emerald-100 text-emerald-700",
};

const STATUS_LABEL: Record<string, string> = {
  pending:     "Pendiente",
  in_progress: "En curso",
  completed:   "Completada",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function VetDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, userName } = useAuth();

  const [tab, setTab] = useState<TabId>("home");
  const [vetProfile, setVetProfile] = useState<VetProfile | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ today: 0, pending: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<string | null>(null);

  // ─── Data fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        // Vet profile
        const profileSnap = await getDoc(doc(db, "vetProfiles", user.uid));
        if (profileSnap.exists()) {
          setVetProfile(profileSnap.data() as VetProfile);
        }

        // Recent consultations
        const consultationsSnap = await getDocs(
          query(
            collection(db, "consultations"),
            where("vetId", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(20),
          ),
        );

        const list: Consultation[] = [];
        consultationsSnap.forEach((d) => {
          const x = d.data();
          list.push({
            id:          d.id,
            petName:     x.petName     || "",
            tutorName:   x.tutorName   || "",
            reason:      x.reason      || "",
            status:      x.status      || "pending",
            date:        x.date        || "",
          });
        });

        setConsultations(list);

        const today = new Date().toISOString().split("T")[0];
        setStats({
          today:   list.filter((c) => c.date === today).length,
          pending: list.filter((c) => c.status === "pending").length,
        });
      } catch {
        // silent — UI shows empty state
      } finally {
        setLoadingData(false);
      }
    })();
  }, [user]);

  // ─── Early returns ────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#F0FAF9" }}
      >
        <div className="w-8 h-8 rounded-full border-2 border-[#074738] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/vet/login" replace />;
  }

  if (selectedConsultation) {
    return (
      <>
        <VetConsultationView
          consultationId={selectedConsultation}
          onBack={() => setSelectedConsultation(null)}
        />
        <VetBottomNav currentTab={tab} onTabChange={setTab} />
      </>
    );
  }

  if (tab === "patients") {
    return (
      <>
        <VetPatientList onSelectConsultation={setSelectedConsultation} />
        <VetBottomNav currentTab={tab} onTabChange={setTab} />
      </>
    );
  }

  if (tab === "profile") {
    return (
      <>
        <VetProfileScreen onBack={() => setTab("home")} />
        <VetBottomNav currentTab={tab} onTabChange={setTab} />
      </>
    );
  }

  // ─── Derived display values ───────────────────────────────────────────────

  const displayName = userName || vetProfile?.fullName?.split(" ")[0] || "Doctor";

  const statCards = [
    { label: "Hoy",        value: stats.today },
    { label: "Pendientes", value: stats.pending },
    { label: "Pacientes",  value: vetProfile?.patientsCount ?? 0 },
  ];

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{ background: "#F0FAF9", fontFamily: "'Manrope', sans-serif" }}
    >
      {/* ── Header ── */}
      <div
        className="px-5 pt-12 pb-6 rounded-b-[28px] relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #074738 0%, #1A9B7D 100%)" }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute -right-16 -top-16 w-[200px] h-[200px] rounded-[42%_58%_65%_35%/52%_48%_38%_62%]"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
        <div
          className="absolute -left-12 bottom-0 w-[160px] h-[160px] rounded-[58%_42%_35%_65%/45%_55%_65%_45%]"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />

        {/* Greeting row */}
        <div className="relative z-10 flex items-center justify-between mb-5">
          <div>
            <p className="text-white/70 text-sm">Bienvenido,</p>
            <p className="text-white text-xl font-bold">{displayName}</p>
          </div>
          <div className="flex items-center gap-2">
            {vetProfile?.verified && (
              <span className="px-2 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                ✓ Verificado
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {statCards.map(({ label, value }) => (
            <div
              key={label}
              className="bg-white/10 backdrop-blur-sm rounded-[16px] p-3 text-center border border-white/20"
            >
              <p className="text-white text-2xl font-bold">{value}</p>
              <p className="text-white/70 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="px-5 mt-5">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTab("patients")}
            className="bg-white rounded-[16px] p-5 text-left shadow-sm border border-slate-100 active:scale-[0.97] transition-transform"
          >
            <p className="text-2xl mb-1">🐾</p>
            <p className="text-[#074738] font-bold text-sm">Mis pacientes</p>
            <p className="text-slate-500 text-xs mt-0.5">Ver historial</p>
          </button>

          <button
            onClick={() => navigate("/vet/new-consultation")}
            className="bg-[#074738] rounded-[16px] p-5 text-left active:scale-[0.97] transition-transform"
          >
            <p className="text-2xl mb-1">➕</p>
            <p className="text-white font-bold text-sm">Nueva consulta</p>
            <p className="text-white/70 text-xs mt-0.5">Registrar atención</p>
          </button>
        </div>
      </div>

      {/* ── Recent consultations ── */}
      <div className="px-5 mt-6 pb-28">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#074738] font-bold text-base">Consultas recientes</h2>
        </div>

        {loadingData ? (
          <div className="bg-white rounded-[16px] p-6 text-center border border-slate-100">
            <div className="w-6 h-6 rounded-full border-2 border-[#074738] border-t-transparent animate-spin mx-auto" />
          </div>
        ) : consultations.length === 0 ? (
          <div className="bg-white rounded-[16px] p-8 text-center border border-slate-100">
            <p className="text-slate-400 text-sm">No hay consultas registradas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {consultations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedConsultation(c.id)}
                className="w-full bg-white rounded-[16px] p-4 text-left shadow-sm border border-slate-100 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[#074738] font-bold text-sm">{c.petName}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CHIP[c.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs">{c.tutorName}</p>
                    <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{c.reason}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <VetBottomNav currentTab={tab} onTabChange={setTab} />
    </div>
  );
}
