import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CAT_BREEDS, DOG_BREEDS, OTHER_BREEDS } from "../../data/breeds";
import { searchBreeds } from "../../utils/breedSearch";

export function RegisterPetStep1() {
  const navigate = useNavigate();
  const [name, setName] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem("pessy_landing_prefill");
      if (!raw) return "";
      const parsed = JSON.parse(raw) as { petName?: string };
      return parsed.petName?.trim() || "";
    } catch {
      return "";
    }
  });
  const [species, setSpecies] = useState<"dog" | "cat" | "other">("dog");
  const [breedInput, setBreedInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [breedSuggestions, setBreedSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!name.trim() || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("pessy_landing_prefill");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { name?: string; email?: string; petName?: string };
      window.localStorage.setItem(
        "pessy_landing_prefill",
        JSON.stringify({
          ...parsed,
          petName: name.trim(),
        })
      );
    } catch {
      // noop
    }
  }, [name]);

  const getBreedList = () => {
    if (species === "dog") return DOG_BREEDS;
    if (species === "cat") return CAT_BREEDS;
    return OTHER_BREEDS;
  };

  const updateSuggestions = (value: string) => {
    if (value.trim().length === 0) {
      setBreedSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const filtered = searchBreeds(getBreedList(), value, 8);
    setBreedSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  const handleNext = () => {
    navigate("/register-pet/step2", {
      state: {
        name: name.trim(),
        species,
        breed: breedInput.trim(),
        age: "",
      },
    });
  };

  return (
    <div
      className="min-h-screen bg-[#F0FAF9] flex flex-col"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="min-h-screen flex flex-col max-w-md mx-auto bg-[#F0FAF9] overflow-hidden relative w-full">
        {/* Hero compacto — segunda etapa, no necesita full hero */}
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
                Tu mascota
              </h1>
            </div>
            <p className="text-[14px] text-[#6B7280] max-w-[260px] leading-relaxed">
              Contanos quién es. Pessy se encarga del resto.
            </p>
          </div>
        </div>

        <main
          className="flex-1 px-5 pt-2 pb-8"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2">
            <span className="h-2 w-8 rounded-full bg-[#1A9B7D] transition-all" aria-label="Paso 1 activo" />
            <span className="h-2 w-6 rounded-full bg-[#E0F2F1] transition-all" aria-label="Paso 2 pendiente" />
            <span className="ml-1 text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Paso 1 de 2
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
                htmlFor="pet-name"
              >
                Nombre
              </label>
              <input
                id="pet-name"
                type="text"
                placeholder="¿Cómo se llama?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-14 px-4 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
                htmlFor="pet-species"
              >
                Especie
              </label>
              <div className="relative">
                <select
                  id="pet-species"
                  value={species}
                  onChange={(e) => {
                    const nextSpecies = e.target.value as "dog" | "cat" | "other";
                    setSpecies(nextSpecies);
                    // Recalcula sugerencias con la especie nueva si ya escribió algo.
                    if (breedInput.trim().length > 0) {
                      const filtered = searchBreeds(
                        nextSpecies === "dog" ? DOG_BREEDS : nextSpecies === "cat" ? CAT_BREEDS : OTHER_BREEDS,
                        breedInput,
                        8
                      );
                      setBreedSuggestions(filtered);
                      setShowSuggestions(filtered.length > 0);
                    }
                  }}
                  className="w-full h-14 px-4 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none appearance-none text-[15px] text-[#1A1A1A] cursor-pointer transition-all"
                >
                  <option value="dog">Perro</option>
                  <option value="cat">Gato</option>
                  <option value="other">Otro</option>
                </select>
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                  ▾
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
                htmlFor="pet-breed"
              >
                Raza
              </label>
              <div className="relative">
                <input
                  id="pet-breed"
                  type="text"
                  placeholder="Empezá a escribir…"
                  value={breedInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setBreedInput(value);
                    updateSuggestions(value);
                  }}
                  onFocus={() => updateSuggestions(breedInput)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                  className="w-full h-14 px-4 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] transition-all"
                />

                {showSuggestions && (
                  <div className="absolute z-20 left-0 right-0 mt-2 max-h-56 overflow-y-auto rounded-[14px] border border-[#E5E7EB] bg-white shadow-xl">
                    {breedSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onMouseDown={() => {
                          setBreedInput(suggestion);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-3 text-[14px] text-[#1A1A1A] hover:bg-[#F0FAF9] border-b border-[#F0FAF9] last:border-b-0"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!name.trim()}
              className="w-full h-14 bg-[#074738] hover:bg-[#0e5c49] text-white text-[15px] font-bold rounded-[16px] flex items-center justify-center disabled:opacity-50 active:scale-[0.97] transition-transform shadow-[0_4px_14px_rgba(7,71,56,0.18)]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Continuar
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
