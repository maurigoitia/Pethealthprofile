import { useVoiceInput } from "../hooks/useVoiceInput";
import { useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { motion } from "motion/react";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Voice input button component with visual feedback.
 * Shows a microphone icon that pulses when listening.
 * Updates parent input field with transcribed speech.
 */
export function VoiceInputButton({
  onTranscript,
  disabled = false,
  className = "",
}: VoiceInputButtonProps) {
  const { isListening, transcript, startListening, stopListening, isSupported } =
    useVoiceInput();
  const prevTranscriptRef = useRef("");

  // When transcript changes and we stop listening, call parent callback
  useEffect(() => {
    if (!isListening && transcript && transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      onTranscript(transcript);
    }
  }, [isListening, transcript, onTranscript]);

  // Hide button if not supported
  if (!isSupported) {
    return null;
  }

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      disabled={disabled}
      aria-label={isListening ? "Dejar de escuchar" : "Tocar para hablar"}
      className={`relative shrink-0 ${className} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {isListening ? (
        <>
          {/* Pulsing circle background */}
          <motion.div
            className="absolute inset-0 rounded-full bg-red-500/20"
            animate={{ scale: [1, 1.3], opacity: [0.8, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <div className="relative size-10 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors">
            <MicOff className="size-5 text-white" />
          </div>
        </>
      ) : (
        <div className="relative size-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
          <Mic className="size-5 text-slate-600 dark:text-slate-300" />
        </div>
      )}
    </motion.button>
  );
}
