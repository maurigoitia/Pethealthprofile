import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { usePet } from "../contexts/PetContext";
import { useAuth } from "../contexts/AuthContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../lib/firebase";

export function RegisterPetStep2() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addPet } = usePet();
  const { user, loading: authLoading } = useAuth();

  const step1Data = location.state || {};

  const [formData, setFormData] = useState({
    weight: "",
    sex: "male" as "male" | "female",
    isNeutered: false,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(
    "https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=400&h=400&fit=crop"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!authLoading && !user) {
    return <Navigate to="/welcome" replace />;
  }

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFinish = async () => {
    if (isSubmitting || !user) return;
    setError("");
    setIsSubmitting(true);

    try {
      let photoUrl = "";
      if (photoFile) {
        try {
          const storageRef = ref(storage, `users/${user.uid}/pets/${Date.now()}_${photoFile.name}`);
          const uploadResult = await uploadBytes(storageRef, photoFile);
          photoUrl = await getDownloadURL(uploadResult.ref);
        } catch (storageError: any) {
          console.warn("No se pudo subir la foto, se continúa sin ella:", storageError?.message);
        }
      }

      await addPet({
        name: step1Data.name || "Mascota",
        breed: step1Data.breed || "Desconocida",
        photo: photoUrl,
        species: step1Data.species || "dog",
        age: step1Data.age || "",
        weight: formData.weight,
        sex: formData.sex,
        isNeutered: formData.isNeutered,
      });

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
          "linear-gradient(rgb(43,124,238) 0%, rgb(61,139,255) 50%, rgb(93,163,255) 100%)",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl px-6 pt-8 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-[#2b7cee]">Pessy</h1>
          <p className="text-slate-500 text-sm mt-2">Que su historia no se pierda.</p>
          <h2 className="text-xl font-bold mt-4 text-slate-900">Registrar mascota</h2>
          <p className="text-sm text-slate-500 mt-1">Paso 2 de 2</p>
        </div>

        <div className="space-y-5">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handlePhotoClick}
              className="relative h-28 w-28 rounded-full border-2 border-dashed border-[#2b7cee]/40 bg-[#2b7cee]/10 overflow-hidden"
            >
              <img src={photoPreview} alt="Foto mascota" className="h-full w-full object-cover" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          <input
            type="number"
            step="0.1"
            placeholder="Peso aproximado (kg)"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#2b7cee] outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, sex: "male" })}
              className={`py-3 rounded-2xl border-2 font-bold transition-colors ${
                formData.sex === "male"
                  ? "border-[#2b7cee] bg-[#2b7cee]/5 text-[#2b7cee]"
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
                  ? "border-[#2b7cee] bg-[#2b7cee]/5 text-[#2b7cee]"
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
              className="h-4 w-4 accent-[#2b7cee]"
            />
          </label>

          {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}

          <button
            type="button"
            onClick={handleFinish}
            disabled={isSubmitting || authLoading || !user}
            className="w-full py-4 rounded-2xl bg-[#2b7cee] text-white font-bold disabled:opacity-60"
          >
            {authLoading ? "Verificando sesión..." : isSubmitting ? "Guardando..." : "Finalizar registro"}
          </button>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full py-4 rounded-2xl border-2 border-[#2b7cee] text-[#2b7cee] font-bold hover:bg-[#2b7cee]/5 transition-all"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
