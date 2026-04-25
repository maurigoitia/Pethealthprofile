/**
 * PublicPetProfilePage — perfil público para rescate cuando alguien
 * encuentra una mascota perdida con QR Pessy.
 *
 * URL: /p/:petId
 *
 * Reglas:
 * - SIN autenticación requerida (página pública).
 * - Solo muestra datos si la mascota tiene `publicProfile.enabled === true`
 *   (campo que setea el dueño desde la app cuando activa "modo perdido").
 * - Información expuesta: nombre, foto, contacto del dueño (tel/email),
 *   alergias críticas. Nunca: dirección, historia clínica completa, otros
 *   pets del owner.
 * - Diseño minimalista para que un rescatista (que probablemente NO tiene
 *   Pessy instalado) pueda llamar/escribir al dueño en 1 tap.
 *
 * Si el petId no existe, lostMode no está activo, o data no public →
 * empty state honesto: "Este perfil no está disponible públicamente."
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface PublicProfile {
  enabled: boolean;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  alerts?: string;
  reward?: string;
}

interface PublicPet {
  name?: string;
  species?: string;
  breed?: string;
  photo?: string;
  publicProfile?: PublicProfile;
}

export default function PublicPetProfilePage() {
  const { petId } = useParams<{ petId: string }>();
  const [pet, setPet] = useState<PublicPet | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!petId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "pets", petId));
        if (!snap.exists()) {
          setNotFound(true);
        } else {
          const data = snap.data() as PublicPet;
          if (!data.publicProfile?.enabled) {
            setNotFound(true);
          } else {
            setPet(data);
          }
        }
      } catch (err) {
        console.error("[PublicPetProfile] fetch error:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [petId]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[#F0FAF9]"
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        <div className="size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
      </div>
    );
  }

  if (notFound || !pet) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#F0FAF9] text-center"
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        <div className="w-16 h-16 rounded-full bg-[#E0F2F1] flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl text-[#074738]">help</span>
        </div>
        <h1
          className="text-xl font-extrabold text-[#074738] mb-2"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Perfil no disponible
        </h1>
        <p className="text-sm text-[#6B7280] max-w-xs">
          Este perfil no está activo públicamente. Si encontraste una mascota,
          probá Google Maps para ubicar veterinarios cercanos.
        </p>
        <a
          href="https://pessy.app"
          className="mt-6 px-5 py-3 rounded-full bg-[#074738] text-white text-sm font-bold"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Conocé Pessy
        </a>
      </div>
    );
  }

  const profile = pet.publicProfile!;

  return (
    <div
      className="min-h-screen bg-[#F0FAF9] pb-12"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <div className="max-w-md mx-auto px-5 pt-6">
        {/* Lost banner */}
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-4 rounded-2xl mb-5 text-center">
          <div className="text-2xl mb-1">🆘</div>
          <p
            className="text-base font-extrabold"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            ESTOY PERDIDO/A
          </p>
          <p className="text-xs text-red-600 mt-1">
            Por favor ayudame a volver con mi familia
          </p>
        </div>

        {/* Pet photo */}
        {pet.photo && !pet.photo.startsWith("data:image/svg") ? (
          <img
            src={pet.photo}
            alt={pet.name || "Mascota"}
            className="w-full aspect-square object-cover rounded-[24px] mb-5 shadow-[0_8px_24px_rgba(7,71,56,0.15)]"
          />
        ) : (
          <div className="w-full aspect-square rounded-[24px] mb-5 bg-[#E0F2F1] flex items-center justify-center text-6xl">
            🐾
          </div>
        )}

        {/* Pet basics */}
        <h1
          className="text-3xl font-extrabold text-[#074738] mb-1"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {pet.name || "Sin nombre"}
        </h1>
        <p className="text-sm text-[#6B7280] mb-6">
          {[pet.breed, pet.species].filter(Boolean).join(" · ") || "Mascota"}
        </p>

        {/* Contact CTAs — el corazón de la página */}
        <div className="space-y-3 mb-5">
          {profile.ownerPhone && (
            <a
              href={`tel:${profile.ownerPhone.replace(/\D/g, "")}`}
              className="flex items-center gap-3 w-full bg-[#1A9B7D] text-white rounded-[16px] px-5 py-4 active:scale-[0.97] transition-transform shadow-[0_4px_14px_rgba(26,155,125,0.25)]"
            >
              <span className="material-symbols-outlined text-2xl">call</span>
              <div className="flex-1 text-left">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest opacity-80"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  Llamar al dueño
                </p>
                <p
                  className="text-base font-extrabold"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {profile.ownerPhone}
                </p>
              </div>
              <span className="material-symbols-outlined">arrow_forward</span>
            </a>
          )}

          {profile.ownerEmail && (
            <a
              href={`mailto:${profile.ownerEmail}?subject=${encodeURIComponent(
                `Encontré a ${pet.name || "tu mascota"}`,
              )}`}
              className="flex items-center gap-3 w-full bg-white border border-[#074738]/20 rounded-[16px] px-5 py-4 active:scale-[0.97] transition-transform"
            >
              <span className="material-symbols-outlined text-2xl text-[#074738]">mail</span>
              <div className="flex-1 text-left">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  Enviar email
                </p>
                <p
                  className="text-sm font-bold text-[#074738] truncate"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  {profile.ownerEmail}
                </p>
              </div>
            </a>
          )}
        </div>

        {/* Critical alerts */}
        {profile.alerts && (
          <div className="bg-amber-50 border border-amber-200 rounded-[16px] px-4 py-3.5 mb-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">
              ⚠️ Información médica importante
            </p>
            <p className="text-sm font-medium text-amber-900 leading-relaxed">
              {profile.alerts}
            </p>
          </div>
        )}

        {/* Reward (opcional) */}
        {profile.reward && (
          <div className="bg-[#E0F2F1] border border-[#1A9B7D]/30 rounded-[16px] px-4 py-3.5 mb-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#074738] mb-1">
              Recompensa ofrecida
            </p>
            <p className="text-sm font-medium text-[#074738]">{profile.reward}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-[#9CA3AF] mt-8 pt-5 border-t border-[#E5E7EB]">
          <p>Perfil generado por Pessy</p>
          <a
            href="https://pessy.app"
            className="inline-block mt-1 text-[#1A9B7D] font-semibold"
          >
            Conocé Pessy →
          </a>
        </div>
      </div>
    </div>
  );
}
