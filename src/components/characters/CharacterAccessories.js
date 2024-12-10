import React, { Suspense, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Character-specific height adjustments
const CHARACTER_HAT_HEIGHTS = {
  cow: 1.3,
  pig: 1.32,
  tiger: 1.35,
};

// Add version number for cache busting
const ASSET_VERSION = Date.now();

// accessory configurations with positions and scales relative to the character
const getAccessoryConfig = (characterType = "cow") => ({
  hat: {
    position: [0, CHARACTER_HAT_HEIGHTS[characterType] || 1.3, 0],
    rotation: [0, 0, 0],
    scale: [0.28, 0.28, 0.3],
    fileName: "cowboy-hat.glb",
    directory: "hats",
  },
  boots: {
    position: [0, 0.1, 0],
    rotation: [0, 0, 0],
    scale: [1.1, 1.1, 1.1],
    fileName: "cowboy-boots.glb",
    directory: "boots",
  },
});

const AccessoryModel = ({ type, config, color }) => {
  // Add version to URL for cache busting
  const modelUrl = `/assets/characters/accessories/${config.directory}/${config.fileName}?v=${ASSET_VERSION}`;

  // Clear the cache for the old model
  useEffect(() => {
    return () => {
      useGLTF.preload(modelUrl);
      useGLTF.clear(modelUrl);
    };
  }, [modelUrl]);

  const { scene } = useGLTF(modelUrl);

  // Clone the scene to avoid sharing materials
  const clonedScene = React.useMemo(() => {
    const cloned = scene.clone();

    // Apply color to all meshes in the model
    cloned.traverse((node) => {
      if (node.isMesh) {
        // Clone the material to avoid sharing
        node.material = node.material.clone();
        // Set the color and material properties
        if (color) {
          node.material.color.set(color);
          // Adjust material properties for better appearance
          node.material.metalness = 0.3;
          node.material.roughness = 0.7;
        }
      }
    });

    return cloned;
  }, [scene, color]);

  return (
    <primitive
      object={clonedScene}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
    />
  );
};

export const CharacterAccessories = ({
  accessories = {},
  accessoryColors = {},
  characterType = "cow",
}) => {
  // Get the configuration based on character type
  const accessoryConfig = React.useMemo(
    () => getAccessoryConfig(characterType),
    [characterType]
  );

  // Preload accessory models with cache busting
  useEffect(() => {
    Object.entries(accessoryConfig).forEach(([type, config]) => {
      const modelUrl = `/assets/characters/accessories/${config.directory}/${config.fileName}?v=${ASSET_VERSION}`;
      useGLTF.preload(modelUrl);
    });

    // Cleanup function to clear cache when component unmounts
    return () => {
      Object.entries(accessoryConfig).forEach(([type, config]) => {
        const modelUrl = `/assets/characters/accessories/${config.directory}/${config.fileName}?v=${ASSET_VERSION}`;
        useGLTF.clear(modelUrl);
      });
    };
  }, [accessoryConfig]);

  return (
    <group>
      <Suspense fallback={null}>
        {/* Render hat if selected */}
        {accessories.hat && (
          <AccessoryModel
            type="hat"
            config={accessoryConfig.hat}
            color={accessoryColors.hat}
          />
        )}

        {/* Render boots if selected */}
        {accessories.boots && (
          <AccessoryModel
            type="boots"
            config={accessoryConfig.boots}
            color={accessoryColors.boots}
          />
        )}
      </Suspense>
    </group>
  );
};
