import React, { useEffect, useState } from "react";
import Scene from "./components/scene/Scene";
import WebRTCService from "./services/webrtc";
import MusicControls from "./components/audio/MusicControls";
import MicControls from "./components/audio/MicControls";
import GameStateService from "./services/gameState";
import CoinCounter from "./components/ui/CoinCounter";
import CharacterCustomization from "./components/character/CharacterCustomization";
import "./App.css";

function App() {
  const [userId] = useState("user-" + Math.random().toString(36).substr(2, 9));
  const [players, setPlayers] = useState([]);
  const [coins, setCoins] = useState([]);
  const [showCustomization, setShowCustomization] = useState(true);
  const [characterData, setCharacterData] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get("room") || "test-room";

    // Only initialize services after character creation
    if (characterData) {
      WebRTCService.initVoiceChat(roomId, userId);
      GameStateService.connect(roomId, userId, characterData)
        .then(() => {
          GameStateService.onPlayersUpdate = (updatedPlayers) =>
            setPlayers(updatedPlayers);
          GameStateService.onCoinsUpdate = (coinsState) => {
            if (coinsState?.coins) {
              setCoins(coinsState.coins);
            }
          };
        })
        .catch(console.error);
    }

    return () => {
      if (characterData) {
        GameStateService.disconnect();
      }
    };
  }, [userId, characterData]);

  const handleCharacterSave = (data) => {
    setCharacterData(data);
    GameStateService.setCharacterData(data);
    setShowCustomization(false);
  };

  const handleCoinCollect = async (coinId) => {
    try {
      await GameStateService.collectCoin(coinId);
    } catch (error) {
      console.error("Error collecting coin:", error);
    }
  };

  const currentPlayer = players.find((p) => p.id === userId);
  const playerCoins = currentPlayer?.coins || 0;

  return (
    <div className="App">
      {showCustomization ? (
        <CharacterCustomization
          isOpen={showCustomization}
          onClose={() => setShowCustomization(false)}
          onSave={handleCharacterSave}
        />
      ) : (
        <>
          <div className="game-container">
            <Scene
              userId={userId}
              players={players}
              coins={coins}
              characterData={characterData}
              onCoinCollect={handleCoinCollect}
            />
          </div>
          <div className="ui-overlay">
            <CoinCounter coins={playerCoins} />
            <MusicControls userId={userId} players={players} />
            <MicControls />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
