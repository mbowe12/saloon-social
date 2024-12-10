import React, { useState, useEffect, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import Character from "./Character";
import * as THREE from "three";
import { keys } from "../services/gameState";
import OtherPlayers from "./OtherPlayers";
import Jukebox from "./Jukebox";
import CharacterCustomization from "./CharacterCustomization";
import GameStateService from "../services/gameState";

// Constants for movement and physics
const MOVE_SPEED = 0.1;
const JUMP_FORCE = 0.15;
const GRAVITY = 0.006;
const ROOM_WIDTH = 20;
const ROOM_LENGTH = 20;

// Helper function to check collisions
const checkCollision = (position, objects) => {
  const playerRadius = 0.5;
  for (const obj of objects) {
    const dx = position[0] - obj.position[0];
    const dz = position[2] - obj.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);

    // For tables, check if we're within radius and below table height
    if (obj.type === "table") {
      // If we're above or at table height, no collision
      if (position[1] >= obj.height - 0.1) {
        continue;
      }
      // If we're below table height and within radius, collision
      if (distance < playerRadius + obj.radius) {
        return true;
      }
      continue;
    }

    // For bar, use a rectangular collision
    if (obj.type === "bar") {
      const barLeft = obj.position[0] - obj.width / 2;
      const barRight = obj.position[0] + obj.width / 2;
      const barFront = obj.position[2] - obj.depth / 2;
      const barBack = obj.position[2] + obj.depth / 2;

      if (
        position[0] >= barLeft - playerRadius &&
        position[0] <= barRight + playerRadius &&
        position[2] >= barFront - playerRadius &&
        position[2] <= barBack + playerRadius
      ) {
        return true;
      }
      continue;
    }

    // For stools, use a cylinder collision
    if (obj.type === "stool") {
      if (position[1] >= 0.8) {
        // Stool height is 0.8
        continue;
      }
      // Calculate the push-out vector
      if (distance < playerRadius + obj.radius) {
        // Calculate normalized direction vector
        const norm = Math.sqrt(dx * dx + dz * dz);
        if (norm > 0) {
          // Push the player out by the overlap amount
          const overlap = playerRadius + obj.radius - distance;
          position[0] += (dx / norm) * overlap;
          position[2] += (dz / norm) * overlap;
        }
        return false; // Don't block movement, just push out
      }
      continue;
    }

    // Regular circular collision for other objects
    if (distance < playerRadius + obj.radius) {
      return true;
    }
  }
  return false;
};

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

// Spinning Coin component
const SpinningCoin = ({ position, id, onCollect }) => {
  const coinRef = useRef();

  useFrame((state) => {
    if (coinRef.current) {
      coinRef.current.rotation.y += 0.02;
      coinRef.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <mesh
      ref={coinRef}
      position={position}
      rotation={[0, 0, Math.PI / 2]}
      onClick={() => onCollect(id)}
    >
      <cylinderGeometry args={[0.2, 0.2, 0.05, 32]} />
      <meshStandardMaterial color="gold" metalness={0.7} roughness={0.3} />
    </mesh>
  );
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
      <CameraController target={[position.x, position.y, position.z]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[0, 10, 0]} intensity={0.5} castShadow />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_LENGTH]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Environment */}
      <Environment
        coins={coins}
        roomWidth={ROOM_WIDTH}
        roomLength={ROOM_LENGTH}
      />

      {/* Player */}
      <Controls
        userId={currentUserId}
        players={players}
        onPositionChange={onPositionChange}
        roomWidth={ROOM_WIDTH}
        roomLength={ROOM_LENGTH}
        coins={coins}
        onCoinCollect={onCoinCollect}
      >
        <Character
          modelPath={`/assets/characters/${characterType}.glb`}
          position={[position.x, position.y, position.z]}
          rotation={[rotation.x, rotation.y, rotation.z]}
          isMoving={isMoving}
          accessories={accessories}
          accessoryColors={accessoryColors}
          username={username}
        />
      </Controls>

      {/* Other Players */}
      <OtherPlayers players={players} currentUserId={currentUserId} />
      <Jukebox position={[-1, 0, -6]} />

      {/* Coins */}
      {coins &&
        coins.map((coin) => (
          <SpinningCoin
            key={coin.id}
            position={coin.position}
            id={coin.id}
            onCollect={onCoinCollect}
          />
        ))}
    </>
  );
};

const ThreeScene = ({
  userId,
  players,
  coins,
  characterData,
  onCoinCollect,
}) => {
  const [characterType, setCharacterType] = useState(
    characterData?.characterType || "cow"
  );
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState(characterData?.username || "");
  const [accessories, setAccessories] = useState(
    characterData?.accessories || {
      hat: false,
      bandana: false,
      boots: false,
    }
  );
  const [accessoryColors, setAccessoryColors] = useState(
    characterData?.accessoryColors || {
      hat: "#000000",
      bandana: "#FF0000",
      boots: "#8B4513",
    }
  );
  const [verticalVelocity, setVerticalVelocity] = useState(0);
  const [isJumping, setIsJumping] = useState(false);

  // Update character data when it changes
  useEffect(() => {
    if (characterData) {
      setCharacterType(characterData.characterType);
      setUsername(characterData.username);
      setAccessories(characterData.accessories);
      setAccessoryColors(characterData.accessoryColors);
    }
  }, [characterData]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      keys[e.key.toLowerCase()] = true;
      setIsMoving(true);

      // Handle jump
      if (e.key === " " && !isJumping) {
        setVerticalVelocity(JUMP_FORCE);
        setIsJumping(true);
      }
    };

    const handleKeyUp = (e) => {
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
  }, [isJumping]);

  // Check for coin collisions
  const checkCoinCollisions = () => {
    if (!coins || !Array.isArray(coins)) return;

    const playerRadius = 0.5;
    const coinRadius = 0.5;
    const collisionDistance = playerRadius + coinRadius;

    coins.forEach((coin) => {
      if (!coin.collected) {
        const dx = position.x - coin.position[0];
        const dy = position.y - coin.position[1];
        const dz = position.z - coin.position[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < collisionDistance) {
          onCoinCollect(coin.id);
        }
      }
    });
  };

  // Handle movement and physics
  useEffect(() => {
    const moveInterval = setInterval(() => {
      let moved = false;
      const newPosition = { ...position };

      // Apply gravity
      let newVerticalVelocity = verticalVelocity - GRAVITY;
      newPosition.y = Math.max(0, position.y + newVerticalVelocity);

      // Check for table collisions and landing
      let landedOnTable = false;
      if (newPosition.y > 0) {
        for (const obj of collisionObjects) {
          if (obj.type === "table") {
            const dx = newPosition.x - obj.position[0];
            const dz = newPosition.z - obj.position[2];
            const distance = Math.sqrt(dx * dx + dz * dz);

            // If we're above and within radius of table
            if (distance < obj.radius + 0.5) {
              // If we're falling onto the table
              if (newPosition.y <= obj.height && position.y > obj.height) {
                newPosition.y = obj.height;
                newVerticalVelocity = 0;
                setIsJumping(false);
                landedOnTable = true;
                break;
              }
              // If we're already on the table, stay on it
              else if (Math.abs(position.y - obj.height) < 0.1) {
                newPosition.y = obj.height;
                newVerticalVelocity = 0;
                landedOnTable = true;
                break;
              }
            }
          }
        }
      }

      // Only apply gravity if we're not on a table
      if (!landedOnTable) {
        // Reset jump when landing on ground
        if (newPosition.y === 0) {
          newVerticalVelocity = 0;
          setIsJumping(false);
        }
      }

      // Handle movement input
      if (keys.w || keys.arrowup) {
        newPosition.z -= MOVE_SPEED;
        moved = true;
      }
      if (keys.s || keys.arrowdown) {
        newPosition.z += MOVE_SPEED;
        moved = true;
      }
      if (keys.a || keys.arrowleft) {
        newPosition.x -= MOVE_SPEED;
        moved = true;
      }
      if (keys.d || keys.arrowright) {
        newPosition.x += MOVE_SPEED;
        moved = true;
      }

      const oldPosition = { ...newPosition };

      // Simple boundary check
      newPosition.x = Math.max(
        -ROOM_WIDTH / 2 + 1,
        Math.min(ROOM_WIDTH / 2 - 1, newPosition.x)
      );
      newPosition.z = Math.max(
        -ROOM_LENGTH / 2 + 1,
        Math.min(ROOM_LENGTH / 2 - 1, newPosition.z)
      );

      // Check collisions
      if (checkCollision(newPosition, collisionObjects)) {
        Object.assign(newPosition, oldPosition);
      }

      // Check for coin collisions
      checkCoinCollisions();

      // Update position and state if moved
      if (moved || newPosition.y !== position.y) {
        setPosition(newPosition);
        setIsMoving(moved);

        // Update rotation based on movement direction
        if (moved) {
          const movementX = newPosition.x - position.x;
          const movementZ = newPosition.z - position.z;
          if (movementX !== 0 || movementZ !== 0) {
            const angle = Math.atan2(movementX, movementZ);
            setRotation({ ...rotation, y: angle });
          }
        }

        // Update server with all player state
        GameStateService.updatePlayerState(newPosition, rotation, moved, {
          characterType,
          username,
          accessories,
          accessoryColors,
        });
      } else if (isMoving) {
        setIsMoving(false);
        GameStateService.updatePlayerState(position, rotation, false, {
          characterType,
          username,
          accessories,
          accessoryColors,
        });
      }

      setVerticalVelocity(newVerticalVelocity);
    }, 16);

    return () => clearInterval(moveInterval);
  }, [
    position,
    rotation,
    isMoving,
    verticalVelocity,
    isJumping,
    characterType,
    username,
    accessories,
    accessoryColors,
    coins,
  ]);

  return (
    <>
      {error && (
        <div className="error-message">
          Error: {error.message || "An error occurred"}
        </div>
      )}
      <Canvas
        camera={{ position: [0, 5, 8], fov: 75 }}
        gl={{ antialias: true }}
        shadows
        style={{ background: "#000000" }}
      >
        <Scene
          characterType={characterType}
          position={position}
          rotation={rotation}
          isMoving={isMoving}
          onPositionChange={setPosition}
          players={players}
          currentUserId={userId}
          coins={coins || []}
          onCoinCollect={onCoinCollect}
          username={username}
          accessories={accessories}
          accessoryColors={accessoryColors}
        />
      </Canvas>
    </>
  );
};

export default ThreeScene;
