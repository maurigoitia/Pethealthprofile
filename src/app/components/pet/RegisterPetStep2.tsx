import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { usePet } from "../../contexts/PetContext";
import { useAuth } from "../../contexts/AuthContext";
import { DEFAULT_PET_PHOTO } from "../../constants/petDefaults";
import { getPetPhotoAcceptValue, preparePetPhotoForUpload } from "../../utils/petPhotoUpload";
import { uploadPetPhotoWithFallback } from "../../services/petPhotoService";

export function RegisterPetStep2() {
  const navigate = useNavigate();
  const location = useLocation();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { addPet, updatePet } = usePet();
  const { user, loading: authLoading } = useAuth();

  const step1Data = location.state || {};
  const hasStep1Data = Boolean(step1Data?.name?.trim() && step1Data?.species);

  const [formData, setFormData] = useState({
    weight: "",
    sex: "male" as "male" | "female",
    isNeutered: false,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(DEFAULT_PET_PHOTO);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [photoNotice, setPhotoNotice] = useState("");

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasStep1Data) {
    return <Navigate to="/register-pet" replace />;
  }

  const handlePhotoClick = () => {
    galleryInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setIsPreparingPhoto(true);
    try {
      const normalizedFile = await preparePetPhotoForUpload(file);
      setPhotoFile(normalizedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(normalizedFile);
    } catch (prepareError: any) {
      setError(prepareError?.message || "No se pudo procesar la foto seleccionada.");
    } finally {
      setIsPreparingPhoto(false);
      e.currentTarget.value = "";
    }
  };

  const handleFinish = async () => {
    if (isSubmitting || !user) return;
    setError("");
    setIsSubmitting(true);

    try {
      const petId = await addPet({
        name: step1Data.name.trim(),
        breed: step1Data.breed?.trim() || "No especificada",
        photo: DEFAULT_PET_PHOTO,
        species: step1Data.species || "dog",
        age: step1Data.age || "",
        weight: formData.weight,
        sex: formData.sex,
        isNeutered: formData.isNeutered,
      });

      let photoUploadFailed = false;
      if (photoFile) {
        try {
          const normalizedForCallable = await preparePetPhotoForUpload(photoFile);
          const uploaded = await uploadPetPhotoWithFallback({
            petId,
            file: normalizedForCallable,
          });
          if (uploaded?.ok && uploaded.url) {
            await updatePet(petId, { photo: uploaded.url });
          } else {
            // NO pisar photo con "" — si ya había una URL (re-registro improbable pero posible),
            // se preserva. Solo marcamos el flag para avisar al user.
            photoUploadFailed = true;
          }
        } catch (uploadError: any) {
          console.error("Upload de foto en alta de mascota falló:", uploadError);
          // NO pisar photo con "" — el bug 8a33c6d hizo perder URLs reales cuando CSP blob:
          // bloqueaba uploads. Preservar valor previo.
          photoUploadFailed = true;
        }
      }

      if (photoUploadFailed) {
        // Antes: auto-navegaba en 2.5s perdiendo la noticia. Ahora espera acción
        // del usuario: "Reintentar" queda acá mismo, "Saltar" navega.
        setPhotoNotice(
          "No pudimos subir la foto. Podés reintentar o seguir y agregarla después."
        );
      } else {
        navigate("/home");
      }
    } catch (err: any) {
      console.error("Error finalizing pet registration:", err);
      setError(err?.message || "No se pudo finalizar el registro.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F0FAF9] flex flex-col"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="min-h-screen flex flex-col max-w-md mx-auto bg-[#F0FAF9] overflow-hidden relative w-full">
        {/* Hero compacto */}
        <div className="h-48 relative overflow-hidden flex items-end px-5 pb-5">
          <div className="absolute inset-0 z-0">
            <img
              src="/illustrations/dark_top_surprised_cork_head.svg"
              alt=""
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#F0FAF9] via-[#F0FAF9]/40 to-transparent" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <img src="/pessy-logo.svg" alt="" className="w-8 h-8" />
              <h1
                className="text-[26px] font-extrabold text-[#074738] tracking-tight leading-none"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Ya casi
              </h1>
            </div>
            <p className="text-[14px] text-[#6B7280] max-w-[260px] leading-relaxed">
              Foto y datos base. Pessy organiza el resto.
            </p>
          </div>
        </div>

        <main
          className="flex-1 px-5 pt-2 pb-8"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2">
            <span className="h-2 w-6 rounded-full bg-[#1A9B7D]/50 transition-all" aria-label="Paso 1 completo" />
            <span className="h-2 w-8 rounded-full bg-[#1A9B7D] transition-all" aria-label="Paso 2 activo" />
            <span className="ml-1 text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Paso 2 de 2
            </span>
          </div>

          <div className="space-y-5">
            {/* Foto */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handlePhotoClick}
                className="relative h-28 w-28 rounded-full border-2 border-dashed border-[#1A9B7D]/40 bg-[#E0F2F1] overflow-hidden active:scale-[0.97] transition-transform"
                aria-label="Subir foto de la mascota"
              >
                <img src={photoPreview} alt="Foto mascota" className="h-full w-full object-cover" />
              </button>
              <input
                ref={galleryInputRef}
                type="file"
                accept={getPetPhotoAcceptValue()}
                className="hidden"
                onChange={handlePhotoChange}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept={getPetPhotoAcceptValue()}
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="h-12 bg-white border border-[#E5E7EB] rounded-[14px] text-[13px] font-semibold text-[#1A1A1A] active:scale-[0.97] transition-transform"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Tomar foto
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="h-12 bg-white border border-[#E5E7EB] rounded-[14px] text-[13px] font-semibold text-[#1A1A1A] active:scale-[0.97] transition-transform"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Elegir foto
              </button>
            </div>

            {/* Peso */}
            <div className="space-y-1.5">
              <label
                className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
                htmlFor="pet-weight"
              >
                Peso aproximado (kg)
              </label>
              <input
                id="pet-weight"
                type="number"
                step="0.1"
                min="0.1"
                max="200"
                placeholder="Ej. 8.5"
                value={formData.weight}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || (Number(val) >= 0 && Number(val) <= 200)) {
                    setFormData({ ...formData, weight: val });
                  }
                }}
                className="w-full h-14 px-4 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] transition-all"
              />
            </div>

            {/* Sexo */}
            <div className="space-y-1.5">
              <p className="text-[12px] font-semibold text-[#6B7280] ml-1 uppercase tracking-wide">
                Sexo
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sex: "male" })}
                  className={`h-14 rounded-[14px] border-2 text-[14px] font-bold transition-colors ${
                    formData.sex === "male"
                      ? "border-[#1A9B7D] bg-[#E0F2F1] text-[#074738]"
                      : "border-[#E5E7EB] bg-white text-[#6B7280]"
                  }`}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Macho
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sex: "female" })}
                  className={`h-14 rounded-[14px] border-2 text-[14px] font-bold transition-colors ${
                    formData.sex === "female"
                      ? "border-[#1A9B7D] bg-[#E0F2F1] text-[#074738]"
                      : "border-[#E5E7EB] bg-white text-[#6B7280]"
                  }`}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Hembra
                </button>
              </div>
            </div>

            {/* Esterilizado */}
            <label className="flex items-center justify-between rounded-[14px] bg-white border border-[#E5E7EB] px-4 py-4 cursor-pointer">
              <span className="text-[14px] font-medium text-[#1A1A1A]">¿Está esterilizado/a?</span>
              <input
                type="checkbox"
                checked={formData.isNeutered}
                onChange={(e) => setFormData({ ...formData, isNeutered: e.target.checked })}
                className="h-5 w-5 accent-[#1A9B7D]"
              />
            </label>

            {/* Photo retry/skip notice — preservado intacto del commit 558c685 */}
            {photoNotice && (
              <div className="rounded-[14px] bg-amber-50 border border-amber-200 px-4 py-3 space-y-2">
                <p className="text-amber-800 text-sm font-semibold text-center">
                  {photoNotice}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setPhotoNotice(""); handleFinish(); }}
                    className="min-h-[44px] rounded-[10px] bg-amber-500 text-white text-xs font-bold active:scale-[0.97] transition-transform"
                  >
                    Reintentar
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/home")}
                    className="min-h-[44px] rounded-[10px] border border-amber-300 text-amber-800 text-xs font-bold active:scale-[0.97] transition-transform"
                  >
                    Seguir sin foto
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-[12px] border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-center text-sm font-semibold text-[#EF4444]">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleFinish}
              disabled={isSubmitting || isPreparingPhoto || authLoading || !user}
              className="w-full h-14 bg-[#074738] hover:bg-[#0e5c49] text-white text-[15px] font-bold rounded-[16px] flex items-center justify-center disabled:opacity-50 active:scale-[0.97] transition-transform shadow-[0_4px_14px_rgba(7,71,56,0.18)]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {authLoading
                ? "Verificando sesión..."
                : isPreparingPhoto
                  ? "Procesando foto..."
                  : isSubmitting
                    ? "Guardando..."
                    : "Finalizar"}
            </button>
          </div>

          <footer className="pt-6 flex justify-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-[13px] font-semibold text-[#6B7280] hover:text-[#074738] transition-colors"
            >
              ← Volver
            </button>
          </footer>
        </main>

        <div className="absolute bottom-10 -right-10 w-40 h-40 bg-[#1A9B7D]/8 rounded-full blur-3xl -z-10" />
        <div className="absolute top-20 -left-10 w-40 h-40 bg-[#074738]/8 rounded-full blur-3xl -z-10" />
      </div>
    </div>
  );
}
