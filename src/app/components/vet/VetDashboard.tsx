import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { VetBottomNav } from "./VetBottomNav";
import { VetPatientList } from "./VetPatientList";
import { VetConsultationView } from "./VetConsultationView";
import { VetProfileScreen } from "./VetProfileScreen";

interface VetProfile {
  fullName: string;
  specialty: string;
  matricula: string;
  clinicName?: string;
  verified: boolean;
  patientsCount: number;
}

interface ConsultationSummary {
  id: string;
  petName: string;
  tutorName: string;
  reason: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: string;
}

export default function VetDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, userName } = useAuth();  const [currentTab, setCurrentTab] = useState<"home" | "patients" | "profile">("home");
  const [vetProfile, setVetProfile] = useState<VetProfile | null>(null);
  const [recentConsultations, setRecentConsultations] = useState<ConsultationSummary[]>([]);
  const [stats, setStats] = useState({ todayCount: 0, pendingCount: 0, totalPatients: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const loadVetData = async () => {
      try {
        // Load vet profile
        const profileSnap = await getDoc(doc(db, "vetProfiles", user.uid));
        if (profileSnap.exists()) {
          setVetProfile(profileSnap.data() as VetProfile);
        }

        // Load recent consultations
        const consRef = collection(db, "consultations");
        const q = query(consRef, where("vetId", "==", user.uid), orderBy("createdAt", "desc"), limit(10));
        const snap = await getDocs(q);
        const consultations: ConsultationSummary[] = [];
        snap.forEach((d) => {
          const data = d.data();
          consultations.push({
            id: d.id,
            petName: data.petName || "Sin nombre",
            tutorName: data.tutorName || "Tutor",
            reason: data.reason || "Consulta general",
            status: data.status || "pending",
            createdAt: data.createdAt || "",
          });
        });        setRecentConsultations(consultations);

        // Calculate stats
        const today = new Date().toISOString().split("T")[0];
        const todayCount = consultations.filter((c) => c.createdAt.startsWith(today)).length;
        const pendingCount = consultations.filter((c) => c.status === "pending").length;
        setStats({ todayCount, pendingCount, totalPatients: profileSnap.exists() ? (profileSnap.data().patientsCount || 0) : 0 });
      } catch (err) {
        console.warn("[PessyVet] Error loading vet data:", err);
      } finally {
        setLoadingData(false);
      }
    };
    loadVetData();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F0FAF9" }}>
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
          <p className="text-base font-bold text-slate-900">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/vet/login" replace />;

  if (selectedConsultation) {
    return (
      <>
        <VetConsultationView consultationId={selectedConsultation} onBack={() => setSelectedConsultation(null)} />
        <VetBottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
      </>
    );
  }
  if (currentTab === "patients") {
    return (
      <>
        <VetPatientList onSelectConsultation={setSelectedConsultation} />
        <VetBottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
      </>
    );
  }

  if (currentTab === "profile") {
    return (
      <>
        <VetProfileScreen onBack={() => setCurrentTab("home")} />
        <VetBottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
      </>
    );
  }

  const safeVetName = userName || vetProfile?.fullName?.split(" ")[0] || "Doctor";
  const statusColor = { pending: "bg-amber-100 text-amber-700", in_progress: "bg-blue-100 text-blue-700", completed: "bg-emerald-100 text-emerald-700" };
  const statusLabel = { pending: "Pendiente", in_progress: "En curso", completed: "Completada" };

  return (
    <div className="min-h-screen font-['Manrope',sans-serif]" style={{ background: "#F0FAF9" }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
        {/* Header */}
        <div className="px-5 pt-12 pb-6 rounded-b-[28px]" style={{ background: "linear-gradient(135deg, #074738 0%, #0a6b54 100%)" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white/70 text-sm font-medium">Bienvenido</p>              <h1 className="text-2xl font-black text-white" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                Dr. {safeVetName}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {vetProfile?.verified && (
                <span className="px-2 py-1 rounded-full bg-emerald-400/20 text-emerald-300 text-xs font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>verified</span> Verificado
                </span>
              )}
              <div className="size-11 rounded-full bg-white/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-white" style={{ fontSize: "22px" }}>stethoscope</span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-[16px] p-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-black text-white">{stats.todayCount}</p>
              <p className="text-white/60 text-xs font-semibold mt-0.5">Hoy</p>
            </div>
            <div className="bg-white/10 rounded-[16px] p-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-black text-[#1A9B7D]">{stats.pendingCount}</p>
              <p className="text-white/60 text-xs font-semibold mt-0.5">Pendientes</p>
            </div>
            <div className="bg-white/10 rounded-[16px] p-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-black text-white">{stats.totalPatients}</p>
              <p className="text-white/60 text-xs font-semibold mt-0.5">Pacientes</p>
            </div>
          </div>
        </div>
        {/* Quick actions */}
        <div className="px-5 mt-5">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setCurrentTab("patients")}
              className="bg-white rounded-[16px] p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 hover:shadow-md transition-shadow">
              <span className="material-symbols-outlined text-[#074738] mb-2" style={{ fontSize: "28px" }}>pets</span>
              <p className="font-bold text-slate-900 text-sm">Mis pacientes</p>
              <p className="text-slate-500 text-xs mt-0.5">Ver historial clínico</p>
            </button>
            <button onClick={() => navigate("/vet/new-consultation")}
              className="bg-[#074738] rounded-[16px] p-4 text-left shadow-[0_4px_12px_rgba(7,71,56,0.3)] hover:shadow-lg transition-shadow">
              <span className="material-symbols-outlined text-[#1A9B7D] mb-2" style={{ fontSize: "28px" }}>add_circle</span>
              <p className="font-bold text-white text-sm">Nueva consulta</p>
              <p className="text-white/60 text-xs mt-0.5">Registrar atención</p>
            </button>
          </div>
        </div>

        {/* Recent consultations */}
        <div className="px-5 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              Consultas recientes
            </h2>
            <button onClick={() => setCurrentTab("patients")} className="text-[#074738] text-sm font-bold">Ver todas</button>
          </div>
          {loadingData ? (
            <div className="bg-white rounded-[16px] p-6 text-center border border-slate-100">
              <div className="mx-auto size-8 rounded-full border-3 border-[#074738]/20 border-t-[#074738] animate-spin" />
            </div>
          ) : recentConsultations.length === 0 ? (
            <div className="bg-white rounded-[16px] p-8 text-center border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="material-symbols-outlined text-slate-300 mb-3" style={{ fontSize: "48px" }}>clinical_notes</span>
              <h3 className="font-bold text-slate-900 mb-1">Sin consultas aún</h3>
              <p className="text-slate-500 text-sm mb-4">Comenzá registrando tu primera consulta veterinaria.</p>
              <button onClick={() => navigate("/vet/new-consultation")}
                className="px-5 py-2.5 rounded-[12px] bg-[#074738] text-white font-bold text-sm shadow-[0_4px_12px_rgba(7,71,56,0.3)]">
                Crear consulta
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentConsultations.map((c) => (
                <button key={c.id} onClick={() => setSelectedConsultation(c.id)}
                  className="w-full bg-white rounded-[16px] p-4 text-left border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[#074738]" style={{ fontSize: "18px" }}>pets</span>
                        <p className="font-bold text-slate-900 text-sm">{c.petName}</p>
                      </div>
                      <p className="text-slate-500 text-xs">Tutor: {c.tutorName}</p>
                      <p className="text-slate-600 text-xs mt-1">{c.reason}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusColor[c.status]}`}>
                      {statusLabel[c.status]}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <VetBottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
}