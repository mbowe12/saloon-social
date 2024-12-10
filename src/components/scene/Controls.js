import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import GameStateService from "../../services/gameState";

const MOVE_SPEED = 0.08;
const JUMP_FORCE = 0.15;
const GRAVITY = 0.006;

// Collision objects
const COLLISION_OBJECTS = [
  // Tables
  { position: [7, 0.5, 0], radius: 1, height: 1, type: "table" },
  { position: [-5, 0.5, 5], radius: 1, height: 1, type: "table" },
  { position: [3, 0.5, -5], radius: 1, height: 1, type: "table" },
  // Bar
  { position: [-4, 1, -6], width: 6, depth: 1, type: "bar" },
  // Stools
  ...[
    [7, 0.4, 1.5],
    [7, 0.4, -1.5],
    [8.5, 0.4, 0],
    [5.5, 0.4, 0],
    [-5, 0.4, 6.5],
    [-5, 0.4, 3.5],
    [-3.5, 0.4, 5],
    [-6.5, 0.4, 5],
    [3, 0.4, -3.5],
    [3, 0.4, -6.5],
    [4.5, 0.4, -5],
    [1.5, 0.4, -5],
    // Bar stools
    [-2, 0.4, -6],
    [-4, 0.4, -6],
    [-6, 0.4, -6],
  ].map((pos) => ({ position: pos, radius: 0.3, type: "stool" })),
];

const Controls = ({
  children,
  userId,
  players,
  onPositionChange,
  playerRef,
  roomWidth,
  roomLength,
  coins,
  onCoinCollect,
}) => {
  const groupRef = useRef();
  const keys = useRef({});
  const [verticalVelocity, setVerticalVelocity] = React.useState(0);
  const [isJumping, setIsJumping] = React.useState(false);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      keys.current[e.key.toLowerCase()] = true;

      // Handle jump
      if (e.key === " " && !isJumping) {
        setVerticalVelocity(JUMP_FORCE);
        setIsJumping(true);
      }
    };

    const handleKeyUp = (e) => {
      keys.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isJumping]);

  // Check collisions
  const checkCollisions = (position) => {
    const playerRadius = 0.5;

    // Room boundaries
    const boundaryPadding = 1;
    if (
      position.x < -roomWidth / 2 + boundaryPadding ||
      position.x > roomWidth / 2 - boundaryPadding ||
      position.z < -roomLength / 2 + boundaryPadding ||
      position.z > roomLength / 2 - boundaryPadding
    ) {
      return true;
    }

    // Check furniture collisions
    for (const obj of COLLISION_OBJECTS) {
      if (obj.type === "bar") {
        const barLeft = obj.position[0] - obj.width / 2;
        const barRight = obj.position[0] + obj.width / 2;
        const barFront = obj.position[2] - obj.depth / 2;
        const barBack = obj.position[2] + obj.depth / 2;

        if (
          position.x >= barLeft - playerRadius &&
          position.x <= barRight + playerRadius &&
          position.z >= barFront - playerRadius &&
          position.z <= barBack + playerRadius
        ) {
          return true;
        }
        continue;
      }

      // Circular collision for tables and stools
      const dx = position.x - obj.position[0];
      const dz = position.z - obj.position[2];
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (obj.type === "table") {
        // If we're above or at table height, no collision
        if (position.y >= obj.height - 0.1) {
          continue;
        }
        // If we're below table height and within radius, collision
        if (distance < playerRadius + obj.radius) {
          return true;
        }
        continue;
      }

      // For stools, use cylinder collision
      if (obj.type === "stool") {
        if (position.y >= 0.8) {
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
            position.x += (dx / norm) * overlap;
            position.z += (dz / norm) * overlap;
          }
          return false; // Don't block movement, just push out
        }
        continue;
      }
    }

    return false;
  };

  // Check for coin collisions
  const checkCoinCollisions = () => {
    if (!coins || !Array.isArray(coins) || !onCoinCollect) return;

    const playerRadius = 0.5;
    const coinRadius = 0.2;
    const collisionDistance = playerRadius + coinRadius;

    coins.forEach((coin) => {
      if (!coin.collected) {
        const dx = groupRef.current.position.x - coin.position[0];
        const dy = groupRef.current.position.y - coin.position[1];
        const dz = groupRef.current.position.z - coin.position[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < collisionDistance) {
          onCoinCollect(coin.id);
        }
      }
    });
  };

  useFrame(() => {
    if (!groupRef.current) return;

    let moved = false;
    let newPosition = { ...groupRef.current.position };
    let newRotation = groupRef.current.rotation.y;

    // Apply gravity
    let newVerticalVelocity = verticalVelocity - GRAVITY;
    newPosition.y = Math.max(
      0,
      groupRef.current.position.y + newVerticalVelocity
    );

    // Check for table collisions and landing
    let landedOnTable = false;
    if (newPosition.y > 0) {
      for (const obj of COLLISION_OBJECTS) {
        if (obj.type === "table") {
          const dx = newPosition.x - obj.position[0];
          const dz = newPosition.z - obj.position[2];
          const distance = Math.sqrt(dx * dx + dz * dz);

          // If we're above and within radius of table
          if (distance < obj.radius + 0.5) {
            // If we're falling onto the table
            if (
              newPosition.y <= obj.height &&
              groupRef.current.position.y > obj.height
            ) {
              newPosition.y = obj.height;
              newVerticalVelocity = 0;
              setIsJumping(false);
              landedOnTable = true;
              break;
            }
            // If we're already on the table, stay on it
            else if (Math.abs(groupRef.current.position.y - obj.height) < 0.1) {
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
    if (keys.current.w || keys.current.arrowup) {
      newPosition.z -= MOVE_SPEED;
      moved = true;
    }
    if (keys.current.s || keys.current.arrowdown) {
      newPosition.z += MOVE_SPEED;
      moved = true;
    }
    if (keys.current.a || keys.current.arrowleft) {
      newPosition.x -= MOVE_SPEED;
      moved = true;
    }
    if (keys.current.d || keys.current.arrowright) {
      newPosition.x += MOVE_SPEED;
      moved = true;
    }

    // Update rotation based on movement direction
    if (moved) {
      const movementX = newPosition.x - groupRef.current.position.x;
      const movementZ = newPosition.z - groupRef.current.position.z;
      if (movementX !== 0 || movementZ !== 0) {
        const angle = Math.atan2(movementX, movementZ);
        newRotation = angle;
      }
    }

    // Check collisions before applying movement
    if (!checkCollisions(newPosition)) {
      groupRef.current.position.x = newPosition.x;
      groupRef.current.position.y = newPosition.y;
      groupRef.current.position.z = newPosition.z;
      groupRef.current.rotation.y = newRotation;

      // Check for coin collisions
      checkCoinCollisions();

      // Notify parent of position change for voice chat
      onPositionChange({
        x: groupRef.current.position.x,
        y: groupRef.current.position.y,
        z: groupRef.current.position.z,
      });

      // Update server with player state
      GameStateService.updatePlayerState(
        {
          x: groupRef.current.position.x,
          y: groupRef.current.position.y,
          z: groupRef.current.position.z,
        },
        {
          x: groupRef.current.rotation.x,
          y: groupRef.current.rotation.y,
          z: groupRef.current.rotation.z,
        },
        moved
      );
    }

    setVerticalVelocity(newVerticalVelocity);
  });

  // Expose the group ref to parent
  useEffect(() => {
    if (playerRef) {
      playerRef.current = groupRef.current;
    }
  }, [playerRef]);

  return <group ref={groupRef}>{children}</group>;
};

export default Controls;
