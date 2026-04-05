import { useState, useEffect } from "react";
import { X, Play, Pause, Square, MapPin, Clock, Zap, Navigation } from "lucide-react";
import { useWalks } from "../../contexts/WalkContext";
import { useGPSTracking } from "../../hooks/useGPSTracking";

// Post-walk learning questions — Pessy aprende de a una por paseo
const POST_WALK_QUESTIONS = [
  { id: "enjoyed", text: "¿Cómo estuvo el paseo?", options: ["🤩 Genial", "😊 Bien", "😐 Normal"] },
  { id: "location", text: "¿A dónde fueron?", options: ["🌳 Parque", "🏙️ Por el barrio", "🏖️ Otro lugar"] },
  { id: "social", text: "¿Se cruzó con otros perros?", options: ["🐕 Sí, jugó", "👀 Sí, de lejos", "🚶 No"] },
  { id: "energy", text: "¿Cómo volvió?", options: ["💤 Agotado", "😊 Bien", "⚡ Con más ganas"] },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface WalkLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  petId: string;
  petName: string;
}

type ModalStep = "idle" | "tracking" | "post-walk-question" | "manual" | "saving";

export function WalkLogModal({ isOpen, onClose, petId, petName }: WalkLogModalProps) {
  const { addWalk } = useWalks();
  const gps = useGPSTracking();

  const [step, setStep] = useState<ModalStep>("idle");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [contextAnswers, setContextAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [manualMinutes, setManualMinutes] = useState("30");
  const [manualKm, setManualKm] = useState("");

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      gps.resetTracking();
      setStep("idle");
      setQuestionIndex(0);
      setContextAnswers({});
      setNotes("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Handlers ────────────────────────────────────────────────

  const handleStartGPS = async () => {
    const ok = await gps.startTracking();
    if (ok) setStep("tracking");
  };

  const handleStop = () => {
    gps.stopTracking();
    setStep("post-walk-question");
    setQuestionIndex(0);
  };

  const handleAnswerQuestion = (answer: string) => {
    const q = POST_WALK_QUESTIONS[questionIndex];
    const updated = { ...contextAnswers, [q.id]: answer };
    setContextAnswers(updated);

    if (questionIndex < POST_WALK_QUESTIONS.length - 1) {
      setQuestionIndex((i) => i + 1);
    } else {
      saveWalk(updated);
    }
  };

  const handleSkipQuestions = () => saveWalk(contextAnswers);

  const saveWalk = (answers: Record<string, string> = contextAnswers) => {
    const durationMinutes = Math.max(1, Math.round(gps.durationSeconds / 60));
    addWalk({
      petId,
      date: new Date().toISOString(),
      durationMinutes,
      distanceKm: gps.distanceKm > 0 ? gps.distanceKm : undefined,
      route: gps.route.length > 0 ? gps.route : undefined,
      averageSpeedKmh: gps.averageSpeedKmh > 0 ? gps.averageSpeedKmh : undefined,
      startedAt: gps.route[0] ? new Date(gps.route[0].timestamp).toISOString() : undefined,
      endedAt: new Date().toISOString(),
      notes: notes.trim() || undefined,
      contextAnswers: Object.keys(answers).length > 0 ? answers : undefined,
    });
    gps.resetTracking();
    onClose();
  };

  const saveManual = () => {
    const mins = parseInt(manualMinutes);
    if (!mins || mins <= 0) return;
    addWalk({
      petId,
      date: new Date().toISOString(),
      durationMinutes: mins,
      distanceKm: manualKm ? parseFloat(manualKm) : undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={step === "idle" ? onClose : undefined} />

      <div className="relative w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-t-3xl overflow-hidden">

        {/* ── IDLE: choose mode ── */}
        {step === "idle" && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Salir a pasear</h2>
                <p className="text-xs text-slate-500 mt-0.5">{petName}</p>
              </div>
              <button onClick={onClose} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <X size={18} className="text-slate-600 dark:text-slate-300" />
              </button>
            </div>

            {/* GPS option */}
            <button
              onClick={handleStartGPS}
              className="w-full p-5 rounded-2xl bg-[#074738] text-white flex items-center gap-4 hover:bg-[#053729] transition-colors"
            >
              <div className="size-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Navigation size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-base">Rastrear con GPS</p>
                <p className="text-xs text-white/70 mt-0.5">Distancia, ruta y tiempo automático</p>
              </div>
            </button>

            {/* Manual option */}
            <button
              onClick={() => setStep("manual")}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="size-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <Clock size={22} className="text-slate-600 dark:text-slate-400" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-slate-900 dark:text-white">Registrar manualmente</p>
                <p className="text-xs text-slate-500 mt-0.5">Si ya volvieron del paseo</p>
              </div>
            </button>

            {gps.permissionStatus === "denied" && (
              <p className="text-xs text-orange-500 text-center">
                GPS bloqueado. Habilitá el permiso en Configuración → Pessy → Ubicación.
              </p>
            )}
          </div>
        )}

        {/* ── TRACKING: live GPS ── */}
        {step === "tracking" && (
          <div className="p-6 space-y-6">
            {/* Live stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={<Clock size={18} className="text-[#074738]" />}
                value={formatDuration(gps.durationSeconds)}
                label="Tiempo"
              />
              <StatCard
                icon={<MapPin size={18} className="text-[#074738]" />}
                value={gps.distanceKm > 0 ? `${gps.distanceKm.toFixed(2)} km` : "— km"}
                label="Distancia"
              />
              <StatCard
                icon={<Zap size={18} className="text-[#074738]" />}
                value={gps.averageSpeedKmh > 0 ? `${gps.averageSpeedKmh} km/h` : "—"}
                label="Velocidad"
              />
            </div>

            {/* GPS status */}
            <div className="flex items-center gap-2 justify-center">
              <span className={`size-2 rounded-full ${gps.currentPosition ? "bg-green-500 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
              <span className="text-xs text-slate-500">
                {gps.currentPosition
                  ? `GPS activo · ${gps.route.length} puntos registrados`
                  : "Buscando señal GPS..."}
              </span>
            </div>

            {gps.error && (
              <p className="text-xs text-red-500 text-center">{gps.error}</p>
            )}

            {/* Pet name banner */}
            <div className="text-center py-2">
              <p className="text-sm text-slate-500">Paseando con</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{petName} 🐾</p>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              <button
                onClick={gps.isPaused ? gps.resumeTracking : gps.pauseTracking}
                className="flex-1 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {gps.isPaused ? <Play size={20} /> : <Pause size={20} />}
                {gps.isPaused ? "Continuar" : "Pausar"}
              </button>
              <button
                onClick={handleStop}
                className="flex-1 py-4 rounded-2xl bg-red-500 text-white flex items-center justify-center gap-2 font-bold hover:bg-red-600 transition-colors"
              >
                <Square size={18} />
                Terminar
              </button>
            </div>
          </div>
        )}

        {/* ── POST-WALK QUESTION ── */}
        {step === "post-walk-question" && (
          <div className="p-6 space-y-6">
            {/* Summary */}
            <div className="bg-[#074738]/10 rounded-2xl p-4 flex justify-around">
              <div className="text-center">
                <p className="text-lg font-bold text-[#074738]">{formatDuration(gps.durationSeconds)}</p>
                <p className="text-xs text-slate-500">Duración</p>
              </div>
              {gps.distanceKm > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-[#074738]">{gps.distanceKm.toFixed(2)} km</p>
                  <p className="text-xs text-slate-500">Distancia</p>
                </div>
              )}
              {gps.route.length > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-[#074738]">{gps.route.length}</p>
                  <p className="text-xs text-slate-500">Puntos GPS</p>
                </div>
              )}
            </div>

            {/* Learning question */}
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[#074738] font-bold uppercase tracking-wide mb-1">
                  Pessy aprende · {questionIndex + 1}/{POST_WALK_QUESTIONS.length}
                </p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {POST_WALK_QUESTIONS[questionIndex].text}
                </h3>
              </div>
              <div className="space-y-2">
                {POST_WALK_QUESTIONS[questionIndex].options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleAnswerQuestion(opt)}
                    className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left font-medium text-slate-800 dark:text-white hover:border-[#074738] hover:bg-[#074738]/5 transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <button
                onClick={handleSkipQuestions}
                className="w-full text-xs text-slate-400 hover:text-slate-600 py-2 transition-colors"
              >
                Saltar y guardar
              </button>
            </div>
          </div>
        )}

        {/* ── MANUAL ── */}
        {step === "manual" && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registrar paseo</h2>
              <button onClick={onClose} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-900 dark:text-white">Duración (minutos)</label>
              <input
                type="number" min="1" max="600" value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]"
                placeholder="30"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-900 dark:text-white">
                Distancia (km) <span className="text-xs font-normal text-slate-500">— opcional</span>
              </label>
              <input
                type="number" min="0" step="0.1" value={manualKm}
                onChange={(e) => setManualKm(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]"
                placeholder="2.5"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-900 dark:text-white">
                ¿Cómo estuvo? <span className="text-xs font-normal text-slate-500">— opcional</span>
              </label>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={150} rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738] resize-none"
                placeholder="Fue al parque, jugó con otros perros..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("idle")}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-700 dark:text-slate-300"
              >
                Volver
              </button>
              <button
                onClick={saveManual}
                className="flex-1 py-3 rounded-xl bg-[#074738] text-white font-bold text-sm hover:bg-[#053729] transition-colors"
              >
                Guardar paseo
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 text-center space-y-1">
      <div className="flex justify-center">{icon}</div>
      <p className="text-base font-bold text-slate-900 dark:text-white leading-none">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
