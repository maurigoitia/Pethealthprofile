import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { MaterialIcon } from "../shared/MaterialIcon";
import { useMedical } from "../../contexts/MedicalContext";
import { useAuth } from "../../contexts/AuthContext";
import { ClinicalReviewDraft } from "../../types/medical";

interface MedicationFormRow {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function hasStorageAccessSignature(urlValue: string): boolean {
  try {
    const parsed = new URL(urlValue);
    const q = parsed.searchParams;
    return (
      q.has("token") ||
      q.has("X-Goog-Algorithm") ||
      q.has("X-Goog-Credential") ||
      q.has("GoogleAccessId") ||
      q.has("Signature")
    );
  } catch {
    return false;
  }
}

function isRenderableStorageUrl(urlValue: string): boolean {
  if (!/^https?:\/\//i.test(urlValue)) return false;
  if (urlValue.startsWith("gs://")) return false;
  if (urlValue.includes("firebasestorage.googleapis.com")) {
    return hasStorageAccessSignature(urlValue);
  }
  return true;
}

function buildMedicationRows(review: ClinicalReviewDraft): MedicationFormRow[] {
  const rowsFromMedications = (review.medications || [])
    .map((medication, index) => ({
      id: `med_${index}_${(medication.name || "sin_nombre").toLowerCase().replace(/\s+/g, "_")}`,
      name: (medication.name || "").trim(),
      dosage: (medication.dose || "").trim(),
      frequency: (medication.frequency || "").trim(),
      duration: medication.duration_days ? `${medication.duration_days} días` : "",
    }))
    .filter((row) => row.name);

  const existing = new Set(rowsFromMedications.map((row) => row.name.toLowerCase()));
  const rowsFromMissing = (review.missingFields || [])
    .filter((row) => (row.medication || "").trim())
    .filter((row) => !existing.has((row.medication || "").toLowerCase()))
    .map((row, index) => ({
      id: `missing_${index}_${(row.medication || "").toLowerCase().replace(/\s+/g, "_")}`,
      name: (row.medication || "").trim(),
      dosage: (row.detectedDose || "").trim(),
      frequency: (row.detectedFrequency || "").trim(),
      duration: "",
    }));

  return [...rowsFromMedications, ...rowsFromMissing];
}

export function ClinicalReviewScreen() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getClinicalReviewDraftById, submitClinicalReviewDraft } = useMedical();

  const [review, setReview] = useState<ClinicalReviewDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MedicationFormRow[]>([]);
  const [eventDate, setEventDate] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!reviewId) {
        setLoading(false);
        setError("No se indicó revisión para abrir.");
        return;
      }
      setLoading(true);
      try {
        const payload = await getClinicalReviewDraftById(reviewId);
        if (cancelled) return;
        if (!payload) {
          setReview(null);
          setRows([]);
          setError("No encontramos este borrador de revisión.");
          return;
        }
        setReview(payload);
        setRows(buildMedicationRows(payload));
        setEventDate((payload.eventDate || "").slice(0, 10));
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError("No pudimos cargar este borrador. Reintentá.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [reviewId, getClinicalReviewDraftById]);

  const previewUrl = useMemo(
    () =>
      normalizeUrl(review?.imageFragmentUrl) ||
      normalizeUrl(review?.sourceStorageSignedUrl) ||
      normalizeUrl(review?.sourceStorageUri) ||
      null,
    [review]
  );
  useEffect(() => {
    setPreviewFailed(false);
  }, [previewUrl]);
  const previewMime = (review?.sourceMimeType || "").toLowerCase();
  const canRenderPreview = Boolean(previewUrl && isRenderableStorageUrl(previewUrl) && !previewFailed);
  const canOpenOriginal = Boolean(previewUrl && isRenderableStorageUrl(previewUrl));
  const isPdfPreview = previewMime.includes("pdf");

  const hasInvalidRows = rows.some((row) => !row.name.trim() || !row.dosage.trim() || !row.frequency.trim());
  const requiresEventDate = !eventDate.trim();

  const updateRow = (id: string, patch: Partial<MedicationFormRow>) => {
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleSubmit = async () => {
    if (!review || !reviewId) return;
    if (hasInvalidRows || requiresEventDate) {
      setError("Completá fecha, dosis y frecuencia antes de confirmar.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitClinicalReviewDraft(reviewId, {
        eventDate,
        medications: rows.map((row) => ({
          name: row.name.trim(),
          dosage: row.dosage.trim(),
          frequency: row.frequency.trim(),
          duration: row.duration.trim() || null,
        })),
      });
      navigate("/home?review=feed");
    } catch (err) {
      setError((err as Error)?.message || "No pudimos confirmar la revisión.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0FAF9] p-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <div className="mx-auto mb-3 size-10 rounded-full border-4 border-red-200 border-t-red-600 animate-spin" />
          <p className="text-sm font-bold text-slate-800">Cargando revisión clínica...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F0FAF9] p-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <p className="text-sm font-bold text-slate-900">Necesitás iniciar sesión para revisar este borrador.</p>
          <Link to="/login" className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-[#074738] hover:underline">
            <MaterialIcon name="login" className="text-base" />
            Ir a login
          </Link>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-[#F0FAF9] p-6">
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6">
          <p className="text-sm font-bold text-slate-900">{error || "Revisión no encontrada."}</p>
          <Link to="/home?review=feed" className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-[#074738] hover:underline">
            <MaterialIcon name="arrow_back" className="text-base" />
            Volver al historial
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0FAF9] p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link to="/home?review=feed" className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900">
            <MaterialIcon name="arrow_back" className="text-base" />
            Volver
          </Link>
          <span className="text-[11px] font-black uppercase tracking-wide text-red-700 bg-red-100 px-2.5 py-1 rounded-lg">
            Borrador clínico
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Fuente original</p>
            <p className="text-sm font-semibold text-slate-900">{review.sourceSubject || "Sin asunto"}</p>
            <p className="text-xs text-slate-500 mt-1">{review.sourceSender || "Remitente no disponible"}</p>
            <p className="text-xs text-slate-500">{review.sourceDate || "Fecha no disponible"}</p>
            <p className="text-xs text-slate-500 mt-2">Mensaje: {review.sourceMessageId || "N/D"}</p>

            <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden bg-[#E0F2F1] min-h-[320px]">
              {canRenderPreview ? (
                isPdfPreview ? (
                  <iframe title="preview-documento" src={previewUrl || undefined} className="w-full min-h-[420px] border-0" />
                ) : (
                  <img
                    src={previewUrl || ""}
                    alt="Documento clínico original"
                    className="w-full h-full object-contain min-h-[320px]"
                    onError={() => setPreviewFailed(true)}
                  />
                )
              ) : (
                <div className="p-4 text-xs text-slate-600">
                  No hay vista embebida disponible o el archivo original requiere permisos adicionales.
                  {review.sourceStoragePath ? <p className="mt-2 font-mono break-all">{review.sourceStoragePath}</p> : null}
                </div>
              )}
            </div>

            {canOpenOriginal && (
              <a
                href={previewUrl || undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#074738] mt-3 hover:underline"
              >
                <MaterialIcon name="open_in_new" className="text-sm" />
                Abrir original en pestaña nueva
              </a>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Editor de emergencia</p>
            <p className="text-sm text-slate-700 mb-4">
              Confirmá los campos faltantes para mover este registro al historial consolidado.
            </p>

            <label className="block mb-4">
              <span className="text-xs font-bold text-slate-700">Fecha clínica del evento</span>
              <input
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${requiresEventDate ? "border-red-400 bg-red-50" : "border-slate-300"}`}
              />
            </label>

            <div className="space-y-3">
              {rows.map((row) => {
                const missingDose = !row.dosage.trim();
                const missingFrequency = !row.frequency.trim();
                return (
                  <div key={row.id} className="rounded-xl border border-slate-200 p-3 bg-[#F0FAF9]">
                    <p className="text-xs font-black text-slate-700 mb-2">{row.name || "Medicamento sin nombre"}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        value={row.dosage}
                        onChange={(event) => updateRow(row.id, { dosage: event.target.value })}
                        placeholder="Dosis (ej: 3/4 comprimido)"
                        className={`rounded-lg border px-3 py-2 text-sm ${missingDose ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                      />
                      <input
                        value={row.frequency}
                        onChange={(event) => updateRow(row.id, { frequency: event.target.value })}
                        placeholder="Frecuencia (ej: cada 12h)"
                        className={`rounded-lg border px-3 py-2 text-sm ${missingFrequency ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                      />
                    </div>
                    <input
                      value={row.duration}
                      onChange={(event) => updateRow(row.id, { duration: event.target.value })}
                      placeholder="Duración (opcional)"
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={saving || hasInvalidRows || requiresEventDate || rows.length === 0}
              className="mt-4 w-full rounded-xl bg-[#1A9B7D] text-white py-3 text-sm font-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando..." : "Confirmar y mover al historial"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
