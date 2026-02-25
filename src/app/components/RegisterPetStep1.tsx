import { useState } from "react";
import { useNavigate } from "react-router";

export function RegisterPetStep1() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("dog");
  const [breed, setBreed] = useState("");

  const handleNext = () => {
    navigate("/register-pet/step2", {
      state: {
        name: name.trim(),
        species,
        breed: breed.trim(),
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
            onChange={(e) => setSpecies(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#2b7cee] outline-none bg-white"
          >
            <option value="dog">Perro</option>
            <option value="cat">Gato</option>
            <option value="other">Otro</option>
          </select>

          <input
            type="text"
            placeholder="Raza (opcional)"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#2b7cee] outline-none"
          />

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
