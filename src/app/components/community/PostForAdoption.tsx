/**
 * PostForAdoption — Formulario para publicar mascota en adopción
 *
 * Permite publicar una mascota propia o de un refugio para que sea adoptada.
 * Captura: fotos, nombre, raza, edad, tamaño, energía, temperamento, ubicación, descripción.
 */

import { useState, useRef } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useGamification } from "../../contexts/GamificationContext";
import { MaterialIcon } from "../shared/MaterialIcon";
import type { AdoptionListing, EnergyLevel, PublisherType } from "../../../domain/community/adoption.contract";

interface Props {
  onBack: () => void;
  onSuccess: () => void;
  publisherType?: PublisherType;
}

const TEMPERAMENT_OPTIONS = [
  "tranquilo",
  "juguetón",
  "tímido",
  "energético",
  "affectuoso",
  "independiente",
];

const ENERGY_LEVELS: EnergyLevel[] = ["low", "medium", "high"];

export function PostForAdoption({ onBack, onSuccess, publisherType = "individual" }: Props) {
  const { user } = useAuth();
  const { addPoints } = useGamification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pet info
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<"dog" | "cat">("dog");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [size, setSize] = useState<"small" | "medium" | "large">("medium");
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>("medium");
  const [selectedTemperaments, setSelectedTemperaments] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");

  // Good with
  const [goodWithKids, setGoodWithKids] = useState(false);
  const [goodWithDogs, setGoodWithDogs] = useState(false);
  const [goodWithCats, setGoodWithCats] = useState(false);

  // Special needs
  const [specialNeeds, setSpecialNeeds] = useState("");

  // Contact
  const [contactPhone, setContactPhone] = useState("");

  // Photos
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Max 5 photos
    if (photoFiles.length + files.length > 5) {
      alert("Máximo 5 fotos");
      return;
    }

    setUploading(true);
    try {
      const newPhotoFiles = [...photoFiles, ...files];
      setPhotoFiles(newPhotoFiles);

      // Generate previews
      const previews: string[] = [];
      for (const file of newPhotoFiles) {
        const reader = new FileReader();
        reader.onload = (event) => {
          previews.push(event.target?.result as string);
          if (previews.length === newPhotoFiles.length) {
            setPhotoUrls(previews);
          }
        };
        reader.readAsDataURL(file);
      }
    } finally {
      setUploading(false);
    }
  }

  async function uploadPhotosToStorage(files: File[]): Promise<string[]> {
    if (!user?.uid) throw new Error("User not authenticated");

    const urls: string[] = [];
    for (const file of files) {
      const storageRef = ref(storage, `adoption/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    }
    return urls;
  }

  async function handleSubmit() {
    if (!user?.uid) return;
    if (!name.trim() || !breed.trim() || !address.trim()) {
      alert("Por favor completa nombre, raza y ubicación");
      return;
    }
    if (!photoFiles.length) {
      alert("Por favor agrega al menos una foto");
      return;
    }

    setSubmitting(true);

    try {
      // Upload photos
      const uploadedPhotoUrls = await uploadPhotosToStorage(photoFiles);

      // Get current location
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }),
      );

      const now = Timestamp.now();

      const specialNeedsList = specialNeeds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const listing: Omit<AdoptionListing, "id"> = {
        publisherId: user.uid,
        publisherType,
        status: "active",
        petProfile: {
          name,
          species,
          breed,
          age: parseInt(age, 10) || 0,
          size,
          energyLevel,
          temperament: selectedTemperaments,
          goodWith: {
            kids: goodWithKids,
            dogs: goodWithDogs,
            cats: goodWithCats,
          },
          specialNeeds: specialNeedsList,
          photoUrls: uploadedPhotoUrls,
          description,
        },
        location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        address,
        ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
        publishedAt: now,
        updatedAt: now,
        viewCount: 0,
        applicationCount: 0,
      };

      await addDoc(collection(db, "adoption_listings"), listing);
      await addPoints("publish_adoption");
      onSuccess();
    } catch (err) {
      console.error("Error publishing adoption:", err);
      alert("Error al publicar. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F0FAF9] dark:bg-[#101622]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="size-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          style={{ transition: "background 150ms ease" }}
        >
          <MaterialIcon name="arrow_back" className="text-[#074738] dark:text-emerald-400" />
        </button>
        <h1 className="text-lg font-bold text-[#074738] dark:text-white">Publicar para adopción</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Photos */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Fotos</label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {photoUrls.map((url, idx) => (
              <div key={idx} className="relative">
                <img src={url} alt={`preview-${idx}`} className="w-full h-24 object-cover rounded-lg" />
                <button
                  onClick={() => {
                    setPhotoFiles(photoFiles.filter((_, i) => i !== idx));
                    setPhotoUrls(photoUrls.filter((_, i) => i !== idx));
                  }}
                  className="absolute -top-2 -right-2 size-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                >
                  <MaterialIcon name="close" className="text-sm" />
                </button>
              </div>
            ))}
            {photoFiles.length < 5 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-24 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center hover:border-[#1A9B7D] transition-colors"
              >
                <MaterialIcon name="add_photo_alternate" className="text-2xl text-slate-400" />
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoSelect}
            disabled={uploading || photoFiles.length >= 5}
            className="hidden"
          />
          <p className="text-xs text-slate-500">{photoFiles.length}/5 fotos</p>
        </div>

        {/* Basic info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Max"
              className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Especie</label>
            <select
              value={species}
              onChange={(e) => setSpecies(e.target.value as "dog" | "cat")}
              className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white"
            >
              <option value="dog">Perro</option>
              <option value="cat">Gato</option>
            </select>
          </div>
        </div>

        {/* Breed & age */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Raza</label>
            <input
              type="text"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="Labrador"
              className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Edad (meses)</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="24"
              className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Size & energy */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Tamaño</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as "small" | "medium" | "large")}
              className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white"
            >
              <option value="small">Pequeño</option>
              <option value="medium">Mediano</option>
              <option value="large">Grande</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Energía</label>
            <select
              value={energyLevel}
              onChange={(e) => setEnergyLevel(e.target.value as EnergyLevel)}
              className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white"
            >
              <option value="low">Bajo</option>
              <option value="medium">Moderado</option>
              <option value="high">Alto</option>
            </select>
          </div>
        </div>

        {/* Temperament */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Temperamento</label>
          <div className="flex flex-wrap gap-2">
            {TEMPERAMENT_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() =>
                  setSelectedTemperaments(
                    selectedTemperaments.includes(t)
                      ? selectedTemperaments.filter((x) => x !== t)
                      : [...selectedTemperaments, t]
                  )
                }
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedTemperaments.includes(t)
                    ? "bg-[#074738] text-white"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Good with */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Compatible con</label>
          <div className="space-y-2">
            {[
              { key: goodWithKids, set: setGoodWithKids, label: "Niños" },
              { key: goodWithDogs, set: setGoodWithDogs, label: "Perros" },
              { key: goodWithCats, set: setGoodWithCats, label: "Gatos" },
            ].map((item) => (
              <label key={item.label} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.key}
                  onChange={(e) => item.set(e.target.checked)}
                  className="size-[18px] rounded accent-[#1A9B7D]"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Special needs */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Necesidades especiales (opcional)</label>
          <input
            type="text"
            value={specialNeeds}
            onChange={(e) => setSpecialNeeds(e.target.value)}
            placeholder="Ej: requiere medicación, tres patas, ciego"
            className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white placeholder-slate-400"
          />
          <p className="text-xs text-slate-500 mt-1">Separa con comas</p>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cuéntanos sobre la personalidad de esta mascota..."
            rows={4}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white placeholder-slate-400 resize-none"
          />
        </div>

        {/* Address */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Ubicación</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Barrio, ciudad o zona"
            className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>

        {/* Contact phone */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
            WhatsApp / Teléfono de contacto <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+54 9 11 1234-5678"
            className="w-full h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base text-slate-900 dark:text-white placeholder-slate-400"
          />
          <p className="text-xs text-slate-500 mt-1">Los interesados podrán escribirte directo por WhatsApp</p>
        </div>

        {/* Info */}
        <div className="bg-[#E0F2F1] dark:bg-emerald-900/20 rounded-2xl p-4 flex gap-3">
          <MaterialIcon name="info" className="text-[#1A9B7D] text-xl flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#074738] dark:text-emerald-300">
            Tu publicación estará visible en el feed de adopción. Los interesados pueden contactarte directamente.
          </p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || uploading || photoFiles.length === 0}
          className="w-full h-[52px] rounded-2xl bg-[#074738] text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ transition: "opacity 150ms ease" }}
        >
          {submitting ? (
            <div className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <>
              <MaterialIcon name="publish" className="text-xl" />
              Publicar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
