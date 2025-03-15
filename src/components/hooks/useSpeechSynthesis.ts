export const useSpeechSynthesis = () => {

  window.speechSynthesis.onvoiceschanged = () => {
    console.log("Voices Loaded:", window.speechSynthesis.getVoices());
  };

  const speakText = (text: string, language: string = "en"): Promise<void> => {
    return new Promise((resolve) => {
      const voices = window.speechSynthesis.getVoices();

      // ✅ Pick a voice that matches the detected language
      const selectedVoice = voices.find(voice => voice.lang.startsWith(language)) || voices[0];

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = selectedVoice;
      utterance.pitch = 1.1; // Friendly pitch
      utterance.rate = 0.9;  // Slightly slower for clarity
      utterance.volume = 1.0; // Full volume

      utterance.onend = () => {
        console.log("🗣️ Speech finished.");
        resolve();
      };

      speechSynthesis.speak(utterance);
    });
  };

  return { speakText };
};
  