import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { DOG_BREEDS, CAT_BREEDS, OTHER_BREEDS } from "../data/breeds";

export function RegisterPetStep1() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    species: "dog" as "dog" | "cat" | "other",
    breed: "",
    age: "",
  });
  const [breedInput, setBreedInput] = useState("");
  const [breedSuggestions, setBreedSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const getBreedList = () => {
    if (formData.species === "dog") return DOG_BREEDS;
    if (formData.species === "cat") return CAT_BREEDS;
    return OTHER_BREEDS;
  };

  const handleBreedInput = (value: string) => {
    setBreedInput(value);
    setFormData({ ...formData, breed: value });
    if (value.length >= 1) {
      const filtered = getBreedList().filter((b) =>
        b.toLowerCase().includes(value.toLowerCase())
      );
      setBreedSuggestions(filtered.slice(0, 6));
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleBreedSelect = (breed: string) => {
    setBreedInput(breed);
    setFormData({ ...formData, breed });
    setShowSuggestions(false);
  };

  const handleNext = () => {
    navigate("/register-pet/step2", { state: formData });
  };

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen">
      <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto">
        {/* TopAppBar */}
        <div className="flex items-center p-4 pb-2 justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-900 dark:text-slate-100 flex size-12 shrink-0 items-center cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
              arrow_back
            </span>
          </button>
          <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            Registrar Mascota
          </h2>
          <div className="size-12"></div> {/* Spacer to center title */}
        </div>

        {/* Progress Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex w-full flex-col items-center justify-center gap-2 py-5"
        >
          <div className="flex flex-row gap-3">
            <div className="h-2 w-12 rounded-full bg-[#2b7cee]"></div>
            <div className="h-2 w-12 rounded-full bg-[#2b7cee]/20 dark:bg-[#2b7cee]/10"></div>
          </div>
          <p className="text-xs font-semibold text-[#2b7cee] mt-1 uppercase tracking-wider">Paso 1 de 2</p>
        </motion.div>

        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="px-6 py-4"
        >
          <h3 className="text-slate-900 dark:text-slate-100 tracking-tight text-2xl font-bold leading-tight">
            Cuéntanos sobre tu mascota
          </h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Necesitamos algunos detalles básicos para empezar.
          </p>
        </motion.div>

        {/* Form Fields */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col gap-6 px-6 py-4 max-w-md mx-auto w-full"
        >
          {/* Pet Name */}
          <label className="flex flex-col w-full">
            <p className="text-slate-800 dark:text-slate-200 text-sm font-semibold pb-2">Nombre de la Mascota</p>
            <input
              className="form-input flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-[#2b7cee]/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-14 placeholder:text-slate-400 p-[15px] text-base font-normal transition-all"
              placeholder="Ej. Max, Luna..."
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </label>

          {/* Species Selection */}
          <div className="flex flex-col w-full">
            <p className="text-slate-800 dark:text-slate-200 text-sm font-semibold pb-3">Especie</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "dog", label: "Perro", icon: "pets" },
                { key: "cat", label: "Gato", icon: "cruelty_free" },
                { key: "other", label: "Otro", icon: "more_horiz" },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, species: key as any, breed: "" });
                    setBreedInput("");
                    setShowSuggestions(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                    formData.species === key
                      ? "border-[#2b7cee] bg-[#2b7cee]/5 text-[#2b7cee]"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>{icon}</span>
                  <span className="font-bold text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Breed Autocomplete */}
          <div className="flex flex-col w-full">
            <p className="text-slate-800 dark:text-slate-200 text-sm font-semibold pb-2">Raza</p>
            <div className="relative">
              <input
                className="form-input flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-[#2b7cee]/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-14 placeholder:text-slate-400 p-[15px] text-base font-normal transition-all"
                placeholder="Escribí para buscar la raza..."
                type="text"
                value={breedInput}
                onChange={(e) => handleBreedInput(e.target.value)}
                onFocus={() => breedInput.length >= 1 && setShowSuggestions(true)}
                autoComplete="off"
              />
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                  {breedSuggestions.map((breed) => (
                    <button
                      key={breed}
                      type="button"
                      onMouseDown={() => handleBreedSelect(breed)}
                      className="w-full text-left px-4 py-3 text-sm text-slate-900 dark:text-white hover:bg-[#2b7cee]/10 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                    >
                      {breed}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Age Input */}
          <label className="flex flex-col w-full">
            <p className="text-slate-800 dark:text-slate-200 text-sm font-semibold pb-2">Edad (Años)</p>
            <div className="flex items-center gap-4">
              <input
                className="form-input flex flex-1 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-[#2b7cee]/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-14 placeholder:text-slate-400 p-[15px] text-base font-normal"
                min="0"
                placeholder="0"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              />
              <div className="flex h-14 items-center justify-center px-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400 font-medium">años</span>
              </div>
            </div>
          </label>
        </motion.div>

        {/* Sticky Bottom Action Button */}
        <div className="mt-auto p-6 flex flex-col gap-3">
          <button
            onClick={handleNext}
            className="flex w-full items-center justify-center h-14 bg-[#2b7cee] text-white font-bold text-lg rounded-xl shadow-lg shadow-[#2b7cee]/20 active:scale-[0.98] transition-transform hover:bg-[#2563d4]"
          >
            Siguiente
            <span className="material-symbols-outlined ml-2">arrow_forward</span>
          </button>
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Podrás editar estos datos más adelante
          </p>
        </div>
      </div>
    </div>
  );
}
