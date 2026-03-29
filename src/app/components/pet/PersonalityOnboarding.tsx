/**
 * PersonalityOnboarding — one-time quiz, Tinder-style auto-advance
 *
 * Shows once per pet after install/update. 5 questions, tap → instantly
 * advances (no "Siguiente" button). Saves all answers + onboardingComplete
 * to Firestore: users/{uid}/pets/{petId}/personality/{topic}.
 *
 * Called from PetHomeView when personality.onboardingComplete is not set.
 */

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";

// ─── Animated Cork (dog) ───────────────────────────────────────────────────

function AnimatedCork({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 60 72" width={size} height={size * 1.2} style={{ display: "block", overflow: "visible" }}>
      <style>{`
        .cork-ear-r {
          transform-box: fill-box;
          transform-origin: bottom center;
          transform: rotate(18deg);
          animation: corkEarWiggle 2.8s ease-in-out infinite;
        }
        .cork-ear-l {
          transform-box: fill-box;
          transform-origin: bottom center;
          transform: rotate(-18deg);
          animation: corkEarWiggle 2.8s ease-in-out infinite 0.3s;
        }
        .cork-tail {
          transform-box: fill-box;
          transform-origin: 0% 100%;
          animation: corkTailWag 1.4s ease-in-out infinite;
        }
        @keyframes corkEarWiggle {
          0%, 100% { transform: rotate(18deg); }
          50% { transform: rotate(24deg); }
        }
        @keyframes corkTailWag {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(22deg); }
          75% { transform: rotate(-14deg); }
        }
      `}</style>
      {/* Body */}
      <ellipse cx="30" cy="56" rx="15" ry="11" fill="#d4ede8" stroke="#074738" strokeWidth="1.5" />
      {/* Tail */}
      <path className="cork-tail" d="M44 52 Q54 43 51 36" stroke="#1A9B7D" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* Head */}
      <circle cx="30" cy="30" r="14" fill="#d4ede8" stroke="#074738" strokeWidth="1.5" />
      {/* Left ear */}
      <ellipse className="cork-ear-l" cx="18" cy="18" rx="5.5" ry="9" fill="#1A9B7D" stroke="#074738" strokeWidth="1.5" />
      {/* Right ear */}
      <ellipse className="cork-ear-r" cx="42" cy="18" rx="5.5" ry="9" fill="#1A9B7D" stroke="#074738" strokeWidth="1.5" />
      {/* Eyes */}
      <circle cx="25" cy="28" r="2.5" fill="#074738" />
      <circle cx="35" cy="28" r="2.5" fill="#074738" />
      <circle cx="25.8" cy="27" r="1" fill="white" />
      <circle cx="35.8" cy="27" r="1" fill="white" />
      {/* Nose */}
      <ellipse cx="30" cy="35" rx="4" ry="3" fill="#074738" />
      {/* Smile */}
      <path d="M24 38 Q30 44 36 38" stroke="#074738" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Legs */}
      <rect x="22" y="60" width="6" height="8" rx="3" fill="#d4ede8" stroke="#074738" strokeWidth="1.5" />
      <rect x="32" y="60" width="6" height="8" rx="3" fill="#d4ede8" stroke="#074738" strokeWidth="1.5" />
    </svg>
  );
}

// ─── Animated Fizz (cat) ──────────────────────────────────────────────────

function AnimatedFizz({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 60 72" width={size} height={size * 1.2} style={{ display: "block", overflow: "visible" }}>
      <style>{`
        .fizz-tail {
          transform-box: fill-box;
          transform-origin: 0% 100%;
          animation: fizzTailCurl 2s ease-in-out infinite;
        }
        @keyframes fizzTailCurl {
          0%, 100% { transform: rotate(0deg); }
          40% { transform: rotate(18deg); }
          70% { transform: rotate(-8deg); }
        }
      `}</style>
      {/* Body */}
      <ellipse cx="30" cy="57" rx="13" ry="10" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
      {/* Tail */}
      <path className="fizz-tail" d="M43 54 Q54 46 50 38" stroke="#F4A261" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* Head */}
      <circle cx="30" cy="30" r="14" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
      {/* Pointed ears */}
      <polygon points="16,20 11,6 23,14" fill="#F4A261" stroke="#C67B3A" strokeWidth="1.5" strokeLinejoin="round" />
      <polygon points="44,20 49,6 37,14" fill="#F4A261" stroke="#C67B3A" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Eyes */}
      <ellipse cx="25" cy="28" rx="2.5" ry="3" fill="#5C3A1E" />
      <ellipse cx="35" cy="28" rx="2.5" ry="3" fill="#5C3A1E" />
      <circle cx="25.8" cy="27" r="1" fill="white" />
      <circle cx="35.8" cy="27" r="1" fill="white" />
      {/* Nose */}
      <ellipse cx="30" cy="34" rx="2.5" ry="1.8" fill="#E8856A" />
      {/* Whiskers */}
      <line x1="14" y1="33" x2="25" y2="34" stroke="#C67B3A" strokeWidth="0.8" />
      <line x1="14" y1="36" x2="25" y2="35" stroke="#C67B3A" strokeWidth="0.8" />
      <line x1="46" y1="33" x2="35" y2="34" stroke="#C67B3A" strokeWidth="0.8" />
      <line x1="46" y1="36" x2="35" y2="35" stroke="#C67B3A" strokeWidth="0.8" />
      {/* Smile */}
      <path d="M26 37 Q30 41 34 37" stroke="#C67B3A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Paws */}
      <ellipse cx="24" cy="64" rx="5" ry="4" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
      <ellipse cx="36" cy="64" rx="5" ry="4" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
    </svg>
  );
}

// ─── Questions ─────────────────────────────────────────────────────────────

const ONBOARDING_QUESTIONS: Array<{
  topic: string;
  question: (name: string) => string;
  options: Array<{ label: string; value: string; emoji: string }>;
}> = [
  {
    topic: "sleep_habits",
    question: (n) => `¿${n} duerme con vos?`,
    options: [
      { label: "Con vos", value: "with_owner", emoji: "🛏️" },
      { label: "Solo", value: "alone", emoji: "🏠" },
      { label: "Varía", value: "varies", emoji: "🤷" },
    ],
  },
  {
    topic: "training_level",
    question: (n) => `¿${n} sabe comandos básicos?`,
    options: [
      { label: "Sí", value: "trained", emoji: "✅" },
      { label: "Algunos", value: "partial", emoji: "🤔" },
      { label: "Ninguno", value: "none", emoji: "❌" },
    ],
  },
  {
    topic: "noise_sensitivity",
    question: (n) => `¿${n} se asusta con ruidos fuertes?`,
    options: [
      { label: "Mucho", value: "sensitive", emoji: "😰" },
      { label: "A veces", value: "moderate", emoji: "😐" },
      { label: "Para nada", value: "calm", emoji: "😌" },
    ],
  },
  {
    topic: "exercise_level",
    question: (n) => `¿Cuánto ejercicio hace ${n}?`,
    options: [
      { label: "Mucho", value: "high", emoji: "🏃" },
      { label: "Normal", value: "moderate", emoji: "🚶" },
      { label: "Poco", value: "low", emoji: "🛋️" },
    ],
  },
  {
    topic: "favorite_activity",
    question: (n) => `¿Qué le gusta más a ${n}?`,
    options: [
      { label: "Salir al parque", value: "park", emoji: "🌳" },
      { label: "Jugar en casa", value: "home", emoji: "🏠" },
      { label: "Socializar", value: "social", emoji: "🐾" },
    ],
  },
];

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  petName: string;
  petId: string;
  species?: "dog" | "cat";
  onComplete: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function PersonalityOnboarding({ petName, petId, species, onComplete }: Props) {
  const { user } = useAuth();
  // step 0 = intro, 1-5 = questions, 6 = done
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const Mascot = species === "cat" ? AnimatedFizz : AnimatedCork;
  const totalQuestions = ONBOARDING_QUESTIONS.length;
  const questionStep = step - 1; // 0-indexed question index

  const handleAnswer = (topic: string, value: string) => {
    const newAnswers = { ...answers, [topic]: value };
    setAnswers(newAnswers);

    if (step < totalQuestions) {
      // Auto-advance immediately — no button
      setStep(step + 1);
    } else {
      // Last question answered — save and finish
      setStep(6);
      void saveAll(newAnswers);
    }
  };

  const saveAll = async (finalAnswers: Record<string, string>) => {
    if (!user) { onComplete(); return; }
    setSaving(true);
    try {
      const base = ["users", user.uid, "pets", petId, "personality"] as const;
      const writes = Object.entries(finalAnswers).map(([topic, value]) =>
        setDoc(doc(db, ...base, topic), { value, savedAt: new Date().toISOString() })
      );
      await Promise.all([
        ...writes,
        setDoc(doc(db, ...base, "onboardingComplete"), { value: "done", savedAt: new Date().toISOString() }),
      ]);
    } catch (e) {
      console.error("[PersonalityOnboarding] save failed", e);
    } finally {
      setSaving(false);
      // Auto-dismiss done screen after 1.8s
      setTimeout(onComplete, 1800);
    }
  };

  const handleSkip = () => {
    if (!user) { onComplete(); return; }
    void setDoc(
      doc(db, "users", user.uid, "pets", petId, "personality", "onboardingComplete"),
      { value: "skipped", savedAt: new Date().toISOString() }
    ).catch(() => {});
    onComplete();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={handleSkip} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-w-md mx-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* ── INTRO ── */}
        {step === 0 && (
          <div className="px-6 pb-6 pt-2">
            <div className="flex flex-col items-center text-center">
              <div className="my-4">
                <Mascot size={64} />
              </div>
              <h2 className="text-lg font-black text-[#074738]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Pessy quiere conocer mejor a {petName}
              </h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                5 preguntas rápidas para personalizar los consejos. Menos de 30 segundos.
              </p>
              <button
                onClick={() => setStep(1)}
                className="mt-6 w-full py-4 rounded-2xl bg-[#074738] text-white font-bold text-base active:scale-[0.97] transition-transform"
              >
                Empezar
              </button>
              <button onClick={handleSkip} className="mt-3 text-sm text-slate-400 py-2">
                Saltar por ahora
              </button>
            </div>
          </div>
        )}

        {/* ── QUESTIONS 1-5 ── */}
        {step >= 1 && step <= totalQuestions && (() => {
          const q = ONBOARDING_QUESTIONS[questionStep]!;
          return (
            <div className="px-5 pb-6 pt-2">
              {/* Progress */}
              <div className="flex gap-1.5 mb-5">
                {ONBOARDING_QUESTIONS.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < step ? "bg-[#1A9B7D]" : "bg-slate-100"}`} />
                ))}
              </div>

              {/* Mascot + question */}
              <div className="flex items-start gap-3 mb-5">
                <div className="shrink-0">
                  <Mascot size={44} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">
                    {step} de {totalQuestions}
                  </p>
                  <p className="text-base font-black text-[#074738] leading-snug" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {q.question(petName)}
                  </p>
                </div>
              </div>

              {/* Options — tap = auto-advance */}
              <div className="flex gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleAnswer(q.topic, opt.value)}
                    className="flex-1 py-4 rounded-2xl border-2 border-[#E5E7EB] flex flex-col items-center gap-1.5 active:scale-[0.95] transition-transform hover:border-[#1A9B7D] hover:bg-[#F0FAF9]"
                  >
                    <span className="text-2xl leading-none">{opt.emoji}</span>
                    <span className="text-xs font-bold text-slate-700 text-center leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>

              <button onClick={handleSkip} className="mt-4 w-full text-xs text-slate-400 py-1">
                Saltar
              </button>
            </div>
          );
        })()}

        {/* ── DONE ── */}
        {step === 6 && (
          <div className="px-6 pb-8 pt-2">
            <div className="flex flex-col items-center text-center">
              <div className="my-4 animate-bounce" style={{ animationDuration: "0.8s" }}>
                <Mascot size={64} />
              </div>
              <div className="flex gap-2 mb-3">
                {["⭐", "✨", "🌟", "⭐", "✨"].map((s, i) => (
                  <span key={i} className="text-xl animate-bounce inline-block"
                    style={{ animationDelay: `${i * 80}ms`, animationDuration: "0.6s" }}>{s}</span>
                ))}
              </div>
              <h2 className="text-lg font-black text-[#074738]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                ¡Listo! Pessy ya conoce a {petName}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {saving ? "Guardando…" : "Los consejos ahora son personalizados 🎉"}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
