import React, { useState, useEffect, useRef, Suspense } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import Character from "./Character";
import * as THREE from "three";
import { keys } from "../services/gameState";
import OtherPlayers from "./OtherPlayers";
import GameStateService from "../services/gameState";
import Jukebox from "./Jukebox";
import CoinCounter from "./CoinCounter";
import CharacterCustomization from "./CharacterCustomization";

// Constants for movement and physics
const MOVE_SPEED = 0.1;
const JUMP_FORCE = 0.15;
const GRAVITY = 0.006;
const ROOM_WIDTH = 20;
const ROOM_LENGTH = 24;

// Camera controller
const CameraController = ({ target }) => {
  const { camera } = useThree();

  useFrame(() => {
    if (!target) return;
    // Position camera behind and above the player
    const idealPosition = new THREE.Vector3(
      target[0],
      target[1] + 5,
      target[2] + 8
    );
    camera.position.lerp(idealPosition, 0.1);
    camera.lookAt(target[0], target[1], target[2]);
  });

  return null;
};

const Scene = ({
  characterType,
  position,
  rotation,
  isMoving,
  onPositionChange,
  players,
  currentUserId,
  coins,
  onCoinCollect,
  username,
  accessories,
  accessoryColors,
}) => {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5, 8]} />
      <CameraController target={position} />
      <fog attach="fog" args={["#87CEEB", 10, 50]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, 10, -5]} intensity={0.8} />
      <directionalLight
        position={[0, 10, 0]}
        intensity={0.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_LENGTH]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 2, -ROOM_LENGTH / 2]}>
        <boxGeometry args={[ROOM_WIDTH, 4, 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, 2, ROOM_LENGTH / 2]}>
        <boxGeometry args={[ROOM_WIDTH, 4, 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[-ROOM_WIDTH / 2, 2, 0]}>
        <boxGeometry args={[0.1, 4, ROOM_LENGTH]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[ROOM_WIDTH / 2, 2, 0]}>
        <boxGeometry args={[0.1, 4, ROOM_LENGTH]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Windows */}
      {[
        [-ROOM_WIDTH / 2 + 0.1, 2, -5],
        [-ROOM_WIDTH / 2 + 0.1, 2, 5],
        [ROOM_WIDTH / 2 - 0.1, 2, -5],
        [ROOM_WIDTH / 2 - 0.1, 2, 5],
      ].map((pos, i) => (
        <mesh key={`window-${i}`} position={pos}>
          <boxGeometry args={[0.1, 1.5, 1]} />
          <meshStandardMaterial color="#87CEEB" transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Paintings */}
      {[
        [0, 2, -ROOM_LENGTH / 2 + 0.1],
        [0, 2, ROOM_LENGTH / 2 - 0.1],
      ].map((pos, i) => (
        <mesh key={`painting-${i}`} position={pos}>
          <boxGeometry args={[2, 1.5, 0.1]} />
          <meshStandardMaterial color="#D2691E" />
        </mesh>
      ))}

      {/* Bar */}
      <mesh position={[-7, 1, -10]} rotation={[0, 0, 0]}>
        <boxGeometry args={[6, 2, 1]} />
        <meshStandardMaterial color="#4a3728" />
      </mesh>

      {/* Bar bottles */}
      {[
        [-5, 2.1, -10],
        [-6, 2.1, -10],
        [-7, 2.1, -10],
        [-8, 2.1, -10],
        [-9, 2.1, -10],
      ].map((pos, i) => (
        <mesh key={`bottle-${i}`} position={pos}>
          <cylinderGeometry args={[0.1, 0.1, 0.5, 8]} />
          <meshStandardMaterial
            color={
              ["#44ff44", "#4444ff", "#ff4444", "#44ffff", "#ffff44"][i % 5]
            }
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}

      {/* Tables */}
      <mesh position={[5, 0.5, 0]}>
        <cylinderGeometry args={[1, 1, 1, 16]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>
      <mesh position={[-5, 0.5, 5]}>
        <cylinderGeometry args={[1, 1, 1, 16]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>
      <mesh position={[0, 0.5, -5]}>
        <cylinderGeometry args={[1, 1, 1, 16]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>

      {/* Stools */}
      {[
        [5, 0.4, 1.5],
        [5, 0.4, -1.5],
        [6.5, 0.4, 0],
        [3.5, 0.4, 0],
        [-5, 0.4, 6.5],
        [-5, 0.4, 3.5],
        [-3.5, 0.4, 5],
        [-6.5, 0.4, 5],
        [0, 0.4, -3.5],
        [0, 0.4, -6.5],
        [1.5, 0.4, -5],
        [-1.5, 0.4, -5],
      ].map((pos, i) => (
        <mesh key={i} position={pos}>
          <cylinderGeometry args={[0.3, 0.3, 0.8, 16]} />
          <meshStandardMaterial color="#654321" />
        </mesh>
      ))}

      {/* Bar stools */}
      {[
        [-5, 0.4, -10],
        [-7, 0.4, -10],
        [-9, 0.4, -10],
      ].map((pos, i) => (
        <mesh key={`bar-${i}`} position={pos}>
          <cylinderGeometry args={[0.3, 0.3, 0.8, 16]} />
          <meshStandardMaterial color="#654321" />
        </mesh>
      ))}

      <Character
        modelPath={`/assets/characters/${characterType}.glb`}
        position={position}
        rotation={rotation}
        isMoving={isMoving}
        onPositionChange={onPositionChange}
        accessories={accessories}
        accessoryColors={accessoryColors}
        username={username}
      />
      <OtherPlayers players={players} currentUserId={currentUserId} />
      <Jukebox position={[0, 0, -8]} />

      {/* Coins */}
      {coins.map((coin) => (
        <mesh
          key={coin.id}
          position={coin.position}
          rotation={[0, 0, Math.PI / 2]}
          onClick={() => onCoinCollect(coin.id)}
        >
          <cylinderGeometry args={[0.2, 0.2, 0.05, 32]} />
          <meshStandardMaterial color="gold" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
    </>
  );
};

const ThreeScene = ({ userId, players }) => {
  const [characterType, setCharacterType] = useState("cow");
  const [position, setPosition] = useState([0, 0, 0]);
  const [rotation, setRotation] = useState([0, 0, 0]);
  const [isMoving, setIsMoving] = useState(false);
  const [coins, setCoins] = useState([]);
  const [error, setError] = useState(null);
  const [showCustomization, setShowCustomization] = useState(true);
  const [username, setUsername] = useState("");
  const [accessories, setAccessories] = useState({
    hat: false,
    bandana: false,
    boots: false,
  });
  const [accessoryColors, setAccessoryColors] = useState({
    hat: "#000000",
    bandana: "#FF0000",
    boots: "#8B4513",
  });
  const [verticalVelocity, setVerticalVelocity] = useState(0);
  const [isJumping, setIsJumping] = useState(false);

  // Initialize coins listener
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get("room") || "test-room";

    GameStateService.initMultiplayer(
      roomId,
      userId,
      null, // players are handled in App.js
      null, // music is handled in MusicControls
      (coinsState) => {
        if (coinsState && coinsState.coins) {
          setCoins(coinsState.coins);
        }
      }
    );
  }, [userId]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showCustomization) return;
      keys[e.key.toLowerCase()] = true;
      setIsMoving(true);

      // Handle jump
      if (e.key === " " && !isJumping) {
        setVerticalVelocity(JUMP_FORCE);
        setIsJumping(true);
      }
    };

    const handleKeyUp = (e) => {
      if (showCustomization) return;
      keys[e.key.toLowerCase()] = false;
      if (!Object.values(keys).some((value) => value)) {
        setIsMoving(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [showCustomization, isJumping]);

  // Handle movement and physics
  useEffect(() => {
    const moveInterval = setInterval(() => {
      let moved = false;
      let newPosition = [...position];

      // Apply gravity
      let newVerticalVelocity = verticalVelocity - GRAVITY;
      newPosition[1] = Math.max(0, position[1] + newVerticalVelocity);

      // Reset jump when landing
      if (newPosition[1] === 0) {
        newVerticalVelocity = 0;
        setIsJumping(false);
      }

      if (keys.w || keys.arrowup) {
        newPosition[2] -= MOVE_SPEED;
        moved = true;
      }
      if (keys.s || keys.arrowdown) {
        newPosition[2] += MOVE_SPEED;
        moved = true;
      }
      if (keys.a || keys.arrowleft) {
        newPosition[0] -= MOVE_SPEED;
        moved = true;
      }
      if (keys.d || keys.arrowright) {
        newPosition[0] += MOVE_SPEED;
        moved = true;
      }

      // Update vertical velocity
      setVerticalVelocity(newVerticalVelocity);

      if (moved || newPosition[1] !== position[1]) {
        // Simple boundary check
        newPosition[0] = Math.max(
          -ROOM_WIDTH / 2 + 1,
          Math.min(ROOM_WIDTH / 2 - 1, newPosition[0])
        );
        newPosition[2] = Math.max(
          -ROOM_LENGTH / 2 + 1,
          Math.min(ROOM_LENGTH / 2 - 1, newPosition[2])
        );

        setPosition(newPosition);

        // Update rotation based on movement direction
        if (moved) {
          const movementX = newPosition[0] - position[0];
          const movementZ = newPosition[2] - position[2];
          if (movementX !== 0 || movementZ !== 0) {
            const angle = Math.atan2(movementX, movementZ);
            setRotation([0, angle, 0]);
          }
        }

        // Update server
        GameStateService.updatePlayerState(newPosition, rotation, moved);
      } else if (isMoving) {
        setIsMoving(false);
        GameStateService.updatePlayerState(position, rotation, false);
      }
    }, 16);

    return () => clearInterval(moveInterval);
  }, [position, rotation, isMoving, verticalVelocity, isJumping]);

  // Handle coin collection
  const handleCoinCollect = async (coinId) => {
    try {
      await GameStateService.collectCoin(coinId);
    } catch (error) {
      console.error("Error collecting coin:", error);
      setError(error);
    }
  };

  const currentPlayer = players.find((p) => p.id === userId);
  const playerCoins = currentPlayer?.coins || 0;

  return (
    <>
      {error && (
        <div className="error-message">
          Error: {error.message || "An error occurred"}
        </div>
      )}
      <CoinCounter coins={playerCoins} />
      {showCustomization ? (
        <CharacterCustomization
          isOpen={showCustomization}
          onClose={() => setShowCustomization(false)}
          currentCharacter={characterType}
          onSave={(data) => {
            setCharacterType(data.characterType);
            setUsername(data.username);
            setAccessories(data.accessories);
            setAccessoryColors(data.accessoryColors);
            setShowCustomization(false);
            // Update server with initial state
            GameStateService.updatePlayerState(position, rotation, false, {
              characterType: data.characterType,
              username: data.username,
              accessories: data.accessories,
              accessoryColors: data.accessoryColors,
            });
          }}
          username={username}
          onUsernameChange={setUsername}
        />
      ) : (
        <Canvas
          camera={{ position: [0, 5, 8], fov: 75 }}
          gl={{ antialias: true }}
          shadows
          style={{ background: "#87CEEB" }}
          onCreated={({ gl }) => {
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          <Suspense fallback={null}>
            <Scene
              characterType={characterType}
              position={position}
              rotation={rotation}
              isMoving={isMoving}
              onPositionChange={setPosition}
              players={players}
              currentUserId={userId}
              coins={coins}
              onCoinCollect={handleCoinCollect}
              username={username}
              accessories={accessories}
              accessoryColors={accessoryColors}
            />
          </Suspense>
        </Canvas>
      )}
    </>
  );
};

export default ThreeScene;
