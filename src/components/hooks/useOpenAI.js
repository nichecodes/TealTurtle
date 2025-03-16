import { useState } from "react";

export const useOpenAI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAIResponse = async (userInput) => {
    setIsLoading(true);
    setError(null);

    const AZURE_OPENAI_API_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY;
    const AZURE_OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
    const DEPLOYMENT_NAME = import.meta.env.VITE_DEPLOYMENT_NAME;

    try {
      const response = await fetch(
        `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${DEPLOYMENT_NAME}/chat/completions?api-version=2024-02-15-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            messages: [
              {
                role: "system",
                content:
                  "You're a friendly AI physician assistant for kids. Your tasked with explaining to very young kids how " +
                  "diseases affect certain parts of the body that they ask about. Use simple language and examples that a " +
                  "5-year-old can understand. Avoid complex medical terms and provide clear, relatable explanations.",
              },
              { role: "user", content: userInput },
            ],
            max_tokens: 100,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${data.error?.message || "Unknown error"}`);
      }

      return data.choices[0]?.message?.content || "No response received.";
    } catch (err) {
      console.error("❌ OpenAI API Error:", err);
      setError(err.message);
      return "I couldn't process your request.";
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchAIResponse, isLoading, error };
};

export default useOpenAI;