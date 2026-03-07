import { useEffect, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { StorageQuota, formatBytes, PLAN_LIMITS, useStorageQuota } from "../hooks/useStorageQuota";

interface StorageUsageWidgetProps {
  premiumPrice?: string;
}

export function StorageUsageWidget({ premiumPrice }: StorageUsageWidgetProps) {
  void premiumPrice;
  const { getQuota } = useStorageQuota();
  const [quota, setQuota] = useState<StorageQuota | null>(null);

  useEffect(() => {
    getQuota().then(setQuota).catch(() => {});
  }, [getQuota]);

  if (!quota) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-1/2 mb-2" />
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
      </div>
    );
  }

  const barColor = quota.isOverLimit ? "bg-red-500"
    : quota.isNearLimit ? "bg-amber-400"
    : "bg-[#074738]";

  return (
    <>
      <div className={`rounded-2xl border p-4 ${
        quota.isOverLimit
          ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
          : quota.isNearLimit
          ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900"
          : "border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800"
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MaterialIcon name="storage" className={`text-lg ${
              quota.isOverLimit ? "text-red-600" : quota.isNearLimit ? "text-amber-600" : "text-slate-500"
            }`} />
            <span className="text-sm font-black text-slate-900 dark:text-white">Almacenamiento</span>
          </div>
          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
            quota.plan === "premium"
              ? "bg-[#074738]/10 text-[#074738]"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
          }`}>
            {quota.plan === "premium" ? "✦ Premium" : "Free"}
          </span>
        </div>

        {/* Barra de uso */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {formatBytes(quota.used)}
            </span>
            <span>{formatBytes(quota.limit)}</span>
          </div>
          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(100, quota.percentUsed)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 text-right">
            {formatBytes(quota.remaining)} disponibles
          </p>
        </div>

        {/* Alerta si cerca del límite */}
        {quota.isOverLimit && (
          <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <p className="text-xs font-bold text-red-700 dark:text-red-400">
              Límite alcanzado — no podés subir más documentos
            </p>
          </div>
        )}
        {quota.isNearLimit && !quota.isOverLimit && (
          <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
              Quedás con poco espacio — hacé una limpieza de archivos para evitar bloqueos
            </p>
          </div>
        )}
      </div>
    </>
  );
}
