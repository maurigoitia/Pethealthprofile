/**
 * AdoptionDetail — Vista detallada de una publicación de adopción
 *
 * Muestra todas las fotos, descripción completa, match scoring, y opción de contactar.
 */

import { useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import type { AdoptionListing } from "../../../domain/community/adoption.contract";

interface Props {
  listing: AdoptionListing;
  onBack: () => void;
}

function sizeLabel(size: string): string {
  const labels: Record<string, string> = {
    small: "Pequeño",
    medium: "Mediano",
    large: "Grande",
  };
  return labels[size] || size;
}

function energyLabel(energy: string): string {
  const labels: Record<string, string> = {
    low: "Tranquilo",
    medium: "Moderado",
    high: "Energético",
  };
  return labels[energy] || energy;
}

export function AdoptionDetail({ listing, onBack }: Props) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const pet = listing.petProfile;
  const photos = pet.photoUrls;

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
        <h1 className="text-lg font-bold text-[#074738] dark:text-white flex-1">{pet.name}</h1>
      </div>

      <div className="max-w-md mx-auto">
        {/* Photo gallery */}
        {photos.length > 0 && (
          <div className="relative w-full bg-slate-100 dark:bg-slate-800">
            <img src={photos[currentPhotoIndex]} alt={pet.name} className="w-full h-80 object-cover" />

            {/* Photo navigation */}
            {photos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPhotoIndex(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentPhotoIndex
                        ? "w-6 bg-white"
                        : "w-2 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Photo counter */}
            {photos.length > 1 && (
              <div className="absolute top-4 right-4 bg-black/50 text-white text-xs font-semibold px-3 py-1 rounded-full">
                {currentPhotoIndex + 1}/{photos.length}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-6 flex flex-col gap-6">
          {/* Basic info card */}
          <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-2xl font-bold text-[#074738] dark:text-white">{pet.name}</p>
                <p className="text-slate-500 dark:text-slate-400">{pet.breed}</p>
              </div>
              {pet.species === "dog" ? (
                <MaterialIcon name="pets" className="text-3xl text-[#1A9B7D]" />
              ) : (
                <MaterialIcon name="favorite" className="text-3xl text-[#E67E7E]" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#E0F2F1] dark:bg-emerald-900/20 rounded-lg p-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Edad</p>
                <p className="font-bold text-[#074738] dark:text-white">{pet.age} meses</p>
              </div>
              <div className="bg-[#E0F2F1] dark:bg-emerald-900/20 rounded-lg p-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Tamaño</p>
                <p className="font-bold text-[#074738] dark:text-white">{sizeLabel(pet.size)}</p>
              </div>
              <div className="bg-[#E0F2F1] dark:bg-emerald-900/20 rounded-lg p-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Energía</p>
                <p className="font-bold text-[#074738] dark:text-white">{energyLabel(pet.energyLevel)}</p>
              </div>
              <div className="bg-[#E0F2F1] dark:bg-emerald-900/20 rounded-lg p-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Ubicación</p>
                <p className="font-bold text-[#074738] dark:text-white text-sm truncate">{listing.address}</p>
              </div>
            </div>
          </div>

          {/* Temperament */}
          {pet.temperament.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#074738] dark:text-white mb-2">Temperamento</h3>
              <div className="flex flex-wrap gap-2">
                {pet.temperament.map((t) => (
                  <span key={t} className="text-xs bg-[#E0F2F1] dark:bg-emerald-900/30 text-[#074738] dark:text-emerald-200 px-3 py-1.5 rounded-full font-medium">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Compatible with */}
          <div>
            <h3 className="text-sm font-semibold text-[#074738] dark:text-white mb-2">Compatible con</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Niños", value: pet.goodWith.kids },
                { label: "Perros", value: pet.goodWith.dogs },
                { label: "Gatos", value: pet.goodWith.cats },
              ].map((item) => (
                <div key={item.label} className={`text-center py-2 rounded-lg ${
                  item.value
                    ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}>
                  <MaterialIcon name={item.value ? "check_circle" : "cancel"} className="text-sm mx-auto mb-1" />
                  <p className="text-xs font-medium">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Special needs */}
          {pet.specialNeeds.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-[16px] border border-amber-200 dark:border-amber-800 p-4">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
                <MaterialIcon name="info" className="text-lg" />
                Necesidades especiales
              </h3>
              <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-100">
                {pet.specialNeeds.map((need, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-300 mt-1">•</span>
                    <span>{need}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-[#074738] dark:text-white mb-2">Sobre {pet.name}</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {pet.description}
            </p>
          </div>

          {/* Contact CTA */}
          <button className="w-full h-[52px] rounded-2xl bg-[#1A9B7D] text-white font-semibold text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <MaterialIcon name="mail" className="text-xl" />
            Contactar al publicador
          </button>
        </div>
      </div>
    </div>
  );
}
