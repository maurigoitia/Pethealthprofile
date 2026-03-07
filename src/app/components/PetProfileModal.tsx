import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import { VaccinationCardModal } from "./VaccinationCardModal";
import { BirthDatePrecision, usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import { useAuth } from "../contexts/AuthContext";
import { DOG_BREEDS, CAT_BREEDS, OTHER_BREEDS } from "../data/breeds";
import { searchBreeds } from "../utils/breedSearch";
import { formatDateSafe, parseDateSafe, toDateInputValueSafe, toDateKeySafe } from "../utils/dateUtils";
import { DEFAULT_PET_PHOTO } from "../constants/petDefaults";
import { PetPhoto } from "./PetPhoto";
import { getPetPhotoAcceptValue, preparePetPhotoForUpload } from "../utils/petPhotoUpload";
import { uploadPetPhotoWithFallback } from "../services/petPhotoService";

interface PetProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = "profile" | "vaccination";

interface Vaccine {
  id: number;
  name: string;
  date: string;
  nextDue: string;
  veterinarian: string;
  status: "current" | "due-soon" | "overdue";
}

export function PetProfileModal({ isOpen, onClose }: PetProfileModalProps) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [showVaccinationCard, setShowVaccinationCard] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoGalleryInputRef = useRef<HTMLInputElement>(null);
  const photoCameraInputRef = useRef<HTMLInputElement>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  // Breed autocomplete
  const [breedInput, setBreedInput] = useState("");
  const [breedSuggestions, setBreedSuggestions] = useState<string[]>([]);
  const [showBreedSuggestions, setShowBreedSuggestions] = useState(false);

  const { activePet, updatePet } = usePet();
  const { user } = useAuth();

  const getBreedList = () => {
    const sp = activePet?.species?.toLowerCase() || "";
    if (sp === "cat" || sp === "gato") return CAT_BREEDS;
    if (sp === "other" || sp === "otro") return OTHER_BREEDS;
    return DOG_BREEDS;
  };

  const getInitialBirthDateState = () => {
    const normalized = toDateInputValueSafe(activePet?.birthDate);
    const parsed = normalized ? parseDateSafe(normalized) : null;
    const precision = (activePet?.birthDatePrecision ||
      (normalized ? "exact" : "unknown")) as BirthDatePrecision;
    return {
      birthDatePrecision: precision,
      birthDateExact: normalized,
      birthDateMonth: normalized ? normalized.slice(0, 7) : "",
      birthDateYear: parsed ? String(parsed.getFullYear()) : "",
    };
  };

  const [editData, setEditData] = useState({
    name: activePet?.name || "",
    breed: activePet?.breed || "",
    weightNum: activePet?.weight || "",
    ...getInitialBirthDateState(),
    hasChip: false,
    microchip: "",
  });

  const photo = activePet?.photo || DEFAULT_PET_PHOTO;

  const handleOpenEdit = () => {
    setEditData({
      name: activePet?.name || "",
      breed: activePet?.breed || "",
      weightNum: activePet?.weight || "",
      ...getInitialBirthDateState(),
      hasChip: false,
      microchip: "",
    });
    setBreedInput(activePet?.breed || "");
    setIsEditing(true);
  };

  const handleBreedInput = (value: string) => {
    setBreedInput(value);
    setEditData((prev) => ({ ...prev, breed: value }));
    if (value.length >= 1) {
      const filtered = searchBreeds(getBreedList(), value, 6);
      setBreedSuggestions(filtered.slice(0, 6));
      setShowBreedSuggestions(filtered.length > 0);
    } else {
      setShowBreedSuggestions(false);
    }
  };

  const handleBreedSelect = (breed: string) => {
    setBreedInput(breed);
    setEditData((prev) => ({ ...prev, breed }));
    setShowBreedSuggestions(false);
  };

  const handleSave = async () => {
    if (!activePet) return;
    setSaving(true);
    try {
      let normalizedBirthDate = "";
      let normalizedBirthPrecision: BirthDatePrecision = editData.birthDatePrecision;
      if (editData.birthDatePrecision === "exact") {
        normalizedBirthDate = toDateKeySafe(editData.birthDateExact);
        if (!normalizedBirthDate) normalizedBirthPrecision = "unknown";
      } else if (editData.birthDatePrecision === "month") {
        if (/^\d{4}-\d{2}$/.test(editData.birthDateMonth)) {
          normalizedBirthDate = `${editData.birthDateMonth}-15`;
        } else {
          normalizedBirthPrecision = "unknown";
        }
      } else if (editData.birthDatePrecision === "year") {
        const year = Number(editData.birthDateYear);
        if (Number.isFinite(year) && year >= 1900 && year <= new Date().getFullYear()) {
          normalizedBirthDate = `${String(year).padStart(4, "0")}-07-01`;
        } else {
          normalizedBirthPrecision = "unknown";
        }
      }

      const calculatedAge = calcAge(normalizedBirthDate, normalizedBirthPrecision);
      const updates: any = {
        name: editData.name,
        breed: editData.breed,
        birthDate: normalizedBirthDate,
        birthDatePrecision: normalizedBirthPrecision,
        age: calculatedAge === "No registrada" ? "" : calculatedAge,
      };
      const newWeight = editData.weightNum.trim();
      if (newWeight && newWeight !== activePet.weight) {
        updates.weight = newWeight;
        updates.newWeightEntry = {
          date: new Date().toISOString(),
          weight: parseFloat(newWeight),
        };
      }
      await updatePet(activePet.id, updates);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePet || !user) return;
    setUploadingPhoto(true);
    try {
      const normalizedFile = await preparePetPhotoForUpload(file);
      let photoUrl = "";
      const uploaded = await uploadPetPhotoWithFallback({
        petId: activePet.id,
        file: normalizedFile,
      });
      if (uploaded?.ok && uploaded.url) {
        photoUrl = uploaded.url;
      }

      if (!photoUrl) {
        throw new Error("No pudimos guardar la foto. Probá de nuevo con otra imagen.");
      }
      await updatePet(activePet.id, { photo: photoUrl });
    } catch (error: any) {
      console.error("No se pudo guardar la foto de la mascota:", error);
      alert(error?.message || "No pudimos guardar la foto. Probá de nuevo con otra imagen.");
    } finally {
      setUploadingPhoto(false);
      e.currentTarget.value = "";
    }
  };

  const openGalleryPicker = () => {
    setShowPhotoPicker(false);
    photoGalleryInputRef.current?.click();
  };

  const openCameraPicker = () => {
    setShowPhotoPicker(false);
    photoCameraInputRef.current?.click();
  };

  const { getEventsByPetId } = useMedical();

  // Vacunas reales desde medical_events procesados
  const vaccines = useMemo(() => {
    if (!activePet?.id) return [];
    return getEventsByPetId(activePet.id)
      .filter((e) => e.extractedData.documentType === "vaccine" && e.status === "completed")
      .map((e, idx) => ({
        id: idx,
        name: e.extractedData.diagnosis || e.extractedData.aiGeneratedSummary || "Vacuna",
        date: e.extractedData.eventDate
          ? formatDateSafe(e.extractedData.eventDate, "es-ES", { day: "2-digit", month: "short", year: "numeric" }, "Sin fecha")
          : formatDateSafe(e.createdAt, "es-ES", { day: "2-digit", month: "short", year: "numeric" }, "Sin fecha"),
        nextDue: e.extractedData.nextAppointmentDate
          ? formatDateSafe(e.extractedData.nextAppointmentDate, "es-ES", { day: "2-digit", month: "short", year: "numeric" }, "Sin fecha")
          : "No especificada",
        veterinarian: e.extractedData.provider || "Profesional no especificado",
        status: (() => {
          if (!e.extractedData.nextAppointmentDate) return "current" as const;
          const next = parseDateSafe(e.extractedData.nextAppointmentDate);
          if (!next) return "current" as const;
          const diff = (next.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          if (diff < 0) return "overdue" as const;
          if (diff < 30) return "due-soon" as const;
          return "current" as const;
        })(),
      }));
  }, [activePet?.id, getEventsByPetId]);

  const getStatusColor = (status: Vaccine["status"]) => {
    if (status === "current") return "bg-emerald-500";
    if (status === "due-soon") return "bg-amber-500";
    return "bg-red-500";
  };
  const getStatusLabel = (status: Vaccine["status"]) => {
    if (status === "current") return "Al día";
    if (status === "due-soon") return "Próxima";
    return "Vencida";
  };

  const displayWeight = activePet?.weight ? `${activePet.weight} kg` : "Sin peso";
  
  // Calcular edad desde birthDate
  const parseBirthDate = (birthDate?: string) => {
    const key = toDateKeySafe(birthDate);
    if (!key) return null;
    const [year, month, day] = key.split("-").map(Number);
    const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const calcAge = (birthDate?: string, precision: BirthDatePrecision = "exact") => {
    if (!birthDate || precision === "unknown") return "No registrada";
    const birth = parseBirthDate(birthDate);
    if (!birth) return "No registrada";
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    const totalMonths = years * 12 + months;
    const prefix = precision === "exact" ? "" : "Aprox. ";
    if (totalMonths < 1) return `${prefix}menos de 1 mes`;
    if (totalMonths < 12) return `${prefix}${totalMonths} ${totalMonths === 1 ? "mes" : "meses"}`;
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    return m > 0
      ? `${prefix}${y} ${y === 1 ? "año" : "años"} y ${m} ${m === 1 ? "mes" : "meses"}`
      : `${prefix}${y} ${y === 1 ? "año" : "años"}`;
  };

  const speciesLabel = () => {
    const s = activePet?.species?.toLowerCase() || "";
    if (s === "dog") return "Perro";
    if (s === "cat") return "Gato";
    return activePet?.species || "—";
  };

  const formatDate = (d?: string, precision: BirthDatePrecision = "exact") => {
    if (precision === "unknown") return "No registrada";
    const birth = parseBirthDate(d);
    if (!birth) return "No registrada";
    if (precision === "year") return `${birth.getFullYear()} (aprox.)`;
    if (precision === "month") {
      return `${birth.toLocaleDateString("es", { month: "long", year: "numeric" })} (aprox.)`;
    }
    return birth.toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" });
  };

  const displayAge = calcAge(activePet?.birthDate, activePet?.birthDatePrecision || "exact");
  const displayGender = activePet?.sex === "female" ? "Hembra" : "Macho";
  const displayBreed = activePet?.breed || "Desconocida";
  const displayBirth = formatDate(activePet?.birthDate, activePet?.birthDatePrecision || "exact");
  const weightHistory = (activePet as any)?.weightHistory || [];

  const handleAddPet = () => {
    onClose();
    navigate("/register-pet");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />

          <motion.div
            initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-6 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Perfil de Mascota</h2>
                <button onClick={onClose}
                  className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <MaterialIcon name="close" className="text-xl" />
                </button>
              </div>
              <div className="flex gap-2">
                {(["profile", "vaccination"] as ViewMode[]).map((mode) => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${
                      viewMode === mode
                        ? "bg-[#074738] text-white shadow-lg shadow-[#074738]/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}>
                    <MaterialIcon name={mode === "profile" ? "info" : "vaccines"} className="inline text-lg mr-1 align-text-bottom" />
                    {mode === "profile" ? "Datos" : "Vacunas"}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {viewMode === "profile" && (
                <div className="p-6 space-y-6">
                  {/* Photo */}
                  <div className="flex flex-col items-center">
                    <div className="relative mb-4">
                      <div className="size-32 rounded-3xl bg-gradient-to-br from-[#074738] to-emerald-500 p-1">
                        <div className="size-full rounded-[23px] overflow-hidden">
                          <PetPhoto
                            src={photo}
                            alt={activePet?.name || "Mascota"}
                            className="size-full object-cover"
                            fallbackClassName="rounded-full"
                          />
                        </div>
                      </div>
                      <input
                        ref={photoGalleryInputRef}
                        type="file"
                        accept={getPetPhotoAcceptValue()}
                        className="hidden"
                        onChange={handlePhotoChange}
                      />
                      <input
                        ref={photoCameraInputRef}
                        type="file"
                        accept={getPetPhotoAcceptValue()}
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoChange}
                      />
                      <button
                        onClick={() => setShowPhotoPicker((prev) => !prev)}
                        disabled={uploadingPhoto}
                        className="absolute bottom-0 right-0 size-10 rounded-full bg-[#074738] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                        {uploadingPhoto
                          ? <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <MaterialIcon name="photo_camera" className="text-xl" />}
                      </button>
                      {showPhotoPicker && !uploadingPhoto && (
                        <div className="absolute bottom-12 right-0 z-20 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
                          <button
                            type="button"
                            onClick={openCameraPicker}
                            className="w-full px-3 py-2.5 text-left text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            Tomar foto
                          </button>
                          <button
                            type="button"
                            onClick={openGalleryPicker}
                            className="w-full px-3 py-2.5 text-left text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800"
                          >
                            Elegir del dispositivo
                          </button>
                        </div>
                      )}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1 capitalize">{activePet?.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{displayBreed}</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: "cake", label: "Edad", value: displayAge },
                      { icon: "monitor_weight", label: "Peso", value: displayWeight },
                      { icon: activePet?.sex === "female" ? "female" : "male", label: "Sexo", value: displayGender },
                    ].map((s) => (
                      <div key={s.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                        <MaterialIcon name={s.icon} className="text-[#074738] text-2xl mb-1" />
                        <p className="text-xs text-slate-500 mb-0.5">{s.label}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Peso histórico */}
                  {weightHistory.length > 1 && (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                      <h4 className="font-black text-sm text-slate-900 dark:text-white mb-3">Historial de Peso</h4>
                      <div className="space-y-2">
                        {[...weightHistory].reverse().slice(0, 5).map((e: any, i: number) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-slate-500">{new Date(e.date).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}</span>
                            <span className="font-bold text-slate-900 dark:text-white">{e.weight} kg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Info detallada */}
                  <div className="space-y-3">
                    <h4 className="font-black text-sm text-slate-900 dark:text-white">Información Detallada</h4>
                    {[
                      { label: "Especie", value: speciesLabel(), icon: "id_card" },
                      { label: "Raza", value: displayBreed, icon: "biotech" },
                      { label: "Fecha de nacimiento", value: displayBirth, icon: "cake" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <div className="flex items-center gap-3">
                          <MaterialIcon name={item.icon} className="text-[#074738] text-xl" />
                          <span className="text-sm text-slate-500">{item.label}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <button onClick={handleOpenEdit}
                    className="w-full py-3 rounded-xl bg-[#074738] text-white font-bold shadow-lg shadow-[#074738]/30 flex items-center justify-center gap-2">
                    <MaterialIcon name="edit" className="text-xl" />
                    Editar Perfil
                  </button>
                  <button
                    onClick={handleAddPet}
                    className="w-full py-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-[#074738] text-[#074738] font-bold flex items-center justify-center gap-2 hover:bg-[#074738]/5 transition-colors"
                  >
                    <MaterialIcon name="add" className="text-xl" />
                    Agregar Mascota
                  </button>

                  {/* Sección co-tutores: solo informativa */}
                  {(() => {
                    const coTutors = activePet?.coTutors || [];
                    if (coTutors.length === 0) return null;
                    return (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
                          Compartida con
                        </p>
                        <div className="space-y-2">
                          {coTutors.map((ct: any) => (
                            <div key={ct.uid} className="flex items-center gap-3">
                              <div className="size-8 rounded-full bg-[#074738]/10 flex items-center justify-center shrink-0">
                                <MaterialIcon name="person" className="text-[#074738] text-base" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                  {ct.name || ct.email || "Co-tutor"}
                                </p>
                                {ct.email && ct.name && (
                                  <p className="text-xs text-slate-500">{ct.email}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {viewMode === "vaccination" && (
                <div className="p-6 space-y-4">
                  <div className="bg-gradient-to-br from-[#074738]/10 to-emerald-100/50 rounded-xl p-4 border border-[#074738]/20">
                    <div className="flex items-start gap-3">
                      <div className="size-12 rounded-xl bg-[#074738] flex items-center justify-center shrink-0">
                        <MaterialIcon name="verified" className="text-white text-2xl" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1">Carnet Oficial de Vacunación</h4>
                        <p className="text-xs text-slate-600">Registro completo de vacunas de {activePet?.name}</p>
                      </div>
                    </div>
                  </div>
                  {vaccines.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-8">Aún no hay vacunas registradas. Subí un documento veterinario para detectarlas automáticamente.</p>
                  )}
                  {vaccines.map((v) => (
                    <div key={v.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h5 className="font-bold text-slate-900 dark:text-white mb-1">{v.name}</h5>
                          <p className="text-xs text-slate-500">{v.veterinarian}</p>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full ${getStatusColor(v.status)} text-white text-[10px] font-black uppercase`}>
                          {getStatusLabel(v.status)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-lg p-2">
                          <p className="text-[10px] text-slate-500 mb-0.5">Aplicada</p>
                          <p className="text-xs font-bold">{v.date}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                          <p className="text-[10px] text-slate-500 mb-0.5">Próxima dosis</p>
                          <p className="text-xs font-bold">{v.nextDue}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setShowVaccinationCard(true)}
                    className="w-full py-3 rounded-xl bg-[#074738] text-white font-bold shadow-lg shadow-[#074738]/30 flex items-center justify-center gap-2">
                    <MaterialIcon name="badge" className="text-xl" />
                    Ver Carnet
                  </button>
                </div>
              )}

              {/* EDIT OVERLAY */}
              <AnimatePresence>
                {isEditing && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white dark:bg-slate-900 z-10 overflow-y-auto">
                    <div className="p-6 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">Editar Información</h3>
                        <button onClick={() => setIsEditing(false)}
                          className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <MaterialIcon name="close" className="text-lg" />
                        </button>
                      </div>

                      {/* Nombre */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Nombre</label>
                        <input type="text" value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#074738]" />
                      </div>

                      {/* Raza con autocomplete */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Raza</label>
                        <div className="relative">
                          <input type="text" value={breedInput} autoComplete="off"
                            placeholder="Escribí para buscar..."
                            onChange={(e) => handleBreedInput(e.target.value)}
                            onFocus={() => breedInput.length >= 1 && setShowBreedSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowBreedSuggestions(false), 150)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#074738]" />
                          {showBreedSuggestions && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                              {breedSuggestions.map((b) => (
                                <button key={b} type="button" onMouseDown={() => handleBreedSelect(b)}
                                  className="w-full text-left px-4 py-3 text-sm text-slate-900 dark:text-white hover:bg-[#074738]/10 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0">
                                  {b}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Peso */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Peso actual (kg)
                          {(activePet as any)?.weightHistory?.length > 0 && (
                            <span className="ml-2 text-[#074738] font-normal">— se guardará en el historial</span>
                          )}
                        </label>
                        <div className="flex gap-3 items-center">
                          <input type="number" step="0.1" min="0" value={editData.weightNum}
                            onChange={(e) => setEditData({ ...editData, weightNum: e.target.value })}
                            placeholder={activePet?.weight || "Ej: 28.5"}
                            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#074738]" />
                          <span className="text-slate-500 font-semibold px-3 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">kg</span>
                        </div>
                        {(activePet as any)?.weightHistory?.length > 0 && (
                          <p className="text-xs text-slate-400 mt-1">
                            Último registro: {(activePet as any).weightHistory.at(-1)?.weight} kg ({formatDateSafe(
                              (activePet as any).weightHistory.at(-1)?.date,
                              "es",
                              { day: "2-digit", month: "short" },
                              "sin fecha"
                            )})
                          </p>
                        )}
                      </div>

                      {/* Fecha de nacimiento */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Fecha de nacimiento</label>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {[
                            { value: "exact", label: "Exacta" },
                            { value: "month", label: "Mes/Año aprox." },
                            { value: "year", label: "Año aprox." },
                            { value: "unknown", label: "No la sé" },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setEditData({ ...editData, birthDatePrecision: option.value as BirthDatePrecision })}
                              className={`py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                                editData.birthDatePrecision === option.value
                                  ? "border-[#074738] bg-[#074738]/10 text-[#074738]"
                                  : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>

                        {editData.birthDatePrecision === "exact" && (
                          <input
                            type="date"
                            value={editData.birthDateExact}
                            onChange={(e) => setEditData({ ...editData, birthDateExact: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#074738]"
                          />
                        )}
                        {editData.birthDatePrecision === "month" && (
                          <input
                            type="month"
                            value={editData.birthDateMonth}
                            onChange={(e) => setEditData({ ...editData, birthDateMonth: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#074738]"
                          />
                        )}
                        {editData.birthDatePrecision === "year" && (
                          <input
                            type="number"
                            min={1900}
                            max={new Date().getFullYear()}
                            placeholder="Ej: 2018"
                            value={editData.birthDateYear}
                            onChange={(e) => setEditData({ ...editData, birthDateYear: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#074738]"
                          />
                        )}
                        {editData.birthDatePrecision === "unknown" && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            No pasa nada. Podés cargarla después cuando tengas más información.
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-2">
                          Si es adoptado, usá mes/año o solo año aproximado. No hace falta inventar un día exacto.
                        </p>
                      </div>

                      {/* Microchip */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">¿Tiene microchip?</label>
                        <div className="flex gap-2">
                          {[true, false].map((v) => (
                            <button key={String(v)} type="button"
                              onClick={() => setEditData({ ...editData, hasChip: v })}
                              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                                editData.hasChip === v
                                  ? "bg-[#074738] text-white shadow-lg shadow-[#074738]/30"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}>
                              {v ? "Sí" : "No"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {editData.hasChip && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Número de Microchip</label>
                          <input type="text" value={editData.microchip}
                            onChange={(e) => setEditData({ ...editData, microchip: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#074738]" />
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setIsEditing(false)}
                          className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 font-bold">
                          Cancelar
                        </button>
                        <button onClick={handleSave} disabled={saving}
                          className="flex-1 py-3 rounded-xl bg-[#074738] text-white font-bold shadow-lg shadow-[#074738]/30 flex items-center justify-center gap-2">
                          {saving
                            ? <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : "Guardar Cambios"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <VaccinationCardModal
            isOpen={showVaccinationCard}
            onClose={() => setShowVaccinationCard(false)}
            petData={{
              name: activePet?.name || "",
              breed: displayBreed,
              birthDate: displayBirth,
              microchip: editData.microchip,
              photo,
            }}
            vaccines={vaccines}
          />
        </>
      )}
    </AnimatePresence>
  );
}
