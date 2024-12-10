import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import WebRTCService from "../../services/webrtc";
import "../../styles/ui/MicControls.css";

const SPEAKING_THRESHOLD = 0.2;

const MicIcon = ({ isMuted, onClick }) => (
  <div
    className="mic-icon-container cursor-pointer select-none"
    onClick={onClick}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isMuted ? (
        <>
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </>
      ) : (
        <>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </>
      )}
    </svg>
  </div>
);

const MicControls = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastSpeakingUpdateRef = useRef(false);

  useEffect(() => {
    let stream;

    const initAudioAnalyser = async () => {
      try {
        // Get microphone stream directly
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        // Initialize WebRTC with the stream
        WebRTCService.localStream = stream;

        // Set up audio analysis
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        analyserRef.current.fftSize = 256;
        const dataArray = new Float32Array(
          analyserRef.current.frequencyBinCount
        );

        const updateLevel = () => {
          if (!analyserRef.current) return;

          analyserRef.current.getFloatTimeDomainData(dataArray);
          const rms = Math.sqrt(
            dataArray.reduce((acc, val) => acc + val * val, 0) /
              dataArray.length
          );
          const normalizedLevel = Math.min(rms * 4, 1); // Adjust multiplier for sensitivity

          setMicLevel(normalizedLevel);

          // Update speaking state if it changed
          const isSpeaking = !isMuted && normalizedLevel > SPEAKING_THRESHOLD;
          if (isSpeaking !== lastSpeakingUpdateRef.current) {
            lastSpeakingUpdateRef.current = isSpeaking;
            WebRTCService.updateSpeakingState(isSpeaking);
          }

          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (error) {
        console.error("Error initializing audio analyser:", error);
      }
    };

    initAudioAnalyser();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      WebRTCService.updateSpeakingState(false);
    };
  }, [isMuted]);

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    WebRTCService.toggleMute();
    if (newMutedState) {
      WebRTCService.updateSpeakingState(false);
    }
  };

  return (
    <div className="mic-controls">
      <MicIcon isMuted={isMuted} onClick={toggleMute} />
      <motion.div
        className="mic-level-bar"
        style={{
          width: `${(isMuted ? 0 : micLevel) * 100}%`,
          backgroundColor:
            micLevel > SPEAKING_THRESHOLD
              ? "rgb(75, 255, 75)"
              : "rgba(255, 255, 255, 0.2)",
        }}
      />
    </div>
  );
};

export default MicControls;
