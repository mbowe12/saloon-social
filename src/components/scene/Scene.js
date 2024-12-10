import React, { useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import Environment from "./Environment";
import Controls from "./Controls";
import Character from "../character/Character";
import OtherPlayers from "../character/OtherPlayers";
import CameraController from "./CameraController";

// Room dimensions
const ROOM_WIDTH = 20;
const ROOM_LENGTH = 20;

const Scene = ({ userId, players, coins, characterData, onCoinCollect }) => {
  const [currentPosition, setCurrentPosition] = useState({ x: 0, y: 0, z: 0 });
  const playerRef = useRef();

  const handlePositionChange = (newPosition) => {
    setCurrentPosition(newPosition);
  };

  return (
    <Canvas
      shadows
      camera={{ position: [0, 5, 8], fov: 75 }}
      style={{ background: "#000000" }}
    >
      {/* Lights */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.5} castShadow />
      <directionalLight position={[0, 10, 0]} intensity={0.5} castShadow />

      {/* Environment */}
      <Environment
        coins={coins}
        roomWidth={ROOM_WIDTH}
        roomLength={ROOM_LENGTH}
      />

      {/* Player */}
      <Controls
        userId={userId}
        players={players}
        onPositionChange={handlePositionChange}
        playerRef={playerRef}
        roomWidth={ROOM_WIDTH}
        roomLength={ROOM_LENGTH}
        coins={coins}
        onCoinCollect={onCoinCollect}
      >
        <Character
          modelPath={`/assets/characters/${
            characterData?.characterType || "cow"
          }.glb`}
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          accessories={characterData?.accessories}
          accessoryColors={characterData?.accessoryColors}
          username={characterData?.username}
        />
      </Controls>

      {/* Other Players */}
      <OtherPlayers players={players} currentUserId={userId} />

      {/* Camera */}
      <CameraController target={playerRef} />
    </Canvas>
  );
};

export default Scene;
