/**
 * ContextualNexosSection
 *
 * Muestra el "siguiente paso concreto" basado en los datos reales de la mascota.
 * NO es un directorio genérico. Cada tarjeta nace de un dato clínico, de vacunación
 * o de alimentación de la mascota específica.
 *
 * Visión: Pessy no da info — da el siguiente paso.
 *   1. Análisis clínico detectó algo → veterinarios que atienden esto
 *   2. Vacuna próxima/vencida → veterinaria cercana con turno
 *   3. Mascota come X → sugerencia de alimento específico
 */

import { useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { useMedical } from "../../contexts/MedicalContext";
import { usePet } from "../../contexts/PetContext";

interface ContextualNexosSectionProps {
  activePetId: string;
  petName: string;
  petSpecies?: string;
  vaccineStatus: { label: string; tone: string };
  onOpenNearbyVets: () => void;
}

type FoodType = "balanced" | "barf" | "mixed" | undefined;

function getFoodLabel(brand?: string, type?: FoodType): string {
  if (brand) return brand;
  if (type === "barf") return "BARF";
  if (type === "balanced") return "alimento balanceado";
  if (type === "mixed") return "alimentación mixta";
  return "su alimento actual";
}

function getFoodSuggestion(brand?: string, type?: FoodType, species?: string): string {
  if (brand) return `Reponer ${brand} antes de que se acabe`;
  if (type === "barf") return "Ver recetas BARF recomendadas para su peso y edad";
  if (species === "cat") return "Ver alimentos premium para gatos";
  return "Ver alimentos recomendados para su raza y edad";
}

function FoodRecommendationSheet({
  petName,
  foodLabel,
  suggestion,
  petSpecies,
  onClose,
}: {
  petName: string;
  foodLabel: string;
  suggestion: string;
  petSpecies?: string;
  onClose: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
      />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-w-md mx-auto p-6 space-y-4">
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto" />
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <MaterialIcon name="restaurant" className="text-emerald-600 text-2xl" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600">
              Sugerencia para {petName}
            </p>
            <p className="text-base font-black text-slate-900 dark:text-white">
              Come {foodLabel}
            </p>
          </div>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl p-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
            Lo que le recomendamos
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{suggestion}</p>
        </div>

        <a
          href={`https://listado.mercadolibre.com.ar/${encodeURIComponent(`alimento ${foodLabel} ${petSpecies === "cat" ? "gato" : "perro"}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#074738] text-white font-black text-sm"
          onClick={onClose}
        >
          <MaterialIcon name="open_in_new" className="text-base" />
          Ver opciones en MercadoLibre
        </a>

        <button
          onClick={onClose}
          className="w-full py-3 text-sm font-semibold text-slate-500"
        >
          Cerrar
        </button>
      </div>
    </>
  );
}

export function ContextualNexosSection({
  activePetId,
  petName,
  petSpecies,
  vaccineStatus,
  onOpenNearbyVets,
}: ContextualNexosSectionProps) {
  const { getClinicalAlertsByPetId } = useMedical();
  const { activePet } = usePet();
  const [showFoodSheet, setShowFoodSheet] = useState(false);

  const activeAlerts = getClinicalAlertsByPetId(activePetId).filter(
    (a) => a.status === "active"
  );
  const topAlert =
    activeAlerts.find((a) => a.severity === "high") ||
    activeAlerts.find((a) => a.severity === "medium") ||
    activeAlerts[0];

  const vaccineNeedsAction =
    vaccineStatus.label === "Próxima" || vaccineStatus.label === "Vencida";

  const foodBrand = activePet?.foodBrand;
  const foodType = activePet?.foodType as FoodType;
  const hasFood = !!(foodBrand || foodType);

  interface Nexo {
    id: string;
    icon: string;
    badge: string;
    title: string;
    subtitle: string;
    cta: string;
    cardBg: string;
    cardBorder: string;
    iconBg: string;
    iconColor: string;
    badgeBg: string;
    badgeText: string;
    action: () => void;
  }

  const nexos: Nexo[] = [];

  // 1. Análisis clínico → veterinarios que atienden esto
  if (topAlert) {
    nexos.push({
      id: "clinical",
      icon: "medical_information",
      badge: topAlert.severity === "high" ? "Requiere atención" : "Seguimiento clínico",
      title: topAlert.title,
      subtitle: `Hay veterinarias cerca que atienden esto para ${petName}`,
      cta: "Ver veterinarias",
      cardBg: "bg-red-50 dark:bg-red-950/20",
      cardBorder: "border-red-200 dark:border-red-900/40",
      iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600",
      badgeBg: "bg-red-100 dark:bg-red-900/40",
      badgeText: "text-red-700 dark:text-red-300",
      action: onOpenNearbyVets,
    });
  }

  // 2. Vacuna próxima/vencida → veterinaria con turno disponible
  if (vaccineNeedsAction) {
    const isOverdue = vaccineStatus.label === "Vencida";
    nexos.push({
      id: "vaccine",
      icon: "vaccines",
      badge: isOverdue ? "Vacuna vencida" : "Vacuna próxima",
      title: `Veterinarias para ${petName}`,
      subtitle: "Veterinarias cerca tuyo",
      cta: "Ver veterinarias",
      cardBg: isOverdue
        ? "bg-red-50 dark:bg-red-950/20"
        : "bg-amber-50 dark:bg-amber-950/20",
      cardBorder: isOverdue
        ? "border-red-200 dark:border-red-900/40"
        : "border-amber-200 dark:border-amber-900/40",
      iconBg: isOverdue
        ? "bg-red-100 dark:bg-red-900/30"
        : "bg-amber-100 dark:bg-amber-900/30",
      iconColor: isOverdue ? "text-red-600" : "text-amber-600",
      badgeBg: isOverdue
        ? "bg-red-100 dark:bg-red-900/40"
        : "bg-amber-100 dark:bg-amber-900/40",
      badgeText: isOverdue
        ? "text-red-700 dark:text-red-300"
        : "text-amber-700 dark:text-amber-300",
      action: onOpenNearbyVets,
    });
  }

  // 3. Alimentación → sugerencia de alimento específico
  if (hasFood) {
    const foodLabel = getFoodLabel(foodBrand, foodType);
    nexos.push({
      id: "food",
      icon: "restaurant",
      badge: "Sugerencia personalizada",
      title: `${petName} come ${foodLabel}`,
      subtitle: "Tenemos una recomendación basada en su perfil",
      cta: "Ver sugerencia",
      cardBg: "bg-emerald-50 dark:bg-emerald-950/20",
      cardBorder: "border-emerald-200 dark:border-emerald-900/40",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600",
      badgeBg: "bg-emerald-100 dark:bg-emerald-900/40",
      badgeText: "text-emerald-700 dark:text-emerald-300",
      action: () => setShowFoodSheet(true),
    });
  }

  if (nexos.length === 0) return null;

  const foodLabel = getFoodLabel(foodBrand, foodType);
  const foodSuggestion = getFoodSuggestion(foodBrand, foodType, petSpecies);

  return (
    <>
      <section className="px-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MaterialIcon name="bolt" className="text-[#074738] text-base" />
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#074738]">
              Próximos pasos
            </span>
          </div>
          <div className="h-px flex-1 bg-[#074738]/10" />
        </div>

        {/* Cards */}
        {nexos.map((nexo) => (
          <button
            key={nexo.id}
            onClick={nexo.action}
            className={`w-full rounded-[20px] border ${nexo.cardBorder} ${nexo.cardBg} p-4 text-left flex items-center gap-4 active:scale-[0.98] transition-transform`}
          >
            {/* Icon */}
            <div
              className={`size-11 rounded-full ${nexo.iconBg} flex items-center justify-center shrink-0`}
            >
              <MaterialIcon name={nexo.icon} className={`text-xl ${nexo.iconColor}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <span
                className={`inline-block text-[10px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded-full mb-1 ${nexo.badgeBg} ${nexo.badgeText}`}
              >
                {nexo.badge}
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-white leading-snug truncate">
                {nexo.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">
                {nexo.subtitle}
              </p>
            </div>

            {/* CTA */}
            <div className="shrink-0">
              <span className="text-[11px] font-black text-white bg-[#074738] px-3 py-1.5 rounded-[10px] whitespace-nowrap">
                {nexo.cta}
              </span>
            </div>
          </button>
        ))}
      </section>

      {/* Food recommendation sheet */}
      {showFoodSheet && (
        <FoodRecommendationSheet
          petName={petName}
          foodLabel={foodLabel}
          suggestion={foodSuggestion}
          petSpecies={petSpecies}
          onClose={() => setShowFoodSheet(false)}
        />
      )}
    </>
  );
}
