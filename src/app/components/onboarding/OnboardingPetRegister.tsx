import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Upload } from "lucide-react";
import { CAT_BREEDS, DOG_BREEDS, OTHER_BREEDS } from "../../data/breeds";
import { searchBreeds } from "../../utils/breedSearch";
import { preparePetPhotoForUpload } from "../../utils/petPhotoUpload";

export interface PetRegisterData {
  name: string;
  species: "dog" | "cat" | "other";
  breed?: string;
  photoFile?: File;
  birthdate?: string;
  sex?: "male" | "female";
  isNeutered?: boolean;
}

interface OnboardingPetRegisterProps {
  onComplete: (petData: PetRegisterData) => void;
  onSkip?: () => void;
}

type Step = "name" | "species" | "photo-breed" | "birthdate" | "sex" | "complete";

const STEPS: Step[] = ["name", "species", "photo-breed", "birthdate", "sex", "complete"];

export function OnboardingPetRegister({ onComplete, onSkip }: OnboardingPetRegisterProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = STEPS[currentStepIndex];
  const [formData, setFormData] = useState<PetRegisterData>({
    name: "",
    species: "dog",
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [breedInput, setBreedInput] = useState("");
  const [breedSuggestions, setBreedSuggestions] = useState<string[]>([]);
  const [showBreedSuggestions, setShowBreedSuggestions] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const getBreedList = () => {
    if (formData.species === "dog") return DOG_BREEDS;
    if (formData.species === "cat") return CAT_BREEDS;
    return OTHER_BREEDS;
  };

  const updateBreedSuggestions = (value: string) => {
    if (value.trim().length === 0) {
      setBreedSuggestions([]);
      setShowBreedSuggestions(false);
      return;
    }
    const filtered = searchBreeds(getBreedList(), value, 8);
    setBreedSuggestions(filtered);
    setShowBreedSuggestions(filtered.length > 0);
  };

  const handlePhotoSelect = async (file: File) => {
    if (!file) return;
    setIsProcessingPhoto(true);
    try {
      const normalizedFile = await preparePetPhotoForUpload(file);
      setPhotoFile(normalizedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(normalizedFile);
    } catch (error) {
      console.error("Error processing photo:", error);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoSelect(file);
    }
    e.currentTarget.value = "";
  };

  const goToNextStep = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleComplete = () => {
    const finalData: PetRegisterData = {
      ...formData,
      breed: breedInput.trim() || undefined,
      photoFile: photoFile || undefined,
    };
    onComplete(finalData);
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-[#F0FAF9]"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Top bar with back and close */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        {currentStepIndex > 0 ? (
          <button
            onClick={goToPreviousStep}
            className="flex items-center gap-1 text-[#074738] font-bold text-sm hover:opacity-70 transition-opacity"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
            Atrás
          </button>
        ) : (
          <div />
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStepIndex
                  ? "w-8 bg-[#1A9B7D]"
                  : i < currentStepIndex
                    ? "w-3 bg-[#1A9B7D]"
                    : "w-3 bg-[#E5E7EB]"
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleSkip}
          className="text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors"
        >
          Saltar
        </button>
      </div>

      {/* Main content area with fade animation */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 animate-fadeIn">
        {currentStep === "name" && (
          <div className="w-full max-w-sm text-center">
            <p className="text-sm font-semibold text-[#1A9B7D] mb-4">Vamos a conocer a tu mascota</p>
            <h2
              className="text-3xl font-black text-[#074738] tracking-tight mb-6"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              ¿Cómo se llama?
            </h2>
            <input
              type="text"
              placeholder="Nombre de tu mascota"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoFocus
              className="w-full px-4 py-4 rounded-[12px] border border-[#1A9B7D]/20 focus:ring-2 focus:ring-[#1A9B7D] outline-none text-center text-lg font-semibold mb-8"
            />
            <button
              onClick={goToNextStep}
              disabled={!formData.name.trim()}
              className="w-full py-4 rounded-[14px] bg-[#1A9B7D] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-[#0a6b54] transition-colors"
            >
              Siguiente <ArrowRight size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {currentStep === "species" && (
          <div className="w-full max-w-sm text-center">
            <h2
              className="text-2xl font-black text-[#074738] tracking-tight mb-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Hola, {formData.name} 👋
            </h2>
            <p className="text-sm font-semibold text-[#1A9B7D] mb-8">¿Es perro o gato?</p>
            <div className="space-y-3">
              {[
                { value: "dog" as const, label: "🐶 Perro" },
                { value: "cat" as const, label: "🐱 Gato" },
                { value: "other" as const, label: "🐾 Otro" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setFormData({ ...formData, species: option.value });
                    setBreedInput("");
                    setBreedSuggestions([]);
                    setShowBreedSuggestions(false);
                    setTimeout(goToNextStep, 200);
                  }}
                  className={`w-full py-4 rounded-[14px] font-bold text-lg transition-all ${
                    formData.species === option.value
                      ? "bg-[#1A9B7D] text-white border-2 border-[#1A9B7D]"
                      : "bg-white text-[#074738] border-2 border-[#1A9B7D] hover:bg-[#E0F2F1]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === "photo-breed" && (
          <div className="w-full max-w-sm text-center">
            <h2
              className="text-2xl font-black text-[#074738] tracking-tight mb-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Cuéntame más sobre {formData.name}
            </h2>
            <p className="text-sm font-semibold text-[#1A9B7D] mb-6">Subí una foto de {formData.name}</p>

            {/* Photo upload */}
            <div className="flex flex-col items-center gap-4 mb-6">
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Photo preview"
                    className="w-32 h-32 rounded-full object-cover border-4 border-[#1A9B7D]"
                  />
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 bg-[#1A9B7D] text-white p-2 rounded-full shadow-lg hover:bg-[#0a6b54] transition-colors"
                  >
                    <Upload size={16} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-32 h-32 rounded-full border-2 border-dashed border-[#1A9B7D]/40 bg-[#E0F2F1] flex items-center justify-center hover:bg-[#D4EBE8] transition-colors"
                >
                  <Upload size={32} strokeWidth={1.5} color="#1A9B7D" />
                </button>
              )}
              <p className="text-xs text-slate-500">
                {isProcessingPhoto ? "Procesando..." : "Toca para cambiar"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="py-3 rounded-[12px] border border-[#1A9B7D] text-[#1A9B7D] font-bold text-sm hover:bg-[#E0F2F1] transition-colors"
              >
                📷 Cámara
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="py-3 rounded-[12px] border border-[#1A9B7D] text-[#1A9B7D] font-bold text-sm hover:bg-[#E0F2F1] transition-colors"
              >
                🖼️ Galería
              </button>
            </div>

            {/* Breed input */}
            <p className="text-sm font-semibold text-[#074738] mb-3 text-left">¿Cuál es su raza?</p>
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Ej: Labrador, Siamés..."
                value={breedInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setBreedInput(value);
                  updateBreedSuggestions(value);
                }}
                onFocus={() => updateBreedSuggestions(breedInput)}
                onBlur={() => setTimeout(() => setShowBreedSuggestions(false), 120)}
                className="w-full px-4 py-4 rounded-[12px] border border-[#1A9B7D]/20 focus:ring-2 focus:ring-[#1A9B7D] outline-none text-sm"
              />

              {showBreedSuggestions && (
                <div className="absolute z-20 left-0 right-0 mt-2 max-h-48 overflow-y-auto rounded-[12px] border border-slate-200 bg-white shadow-lg">
                  {breedSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={() => {
                        setBreedInput(suggestion);
                        setShowBreedSuggestions(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-[#E0F2F1] border-b border-slate-100 last:border-b-0"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={goToNextStep}
                className="w-full py-4 rounded-[14px] bg-[#1A9B7D] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#0a6b54] transition-colors"
              >
                Siguiente <ArrowRight size={18} strokeWidth={2.5} />
              </button>
              <button
                onClick={goToNextStep}
                className="w-full py-3 rounded-[14px] border border-[#1A9B7D] text-[#1A9B7D] font-bold text-sm hover:bg-[#E0F2F1] transition-colors"
              >
                Saltar por ahora
              </button>
            </div>

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
        )}

        {currentStep === "birthdate" && (
          <div className="w-full max-w-sm text-center">
            <h2
              className="text-2xl font-black text-[#074738] tracking-tight mb-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              ¿Cuándo nació {formData.name}?
            </h2>
            <div className="space-y-3 mt-8">
              <button
                onClick={() => {
                  const year = new Date().getFullYear() - 5;
                  setFormData({
                    ...formData,
                    birthdate: `${year}-01-01`,
                  });
                  setTimeout(goToNextStep, 200);
                }}
                className="w-full py-4 rounded-[14px] bg-white border-2 border-[#1A9B7D] text-[#074738] font-bold hover:bg-[#E0F2F1] transition-colors"
              >
                📅 Sé la fecha exacta
              </button>

              <button
                onClick={() => {
                  setFormData({
                    ...formData,
                    birthdate: "approximate",
                  });
                  setTimeout(goToNextStep, 200);
                }}
                className="w-full py-4 rounded-[14px] bg-white border-2 border-[#1A9B7D] text-[#074738] font-bold hover:bg-[#E0F2F1] transition-colors"
              >
                📆 Sé el año más o menos
              </button>

              <button
                onClick={() => {
                  setFormData({
                    ...formData,
                    birthdate: undefined,
                  });
                  setTimeout(goToNextStep, 200);
                }}
                className="w-full py-4 rounded-[14px] bg-white border-2 border-[#1A9B7D] text-[#074738] font-bold hover:bg-[#E0F2F1] transition-colors"
              >
                🤔 No sé
              </button>
            </div>
          </div>
        )}

        {currentStep === "sex" && (
          <div className="w-full max-w-sm text-center">
            <h2
              className="text-2xl font-black text-[#074738] tracking-tight mb-6"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              ¿{formData.name} es...?
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { value: "male" as const, label: "♂ Macho" },
                { value: "female" as const, label: "♀ Hembra" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setFormData({ ...formData, sex: option.value });
                    setTimeout(goToNextStep, 200);
                  }}
                  className={`py-4 rounded-[12px] font-bold text-base transition-all ${
                    formData.sex === option.value
                      ? "bg-[#1A9B7D] text-white border-2 border-[#1A9B7D]"
                      : "bg-white text-[#074738] border-2 border-[#1A9B7D] hover:bg-[#E0F2F1]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="flex items-center justify-start gap-3 rounded-[12px] border-2 border-[#1A9B7D]/20 px-4 py-3 cursor-pointer hover:bg-[#E0F2F1] transition-colors">
              <input
                type="checkbox"
                checked={formData.isNeutered || false}
                onChange={(e) =>
                  setFormData({ ...formData, isNeutered: e.target.checked })
                }
                className="h-4 w-4 accent-[#1A9B7D]"
              />
              <span className="text-sm font-semibold text-[#074738]">
                Está castrado/a
              </span>
            </label>
          </div>
        )}

        {currentStep === "complete" && (
          <div className="w-full max-w-sm text-center">
            <div className="text-6xl mb-6">🐾</div>
            <h2
              className="text-3xl font-black text-[#074738] tracking-tight mb-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              ¡Todo listo!
            </h2>
            <p className="text-lg font-semibold text-[#1A9B7D] mb-8">
              {formData.name} ya tiene su perfil en Pessy
            </p>

            <div className="space-y-3 mb-8 text-left">
              {[
                "Recordatorios de vacunas y medicamentos",
                "Registro de paseos y rutinas",
                "Documentos e historial en un lugar",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-[#074738] font-semibold">
                  <Check size={20} className="text-[#1A9B7D] flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleComplete}
              className="w-full py-4 rounded-[14px] bg-[#1A9B7D] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#0a6b54] transition-colors"
            >
              Empezar con {formData.name} <ArrowRight size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
