import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AudioManager from "../../audio/AudioManager";
import "../../styles/ui/MusicControls.css";

const VolumeIcon = ({ volume, onClick, defaultVolume }) => {
  const isHovered = volume > 0;

  return (
    <div
      className="volume-icon-container cursor-pointer select-none"
      onClick={onClick}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
        <AnimatePresence mode="wait" initial={false}>
          {isHovered ? (
            <>
              <motion.path
                d="M16 9a5 5 0 0 1 0 6"
                animate={{
                  opacity: volume > 0.15 ? 1 : 0,
                  transition: { delay: 0.1 },
                }}
                initial={{ opacity: 0 }}
              />
              <motion.path
                d="M19.364 18.364a9 9 0 0 0 0-12.728"
                animate={{
                  opacity: volume > 0.4 ? 1 : 0,
                  transition: { delay: 0.2 },
                }}
                initial={{ opacity: 0 }}
              />
            </>
          ) : (
            <>
              <motion.line
                x1="22"
                x2="16"
                y1="9"
                y2="15"
                animate={{
                  pathLength: [0, 1],
                  opacity: [0, 1],
                  transition: { delay: 0.1 },
                }}
                initial={{ pathLength: 1, opacity: 1 }}
              />
              <motion.line
                x1="16"
                x2="22"
                y1="9"
                y2="15"
                animate={{
                  pathLength: [0, 1],
                  opacity: [0, 1],
                  transition: { delay: 0.2 },
                }}
                initial={{ pathLength: 1, opacity: 1 }}
              />
            </>
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
};

const MusicControls = ({ userId, players }) => {
  const [volume, setVolume] = useState(0.25);
  const [previousVolume, setPreviousVolume] = useState(0.25);
  const hasInitialized = useRef(false);

  // initialize and start playing only after character creation (player exists)
  useEffect(() => {
    if (!userId || hasInitialized.current) return;

    const currentPlayer = players.find((p) => p.id === userId);
    if (!currentPlayer) return;

    hasInitialized.current = true;
    const audioManager = AudioManager.getInstance();
    audioManager.setVolume(volume);
    audioManager.startPlaylist();
  }, [userId, players]);

  // handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = Math.min(parseFloat(e.target.value), 0.6);
    setVolume(newVolume);
    const audioManager = AudioManager.getInstance();
    audioManager.setVolume(newVolume);
  };

  const handleVolumeIconClick = () => {
    const audioManager = AudioManager.getInstance();
    if (volume > 0) {
      setPreviousVolume(volume);
      setVolume(0);
      audioManager.setVolume(0);
    } else {
      setVolume(previousVolume);
      audioManager.setVolume(previousVolume);
    }
  };

  // Only show controls after player exists
  const currentPlayer = players.find((p) => p.id === userId);
  if (!currentPlayer) return null;

  return (
    <div className="music-controls">
      <div className="volume-control">
        <VolumeIcon
          volume={volume}
          onClick={handleVolumeIconClick}
          defaultVolume={0.25}
        />
        <div className="volume-slider-container">
          <div
            className="volume-fill"
            style={{ width: `${(volume / 0.6) * 100}%` }}
          />
          <input
            type="range"
            min="0"
            max="0.6"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
          />
        </div>
      </div>
    </div>
  );
};

export default MusicControls;
