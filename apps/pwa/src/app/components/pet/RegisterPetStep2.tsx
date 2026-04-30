import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { usePet } from "../../contexts/PetContext";
import { useAuth } from "../../contexts/AuthContext";
import { DEFAULT_PET_PHOTO } from "../../constants/petDefaults";
import { getPetPhotoAcceptValue, preparePetPhotoForUpload } from "../../utils/petPhotoUpload";
import { uploadPetPhotoWithFallback } from "../../services/petPhotoService";
import { AuthPageShell } from "../auth/AuthPageShell";

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
            await updatePet(petId, { photo: "" });
            photoUploadFailed = true;
          }
        } catch (uploadError: any) {
          console.error("Upload de foto en alta de mascota falló:", uploadError);
          await updatePet(petId, { photo: "" });
          photoUploadFailed = true;
        }
      }

      if (photoUploadFailed) {
        setPhotoNotice("Tu mascota fue creada. Podés agregar la foto desde tu perfil.");
        // Give the user a moment to read the notice, then navigate
        setTimeout(() => navigate("/home"), 2500);
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
    <AuthPageShell
      eyebrow="Registro"
      title="Ya casi. Pessy empieza a conocerlo."
      description="Con esto, Pessy organiza sus documentos, recordatorios y cuidados solo. Vos solo disfrutás."
      highlights={["Foto", "Datos base", "Primer perfil"]}
    >
      <div className="mb-6">
        <h2
          className="text-3xl font-extrabold tracking-tight text-[#074738]"
          style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
        >
          Registrar mascota
        </h2>
        <p className="mt-2 text-sm font-medium text-[#9CA3AF]">Paso 2 de 2</p>
      </div>

      <div className="space-y-5">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handlePhotoClick}
              className="relative h-28 w-28 rounded-full border-2 border-dashed border-[#1A9B7D]/40 bg-[#E0F2F1] overflow-hidden"
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
              className="rounded-[14px] border border-[#1A9B7D] py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#1A9B7D] transition-all hover:bg-[#E0F2F1]"
            >
              Tomar foto
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="rounded-[14px] border border-[#E0F2F1] py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#9CA3AF] transition-all hover:bg-[#F0FAF9]"
            >
              Elegir foto
            </button>
          </div>

          <input
            type="number"
            step="0.1"
            min="0.1"
            max="200"
            placeholder="Peso aproximado (kg)"
            value={formData.weight}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || (Number(val) >= 0 && Number(val) <= 200)) {
                setFormData({ ...formData, weight: val });
              }
            }}
            className="w-full px-4 py-4 rounded-[12px] border border-slate-200 focus:ring-2 focus:ring-[#1A9B7D] outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, sex: "male" })}
              className={`py-3 rounded-[12px] border-2 font-bold transition-colors ${
                formData.sex === "male"
                  ? "border-[#1A9B7D] bg-[#E0F2F1] text-[#1A9B7D]"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              Macho
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, sex: "female" })}
              className={`py-3 rounded-[12px] border-2 font-bold transition-colors ${
                formData.sex === "female"
                  ? "border-[#1A9B7D] bg-[#E0F2F1] text-[#1A9B7D]"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              Hembra
            </button>
          </div>

          <label className="flex items-center justify-between rounded-[12px] border border-slate-200 px-4 py-3">
            <span className="text-slate-700 font-medium">¿Está esterilizado/a?</span>
            <input
              type="checkbox"
              checked={formData.isNeutered}
              onChange={(e) => setFormData({ ...formData, isNeutered: e.target.checked })}
              className="h-4 w-4 accent-[#1A9B7D]"
            />
          </label>

          {photoNotice && (
            <p className="text-[#1A9B7D] text-sm font-semibold text-center bg-[#E0F2F1] rounded-[10px] px-4 py-3">
              {photoNotice}
            </p>
          )}
          {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}

          <button
            type="button"
            onClick={handleFinish}
            disabled={isSubmitting || isPreparingPhoto || authLoading || !user}
            className="w-full rounded-[14px] bg-[#1A9B7D] py-4 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60"
          >
            {authLoading
              ? "Verificando sesión..."
              : isPreparingPhoto
                ? "Procesando foto..."
                : isSubmitting
                  ? "Guardando..."
                  : "Finalizar registro"}
          </button>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full rounded-[14px] border border-[#E0F2F1] py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#074738] transition-all hover:bg-[#F0FAF9]"
          >
            Volver
          </button>
      </div>
    </AuthPageShell>
  );
}
