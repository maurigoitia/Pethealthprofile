/**
 * ReportLostPet — Formulario para reportar mascota perdida
 *
 * Auto-fills datos de la mascota desde PetContext.
 * Captura: foto, ubicación, hora, características distintivas, contacto.
 * Status: perdido, encontrado, reunido.
 */

import { useState, useRef } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [features, setFeatures] = useState("");
  const [address, setAddress] = useState("");
  const [lostDate, setLostDate] = useState("");
  const [lostTime, setLostTime] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [status, setStatus] = useState<"perdido" | "encontrado" | "reunido">("perdido");
  const [photoUrl, setPhotoUrl] = useState<string | null>(activePet?.photo || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      // Store file for later upload during submit
      setPhotoFile(file);

      // Show preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function uploadPhotoToStorage(file: File): Promise<string> {
    if (!user?.uid) throw new Error("User not authenticated");

    const storageRef = ref(storage, `lost-pets/${user.uid}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  async function handleSubmit() {
    if (!user?.uid || !activePet || !activePetId) return;
    if (!address.trim() || !lostDate || !lostTime) {
      alert("Por favor completa ubicación, fecha y hora");
      return;
    }

    setSubmitting(true);

    try {
      // Get current location
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }),
      );

      let finalPhotoUrl = photoUrl;

      // Upload new photo if selected
      if (photoFile) {
        finalPhotoUrl = await uploadPhotoToStorage(photoFile);
      }

      const now = Timestamp.now();
      const snapshot: PetSnapshot = {
        name: activePet.name,
        species: (activePet.species as "dog" | "cat") || "dog",
        breed: activePet.breed || "",
        color: activePet.color || "",
        size: activePet.weight && activePet.weight > 25 ? "large" : activePet.weight && activePet.weight > 10 ? "medium" : "small",
        photoUrls: finalPhotoUrl ? [finalPhotoUrl] : [],
        distinctiveFeatures: features,
      };

      const report: Omit<LostPetReport, "id"> = {
        petId: activePetId,
        ownerId: user.uid,
        status: status === "reunido" ? "found" : "active",
        petSnapshot: snapshot,
        lastSeenLocation: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        lastSeenAddress: address,
        lastSeenAt: Timestamp.fromDate(new Date(`${lostDate}T${lostTime}`)),
        searchRadius: DEFAULT_LOST_PET_ALERT_CONFIG.immediateRadiusKm,
        reportedAt: now,
        updatedAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + DEFAULT_LOST_PET_ALERT_CONFIG.expirationDays * 86400000),
        viewCount: 0,
        sightingCount: 0,
        contactPhone: contactPhone,
        reportType: status,
      };

      await addDoc(collection(db, "lost_pets"), report);
      await addPoints("report_lost_pet");
      onSuccess();
    } catch (err) {
      console.error("Error reporting lost pet:", err);
      alert("Error al reportar. Intenta de nuevo.");
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
        <h1 className="text-lg font-bold text-[#074738] dark:text-white">Reportar mascota</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Status selector */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">¿Cuál es la situación?</label>
          <div className="flex gap-2">
            {(["perdido", "encontrado", "reunido"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 h-[44px] rounded-2xl font-medium text-sm transition-colors ${
                  status === s
                    ? "bg-[#074738] text-white"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {s === "perdido" && "Perdido"}
                {s === "encontrado" && "Encontrado"}
                {s === "reunido" && "Reunido"}
              </button>
            ))}
          </div>
        </div>

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

        {/* Photo upload */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Foto adicional (opcional)</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 cursor-pointer text-center hover:border-[#1A9B7D] transition-colors"
          >
            {photoUrl ? (
              <div className="space-y-2">
                <img src={photoUrl} alt="preview" className="h-32 w-full object-cover rounded-lg" />
                <p className="text-xs text-slate-500">Toca para cambiar</p>
              </div>
            ) : (
              <div className="space-y-2">
                <MaterialIcon name="cloud_upload" className="text-3xl text-slate-400 mx-auto" />
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">Subir foto</p>
                <p className="text-xs text-slate-500">PNG, JPG o WebP</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            disabled={uploadingPhoto}
            className="hidden"
          />
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Fecha</label>
            <input
              type="date"
              value={lostDate}
              onChange={(e) => setLostDate(e.target.value)}
              className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Hora</label>
            <input
              type="time"
              value={lostTime}
              onChange={(e) => setLostTime(e.target.value)}
              className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">¿Dónde fue visto/a?</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ej: Parque Centenario, esquina Díaz Vélez"
            className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>

        {/* Contact phone */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Teléfono de contacto</label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+54 9 1123456789 o WhatsApp"
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
            {status === "perdido" ? "Se enviará una alerta a usuarios de PESSY en un radio de 2km. Si no hay avistamientos, se expandirá automáticamente." : "Tu reporte ayudará a otros usuarios a identificar a esta mascota."}
          </p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || uploadingPhoto}
          className="w-full h-[52px] rounded-2xl bg-[#074738] text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ transition: "opacity 150ms ease" }}
        >
          {submitting ? (
            <div className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <>
              <MaterialIcon name="campaign" className="text-xl" />
              Enviar reporte
            </>
          )}
        </button>
      </div>
    </div>
  );
}
