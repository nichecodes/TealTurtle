import React, { useRef, useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl"; // Ensure WebGL is loaded
import * as posenet from "@tensorflow-models/posenet";

import { useOpenAI } from "./hooks/useOpenAI";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";


// TypeScript interface for PoseNet keypoints
interface Keypoint {
  part: string;
  position: { x: number; y: number };
  score: number;
}

interface Pose {
  keypoints: Keypoint[];
}

// Load and initialize PoseNet.
const loadPoseNet = async (): Promise<posenet.PoseNet | null> => {
  try {
    // Check if WebGL is available; if not, fallback to CPU.
    const isWebGLAvailable = tf.ENV.get("WEBGL_RENDER_FLOAT32_CAPABLE");
    console.log("WebGL Supported:", isWebGLAvailable);

    if (isWebGLAvailable) {
      await tf.setBackend("webgl"); // Use WebGL if available
    } else {
      console.warn("WebGL is not supported, switching to CPU backend.");
      await tf.setBackend("cpu"); // Fallback to CPU
    }
    await tf.ready(); // Wait until TensorFlow is fully initialized

    console.log("TensorFlow.js backend:", tf.getBackend());

    const net = await posenet.load({
      architecture: "ResNet50", // More accurate model
      outputStride: 32,
      inputResolution: { width: 640, height: 480 },
      quantBytes: 2,
    });

    console.log("PoseNet Loaded");
    return net;
  } catch (error) {
    console.error("Error loading PoseNet:", error);
    return null;
  }
};

const PoseDetection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isAiResponding, setIsAiResponding] = useState(false); // Prevent multiple API calls.

  const { fetchAIResponse, isLoading, error } = useOpenAI();
  const { speakText } = useSpeechSynthesis();

  useEffect(() => {

    const setupCamera = async (): Promise<void> => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
    
        // Ensure video metadata is loaded before processing frames
        await new Promise<void>((resolve) => {
          videoRef.current!.onloadedmetadata = () => {
            console.log("Video Loaded:", videoRef.current!.videoWidth, "x", videoRef.current!.videoHeight);
            resolve();
          };
        });
    
        console.log("Camera is ready:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
      }
    };

    async function detectPose(net: posenet.PoseNet): Promise<void> {
      if (!videoRef.current || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0 || !canvasRef.current) {
        console.warn("Skipping pose detection: Video is not ready");
        return;
      }

      // Prevent detection while AI is speaking.
      if (isAiResponding) return;

      // Set lock to prevent multiple API calls.
      setIsAiResponding(true);

      const inputTensor = tf.browser.fromPixels(videoRef.current);
      const pose = await net.estimateSinglePose(inputTensor, {
        flipHorizontal: false,
      });
      inputTensor.dispose(); // Need to dispose the tensor to free up memory.

      //console.log("Pose Data:", pose.keypoints.map(kp => `${kp.part}: (${kp.position.x}, ${kp.position.y})`));
      // !!!!!!!!!!!!!!!!!!! START Troubleshoot Keypoint Detection Section !!!!!!!!!!!!!!!!!!!!!!!
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.fillStyle = "red";

      pose.keypoints.forEach((kp) => {
        if (kp.score > 0.3) {
          ctx.beginPath();
          ctx.arc(kp.position.x, kp.position.y, 5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      if (!pose || pose.keypoints.every((kp) => kp.score < 0.3)) {
        console.warn("No clear pose detected.");
        return;
      }
      // !!!!!!!!!!!!!!!!!!! END Troubleshoot Keypoint Detection Section !!!!!!!!!!!!!!!!!!!!!!!

      // Detect specific gestures.
      let userInput = "";
      if (isHandRaised(pose)) {
        console.log("The child raised their hand. How should I respond?");
        userInput = "The child raised their hand. How should I respond?";
      } else if (isHeadTilted(pose)) {
        console.log("The child tilted their head. Do they feel dizzy?");
        userInput = "The child tilted their head. Do they feel dizzy?";
      }
      else {
        requestAnimationFrame(() => detectPose(net));
      }
      
      // If an API call is already running, do not proceed.
      if (!userInput || isAiResponding) return;

      // If a gesture is detected, call AI for response.
      try {
        const aiText = await fetchAIResponse(userInput);
        setAiResponse(aiText);
        
        // Wait for AI speech to finish before detecting again.
        await speakText(aiText);
        
      } catch (error) {
        console.error("Error in AI response:", error);
      }

      requestAnimationFrame(() => detectPose(net));
    }

    async function runPoseDetection(): Promise<void> {
      await setupCamera();
      const net = await loadPoseNet(); // `net` might be null if loading fails
      
      // Stop execution if PoseNet didn't load.
      if (!net) {
        console.error("PoseNet failed to load.");
        return; 
      }
    
      detectPose(net);
    }

    runPoseDetection();
    listenForSpeech();
  }, []);

  // Helper function: Detect if hand is raised
  function isHandRaised(pose: posenet.Pose): boolean {
    const leftWrist = pose.keypoints.find((kp) => kp.part === "leftWrist");
    const rightWrist = pose.keypoints.find((kp) => kp.part === "rightWrist");
    const nose = pose.keypoints.find((kp) => kp.part === "nose");
  
    //console.log("Left Wrist:", leftWrist);
    //console.log("Right Wrist:", rightWrist);
    //console.log("Nose:", nose);
  
    if (!leftWrist || !rightWrist || !nose) return false;
  
    return leftWrist.position.y < nose.position.y || rightWrist.position.y < nose.position.y;
  }

  // Helper function: Detect if head is tilted
  function isHeadTilted(pose: posenet.Pose): boolean {
    const leftEar = pose.keypoints.find((kp) => kp.part === "leftEar");
    const rightEar = pose.keypoints.find((kp) => kp.part === "rightEar");
  
    //console.log("Left Ear:", leftEar);
    //console.log("Right Ear:", rightEar);
  
    if (!leftEar || !rightEar) return false;
  
    return Math.abs(leftEar.position.y - rightEar.position.y) > 20;
  }

  const listenForSpeech = (): void => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
    if (!SpeechRecognition) {
      console.error("Speech recognition not supported in this browser.");
      return;
    }
  
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US"; // Auto-detect language
    recognition.continuous = true; // Keep listening continuously
    recognition.interimResults = false; // Get only the final recognized speech
  
    let lastAiResponse = ""; // Trying to avoid loops.

    recognition.onresult = async (event: any) => {
      if (isAiResponding) return; // Prevent capturing AI's own speech
  
      setIsAiResponding(true);

      const spokenText = event.results[event.results.length - 1][0].transcript.trim();
      console.log("User Said:", spokenText);
  
      // Detect language from spoken text
      const detectedLanguage = await detectLanguage(spokenText);
      console.log(`Detected Language: ${detectedLanguage}`);

      if (spokenText.toLowerCase() === lastAiResponse.toLowerCase()) {
        console.warn("Ignoring AI's own response to prevent looping.");
        return;
      }
  
      handleDetectedSpeech(spokenText, detectedLanguage);
    };
  
    recognition.onerror = (error: any) => {
      console.error("Speech Recognition Error:", error);
    };

    window.speechSynthesis.addEventListener("start", () => {
      console.log("🛑 Stopping speech recognition while AI is speaking...");
      recognition.abort(); // ✅ Immediate stop
    });
  
    // ✅ Restart recognition with a **longer delay** to prevent picking up AI's speech
    window.speechSynthesis.addEventListener("end", () => {
      console.log("✅ AI speech finished. Resuming speech recognition...");
      setTimeout(() => {
        recognition.start();
      }, 4000); // ✅ Wait 4 seconds before restarting
    });

    recognition.start();
  };
  
  async function handleDetectedSpeech(spokenText: string, language: string) {
  
    try {
      const aiText = await fetchAIResponse(spokenText);
      setAiResponse(aiText);

      await speakText(aiText, language);
    } catch (error) {
      console.error("Error processing AI response:", error);
    }
  }

  const detectLanguage = async (text: string): Promise<string> => {
    const AZURE_OPENAI_API_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY;
    const AZURE_OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
    const DEPLOYMENT_NAME = import.meta.env.VITE_DEPLOYMENT_NAME;
  
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
  };
  

  return (
    <div>
      <h2>Interactive AI for Kids</h2>
      <canvas ref={canvasRef} width="640" height="480"
        style={{ position: "absolute", top: 0, left: 0, zIndex: 10, pointerEvents: "none" }}
      />
      <video ref={videoRef} autoPlay playsInline
        style={{ position: "absolute", top: 0, left: 0, zIndex: 5 }}
      />
      <h3>AI Response: {aiResponse}</h3>
    </div>
  );
};

export default PoseDetection;