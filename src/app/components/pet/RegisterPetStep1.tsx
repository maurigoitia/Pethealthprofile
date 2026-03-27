import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CAT_BREEDS, DOG_BREEDS, OTHER_BREEDS } from "../../data/breeds";
import { searchBreeds } from "../../utils/breedSearch";
import { AuthPageShell } from "../auth/AuthPageShell";

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
    <AuthPageShell
      eyebrow="Registro"
      title="Porque quererlo ya es suficiente trabajo."
      description="Contanos quien es. Pessy se encarga del resto."
      highlights={["Perfil digital", "Documentos", "Carnet"]}
    >
      <div className="mb-6">
        <h2
          className="text-3xl font-extrabold tracking-tight text-[#002f24]"
          style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
        >
          Registrar mascota
        </h2>
        <p className="mt-2 text-sm font-medium text-[#5e716b]">Paso 1 de 2</p>
      </div>

      <div className="space-y-5">
          <input
            type="text"
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
          />

          <select
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
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none bg-white"
          >
            <option value="dog">Perro</option>
            <option value="cat">Gato</option>
            <option value="other">Otro</option>
          </select>

          <div className="relative">
            <input
              type="text"
              placeholder="Raza (autocompletar)"
              value={breedInput}
              onChange={(e) => {
                const value = e.target.value;
                setBreedInput(value);
                updateSuggestions(value);
              }}
              onFocus={() => updateSuggestions(breedInput)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
            />

            {showSuggestions && (
              <div className="absolute z-20 left-0 right-0 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                {breedSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onMouseDown={() => {
                      setBreedInput(suggestion);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleNext}
            disabled={!name.trim()}
            className="w-full rounded-full bg-[#074738] py-4 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60"
          >
            Continuar
          </button>
      </div>
    </AuthPageShell>
  );
}
