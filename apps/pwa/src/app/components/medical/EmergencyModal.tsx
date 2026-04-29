import { useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../../lib/firebase";
import { MaterialIcon } from "../shared/MaterialIcon";
import { usePet } from "../../contexts/PetContext";
import { useAuth } from "../../contexts/AuthContext";
import { useMedical } from "../../contexts/MedicalContext";
import { MedicalEvent } from "../../types/medical";

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * "Pasó algo" — Tutor-confirmed incident logger.
 * No diagnosis. No AI. Pure tutor input saved as a medical_event with
 * source: "tutor_input" so the export safety layer routes it to observations.
 */
export function EmergencyModal({ isOpen, onClose }: EmergencyModalProps) {
  const { user } = useAuth();
  const { activePet } = usePet();
  const { addEvent } = useMedical();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const trimmedNote = note.trim();
  const canSave = (!!photoFile || trimmedNote.length > 0) && !submitting && !!activePet;

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleClose = () => {
    if (submitting) return;
    setNote("");
    setPhotoFile(null);
    setPhotoPreview("");
    setError("");
    onClose();
  };

  const formatDateLabel = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso.slice(0, 10);
    }
  };

  const handleSave = async () => {
    if (!activePet || !user) {
      setError("Iniciá sesión y seleccioná una mascota.");
      return;
    }
    if (!photoFile && !trimmedNote) {
      setError("Agregá una foto o una nota.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      let documentUrl = "";
      if (photoFile) {
        const path = `documents/${user.uid}/${Date.now()}_incident.jpg`;
        const sref = ref(storage, path);
        const uploaded = await uploadBytes(sref, photoFile);
        documentUrl = await getDownloadURL(uploaded.ref);
      }

      const now = new Date().toISOString();
      const title = `Incidente registrado · ${formatDateLabel(now)}`;

      const newEvent = {
        id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        petId: activePet.id,
        userId: user.uid,
        title,
        documentType: "incident",
        source: "tutor_input",
        documentUrl: documentUrl || "",
        documentPreviewUrl: documentUrl || null,
        fileName: photoFile?.name || "",
        fileType: "image",
        status: "completed",
        ocrProcessed: false,
        aiProcessed: false,
        validatedByHuman: true,
        sourceTruthLevel: "human_confirmed",
        truthStatus: "human_confirmed",
        requiresManualConfirmation: false,
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
          notes: trimmedNote || null,
          medications: [],
          measurements: [],
          suggestedTitle: title,
          aiGeneratedSummary: "",
          nextAppointmentDate: null,
          nextAppointmentDateConfidence: "not_detected",
        } as any,
        createdAt: now,
        updatedAt: now,
        relatedEventIds: [],
        aiSuggestedRelation: null,
      } as unknown as MedicalEvent;

      const ok = await addEvent(newEvent);
      if (!ok) {
        setError("No se pudo guardar. Intentá de nuevo.");
        return;
      }

      setNote("");
      setPhotoFile(null);
      setPhotoPreview("");
      onClose();
    } catch (e: any) {
      console.error("[EmergencyModal] error:", e);
      setError(e?.message || "Error al guardar el incidente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <div className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-[24px] max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto px-5 py-5">
          {/* Drag handle */}
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />

          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>⚠️</span>
              <h2 className="text-xl font-black text-slate-900">Pasó algo</h2>
            </div>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="size-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 disabled:opacity-50"
              aria-label="Cerrar"
            >
              <MaterialIcon name="close" className="text-lg" />
            </button>
          </div>

          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            Anotá lo que viste. Sumá una foto si querés. Queda guardado en el historial para consultar luego con tu veterinario.
          </p>

          {/* Photo */}
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoPick}
              className="hidden"
            />
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Foto del incidente"
                  className="w-full h-48 object-cover rounded-[14px]"
                />
                <button
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview("");
                  }}
                  disabled={submitting}
                  className="absolute top-2 right-2 size-9 rounded-full bg-black/60 text-white flex items-center justify-center"
                  aria-label="Quitar foto"
                >
                  <MaterialIcon name="close" className="text-lg" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="w-full p-4 rounded-[14px] border-2 border-dashed border-slate-300 flex items-center justify-center gap-2 text-slate-600 hover:border-[#B91C1C] hover:text-[#B91C1C] transition-colors"
              >
                <MaterialIcon name="photo_camera" className="text-xl" />
                <span className="font-bold text-sm">Tomar o subir foto (opcional)</span>
              </button>
            )}
          </div>

          {/* Note */}
          <div className="mb-4">
            <label htmlFor="incident-note" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Nota (opcional)
            </label>
            <textarea
              id="incident-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contá brevemente qué pasó..."
              maxLength={500}
              rows={4}
              disabled={submitting}
              className="w-full p-3 rounded-[12px] border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#B91C1C] resize-none"
            />
            <div className="text-right text-[11px] text-slate-400 mt-1">
              {note.length}/500
            </div>
          </div>

          {error && (
            <div className="mb-3 p-3 rounded-[12px] bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 rounded-[14px] bg-slate-100 text-slate-700 font-bold disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 px-4 py-3 rounded-[14px] bg-[#B91C1C] text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#991B1B] transition-colors"
            >
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
