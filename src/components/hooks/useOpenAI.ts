import { useState } from "react";

export const useOpenAI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAIResponse = async (userInput: string): Promise<string> => {
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
            "api-key": AZURE_OPENAI_API_KEY, // Azure uses "api-key" instead of "Authorization"
          },
          body: JSON.stringify({
            messages: [
              {
                role: "system",
                content:
                  "You're a friendly AI doctor for kids. Provide warm, encouraging responses based on detected gestures and spoken words.",
              },
              { role: "user", content: userInput },
            ],
            max_tokens: 100, // Limit response length
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${data.error?.message || "Unknown error"}`);
      }

      return data.choices[0]?.message?.content || "No response received.";
    } catch (err: any) {
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