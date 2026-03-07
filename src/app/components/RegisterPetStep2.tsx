import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { usePet } from "../contexts/PetContext";
import { useAuth } from "../contexts/AuthContext";
import { DEFAULT_PET_PHOTO } from "../constants/petDefaults";
import { getPetPhotoAcceptValue, preparePetPhotoForUpload } from "../utils/petPhotoUpload";
import { uploadPetPhotoWithFallback } from "../services/petPhotoService";

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

      if (photoFile) {
        try {
          const normalizedForCallable = await preparePetPhotoForUpload(photoFile);
          const uploaded = await uploadPetPhotoWithFallback({
            petId,
            file: normalizedForCallable,
          });
          if (uploaded?.ok && uploaded.url) {
            await updatePet(petId, { photo: uploaded.url });
          }
        } catch (uploadError: any) {
          setError(uploadError?.message || "Mascota creada, pero no pudimos subir la foto. Podés hacerlo desde el perfil.");
          console.error("Upload de foto en alta de mascota falló:", uploadError);
        }
      }

      navigate("/home");
    } catch (err: any) {
      console.error("Error finalizing pet registration:", err);
      setError(err?.message || "No se pudo finalizar el registro.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        backgroundImage:
          "linear-gradient(180deg, #074738 0%, #0e6a5a 50%, #1a9b7d 100%)",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl px-6 pt-8 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-[#074738]">Pessy</h1>
          <p className="text-slate-500 text-sm mt-2">Que su historia no se pierda.</p>
          <h2 className="text-xl font-bold mt-4 text-slate-900">Registrar mascota</h2>
          <p className="text-sm text-slate-500 mt-1">Paso 2 de 2</p>
        </div>

        <div className="space-y-5">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handlePhotoClick}
              className="relative h-28 w-28 rounded-full border-2 border-dashed border-[#074738]/40 bg-[#074738]/10 overflow-hidden"
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
              className="py-3 rounded-2xl border-2 border-[#074738] text-[#074738] font-bold hover:bg-[#074738]/5 transition-all"
            >
              Tomar foto
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="py-3 rounded-2xl border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all"
            >
              Elegir foto
            </button>
          </div>

          <input
            type="number"
            step="0.1"
            placeholder="Peso aproximado (kg)"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, sex: "male" })}
              className={`py-3 rounded-2xl border-2 font-bold transition-colors ${
                formData.sex === "male"
                  ? "border-[#074738] bg-[#074738]/5 text-[#074738]"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              Macho
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, sex: "female" })}
              className={`py-3 rounded-2xl border-2 font-bold transition-colors ${
                formData.sex === "female"
                  ? "border-[#074738] bg-[#074738]/5 text-[#074738]"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              Hembra
            </button>
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
            <span className="text-slate-700 font-medium">¿Está esterilizado/a?</span>
            <input
              type="checkbox"
              checked={formData.isNeutered}
              onChange={(e) => setFormData({ ...formData, isNeutered: e.target.checked })}
              className="h-4 w-4 accent-[#074738]"
            />
          </label>

          {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}

          <button
            type="button"
            onClick={handleFinish}
            disabled={isSubmitting || isPreparingPhoto || authLoading || !user}
            className="w-full py-4 rounded-2xl bg-[#074738] text-white font-bold disabled:opacity-60"
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
            className="w-full py-4 rounded-2xl border-2 border-[#074738] text-[#074738] font-bold hover:bg-[#074738]/5 transition-all"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
