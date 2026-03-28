/**
 * ReportLostPet — Formulario para reportar mascota perdida
 *
 * Auto-fills datos de la mascota desde PetContext.
 * Captura: última ubicación, hora, características distintivas.
 */

import { useState } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { usePet } from "../../contexts/PetContext";
import { useAuth } from "../../contexts/AuthContext";
import { useGamification } from "../../contexts/GamificationContext";
import { MaterialIcon } from "../shared/MaterialIcon";
import type { LostPetReport, PetSnapshot } from "../../../domain/community/lostPet.contract";
import { DEFAULT_LOST_PET_ALERT_CONFIG } from "../../../domain/community/lostPet.contract";

interface Props {
  onBack: () => void;
  onSuccess: () => void;
}

export function ReportLostPet({ onBack, onSuccess }: Props) {
  const { activePet, activePetId } = usePet();
  const { user } = useAuth();
  const { addPoints } = useGamification();

  const [features, setFeatures] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!user?.uid || !activePet || !activePetId) return;
    setSubmitting(true);

    try {
      // Get current location
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }),
      );

      const now = Timestamp.now();
      const snapshot: PetSnapshot = {
        name: activePet.name,
        species: (activePet.species as "dog" | "cat") || "dog",
        breed: activePet.breed || "",
        color: "",
        size: activePet.weight && activePet.weight > 25 ? "large" : activePet.weight && activePet.weight > 10 ? "medium" : "small",
        photoUrls: activePet.photo ? [activePet.photo] : [],
        distinctiveFeatures: features,
      };

      const report: Omit<LostPetReport, "id"> = {
        petId: activePetId,
        ownerId: user.uid,
        status: "active",
        petSnapshot: snapshot,
        lastSeenLocation: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        lastSeenAddress: address,
        lastSeenAt: now,
        searchRadius: DEFAULT_LOST_PET_ALERT_CONFIG.immediateRadiusKm,
        reportedAt: now,
        updatedAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + DEFAULT_LOST_PET_ALERT_CONFIG.expirationDays * 86400000),
        viewCount: 0,
        sightingCount: 0,
      };

      await addDoc(collection(db, "lost_pets"), report);
      await addPoints("report_lost_pet");
      onSuccess();
    } catch (err) {
      console.error("Error reporting lost pet:", err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!activePet) return null;

  return (
    <div className="min-h-screen bg-[#F0FAF9] dark:bg-[#101622]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="size-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" style={{ transition: "background 150ms ease" }}>
          <MaterialIcon name="arrow_back" className="text-[#074738] dark:text-emerald-400" />
        </button>
        <h1 className="text-lg font-bold text-[#074738] dark:text-white">Reportar mascota perdida</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Auto-filled pet info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
          <div className="size-14 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden">
            {activePet.photo ? (
              <img src={activePet.photo} alt={activePet.name} className="size-full object-cover" />
            ) : (
              <div className="size-full flex items-center justify-center"><MaterialIcon name="pets" className="text-xl text-slate-400" /></div>
            )}
          </div>
          <div>
            <p className="font-bold text-[#074738] dark:text-white">{activePet.name}</p>
            <p className="text-sm text-slate-500">{activePet.breed}</p>
          </div>
          <MaterialIcon name="check_circle" className="ml-auto text-[#1A9B7D] text-xl" />
        </div>

        {/* Address */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">¿Dónde lo/la viste por última vez?</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ej: Parque Centenario, esquina Díaz Vélez"
            className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>

        {/* Distinctive features */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Características distintivas</label>
          <textarea
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder="Ej: Collar rojo, cicatriz en oreja izquierda, tiene chip"
            rows={3}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white placeholder-slate-400 resize-none"
          />
        </div>

        {/* Info */}
        <div className="bg-[#E0F2F1] dark:bg-emerald-900/20 rounded-2xl p-4 flex gap-3">
          <MaterialIcon name="info" className="text-[#1A9B7D] text-xl flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#074738] dark:text-emerald-300">
            Se enviará una alerta a usuarios de PESSY en un radio de 2km. Si no hay avistamientos, se expandirá automáticamente.
          </p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-[52px] rounded-2xl bg-[#074738] text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ transition: "opacity 150ms ease" }}
        >
          {submitting ? (
            <div className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <>
              <MaterialIcon name="campaign" className="text-xl" />
              Enviar alerta
            </>
          )}
        </button>
      </div>
    </div>
  );
}
