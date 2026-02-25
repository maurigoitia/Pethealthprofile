import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
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
  const [waitingForAuth, setWaitingForAuth] = useState(false);

  // Esperar hasta 5 segundos a que el usuario esté disponible
  useEffect(() => {
    if (!user && !authLoading) {
      setWaitingForAuth(true);
      const timeout = setTimeout(() => setWaitingForAuth(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [user, authLoading]);

  const step1Data = location.state || {};

  const [formData, setFormData] = useState({
    weight: "",
    sex: "male" as "male" | "female",
    isNeutered: false,
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=400&h=400&fit=crop");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFinish = async () => {
    if (isSubmitting) return;

    // Esperar a que el usuario esté disponible (puede tardar si acaba de registrarse)
    if (!user) {
      alert("Tu sesión aún está cargando. Espera un momento e intenta de nuevo.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Subir foto a Storage si el usuario eligió una
      let photoUrl = "";
      if (photoFile && user) {
        try {
          const storageRef = ref(storage, `users/${user.uid}/pets/${Date.now()}_${photoFile.name}`);
          const uploadResult = await uploadBytes(storageRef, photoFile);
          photoUrl = await getDownloadURL(uploadResult.ref);
        } catch (storageError: any) {
          console.warn("No se pudo subir la foto, se continúa sin ella:", storageError?.message);
          // Continúa sin foto — no bloquea el registro
        }
      }

      const petData = {
        name: step1Data.name || "Mascota",
        breed: step1Data.breed || "Desconocida",
        photo: photoUrl,
        species: step1Data.species || "dog",
        age: step1Data.age || "",
        weight: formData.weight,
        sex: formData.sex,
        isNeutered: formData.isNeutered,
      };

      await addPet(petData);
      navigate("/home");
    } catch (error: any) {
      console.error("Error finalizing pet registration:", error);
      const msg = error?.message || String(error);
      alert(`Error al registrar mascota: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen">
      <div className="relative flex h-auto min-h-screen w-full flex-col max-w-md mx-auto overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center p-4 pb-2 justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-900 dark:text-slate-100 flex size-12 shrink-0 items-center justify-start"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
            Registro de Mascota
          </h2>
        </div>

        {/* Progress Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex w-full flex-row items-center justify-center gap-3 py-5"
        >
          <div className="h-2 w-2 rounded-full bg-[#2b7cee]/20"></div>
          <div className="h-2 w-2 rounded-full bg-[#2b7cee]/20"></div>
          <div className="h-2 w-8 rounded-full bg-[#2b7cee]"></div>
        </motion.div>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex p-4"
        >
          <div className="flex w-full flex-col gap-6 items-center">
            <div className="flex gap-4 flex-col items-center">
              <div className="relative group cursor-pointer" onClick={handlePhotoClick}>
                <div
                  className="bg-[#2b7cee]/10 border-2 border-dashed border-[#2b7cee]/40 bg-center bg-no-repeat aspect-square bg-cover rounded-full min-h-32 w-32 flex items-center justify-center overflow-hidden"
                  style={{
                    backgroundImage: `url(${photoPreview})`,
                  }}
                ></div>
                <div className="absolute bottom-0 right-0 bg-[#2b7cee] text-white p-2 rounded-full shadow-lg">
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
              <div className="flex flex-col items-center justify-center">
                <p className="text-slate-900 dark:text-slate-100 text-[22px] font-bold leading-tight tracking-[-0.015em] text-center">
                  ¡Casi listo!
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal text-center max-w-[280px]">
                  Sube una foto de tu mascota y completa los últimos detalles.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Form Fields */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col gap-6 px-4 py-3"
        >
          {/* Weight Input */}
          <label className="flex flex-col w-full">
            <p className="text-slate-900 dark:text-slate-100 text-base font-medium leading-normal pb-2">
              Peso aproximado
            </p>
            <div className="relative">
              <input
                className="form-input flex w-full rounded-xl text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-[#2b7cee] focus:ring-1 focus:ring-[#2b7cee] h-14 placeholder:text-slate-400 p-[15px] text-base font-normal"
                placeholder="Ej. 5.5"
                step="0.1"
                type="number"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">kg</span>
            </div>
          </label>

          {/* Sex Selection */}
          <div className="flex flex-col">
            <p className="text-slate-900 dark:text-slate-100 text-base font-medium leading-normal pb-2">Sexo</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, sex: "male" })}
                className={`flex items-center justify-center gap-2 h-14 rounded-xl border-2 font-bold transition-colors ${formData.sex === "male"
                    ? "border-[#2b7cee] bg-[#2b7cee]/5 text-[#2b7cee]"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
              >
                <span className="material-symbols-outlined">male</span>
                Macho
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, sex: "female" })}
                className={`flex items-center justify-center gap-2 h-14 rounded-xl border-2 font-bold transition-colors ${formData.sex === "female"
                    ? "border-[#2b7cee] bg-[#2b7cee]/5 text-[#2b7cee]"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
              >
                <span className="material-symbols-outlined">female</span>
                Hembra
              </button>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col">
              <p className="text-slate-900 dark:text-slate-100 font-medium">¿Está esterilizado/a?</p>
              <p className="text-sm text-slate-500">Mantenemos el historial al día</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                className="sr-only peer"
                type="checkbox"
                checked={formData.isNeutered}
                onChange={(e) => setFormData({ ...formData, isNeutered: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2b7cee]"></div>
            </label>
          </div>
        </motion.div>

        {/* Spacer */}
        <div className="flex-1 min-h-[40px]"></div>

        {/* Footer Button */}
        <div className="p-4 bg-[#f6f6f8] dark:bg-[#101622] border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleFinish}
            disabled={isSubmitting || authLoading}
            className="w-full bg-[#2b7cee] hover:bg-[#2563d4] text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-[#2b7cee]/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {(isSubmitting || authLoading) ? (
              <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            {authLoading ? "Verificando sesión..." : isSubmitting ? "Guardando..." : "Finalizar Registro"}
          </button>
        </div>
      </div>
    </div>
  );
}