import React, { useRef, useEffect, useState } from "react";
import * as posenet from "@tensorflow-models/posenet";

// Define a TypeScript interface for PoseNet keypoints
interface Keypoint {
  part: string;
  position: { x: number; y: number };
  score: number;
}

interface Pose {
  keypoints: Keypoint[];
}

// Function to call Azure OpenAI API.
const fetchAIResponse = async (userInput: string) => {
  const AZURE_OPENAI_API_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY;  // Store in .env
  const AZURE_OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT; // Stored in .env
  const DEPLOYMENT_NAME = import.meta.env.VITE_DEPLOYMENT_NAME; // Stored in .env

  const response = await fetch(`${AZURE_OPENAI_ENDPOINT}/openai/deployments/${DEPLOYMENT_NAME}/chat/completions?api-version=2024-02-15-preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_OPENAI_API_KEY,  // Azure uses "api-key" instead of "Authorization"
    },
    body: JSON.stringify({
      messages: [{ role: "system", content: "You're a friendly AI doctor for kids." },
                 { role: "user", content: userInput }],
      max_tokens: 50  // Reduce token usage for cheaper costs
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
};



// Function to make the AI speak
const speakText = (text: string): void => {
  const utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utterance);
};

const PoseDetection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [aiResponse, setAiResponse] = useState<string>("");

  useEffect(() => {
    async function setupCamera(): Promise<void> {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }

    async function loadPoseNet(): Promise<posenet.PoseNet> {
      return await posenet.load();
    }

    async function detectPose(net: posenet.PoseNet): Promise<void> {
      if (!videoRef.current) return;

      const pose = await net.estimateSinglePose(videoRef.current, {
        flipHorizontal: false,
      });

      // Detect specific gestures
      let userInput = "";
      if (isHandRaised(pose)) {
        userInput = "The child raised their hand. How should I respond?";
      } else if (isHeadTilted(pose)) {
        userInput = "The child tilted their head. Do they feel dizzy?";
      }

      // If a gesture is detected, call AI for response
      if (userInput) {
        const aiText = await fetchAIResponse(userInput);
        setAiResponse(aiText);
        speakText(aiText);
      }

      requestAnimationFrame(() => detectPose(net));
    }

    async function runPoseDetection(): Promise<void> {
      await setupCamera();
      const net = await loadPoseNet();
      detectPose(net);
    }

    runPoseDetection();
  }, []);

  // Helper function: Detect if hand is raised
  function isHandRaised(pose: Pose): boolean {
    const leftWrist = pose.keypoints.find((kp) => kp.part === "leftWrist");
    const rightWrist = pose.keypoints.find((kp) => kp.part === "rightWrist");
    const nose = pose.keypoints.find((kp) => kp.part === "nose");

    return !!leftWrist && !!nose && leftWrist.position.y < nose.position.y ||
           !!rightWrist && !!nose && rightWrist.position.y < nose.position.y;
  }

  // Helper function: Detect if head is tilted
  function isHeadTilted(pose: Pose): boolean {
    const leftEar = pose.keypoints.find((kp) => kp.part === "leftEar");
    const rightEar = pose.keypoints.find((kp) => kp.part === "rightEar");

    return !!leftEar && !!rightEar && Math.abs(leftEar.position.y - rightEar.position.y) > 20;
  }

  return (
    <div>
      <h2>Interactive AI for Kids</h2>
      <video ref={videoRef} autoPlay playsInline />
      <h3>AI Response: {aiResponse}</h3>
    </div>
  );
};

export default PoseDetection;
