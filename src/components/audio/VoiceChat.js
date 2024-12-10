import React, { useEffect, useRef, useState } from "react";
import WebRTCService from "../../services/webrtc";
import { motion, AnimatePresence } from "framer-motion";
import "../../styles/audio/VoiceChat.css";

const AUDIO_FALLOFF_START = 5;
const AUDIO_CUTOFF = 10;
const SPEAKING_THRESHOLD = -50; // in dB

const VoiceChat = ({ userId, players, currentPlayerPosition }) => {
  const audioContextRef = useRef(null);
  const gainNodesRef = useRef({});
  const analyserNodesRef = useRef({});
  const [connectedPeers, setConnectedPeers] = useState(new Set());
  const [speakingStates, setSpeakingStates] = useState({});
  const [micStatus, setMicStatus] = useState("initializing");
  const [errorMessage, setErrorMessage] = useState("");

  // initialize audio context and WebRTC
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        if (!window.AudioContext && !window.webkitAudioContext) {
          throw new Error("Browser does not support required audio features");
        }

        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
        await audioContextRef.current.resume();
        setMicStatus("ready");
      } catch (error) {
        console.error("Error initializing audio:", error);
        setMicStatus("error");
        setErrorMessage(error.message);
      }
    };

    initializeAudio();

    return () => {
      if (audioContextRef.current?.state === "running") {
        audioContextRef.current.close();
      }
    };
  }, []);

  // remote audio processing
  useEffect(() => {
    WebRTCService.onRemoteStream = (remoteUserId, stream) => {
      if (micStatus !== "ready" || !audioContextRef.current) return;

      try {
        const audioContext = audioContextRef.current;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserNodesRef.current[remoteUserId] = analyser;

        // create panner node for 3d audio
        const panner = audioContext.createPanner();
        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = AUDIO_FALLOFF_START;
        panner.maxDistance = AUDIO_CUTOFF;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 0;
        panner.coneOuterGain = 0;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1; // set to 1 since we'll use panner for attenuation
        gainNodesRef.current[remoteUserId] = gainNode;

        source.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(audioContext.destination);

        // store panner node reference
        if (!window.pannerNodes) window.pannerNodes = {};
        window.pannerNodes[remoteUserId] = panner;

        setConnectedPeers((prev) => new Set([...prev, remoteUserId]));

        const dataArray = new Float32Array(analyser.frequencyBinCount);
        const checkAudioLevel = () => {
          if (!analyserNodesRef.current[remoteUserId]) return;

          analyser.getFloatTimeDomainData(dataArray);
          const rms = Math.sqrt(
            dataArray.reduce((acc, val) => acc + val * val, 0) /
              dataArray.length
          );
          const db = 20 * Math.log10(rms);
          const isSpeaking = db > SPEAKING_THRESHOLD;

          setSpeakingStates((prev) => ({
            ...prev,
            [remoteUserId]: isSpeaking,
          }));

          requestAnimationFrame(checkAudioLevel);
        };
        checkAudioLevel();
      } catch (error) {
        console.error("Error processing remote stream:", error);
        setErrorMessage("Error processing remote audio");
      }
    };
  }, [micStatus]);

  // update 3d audio positions
  useEffect(() => {
    if (!currentPlayerPosition || micStatus !== "ready") return;

    players.forEach((player) => {
      if (player.id === userId) return;
      const panner = window.pannerNodes?.[player.id];
      if (!panner) return;

      // update panner position relative to listener (current player)
      panner.positionX.setValueAtTime(
        player.position.x - currentPlayerPosition.x,
        audioContextRef.current.currentTime
      );
      panner.positionY.setValueAtTime(
        player.position.y - currentPlayerPosition.y,
        audioContextRef.current.currentTime
      );
      panner.positionZ.setValueAtTime(
        player.position.z - currentPlayerPosition.z,
        audioContextRef.current.currentTime
      );

      // update listener position and orientation
      const listener = audioContextRef.current.listener;
      if (listener.positionX) {
        listener.positionX.setValueAtTime(
          currentPlayerPosition.x,
          audioContextRef.current.currentTime
        );
        listener.positionY.setValueAtTime(
          currentPlayerPosition.y,
          audioContextRef.current.currentTime
        );
        listener.positionZ.setValueAtTime(
          currentPlayerPosition.z,
          audioContextRef.current.currentTime
        );
      } else {
        // fallback for browsers that don't support position setters
        listener.setPosition(
          currentPlayerPosition.x,
          currentPlayerPosition.y,
          currentPlayerPosition.z
        );
      }
    });
  }, [players, currentPlayerPosition, userId, micStatus]);

  return (
    <motion.div
      className="voice-chat"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="voice-chat-header">
        <div
          className={`status-indicator ${
            micStatus === "ready"
              ? "connected"
              : micStatus === "error"
              ? "error"
              : "connecting"
          }`}
        />
        <span>Connected Players</span>
      </div>

      <AnimatePresence>
        {errorMessage && (
          <motion.div
            className="error-message"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="remote-players">
        <AnimatePresence>
          {players.map((player) => {
            if (player.id === userId) return null;
            const isConnected = connectedPeers.has(player.id);
            const isSpeaking = speakingStates[player.id];

            return (
              <motion.div
                key={player.id}
                className="remote-player"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className={`status-indicator ${
                    isConnected
                      ? isSpeaking
                        ? "speaking"
                        : "connected"
                      : "disconnected"
                  }`}
                />
                <span>{player.name || `Player ${player.id}`}</span>
                {isConnected && (
                  <motion.div
                    className="volume-bar"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <motion.div
                      className="volume-level"
                      animate={{
                        scaleX: isSpeaking ? 1 : 0,
                        opacity: isSpeaking ? 1 : 0.3,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default VoiceChat;
