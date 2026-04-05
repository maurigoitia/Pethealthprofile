/**
 * ReportFoundPet — Form for "Encontré un perro/gato"
 *
 * The finder is a Good Samaritan helping reunite a pet with its owner.
 * They NEVER get ownership. This creates a `found_pets` Firestore record
 * so the owner can be notified and arranged a reunion.
 */

import { useState, useRef } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { MaterialIcon } from "../shared/MaterialIcon";

interface Props {
  onBack: () => void;
  onSuccess: () => void;
}

export function ReportFoundPet({ onBack, onSuccess }: Props) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [foundDate, setFoundDate] = useState(new Date().toISOString().slice(0, 10));
  const [foundTime, setFoundTime] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [hasCollar, setHasCollar] = useState<boolean | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!user?.uid) return;
    if (!address.trim() || !contactPhone.trim()) {
      alert("Por favor ingresá la ubicación y tu teléfono de contacto");
      return;
    }

    setSubmitting(true);
    try {
      let finalPhotoUrl: string | null = null;
      if (photoFile) {
        const storageRef = ref(storage, `found-pets/${user.uid}/${Date.now()}_${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
        finalPhotoUrl = await getDownloadURL(storageRef);
      }

      // Get current location for matching
      const pos = await new Promise<GeolocationPosition | null>((resolve) =>
        navigator.geolocation?.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true })
      );

      const now = Timestamp.now();
      await addDoc(collection(db, "found_pets"), {
        finderUserId: user.uid,
        status: "active",
        photoUrl: finalPhotoUrl,
        description: description.trim(),
        foundAddress: address.trim(),
        foundLocation: pos
          ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
          : null,
        foundAt: Timestamp.fromDate(new Date(`${foundDate}T${foundTime || "12:00"}`)),
        hasCollar,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        reportedAt: now,
        updatedAt: now,
        // NEVER allows ownership transfer — this is a reunion lead only
        ownershipTransferAllowed: false,
      });

      onSuccess();
    } catch (err) {
      console.error("ReportFoundPet:", err);
      alert("Error al enviar el reporte. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F0FAF9] dark:bg-[#101622]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="size-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <MaterialIcon name="arrow_back" className="text-[#074738] dark:text-emerald-400" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-[#074738] dark:text-white">Encontré una mascota</h1>
          <p className="text-xs text-slate-500">Ayudame a reunirla con su tutor</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Info banner — make clear this is NOT an ownership claim */}
        <div className="bg-[#E0F2F1] dark:bg-emerald-900/20 rounded-2xl p-4 flex gap-3">
          <MaterialIcon name="volunteer_activism" className="text-[#1A9B7D] text-xl flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-[#074738] dark:text-emerald-300">
              Gracias por ayudar 🐾
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Tu reporte se usará para contactar al tutor. No implica adopción ni transferencia — sos un/a samaritano/a ayudando a reunir a esta mascota con su familia.
            </p>
          </div>
        </div>

        {/* Photo upload */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
            Foto de la mascota <span className="text-[#1A9B7D] font-bold">*</span>
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 cursor-pointer text-center hover:border-[#1A9B7D] transition-colors"
          >
            {photoUrl ? (
              <div className="space-y-2">
                <img src={photoUrl} alt="preview" className="h-36 w-full object-cover rounded-xl" />
                <p className="text-xs text-slate-500">Toca para cambiar</p>
              </div>
            ) : (
              <div className="space-y-2 py-4">
                <MaterialIcon name="add_a_photo" className="text-4xl text-slate-400 mx-auto" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Agregar foto</p>
                <p className="text-xs text-slate-500">Muy importante para identificarla</p>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
            Descripción de la mascota
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Perro mediano, pelaje marrón, parece Golden Retriever, muy amigable. Sin collar."
            rows={3}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:border-[#1A9B7D]"
          />
        </div>

        {/* Has collar */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
            ¿Tiene collar?
          </label>
          <div className="flex gap-2">
            {([true, false] as const).map((val) => (
              <button
                key={String(val)}
                onClick={() => setHasCollar(val)}
                className={`flex-1 h-[44px] rounded-2xl font-medium text-sm transition-colors border-2 ${
                  hasCollar === val
                    ? "bg-[#074738] text-white border-[#074738]"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {val ? "Sí" : "No"}
              </button>
            ))}
          </div>
        </div>

        {/* Where found */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
            ¿Dónde la encontraste? <span className="text-[#1A9B7D] font-bold">*</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ej: Av. Corrientes y Maipú, CABA"
            className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#1A9B7D]"
          />
        </div>

        {/* Date & Time found */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Fecha</label>
            <input
              type="date"
              value={foundDate}
              onChange={(e) => setFoundDate(e.target.value)}
              className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Hora aprox.</label>
            <input
              type="time"
              value={foundTime}
              onChange={(e) => setFoundTime(e.target.value)}
              className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Contact */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Tu nombre</label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Para que el tutor pueda contactarte"
            className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#1A9B7D]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
            Teléfono de contacto <span className="text-[#1A9B7D] font-bold">*</span>
          </label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+54 9 1123456789 o WhatsApp"
            className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#1A9B7D]"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-[52px] rounded-2xl bg-[#1A9B7D] text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#1A9B7D]/25"
        >
          {submitting ? (
            <div className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <>
              <MaterialIcon name="send" className="text-lg" />
              Enviar reporte de mascota encontrada
            </>
          )}
        </button>

        <p className="text-xs text-center text-slate-400 pb-4">
          Este reporte ayuda a reunir a la mascota con su tutor. No implica adopción.
        </p>
      </div>
    </div>
  );
}
