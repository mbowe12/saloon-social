import { useThree, useFrame } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

const CameraController = ({ target }) => {
  const { camera } = useThree();

  // Set initial camera position
  useEffect(() => {
    if (camera) {
      camera.position.set(0, 5, 8);
      camera.lookAt(0, 0, 0);
    }
  }, [camera]);

  useFrame(() => {
    if (!target?.current) return;

    // Get the target's world position
    const targetPosition = target.current.position;
    if (!targetPosition) return;

    // Position camera behind and above the player
    const idealPosition = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y + 3,
      targetPosition.z + 5
    );
    camera.position.lerp(idealPosition, 0.1);
    camera.lookAt(targetPosition.x, targetPosition.y, targetPosition.z);
  });

  return null;
};

export default CameraController;
