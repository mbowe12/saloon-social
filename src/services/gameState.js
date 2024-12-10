import { db } from "./firebase";
import AudioManager from "../audio/AudioManager";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  runTransaction,
  writeBatch,
} from "firebase/firestore";

// shared game state
export const keys = {};

// Initialize coins if they don't exist
const initializeCoins = async (roomId) => {
  const coinsRef = doc(db, "rooms", roomId, "state", "coins");
  const coinsDoc = await getDoc(coinsRef);

  // if no coins exist or coins array is empty, create them
  if (!coinsDoc.exists() || !coinsDoc.data()?.coins?.length) {
    console.log("Initializing coins...");
    const timestamp = Date.now();
    const initialCoins = {
      coins: [
        { id: `${timestamp}-1`, position: [-8, 0.5, -8] },
        { id: `${timestamp}-2`, position: [8, 0.5, -8] },
        { id: `${timestamp}-3`, position: [-8, 0.5, 8] },
        { id: `${timestamp}-4`, position: [8, 0.5, 8] },
      ],
      lastRespawn: serverTimestamp(),
    };
    console.log("Writing initial coins:", initialCoins);
    await setDoc(coinsRef, initialCoins);
    return { ref: coinsRef, data: initialCoins };
  }

  const existingData = coinsDoc.data();
  console.log("Found existing coins:", existingData);
  return { ref: coinsRef, data: existingData };
};

// Initialize room if it doesn't exist
const initializeRoom = async (roomId) => {
  const roomRef = doc(db, "rooms", roomId);
  const roomDoc = await getDoc(roomRef);

  if (!roomDoc.exists()) {
    console.log("Initializing room:", roomId);
    await setDoc(roomRef, {
      created: serverTimestamp(),
      lastActivity: serverTimestamp(),
      peers: {},
    });
  }

  // Initialize state collection
  const stateRef = doc(db, "rooms", roomId, "state", "game");
  const stateDoc = await getDoc(stateRef);

  if (!stateDoc.exists()) {
    await setDoc(stateRef, {
      created: serverTimestamp(),
      lastUpdate: serverTimestamp(),
    });
  }

  return roomRef;
};

class GameStateService {
  constructor() {
    this.players = new Map();
    this.currentUserId = null;
    this.roomId = null;
    this.onPlayersUpdate = null;
    this.onMusicUpdate = null;
    this.onCoinsUpdate = null;
    this.unsubscribeFromPlayers = null;
    this.unsubscribeFromMusic = null;
    this.unsubscribeFromCoins = null;
    this.heartbeatInterval = null;
    this.cleanupInterval = null;
    this.respawnTimers = new Map();
    this.lastUpdateTime = 0;
    this.UPDATE_INTERVAL = 50;
    this.characterData = null;
    this.audioManager = AudioManager.getInstance();
  }

  async connect(roomId, userId, characterData = null) {
    this.roomId = roomId;
    this.currentUserId = userId;
    this.characterData = characterData;

    try {
      // Initialize room and required collections
      await initializeRoom(roomId);

      // Initialize player document with safe defaults
      const playerRef = doc(db, "rooms", roomId, "players", userId);
      await setDoc(playerRef, {
        id: userId,
        username: characterData?.username || `Player ${userId.slice(0, 4)}`,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        isMoving: false,
        characterType: characterData?.type || "cow",
        accessories: characterData?.accessories || {},
        accessoryColors: characterData?.colors || {},
        lastUpdate: serverTimestamp(),
        lastHeartbeat: serverTimestamp(),
        isSpeaking: false,
        isMuted: false,
        coins: 0,
      });

      // Initialize coins
      await initializeCoins(roomId);

      // Setup listeners
      this.setupPlayerListener();
      this.setupMusicListener();
      this.setupCoinListener();

      // Start heartbeat and cleanup
      this.startHeartbeat();
      this.startCleanup();
    } catch (error) {
      console.error("Error connecting to game state:", error);
      throw error;
    }
  }

  // Setup player listener
  setupPlayerListener() {
    if (!this.roomId) return;

    this.unsubscribeFromPlayers = onSnapshot(
      collection(db, "rooms", this.roomId, "players"),
      {
        includeMetadataChanges: true,
      },
      (snapshot) => {
        const players = [];
        const now = Date.now();

        snapshot.forEach((doc) => {
          try {
            const player = doc.data();
            // Ensure we have valid player data and the player is active
            if (!player || !player.id) return;

            // Check if player is still active (within last 10 seconds)
            const lastUpdate =
              player.lastHeartbeat?.toMillis() || player.lastUpdate?.toMillis();
            if (!lastUpdate || now - lastUpdate > 10000) return;

            players.push({
              id: player.id,
              username:
                player.username || `Player ${(player.id || "").slice(0, 4)}`,
              position: player.position || { x: 0, y: 0, z: 0 },
              rotation: player.rotation || { x: 0, y: 0, z: 0 },
              isMoving: Boolean(player.isMoving),
              characterType: player.characterType || "cow",
              accessories: player.accessories || {},
              accessoryColors: player.accessoryColors || {},
              isSpeaking: Boolean(player.isSpeaking),
              isMuted: Boolean(player.isMuted),
              lastUpdate: player.lastUpdate || null,
              coins: Number(player.coins || 0),
            });
          } catch (error) {
            console.error("Error processing player data:", error);
          }
        });

        if (this.onPlayersUpdate) {
          this.onPlayersUpdate(players);
        }
      }
    );
  }

  // Setup music listener
  setupMusicListener() {
    if (!this.roomId) return;

    const musicStateRef = doc(db, "rooms", this.roomId, "state", "music");

    this.unsubscribeFromMusic = onSnapshot(musicStateRef, async (snapshot) => {
      if (!snapshot.exists()) {
        await this.initializeMusicState(this.roomId);
        return;
      }

      const musicState = snapshot.data();
      if (this.onMusicUpdate) {
        this.onMusicUpdate(musicState);
      }

      // update audio manager state
      if (musicState.isPlaying) {
        this.audioManager.startPlaylist();
        if (typeof musicState.currentSongIndex === "number") {
          this.audioManager.playTrack(musicState.currentSongIndex);
        }
      } else {
        this.audioManager.stopPlaylist();
      }
    });
  }

  // Setup coin listener
  setupCoinListener() {
    if (!this.roomId) return;

    const coinsRef = doc(db, "rooms", this.roomId, "state", "coins");
    this.unsubscribeFromCoins = onSnapshot(coinsRef, (snapshot) => {
      if (snapshot.exists() && this.onCoinsUpdate) {
        const data = snapshot.data();
        if (!data.coins || data.coins.length === 0) {
          initializeCoins(this.roomId);
        } else {
          this.onCoinsUpdate(data);
        }
      }
    });
  }

  // Start heartbeat
  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      if (this.currentUserId && this.roomId) {
        const playerRef = doc(
          db,
          "rooms",
          this.roomId,
          "players",
          this.currentUserId
        );

        try {
          const playerDoc = await getDoc(playerRef);

          if (!playerDoc.exists()) {
            console.log("Recreating player document");
            await setDoc(playerRef, {
              id: this.currentUserId,
              username:
                this.characterData?.username ||
                `Player ${this.currentUserId.slice(0, 4)}`,
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              isMoving: false,
              characterType: this.characterData?.type || "cow",
              accessories: this.characterData?.accessories || {},
              accessoryColors: this.characterData?.colors || {},
              lastUpdate: serverTimestamp(),
              lastHeartbeat: serverTimestamp(),
              isSpeaking: false,
              isMuted: false,
            });
          } else {
            await setDoc(
              playerRef,
              {
                lastHeartbeat: serverTimestamp(),
              },
              { merge: true }
            );
          }
        } catch (error) {
          console.error("Error in heartbeat:", error);
        }
      }
    }, 5000);
  }

  // Start cleanup
  startCleanup() {
    this.cleanupInterval = setInterval(async () => {
      if (!this.roomId) return;

      const playersRef = collection(db, "rooms", this.roomId, "players");
      const snapshot = await getDocs(playersRef);
      const staleTimeout = 30000; // Consider players stale after 30 seconds

      const now = Date.now();
      const batch = writeBatch(db);
      let hasStalePlayers = false;

      snapshot.forEach((doc) => {
        const playerData = doc.data();
        const lastUpdate = playerData.lastHeartbeat?.toMillis() || 0;

        if (
          now - lastUpdate > staleTimeout &&
          playerData.id !== this.currentUserId
        ) {
          console.log("Removing stale player:", playerData.id);
          batch.delete(doc.ref);
          hasStalePlayers = true;
        }
      });

      if (hasStalePlayers) {
        await batch.commit();
      }
    }, 10000);
  }

  async updatePlayerState(position, rotation, isMoving, additionalData = {}) {
    if (!this.currentUserId || !this.roomId) return;

    const now = Date.now();
    if (now - this.lastUpdateTime < this.UPDATE_INTERVAL) {
      return;
    }
    this.lastUpdateTime = now;

    const playerRef = doc(
      db,
      "rooms",
      this.roomId,
      "players",
      this.currentUserId
    );

    await setDoc(
      playerRef,
      {
        position,
        rotation,
        isMoving,
        ...additionalData,
        lastUpdate: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // Initialize music state if it doesn't exist
  async initializeMusicState(roomId) {
    const musicStateRef = doc(db, "rooms", roomId, "state", "music");
    await setDoc(musicStateRef, {
      isPlaying: true,
      currentSongIndex: 0,
      lastUpdate: serverTimestamp(),
    });
  }

  // Disconnect player
  disconnect() {
    if (this.unsubscribeFromPlayers) {
      this.unsubscribeFromPlayers();
      this.unsubscribeFromPlayers = null;
    }
    if (this.unsubscribeFromMusic) {
      this.unsubscribeFromMusic();
      this.unsubscribeFromMusic = null;
    }
    if (this.unsubscribeFromCoins) {
      this.unsubscribeFromCoins();
      this.unsubscribeFromCoins = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    // Clean up player document on disconnect
    if (this.currentUserId && this.roomId) {
      const playerRef = doc(
        db,
        "rooms",
        this.roomId,
        "players",
        this.currentUserId
      );
      deleteDoc(playerRef).catch(console.error);
    }
    this.currentUserId = null;
    this.roomId = null;
  }

  // Schedule respawn for a specific coin
  scheduleRespawn(position) {
    const positionKey = position.join(",");

    // Clear existing timer if there is one
    if (this.respawnTimers.has(positionKey)) {
      clearTimeout(this.respawnTimers.get(positionKey));
    }

    // Set new timer
    const timer = setTimeout(async () => {
      try {
        const coinsRef = doc(db, "rooms", this.roomId, "state", "coins");
        const coinsDoc = await getDoc(coinsRef);

        if (!coinsDoc.exists()) return;

        const coinsData = coinsDoc.data();
        const newCoin = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          position,
        };

        console.log("Respawning coin at position:", position);

        // Add the new coin to the existing coins array
        await setDoc(
          coinsRef,
          {
            coins: [...(coinsData.coins || []), newCoin],
            lastRespawn: serverTimestamp(),
          },
          { merge: true }
        );

        this.respawnTimers.delete(positionKey);
      } catch (error) {
        console.error("Error respawning coin:", error);
      }
    }, 5000); // Respawn after 5 seconds

    this.respawnTimers.set(positionKey, timer);
  }

  // Collect coin
  async collectCoin(coinId) {
    if (!this.roomId || !this.currentUserId) {
      console.error("Cannot collect coin: no room or user ID");
      return;
    }

    const coinsRef = doc(db, "rooms", this.roomId, "state", "coins");
    const playerRef = doc(
      db,
      "rooms",
      this.roomId,
      "players",
      this.currentUserId
    );

    try {
      const coinsDoc = await getDoc(coinsRef);
      const playerDoc = await getDoc(playerRef);

      if (!coinsDoc.exists() || !playerDoc.exists()) {
        console.error("Coins or player document doesn't exist");
        return;
      }

      const coinsData = coinsDoc.data();
      const playerData = playerDoc.data();

      const coinToCollect = coinsData.coins.find((coin) => coin.id === coinId);
      if (!coinToCollect) return;

      const coinPosition = [...coinToCollect.position];
      const remainingCoins = coinsData.coins.filter(
        (coin) => coin.id !== coinId
      );
      const currentCoins = playerData.coins || 0;
      const newCoinCount = currentCoins + 1;

      await Promise.all([
        setDoc(
          coinsRef,
          {
            coins: remainingCoins,
            lastRespawn: serverTimestamp(),
          },
          { merge: true }
        ),
        setDoc(
          playerRef,
          {
            coins: newCoinCount,
            lastUpdate: serverTimestamp(),
          },
          { merge: true }
        ),
      ]);

      this.scheduleRespawn(coinPosition);
      return newCoinCount;
    } catch (error) {
      console.error("Error collecting coin:", error);
    }
  }

  setCharacterData(data) {
    this.characterData = data;
  }

  async updateMusicState(isPlaying, currentSongIndex) {
    if (!this.roomId) return;

    const musicStateRef = doc(db, "rooms", this.roomId, "state", "music");
    await setDoc(
      musicStateRef,
      {
        isPlaying,
        currentSongIndex,
        lastUpdate: serverTimestamp(),
      },
      { merge: true }
    );

    // update audio manager state
    if (isPlaying) {
      this.audioManager.startPlaylist();
      if (typeof currentSongIndex === "number") {
        this.audioManager.playTrack(currentSongIndex);
      }
    } else {
      this.audioManager.stopPlaylist();
    }
  }

  bindMethods() {
    // bind only existing methods to this instance
    this.disconnect = this.disconnect.bind(this);
    this.collectCoin = this.collectCoin.bind(this);
    this.updatePlayerState = this.updatePlayerState.bind(this);
    this.scheduleRespawn = this.scheduleRespawn.bind(this);
    this.updateMusicState = this.updateMusicState.bind(this);
  }
}

// create a singleton instance
const gameStateService = new GameStateService();
gameStateService.bindMethods();
export default gameStateService;
