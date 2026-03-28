import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface VetProfile {
  fullName: string; email: string; specialty: string; matricula: string;
  clinicName?: string; clinicAddress?: string; phone?: string;
  country?: string; verified: boolean; createdAt: string;
}

interface Props { onBack: () => void; }

export function VetProfileScreen({ onBack }: Props) {
  const navigate = useNavigate();
  const { user, logout, userPhoto } = useAuth();
  const [profile, setProfile] = useState<VetProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "vetProfiles", user.uid)).then((snap) => {
      if (snap.exists()) setProfile(snap.data() as VetProfile);
    }).catch(() => {});
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/vet/login");
  };
  const InfoRow = ({ label, value }: { label: string; value?: string }) => value ? (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-900 text-right max-w-[60%] truncate">{value}</span>
    </div>
  ) : null;

  return (
    <div className="min-h-screen font-['Manrope',sans-serif]" style={{ background: "#F0FAF9" }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
        <div className="px-5 pt-12 pb-4">
          <h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Mi perfil</h1>
        </div>

        <div className="px-5 space-y-4">
          {/* Avatar + name */}
          <div className="bg-white rounded-[16px] p-5 text-center border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="size-20 mx-auto rounded-full bg-[#E0F2F1] flex items-center justify-center mb-3 overflow-hidden">
              {userPhoto ? <img src={userPhoto} alt="" className="w-full h-full object-cover" /> :
                <span className="material-symbols-outlined text-[#074738]" style={{ fontSize: "36px" }}>stethoscope</span>}
            </div>
            <h2 className="text-lg font-black text-slate-900">{profile?.fullName || user?.displayName || "Doctor"}</h2>
            <p className="text-sm text-slate-500">{profile?.specialty || "Veterinario"}</p>
            {profile?.verified && (
              <span className="inline-flex items-center gap-1 px-3 py-1 mt-2 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>verified</span> Verificado
              </span>
            )}
          </div>
          {/* Professional info */}
          <div className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Información profesional</h3>
            <InfoRow label="Matrícula" value={profile?.matricula} />
            <InfoRow label="Especialidad" value={profile?.specialty} />
            <InfoRow label="Email" value={profile?.email || user?.email || ""} />
            <InfoRow label="Teléfono" value={profile?.phone} />
          </div>

          {/* Clinic info */}
          {(profile?.clinicName || profile?.clinicAddress) && (
            <div className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Clínica</h3>
              <InfoRow label="Nombre" value={profile?.clinicName} />
              <InfoRow label="Dirección" value={profile?.clinicAddress} />
            </div>
          )}

          {/* Link to tutor app */}
          <button onClick={() => navigate("/login")}
            className="w-full bg-white rounded-[16px] p-4 text-left border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center gap-3">
            <span className="material-symbols-outlined text-[#074738]" style={{ fontSize: "24px" }}>pets</span>
            <div>
              <p className="font-bold text-slate-900 text-sm">¿Tenés mascota?</p>
              <p className="text-slate-500 text-xs">Ingresá a Pessy como tutor</p>
            </div>
          </button>

          {/* Logout */}
          <button onClick={handleLogout}
            className="w-full py-4 rounded-[14px] bg-red-50 text-red-600 font-bold text-sm border border-red-100">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}