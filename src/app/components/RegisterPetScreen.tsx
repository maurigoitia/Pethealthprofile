import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { ImageWithFallback } from "./figma/ImageWithFallback";

type Step = 1 | 2;

interface PetData {
  name: string;
  species: string;
  breed: string;
  birthDate: string;
  weight: string;
  gender: "male" | "female" | "";
  photo: string | null;
}

export function RegisterPetScreen() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [petData, setPetData] = useState<PetData>({
    name: "",
    species: "dog",
    breed: "",
    birthDate: "",
    weight: "",
    gender: "",
    photo: null,
  });

  const updatePetData = (field: keyof PetData, value: string) => {
    setPetData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep((prev) => (prev + 1) as Step);
    } else {
      // Completar registro
      navigate("/home");
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const progressPercentage = (currentStep / 2) * 100;

  return (
    <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#101622] flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">
        {/* Header */}
        <div className="pt-6 pb-4 px-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="size-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center disabled:opacity-40"
            >
              <MaterialIcon name="arrow_back" className="text-xl" />
            </button>
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
              Paso {currentStep} de 2
            </span>
            <button
              onClick={() => navigate("/home")}
              className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Omitir
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#2b6fee] rounded-full"
              initial={{ width: "50%" }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="flex-1 px-6 pb-6"
        >
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                  Información básica
                </h2>
                <p className="text-slate-500 dark:text-slate-400">
                  Cuéntanos sobre tu mascota
                </p>
              </div>

              {/* Photo Upload */}
              <div className="flex flex-col items-center py-6">
                <div className="relative">
                  <div className="size-32 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-900 shadow-lg overflow-hidden flex items-center justify-center">
                    {petData.photo ? (
                      <ImageWithFallback
                        src={petData.photo}
                        alt="Pet photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <MaterialIcon
                        name="ecg_heart"
                        className="text-5xl text-slate-400"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    className="absolute bottom-0 right-0 size-10 rounded-full bg-[#2b6fee] text-white flex items-center justify-center shadow-lg"
                  >
                    <MaterialIcon name="photo_camera" className="text-xl" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Añade una foto de tu mascota
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={petData.name}
                  onChange={(e) => updatePetData("name", e.target.value)}
                  placeholder="Ej: Max, Luna, Rocky..."
                  className="w-full px-4 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2b6fee] focus:border-transparent"
                />
              </div>

              {/* Species */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  Especie
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updatePetData("species", "dog")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      petData.species === "dog"
                        ? "border-[#2b6fee] bg-[#2b6fee]/5"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <MaterialIcon name="ecg_heart" className="text-3xl mb-2" />
                    <p className="font-bold text-sm">Perro</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePetData("species", "cat")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      petData.species === "cat"
                        ? "border-[#2b6fee] bg-[#2b6fee]/5"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <span className="text-3xl mb-2 block">🐱</span>
                    <p className="font-bold text-sm">Gato</p>
                  </button>
                </div>
              </div>

              {/* Breed */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Raza
                </label>
                <input
                  type="text"
                  value={petData.breed}
                  onChange={(e) => updatePetData("breed", e.target.value)}
                  placeholder="Ej: Golden Retriever, Persa..."
                  className="w-full px-4 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2b6fee] focus:border-transparent"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                  Detalles físicos
                </h2>
                <p className="text-slate-500 dark:text-slate-400">
                  Información sobre su edad y tamaño
                </p>
              </div>

              {/* Birth Date */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Fecha de nacimiento
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <MaterialIcon name="calendar_today" className="text-xl" />
                  </div>
                  <input
                    type="date"
                    value={petData.birthDate}
                    onChange={(e) => updatePetData("birthDate", e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2b6fee] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Peso (kg)
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <MaterialIcon name="scale" className="text-xl" />
                  </div>
                  <input
                    type="number"
                    value={petData.weight}
                    onChange={(e) => updatePetData("weight", e.target.value)}
                    placeholder="15"
                    step="0.1"
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2b6fee] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                  Sexo
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updatePetData("gender", "male")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      petData.gender === "male"
                        ? "border-[#2b6fee] bg-[#2b6fee]/5"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <MaterialIcon name="male" className="text-3xl mb-2" />
                    <p className="font-bold text-sm">Macho</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePetData("gender", "female")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      petData.gender === "female"
                        ? "border-[#2b6fee] bg-[#2b6fee]/5"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <MaterialIcon name="female" className="text-3xl mb-2" />
                    <p className="font-bold text-sm">Hembra</p>
                  </button>
                </div>
              </div>

              {/* Success Preview */}
              <div className="bg-gradient-to-br from-[#2b6fee]/10 to-purple-100/50 dark:from-[#2b6fee]/20 dark:to-purple-950/30 rounded-2xl p-6 text-center border border-[#2b6fee]/20">
                <div className="size-16 bg-[#2b6fee] rounded-full flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-[#2b6fee]/30">
                  <MaterialIcon name="check" className="text-4xl" />
                </div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white mb-2">
                  ¡Todo listo!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Estás a punto de comenzar a cuidar mejor la salud de{" "}
                  {petData.name || "tu mascota"}
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Footer Button */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <button
            onClick={handleNext}
            className="w-full py-4 rounded-xl bg-[#2b6fee] text-white font-bold text-base shadow-lg shadow-[#2b6fee]/30 hover:bg-[#2b6fee]/90 active:scale-[0.98] transition-all"
          >
            {currentStep === 2 ? "Completar registro" : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}