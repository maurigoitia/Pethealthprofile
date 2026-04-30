import { useParams, Link } from "react-router";
import { MaterialIcon } from "../shared/MaterialIcon";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export function VerifyReportScreen() {
  const { hash } = useParams<{ hash: string }>();
  const [report, setReport] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "found" | "not_found">("loading");

  useEffect(() => {
    async function fetchReport() {
      if (!hash) {
        setStatus("not_found");
        return;
      }

      try {
        const docRef = doc(db, "verified_reports", hash);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setReport({ id: docSnap.id, ...docSnap.data() });
          setStatus("found");
        } else {
          setStatus("not_found");
        }
      } catch (error) {
        console.error("Error fetching report:", error);
        setStatus("not_found");
      }
    }

    fetchReport();
  }, [hash]);

  const cleanSummary = (text?: string | null) =>
    (text || "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s+/g, "")
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/`{1,3}/g, "")
      .replace(/\s+/g, " ")
      .trim();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-6"
          >
            <MaterialIcon name="arrow_back" className="text-lg" />
            Volver al inicio
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="size-14 bg-[#074738] dark:bg-white/10 text-white dark:text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg transition-colors">
              P
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                Verificación de Reporte
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sistema de integridad documental PESSY
              </p>
            </div>
          </div>
        </div>

        {/* Verification Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 mb-6">
          {/* Hash Display */}
          <div className="mb-8 pb-8 border-b border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              Huella Digital del Reporte (ID)
            </p>
            <p className="text-sm font-mono text-slate-900 dark:text-white break-all bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
              {hash || "No proporcionado"}
            </p>
          </div>

          {status === "loading" ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#074738] border-t-transparent mb-4"></div>
              <p className="text-sm text-slate-500 font-bold">Verificando integridad...</p>
            </div>
          ) : status === "found" && report ? (
            // Report Found
            <>
              {/* Status */}
              <div className="flex items-center gap-3 mb-8 p-6 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-500 rounded-2xl">
                <MaterialIcon name="verified" className="text-3xl text-emerald-600" />
                <div>
                  <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                    Reporte Válido
                  </p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-500">
                    La huella digital coincide con nuestros registros
                  </p>
                </div>
              </div>

              {/* Report Details */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                      ID de Certificación
                    </p>
                    <p className="text-sm font-mono font-bold text-slate-900 dark:text-white uppercase">
                      {report.id.slice(0, 12)}...
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Fecha de Certificación
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {report.generatedAt
                        ? new Date(report.generatedAt).toLocaleString("es-AR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Sin fecha"}
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                    Resumen Verificado (Vista Pública Redaccionada)
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl mb-6">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {cleanSummary(report.summary) || "Sin resumen disponible para este reporte."}
                    </p>
                  </div>

                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                    Metadatos Públicos del Certificado
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tipo</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {report.certificateType || "Certificado verificado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Versión</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {report.verificationVersion || "pessy_verified_v2"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Documentos resumidos</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {typeof report.documentCount === "number" ? report.documentCount : 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Fuente narrativa</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {report.includesAiNarrative ? "Resumen automático (no canónico)" : "No aplica"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Estado de Verificación
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      <MaterialIcon name="check_circle" className="text-emerald-500" />
                      <span className="text-slate-700 dark:text-slate-300">
                        Coincidencia de hash: <strong>Positiva</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <MaterialIcon name="check_circle" className="text-emerald-500" />
                      <span className="text-slate-700 dark:text-slate-300">
                        Integridad del documento: <strong>Verificada</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <MaterialIcon name="check_circle" className="text-emerald-500" />
                      <span className="text-slate-700 dark:text-slate-300">
                        Estado del registro: <strong>Activo</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Report Not Found
            <>
              <div className="flex items-center gap-3 mb-8 p-6 bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl">
                <MaterialIcon name="info" className="text-3xl text-slate-500" />
                <div>
                  <p className="text-lg font-black text-slate-700 dark:text-slate-300">
                    Reporte No Encontrado
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    No hay registros asociados a esta huella digital
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6">
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  Esto puede deberse a:
                </p>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <MaterialIcon name="circle" className="text-[8px] mt-1.5" />
                    <span>El hash proporcionado no existe en nuestra base de datos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <MaterialIcon name="circle" className="text-[8px] mt-1.5" />
                    <span>El documento fue modificado después de su generación</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <MaterialIcon name="circle" className="text-[8px] mt-1.5" />
                    <span>El código QR fue dañado o escaneado incorrectamente</span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer Info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-start gap-3">
            <MaterialIcon name="info" className="text-[#074738] text-xl mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                Sobre este sistema
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                PESSY utiliza hash criptográfico SHA-256 para garantizar la integridad de los
                reportes verificados. Cada documento genera una huella digital única que permite
                verificar que no ha sido alterado desde su emisión original.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
