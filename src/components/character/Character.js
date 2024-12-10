import React, { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { CharacterAccessories } from "../characters/CharacterAccessories";

const Character = ({
  modelPath = "/assets/characters/cow.glb",
  position,
  rotation,
  isMoving,
  onPositionChange,
  accessories = {},
  accessoryColors = {},
  username,
  isSpeaking,
}) => {
  const group = useRef();
  const [modelError, setModelError] = useState(null);
  const mixerRef = useRef();
  const actionsRef = useRef({});
  const defaultModel = useGLTF("/assets/characters/cow.glb");

  // Load model with error handling
  const { scene, animations } = useGLTF(modelPath, undefined, (error) => {
    console.error("Error loading model:", modelPath, error);
    setModelError(error);
  });

  // Preload all character models
  useEffect(() => {
    const models = ["cow", "pig", "tiger"];
    models.forEach((model) => {
      useGLTF.preload(`/assets/characters/${model}.glb`);
    });
  }, []);

  // Clone the scene to avoid sharing materials between instances
  const clonedScene = React.useMemo(() => {
    if (!scene) {
      console.warn("No scene available, using default model");
      if (defaultModel.scene) {
        return SkeletonUtils.clone(defaultModel.scene);
      }
      return null;
    }

    // Use SkeletonUtils for proper skeleton cloning
    const cloned = SkeletonUtils.clone(scene);

    // Clone materials to prevent sharing
    cloned.traverse((node) => {
      if (node.isMesh) {
        node.material = node.material.clone();
      }
    });

    return cloned;
  }, [scene, defaultModel]);

  // Setup animations
  useEffect(() => {
    if (clonedScene && animations?.length) {
      // Create new animation mixer
      const mixer = new THREE.AnimationMixer(clonedScene);
      mixerRef.current = mixer;

      // Setup all animations
      animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        actionsRef.current[clip.name] = action;
      });

      // Start idle animation
      if (actionsRef.current["Idle"]) {
        actionsRef.current["Idle"].play();
      }

      return () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(clonedScene);
      };
    }
  }, [clonedScene, animations]);

  // Handle animation transitions
  useEffect(() => {
    if (
      !mixerRef.current ||
      !actionsRef.current["Walk"] ||
      !actionsRef.current["Idle"]
    )
      return;

    const currentAction = isMoving ? "Walk" : "Idle";
    const fadeTime = 0.2;

    Object.entries(actionsRef.current).forEach(([name, action]) => {
      if (name === currentAction) {
        action.reset().fadeIn(fadeTime).play();
      } else {
        action.fadeOut(fadeTime);
      }
    });
  }, [isMoving]);

  // Update animation mixer
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  if (modelError) {
    console.warn(`Failed to load model: ${modelPath}`);
    return null;
  }

  if (!clonedScene) {
    console.warn(`No scene available for model: ${modelPath}`);
    return null;
  }

  return (
    <group ref={group} position={position} rotation={rotation}>
      <primitive object={clonedScene} />
      <CharacterAccessories
        accessories={accessories}
        accessoryColors={accessoryColors}
        characterType={modelPath.split("/").pop().replace(".glb", "")}
      />
      {username && (
        <Html position={[0, 2, 0]}>
          <div className={`username-tag ${isSpeaking ? "speaking" : ""}`}>
            <div className="speaking-indicator" />
            <span>{username}</span>
          </div>
        </Html>
      )}
    </group>
  );
};

export default Character;
