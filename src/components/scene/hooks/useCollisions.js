import { useMemo } from "react";

const COLLISION_THRESHOLD = 1;

export const useCollisions = (players) => {
  // Define static collision boxes for furniture
  const staticColliders = useMemo(
    () => [
      // Bar
      { min: { x: -8, z: -2 }, max: { x: 8, z: 2 } },
      // Tables
      { min: { x: -6, z: -8 }, max: { x: -4, z: -6 } },
      { min: { x: 4, z: -8 }, max: { x: 6, z: -6 } },
      { min: { x: -6, z: 6 }, max: { x: -4, z: 8 } },
      { min: { x: 4, z: 6 }, max: { x: 6, z: 8 } },
      // Walls
      { min: { x: -10, z: -10 }, max: { x: 10, z: -9.5 } },
      { min: { x: -10, z: 9.5 }, max: { x: 10, z: 10 } },
      { min: { x: -10, z: -10 }, max: { x: -9.5, z: 10 } },
      { min: { x: 9.5, z: -10 }, max: { x: 10, z: 10 } },
    ],
    []
  );

  const checkCollisions = (newPosition) => {
    // Check static colliders
    for (const collider of staticColliders) {
      if (
        newPosition.x >= collider.min.x - COLLISION_THRESHOLD &&
        newPosition.x <= collider.max.x + COLLISION_THRESHOLD &&
        newPosition.z >= collider.min.z - COLLISION_THRESHOLD &&
        newPosition.z <= collider.max.z + COLLISION_THRESHOLD
      ) {
        return { collision: true, type: "static" };
      }
    }

    // Check player collisions
    for (const player of players) {
      const dx = newPosition.x - player.position.x;
      const dz = newPosition.z - player.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < COLLISION_THRESHOLD * 2) {
        return { collision: true, type: "player" };
      }
    }

    return { collision: false };
  };

  return { checkCollisions };
};
