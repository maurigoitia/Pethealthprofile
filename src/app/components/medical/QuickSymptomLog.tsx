/**
 * QuickSymptomLog — registrar un síntoma/observación rápida.
 *
 * Caso de uso (Reddit research): el dueño nota algo raro (mancha, tos, vómito),
 * saca foto en el momento, agrega 1-2 líneas de contexto. Sin OCR, sin IA, sin
 * pipeline completo. Solo: foto + nota + timestamp + a Timeline.
 *
 * Resuelve el pain point #1 del thread:
 * "scrolling forever through camera roll, wading through blurry squirrel pics"
 */
import { useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../../lib/firebase";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { useAuth } from "../../contexts/AuthContext";
import { MaterialIcon } from "../shared/MaterialIcon";
import type { MedicalEvent } from "../../types/medical";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickSymptomLog({ isOpen, onClose }: Props) {
  const { activePet } = usePet();
  const { addEvent } = useMedical();
  const { user } = useAuth();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
    setError("");
  };

  const handleSubmit = async () => {
    if (!activePet || !user) {
      setError("No hay mascota activa.");
      return;
    }
    const trimmedNote = note.trim();
    if (!trimmedNote && !photoFile) {
      setError("Agregá al menos una nota o una foto.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      let documentUrl = "";
      if (photoFile) {
        const path = `users/${user.uid}/observations/${activePet.id}_obs_${Date.now()}_${photoFile.name}`;
        const sref = ref(storage, path);
        const result = await uploadBytes(sref, photoFile);
        documentUrl = await getDownloadURL(result.ref);
      }

      const now = new Date().toISOString();
      const title = trimmedNote
        ? trimmedNote.slice(0, 80)
        : "Observación rápida";

      const newEvent: MedicalEvent = {
        id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        petId: activePet.id,
        userId: user.uid,
        title,
        documentUrl,
        documentPreviewUrl: documentUrl || null,
        fileName: photoFile?.name || "",
        fileType: "image",
        status: "completed",
        ocrProcessed: false,
        aiProcessed: false,
        validatedByHuman: true,
        sourceTruthLevel: "human_confirmed",
        truthStatus: "human_confirmed",
        extractedData: {
          documentType: "observation",
          documentTypeConfidence: "high",
          eventDate: now,
          eventDateConfidence: "high",
          provider: null,
          providerConfidence: "not_detected",
          clinic: null,
          clinicConfidence: "not_detected",
          diagnosis: null,
          diagnosisConfidence: "not_detected",
          observations: trimmedNote || null,
          observationsConfidence: trimmedNote ? "high" : "not_detected",
          medications: [],
          measurements: [],
          suggestedTitle: title,
          aiGeneratedSummary: trimmedNote || "",
          nextAppointmentDate: null,
          nextAppointmentDateConfidence: "not_detected",
        } as any,
        createdAt: now,
        updatedAt: now,
        relatedEventIds: [],
        aiSuggestedRelation: null,
      } as MedicalEvent;

      const ok = await addEvent(newEvent);
      if (!ok) {
        setError("No se pudo guardar. Intentá de nuevo.");
        return;
      }
      // reset y cerrar
      setNote("");
      setPhotoFile(null);
      setPhotoPreview("");
      onClose();
    } catch (e: any) {
      console.error("[QuickSymptomLog] error:", e);
      setError(e?.message || "Error al guardar la observación.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <div className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-[24px] max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto px-5 py-5">
          {/* Drag handle */}
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xl font-extrabold text-[#074738]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Algo raro hoy
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="size-9 rounded-full bg-slate-100 flex items-center justify-center"
              aria-label="Cerrar"
            >
              <MaterialIcon name="close" className="text-lg text-slate-600" />
            </button>
          </div>

          <p
            className="text-sm text-slate-500 mb-4 leading-relaxed"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Sacá una foto y dejá una nota corta. Lo vas a tener en el historial
            cuando vayas al veterinario.
          </p>

          {/* Photo area */}
          {photoPreview ? (
            <div className="relative mb-4">
              <img
                src={photoPreview}
                alt="Vista previa"
                className="w-full h-56 object-cover rounded-[16px]"
              />
              <button
                type="button"
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoPreview("");
                }}
                className="absolute top-2 right-2 size-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center"
                aria-label="Sacar foto"
              >
                <MaterialIcon name="close" className="text-base text-white" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => captureRef.current?.click()}
                className="min-h-[96px] rounded-[16px] border-2 border-dashed border-[#1A9B7D]/40 bg-[#E0F2F1]/50 flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
              >
                <MaterialIcon
                  name="photo_camera"
                  className="text-2xl text-[#1A9B7D]"
                />
                <span
                  className="text-xs font-bold text-[#074738]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Cámara
                </span>
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="min-h-[96px] rounded-[16px] border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
              >
                <MaterialIcon name="image" className="text-2xl text-slate-500" />
                <span
                  className="text-xs font-bold text-slate-700"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Galería
                </span>
              </button>
            </div>
          )}

          <input
            ref={captureRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Note */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="¿Qué viste? Ej: 'mancha rosada en la pata, le molesta'"
            rows={3}
            maxLength={280}
            className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-[#1A9B7D] focus:outline-none focus:ring-2 focus:ring-[#1A9B7D]/20 resize-none mb-2"
            style={{ fontFamily: "Manrope, sans-serif" }}
          />
          <div className="flex justify-between items-center mb-4 text-[11px] text-slate-400">
            <span>{note.length}/280</span>
            <span>Sin diagnóstico — solo observación</span>
          </div>

          {error && (
            <div className="rounded-[10px] bg-red-50 border border-red-200 px-3 py-2.5 mb-3 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (!note.trim() && !photoFile)}
            className="w-full min-h-[48px] rounded-[14px] bg-[#074738] text-white text-sm font-bold disabled:opacity-50 active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {submitting ? (
              <>
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <MaterialIcon name="check" className="text-base" />
                Guardar en historial
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
