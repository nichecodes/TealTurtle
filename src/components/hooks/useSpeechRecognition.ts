import { useState, useEffect } from "react";
import { useOpenAI } from "./useOpenAI";
import { useSpeechSynthesis } from "./useSpeechSynthesis";


export const useSpeechRecognition = () => {
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [aiResponse, setAiResponse] = useState<string>("");
  let lastAiResponse = ""; // Track last AI response to avoid loops

  const { fetchAIResponse } = useOpenAI();
  const { speakText } = useSpeechSynthesis();

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("❌ Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US"; // Auto-detect language
    recognition.continuous = true; // ✅ Keep listening continuously
    recognition.interimResults = false; // ✅ Get only the final recognized speech

    recognition.onresult = async (event: any) => {
      if (isAiResponding) return; // ✅ Prevent capturing AI's own speech

      setIsAiResponding(true);

      const spokenText = event.results[event.results.length - 1][0].transcript.trim();
      console.log("🎤 User Said:", spokenText);

      const detectedLanguage = await detectLanguage(spokenText);
      console.log(`🌍 Detected Language: ${detectedLanguage}`);

      if (spokenText.toLowerCase() === lastAiResponse.toLowerCase()) {
        console.warn("🛑 Ignoring AI's own response to prevent looping.");
        return;
      }

      handleDetectedSpeech(spokenText, detectedLanguage);
    };

    recognition.onerror = (error: any) => {
      if (error.error === "no-speech") {
          console.warn("No speech detected. Restarting...");
          setTimeout(() => recognition.start(), 5000);
          return;
      }
      console.error("Speech Recognition Error:", error);
  };

    window.speechSynthesis.addEventListener("start", () => {
      console.log("🛑 Stopping speech recognition while AI is speaking...");
      recognition.abort(); // ✅ Immediate stop
    });

    window.speechSynthesis.addEventListener("end", () => {
      console.log("✅ AI speech finished. Resuming speech recognition...");
      setTimeout(() => {
        recognition.start();
      }, 4000);
    });

    recognition.start();
  }, []);

  async function handleDetectedSpeech(spokenText: string, language: string) {
    try {
      const aiText = await fetchAIResponse(spokenText);
      setAiResponse(aiText);
      lastAiResponse = aiText; // ✅ Store last response to prevent repetition
      await speakText(aiText, language);
    } catch (error) {
      console.error("❌ Error processing AI response:", error);
    }
  }

  const detectLanguage = async (text: string): Promise<string> => {
    const AZURE_OPENAI_API_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY;
    const AZURE_OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
    const DEPLOYMENT_NAME = import.meta.env.VITE_DEPLOYMENT_NAME;

    try {
      const response = await fetch(`${AZURE_OPENAI_ENDPOINT}/openai/deployments/${DEPLOYMENT_NAME}/chat/completions?api-version=2024-02-15-preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a language detection assistant. Identify the language of the given text and return only the language code (e.g., 'en' for English, 'es' for Spanish, 'fr' for French)." },
            { role: "user", content: text }
          ],
          max_tokens: 10
        }),
      });

      const data = await response.json();
      return data.choices[0]?.message?.content.trim() || "en"; // Default to English if detection fails
    } catch (error) {
      console.error("❌ Error detecting language:", error);
      return "en"; // Default fallback
    }
  };

  return { aiResponse, isAiResponding };
};