import React, { useEffect } from "react";
import Character from "./Character";
import WebRTCService from "../../services/webrtc";

const OtherPlayers = ({ players, currentUserId }) => {
  useEffect(() => {
    // listen for character updates from other players
    WebRTCService.onDataReceived = (peerId, data) => {
      if (data.type === "characterUpdate") {
        // update the player's data in your state management system
        // this depends on how you're managing state (Redux, Context, etc.)
        console.log("Received character update from peer:", peerId, data);
      }
    };
  }, []);

  // send character updates when local player changes
  useEffect(() => {
    const localPlayer = players.find((p) => p.id === currentUserId);
    if (localPlayer) {
      WebRTCService.sendCharacterUpdate({
        id: currentUserId,
        characterType: localPlayer.characterType,
        position: localPlayer.position,
        rotation: localPlayer.rotation,
        isMoving: localPlayer.isMoving,
        accessories: localPlayer.accessories,
        accessoryColors: localPlayer.accessoryColors,
        username: localPlayer.username || localPlayer.name,
        isSpeaking: localPlayer.isSpeaking,
      });
    }
  }, [players, currentUserId]);

  return (
    <>
      {players
        .filter((player) => player.id !== currentUserId)
        .map((player) => {
          const characterType = player.characterType || "cow";
          const position = player.position || { x: 0, y: 0, z: 0 };
          const rotation = player.rotation || { x: 0, y: 0, z: 0 };

          return (
            <Character
              key={player.id}
              modelPath={`/assets/characters/${characterType}.glb`}
              position={[position.x, position.y, position.z]}
              rotation={[rotation.x, rotation.y, rotation.z]}
              isMoving={player.isMoving || false}
              accessories={player.accessories || {}}
              accessoryColors={player.accessoryColors || {}}
              username={
                player.username ||
                player.name ||
                `Player ${player.id.slice(0, 4)}`
              }
              isSpeaking={player.isSpeaking || false}
              onPositionChange={() => {}}
            />
          );
        })}
    </>
  );
};

export default OtherPlayers;
