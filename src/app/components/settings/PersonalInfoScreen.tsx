import { useState, useEffect } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { COUNTRIES } from "../../data/countries";
import { uploadWithAuthFallback } from "../../utils/storageUpload";

interface PersonalInfoScreenProps {
  onBack: () => void;
}

export function PersonalInfoScreen({ onBack }: PersonalInfoScreenProps) {
  const { user, refreshUser, userFullName, userPhoto, userCountry } = useAuth();
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", photo: "", country: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Cargar datos desde AuthContext — ya vienen de Firestore, sin duplicar la query
  useEffect(() => {
    if (!user) return;
    setFormData({
      name: userFullName || user.displayName || "",
      email: user.email || "",
      phone: user.phoneNumber || "",
      photo: userPhoto || user.photoURL || "",
      country: userCountry || "",
    });
  }, [user, userFullName, userPhoto, userCountry]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { alert("La imagen es muy grande. Máximo 5MB."); return; }
    setUploadingPhoto(true);
    try {
      const timestamp = Date.now();
      const uploadResult = await uploadWithAuthFallback({
        uid: user.uid,
        file,
        attempts: [
          { path: `users/${user.uid}/profile_photo_${timestamp}` },
          { path: `documents/${user.uid}/profile/profile_photo_${timestamp}` },
        ],
      });
      const url = await getDownloadURL(uploadResult.result.ref);
      await updateProfile(user, { photoURL: url });
      await setDoc(doc(db, "users", user.uid), { photo: url }, { merge: true });
      setFormData(prev => ({ ...prev, photo: url }));
      await refreshUser();
    } catch {
      alert("Error al subir la foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateProfile(user, { displayName: formData.name });
      await setDoc(doc(db, "users", user.uid), {
        fullName: formData.name,
        name: formData.name,
        phone: formData.phone || null,
        country: formData.country || null,
        email: user.email || "",
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      await refreshUser(); // Actualiza userName/userFullName en todo el app
      setSuccessMsg("¡Información guardada!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch {
      alert("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 py-4 flex items-center gap-3">
            <button onClick={onBack}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <MaterialIcon name="arrow_back" className="text-xl" />
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Información Personal</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Foto */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Foto de perfil</label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {formData.photo ? (
                  <img src={formData.photo} alt="Foto"
                    className="size-24 rounded-full object-cover border-4 border-white dark:border-slate-900 shadow-lg" />
                ) : (
                  <div className="size-24 rounded-full bg-gradient-to-br from-[#074738] to-[#1a9b7d] flex items-center justify-center text-white shadow-lg">
                    <MaterialIcon name="person" className="text-5xl" />
                  </div>
                )}
                <label htmlFor="photo-upload"
                  className="absolute bottom-0 right-0 size-8 rounded-full bg-[#074738] text-white flex items-center justify-center cursor-pointer shadow-lg">
                  {uploadingPhoto
                    ? <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <MaterialIcon name="photo_camera" className="text-lg" />}
                  <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
              </div>
              <p className="text-xs text-slate-500">JPG, PNG o GIF. Máximo 5MB.</p>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nombre completo</label>
            <input type="text" value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]"
              placeholder="Tu nombre completo" />
          </div>

          {/* Email (solo lectura) */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email</label>
            <input type="email" value={formData.email} readOnly
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 cursor-not-allowed" />
            <p className="text-xs text-slate-400 mt-1">El email no se puede cambiar desde aquí.</p>
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Teléfono</label>
            <input type="tel" value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]"
              placeholder="+54 9 11 1234-5678" />
          </div>

          {/* País */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">País</label>
            <div className="relative">
              <select value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738] appearance-none cursor-pointer">
                <option value="">🌍 Seleccioná tu país</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">▾</div>
            </div>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium text-center">
              {successMsg}
            </div>
          )}

          <button onClick={handleSave} disabled={isSaving}
            className="w-full py-4 rounded-xl bg-[#074738] text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {isSaving
              ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
              : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
