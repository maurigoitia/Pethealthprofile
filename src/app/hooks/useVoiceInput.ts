import { useState, useRef, useCallback, useEffect } from "react";

interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
}

/**
 * Custom hook for Web Speech API integration with Spanish language support.
 * Uses SpeechRecognition (or webkit variant for browser compatibility).
 * Returns transcript and listening state for use in voice-enabled inputs.
 */
export function useVoiceInput(): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition on mount
  useEffect(() => {
    // Check browser support and create instance
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();

    // Configure for Spanish
    recognition.lang = "es-AR"; // Argentina Spanish preferred
    recognition.continuous = false;
    recognition.interimResults = true;

    // Handle incoming speech
    recognition.onresult = (event: any) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          setTranscript((prev) => prev + transcript);
        } else {
          interimTranscript += transcript;
        }
      }

      // Update UI with interim results during listening
      if (interimTranscript) {
        setTranscript((prev) => {
          // Keep final results and show interim
          const finalOnly = prev.split(" ").slice(0, -1).join(" ");
          return finalOnly ? finalOnly + " " + interimTranscript : interimTranscript;
        });
      }
    };

    // Stop listening when speech ends
    recognition.onend = () => {
      setIsListening(false);
    };

    // Handle errors gracefully
    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) return;

    setTranscript("");
    setIsListening(true);
    recognitionRef.current.start();
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
  };
}
