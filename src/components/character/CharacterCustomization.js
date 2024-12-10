import React, { useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Shadow, useTexture } from "@react-three/drei";
import * as THREE from "three";
import Character from "./Character";
import "../../styles/character/CharacterCustomization.css";

// Background component
const Background = () => {
  const texture = useTexture("/assets/environment/cowboy-pattern.png");

  // Set texture to repeat
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1); // Adjust this value to control pattern density

  return (
    <mesh position={[0, 0, -2]} scale={[6, 6, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={texture} transparent opacity={0.5} />
    </mesh>
  );
};

const characterTypes = [
  { id: "cow", name: "Cow" },
  { id: "pig", name: "Pig" },
  { id: "tiger", name: "Tiger" },
];

const accessoryOptions = {
  hat: {
    name: "Cowboy Hat",
    colors: ["#8B4513", "#000000", "#FFFFFF", "#D2691E", "#A0522D", "#FFC8EB"],
    type: "hat",
  },
  boots: {
    name: "Cowboy Boots",
    colors: ["#8B4513", "#000000", "#FFFFFF", "#D2691E", "#A0522D", "#FFC8EB"],
    type: "boots",
  },
};

const CharacterCustomization = ({
  isOpen,
  onClose,
  currentCharacter,
  onSave,
  username,
  onUsernameChange,
}) => {
  const [selectedCharacter, setSelectedCharacter] = useState(
    currentCharacter || "cow"
  );
  const [localUsername, setLocalUsername] = useState(username || "");
  const [error, setError] = useState("");
  const [selectedAccessories, setSelectedAccessories] = useState({
    hat: false,
    boots: false,
  });
  const [accessoryColors, setAccessoryColors] = useState({
    hat: "#8B4513",
    boots: "#8B4513",
  });

  const handleSave = () => {
    if (!localUsername.trim()) {
      setError("Please enter a username");
      return;
    }

    // Convert selected accessories to the new format
    const processedAccessories = {};
    Object.entries(selectedAccessories).forEach(([key, isSelected]) => {
      if (isSelected) {
        processedAccessories[key] = true;
      }
    });

    onSave({
      characterType: selectedCharacter,
      username: localUsername,
      accessories: processedAccessories,
      accessoryColors: accessoryColors,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="character-customization-modal">
      <div className="modal-content">
        <div className="modal-grid">
          {/* Character Preview - Left Side */}
          <div className="character-preview">
            <Canvas camera={{ position: [0, 0.5, 2.5], fov: 45 }}>
              <color attach="background" args={["#501b13"]} />
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} intensity={2.8} />
              <directionalLight
                position={[5, 5, 5]}
                intensity={2.1}
                castShadow
              />
              <Suspense fallback={null}>
                <Background />
                <group position={[0, -0.7, 0]}>
                  <Character
                    modelPath={`/assets/characters/${selectedCharacter}.glb`}
                    position={[0, 0, 0]}
                    rotation={[0, Math.PI / 4, 0]}
                    accessories={selectedAccessories}
                    accessoryColors={accessoryColors}
                  />
                  <Shadow
                    position={[0, 0.001, 0]}
                    scale={[1, 1, 1]}
                    color="black"
                    opacity={0.3}
                  />
                </group>
              </Suspense>
            </Canvas>
          </div>

          {/* Customization Controls - Right Side */}
          <div className="customization-controls">
            <h2>Howdy, Partner!</h2>
            <p>
              Welcome to the Saloon! Ain’t seen you ’round here before—what do
              they call ya?
            </p>

            {/* Username Input */}
            <div className="customization-section">
              <h3>What’s yer handle, partner?</h3>
              <input
                type="text"
                value={localUsername}
                onChange={(e) => {
                  setLocalUsername(e.target.value);
                  setError("");
                }}
                placeholder="Enter your name"
                maxLength={20}
              />
              {error && <div className="error-message">{error}</div>}
            </div>

            {/* Character Selection */}
            <div className="customization-section">
              <h3>Choose yer look</h3>
              <div className="character-options">
                {characterTypes.map((char) => (
                  <button
                    key={char.id}
                    className={selectedCharacter === char.id ? "selected" : ""}
                    onClick={() => setSelectedCharacter(char.id)}
                  >
                    {char.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Accessories */}
            <div className="customization-section">
              <h3>Add a lil’ somethin’ extra to yer getup, cowpoke</h3>
              <div className="accessories-options">
                {Object.entries(accessoryOptions).map(([key, accessory]) => (
                  <div key={key} className="accessory-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedAccessories[key]}
                        onChange={() =>
                          setSelectedAccessories((prev) => ({
                            ...prev,
                            [key]: !prev[key],
                          }))
                        }
                      />
                      {accessory.name}
                    </label>
                    {selectedAccessories[key] && (
                      <div className="color-options">
                        {accessory.colors.map((color) => (
                          <button
                            key={color}
                            className={`color-option ${
                              accessoryColors[key] === color ? "selected" : ""
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() =>
                              setAccessoryColors((prev) => ({
                                ...prev,
                                [key]: color,
                              }))
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="button-group">
              <button className="save-button" onClick={handleSave}>
                Save & Enter
              </button>
              <button
                className="cancel-button"
                onClick={() => (window.location.href = "/home")}
              >
                Cancel
              </button>
            </div>
            <div className="controls-description">
              <p>
                Use <strong>WASD</strong> or the <strong>arrow keys</strong> to
                mosey around, and press <strong>Space</strong> to start leaping.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterCustomization;
