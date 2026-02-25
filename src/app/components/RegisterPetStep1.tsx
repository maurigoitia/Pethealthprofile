import { useState } from "react";
import { useNavigate } from "react-router";
import { CAT_BREEDS, DOG_BREEDS, OTHER_BREEDS } from "../data/breeds";

export function RegisterPetStep1() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<"dog" | "cat" | "other">("dog");
  const [breedInput, setBreedInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [breedSuggestions, setBreedSuggestions] = useState<string[]>([]);

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
    const filtered = getBreedList()
      .filter((breed) => breed.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 8);
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
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        backgroundImage: "linear-gradient(rgb(43,124,238) 0%, rgb(61,139,255) 50%, rgb(93,163,255) 100%)",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl px-6 pt-8 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-[#2b7cee]">
            Pessy
          </h1>
          <p className="text-slate-500 text-sm mt-2">Que su historia no se pierda.</p>
          <h2 className="text-xl font-bold mt-4 text-slate-900">
            Registrar mascota
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Paso 1 de 2
          </p>
        </div>

        <div className="space-y-5">
          <input
            type="text"
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#2b7cee] outline-none"
          />

          <select
            value={species}
            onChange={(e) => {
              const nextSpecies = e.target.value as "dog" | "cat" | "other";
              setSpecies(nextSpecies);
              // Recalcula sugerencias con la especie nueva si ya escribió algo.
              if (breedInput.trim().length > 0) {
                const filtered = (nextSpecies === "dog" ? DOG_BREEDS : nextSpecies === "cat" ? CAT_BREEDS : OTHER_BREEDS)
                  .filter((breed) => breed.toLowerCase().includes(breedInput.toLowerCase()))
                  .slice(0, 8);
                setBreedSuggestions(filtered);
                setShowSuggestions(filtered.length > 0);
              }
            }}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#2b7cee] outline-none bg-white"
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
              className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#2b7cee] outline-none"
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
            className="w-full py-4 rounded-2xl bg-[#2b7cee] text-white font-bold disabled:opacity-60"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
