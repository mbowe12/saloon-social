import React, { useState, useEffect } from "react";
import GameStateService from "../services/gameState";

const Jukebox = ({ position = [0, 0, 0] }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Listen for music state updates
  useEffect(() => {
    const handleMusicUpdate = (musicState) => {
      if (!musicState) return;
      setIsPlaying(musicState.isPlaying);
    };

    // Add music update handler
    const originalHandler = GameStateService.onMusicUpdate;
    GameStateService.onMusicUpdate = (state) => {
      handleMusicUpdate(state);
      if (originalHandler) originalHandler(state);
    };

    return () => {
      GameStateService.onMusicUpdate = originalHandler;
    };
  }, []);

  const togglePlay = (e) => {
    e.preventDefault(); // Prevent default behavior
    e.stopPropagation(); // Stop event propagation
    GameStateService.updateMusicState(!isPlaying, null);
  };

  return (
    <group position={position}>
      {/* Jukebox model */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[1, 2, 0.5]} />
        <meshStandardMaterial color="#4a4a4a" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.2, 1, 0.7]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* Play/Pause button */}
      <mesh
        position={[0, 1.5, 0.3]}
        onClick={togglePlay}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial
          color={isPlaying ? "#00ff00" : "#ff0000"}
          emissive={isPlaying ? "#00ff00" : "#ff0000"}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
};

export default Jukebox;
