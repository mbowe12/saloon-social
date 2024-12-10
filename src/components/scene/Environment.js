import React, { useRef, Suspense } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

// Bar component with bottles
const Bar = () => (
  <group>
    {/* Main bar */}
    <mesh position={[-4, 1, -6]} receiveShadow castShadow>
      <boxGeometry args={[6, 1.5, 1]} />
      <meshStandardMaterial color="#4a3728" />
    </mesh>

    {/* Bar bottles */}
    {[
      [-2, 1.8, -6],
      [-3, 1.8, -6],
      [-4, 1.8, -6],
      [-5, 1.8, -6],
      [-6, 1.8, -6],
    ].map((pos, i) => (
      <mesh key={`bottle-${i}`} position={pos}>
        <cylinderGeometry args={[0.1, 0.1, 0.5, 8]} />
        <meshStandardMaterial
          color={["#44ff44", "#4444ff", "#ff4444", "#44ffff", "#ffff44"][i % 5]}
          transparent
          opacity={0.6}
        />
      </mesh>
    ))}
  </group>
);

// Table component
const Table = ({ position }) => (
  <mesh position={position} receiveShadow castShadow>
    <cylinderGeometry args={[1, 1, 1, 16]} />
    <meshStandardMaterial color="#8b4513" />
  </mesh>
);

// Stool component
const Stool = ({ position }) => (
  <mesh position={position} receiveShadow castShadow>
    <cylinderGeometry args={[0.3, 0.3, 0.8, 16]} />
    <meshStandardMaterial color="#654321" />
  </mesh>
);

// Window component
const Window = ({ position }) => (
  <group position={position}>
    {/* window frame */}
    <mesh>
      <boxGeometry args={[0.2, 1.7, 1.2]} />
      <meshStandardMaterial color="#4a3728" />
    </mesh>
    {/* window glass */}
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[0.1, 1.5, 1]} />
      <meshStandardMaterial color="#87CEEB" transparent opacity={0.5} />
    </mesh>
  </group>
);

// Spinning coin component
const SpinningCoin = ({ position, id, onCollect }) => {
  const coinRef = useRef();

  useFrame((state) => {
    if (coinRef.current) {
      // Rotate coin around Y axis
      coinRef.current.rotation.y += 0.02;

      // Hover animation
      const hover = Math.sin(state.clock.elapsedTime * 2) * 0.1;
      coinRef.current.position.set(
        position[0],
        position[1] + hover,
        position[2]
      );
    }
  });

  return (
    <mesh
      ref={coinRef}
      position={position}
      rotation={[0, 0, Math.PI / 2]}
      onClick={() => onCollect(id)}
      castShadow
    >
      <cylinderGeometry args={[0.2, 0.2, 0.05, 32]} />
      <meshStandardMaterial color="gold" metalness={0.7} roughness={0.3} />
    </mesh>
  );
};

const TexturedEnvironment = ({ coins, roomWidth, roomLength }) => {
  // Load textures with relative paths - hooks must be called unconditionally
  const floorTexture = useLoader(
    THREE.TextureLoader,
    "/assets/environment/Saloon-Floor.png"
  );
  const wallTexture = useLoader(
    THREE.TextureLoader,
    "/assets/environment/Saloon-Wall.png"
  );

  try {
    // Configure floor texture
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(4, 4);
    floorTexture.rotation = Math.PI / 2;

    // Configure wall texture
    wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(6, 2);

    return (
      <group>
        {/* Floor */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[roomWidth, roomLength]} />
          <meshStandardMaterial
            map={floorTexture}
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>

        {/* Back wall */}
        <mesh position={[0, 2, -roomLength / 2]} receiveShadow>
          <planeGeometry args={[roomWidth, 4]} />
          <meshStandardMaterial
            map={wallTexture}
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>

        {/* Front wall (railing) */}
        <mesh position={[0, 1.1, roomLength / 2]}>
          <boxGeometry args={[roomWidth, 0.2, 0.1]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        {/* Vertical supports */}
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh
            key={`support-${i}`}
            position={[
              -roomWidth / 2 + i * (roomWidth / 5),
              0.85,
              roomLength / 2,
            ]}
          >
            <boxGeometry args={[0.1, 1.5, 0.1]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
        ))}

        {/* Left wall with window cutouts */}
        <group position={[-roomWidth / 2, 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          {/* main wall */}
          <mesh receiveShadow>
            <planeGeometry args={[roomLength, 4]} />
            <meshStandardMaterial
              map={wallTexture}
              roughness={0.8}
              metalness={0.2}
              // add alphaMap for cutouts
              alphaTest={0.5}
            />
          </mesh>
          {/* dark interior visible through windows */}
          <mesh position={[5, 0, 0.1]}>
            <planeGeometry args={[1.2, 1.7]} />
            <meshBasicMaterial color="#111111" />
          </mesh>
          <mesh position={[-5, 0, 0.1]}>
            <planeGeometry args={[1.2, 1.7]} />
            <meshBasicMaterial color="#111111" />
          </mesh>
        </group>

        {/* Right wall with window cutouts */}
        <group position={[roomWidth / 2, 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
          {/* main wall */}
          <mesh receiveShadow>
            <planeGeometry args={[roomLength, 4]} />
            <meshStandardMaterial
              map={wallTexture}
              roughness={0.8}
              metalness={0.2}
              // add alphaMap for cutouts
              alphaTest={0.5}
            />
          </mesh>
          {/* dark interior visible through windows */}
          <mesh position={[5, 0, -0.1]}>
            <planeGeometry args={[1.2, 1.7]} />
            <meshBasicMaterial color="#111111" />
          </mesh>
          <mesh position={[-5, 0, -0.1]}>
            <planeGeometry args={[1.2, 1.7]} />
            <meshBasicMaterial color="#111111" />
          </mesh>
        </group>

        {/* Windows */}
        {[
          [-roomWidth / 2 + 0.1, 2, -5],
          [-roomWidth / 2 + 0.1, 2, 5],
          [roomWidth / 2 - 0.1, 2, -5],
          [roomWidth / 2 - 0.1, 2, 5],
        ].map((pos, i) => (
          <Window key={`window-${i}`} position={pos} />
        ))}

        <Bar />

        {/* Tables */}
        {[
          [7, 0.5, 0],
          [-5, 0.5, 5],
          [3, 0.5, -5],
        ].map((pos, i) => (
          <Table key={`table-${i}`} position={pos} />
        ))}

        {/* Table stools */}
        {[
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
        ].map((pos, i) => (
          <Stool key={`table-stool-${i}`} position={pos} />
        ))}

        {/* Bar stools */}
        {[
          [-2, 0.4, -6],
          [-4, 0.4, -6],
          [-6, 0.4, -6],
        ].map((pos, i) => (
          <Stool key={`bar-stool-${i}`} position={pos} />
        ))}

        {/* Coins */}
        {coins?.map((coin) => (
          <SpinningCoin
            key={coin.id}
            position={coin.position}
            id={coin.id}
            onCollect={coin.onCollect}
          />
        ))}
      </group>
    );
  } catch (error) {
    console.error("Error in TexturedEnvironment:", error);
    return (
      <FallbackEnvironment
        coins={coins}
        roomWidth={roomWidth}
        roomLength={roomLength}
      />
    );
  }
};

// Fallback environment without textures
const FallbackEnvironment = ({ coins, roomWidth, roomLength }) => {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[roomWidth, roomLength]} />
        <meshStandardMaterial color="#8B4513" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 2, -roomLength / 2]} receiveShadow>
        <planeGeometry args={[roomWidth, 4]} />
        <meshStandardMaterial color="#8B4513" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Front wall (thin strip at top) */}
      <mesh position={[0, 3.5, roomLength / 2]}>
        <boxGeometry args={[roomWidth, 1, 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Left wall */}
      <mesh
        position={[-roomWidth / 2, 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[roomLength, 4]} />
        <meshStandardMaterial color="#8B4513" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Right wall */}
      <mesh
        position={[roomWidth / 2, 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[roomLength, 4]} />
        <meshStandardMaterial color="#8B4513" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Rest of the components */}
      <Bar />
      {/* ... other components ... */}
    </group>
  );
};

// Wrap the environment in Suspense
const Environment = (props) => {
  return (
    <Suspense fallback={<FallbackEnvironment {...props} />}>
      <TexturedEnvironment {...props} />
    </Suspense>
  );
};

export default Environment;
