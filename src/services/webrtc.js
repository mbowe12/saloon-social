import { db } from "./firebase";
import { onSnapshot, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";

class WebRTCService {
  constructor() {
    this.localStream = null;
    this.peerConnections = {};
    this.dataChannels = {};
    this.onRemoteStream = null;
    this.onDataReceived = null;
    this.roomRef = null;
    this.userId = null;
    this.isMuted = false;
    this.remoteAudioElements = {};
    this.reconnectAttempts = {};
    this.MAX_RECONNECT_ATTEMPTS = 3;
    this.audioDebugInterval = null;
    this.firebaseReconnectTimeout = null;
    this.isReconnecting = false;
    this.connectionUnsubscribe = null;
  }

  async initVoiceChat(roomId, userId) {
    this.userId = userId;
    this.roomRef = doc(db, "rooms", roomId);

    try {
      console.log(
        "Initializing voice chat for user:",
        userId,
        "in room:",
        roomId
      );

      // Get user's audio stream with specific microphone constraints
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
          // Add specific constraints for voice
          latency: 0,
          volume: 1.0,
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
        },
        video: false,
      });

      this.localStream = audioStream;

      // Create audio context for voice monitoring
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
        latencyHint: "interactive",
        sampleRate: 48000,
      });

      const microphone = audioContext.createMediaStreamSource(audioStream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0; // Ensure microphone volume is at maximum

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Increased for better voice detection

      microphone.connect(gainNode);
      gainNode.connect(analyser);

      // Monitor voice levels
      const dataArray = new Float32Array(analyser.frequencyBinCount);
      const checkAudioLevel = () => {
        analyser.getFloatTimeDomainData(dataArray);
        const rms = Math.sqrt(
          dataArray.reduce((acc, val) => acc + val * val, 0) / dataArray.length
        );
        const db = 20 * Math.log10(Math.max(rms, 1e-10));
        if (db > -50) {
          console.log("Voice input level (dB):", db.toFixed(2));
        }
        requestAnimationFrame(checkAudioLevel);
      };
      checkAudioLevel();

      // Setup room listener and continue with initialization...
      this.setupRoomListener();

      await this.updatePeerData(this.userId, {
        joined: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        isMuted: false,
        isSpeaking: false,
      });

      console.log("Voice chat initialized successfully");
      this.startHeartbeat();
    } catch (error) {
      console.error("Error initializing voice chat:", error);
      throw error;
    }
  }

  setupRoomListener() {
    if (this.unsubscribeFromRoom) {
      this.unsubscribeFromRoom();
    }

    try {
      this.unsubscribeFromRoom = onSnapshot(
        this.roomRef,
        async (snapshot) => {
          const data = snapshot.data();
          console.log("Room data updated:", data);

          if (!data?.peers) {
            console.log("No peers in room data");
            return;
          }

          await this.processPeerUpdates(data.peers);
        },
        (error) => {
          if (error.code === "permission-denied") {
            console.error(
              "Firestore permission denied. Please check your security rules:",
              error
            );
          } else {
            console.error("Room listener error:", error);
            this.handleFirebaseDisconnection();
          }
        }
      );
    } catch (error) {
      console.error("Error setting up room listener:", error);
    }
  }

  async processPeerUpdates(peers) {
    // Clean up connections for peers that are no longer in the room
    Object.keys(this.peerConnections).forEach((peerId) => {
      if (!peers[peerId]) {
        console.log("Cleaning up connection for departed peer:", peerId);
        this.cleanupPeerConnection(peerId);
      }
    });

    // Handle peer updates
    for (const [peerId, peerData] of Object.entries(peers)) {
      if (peerId === this.userId) {
        console.log("Skipping self peer:", peerId);
        continue;
      }

      try {
        // Check if peer is active (has recent heartbeat)
        const lastHeartbeat = peerData.lastHeartbeat
          ? new Date(peerData.lastHeartbeat)
          : null;
        const isActive =
          lastHeartbeat && Date.now() - lastHeartbeat.getTime() <= 15000;

        if (!isActive) {
          if (this.peerConnections[peerId]) {
            console.log("Peer not active, cleaning up:", peerId);
            this.cleanupPeerConnection(peerId);
          }
          continue;
        }

        let pc = this.peerConnections[peerId];

        if (!pc) {
          console.log("Creating new peer connection for:", peerId);
          pc = await this.createPeerConnection(peerId);

          // Create and send offer immediately for new peers
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            voiceActivityDetection: true,
          });

          await pc.setLocalDescription(offer);
          console.log("Created and set local offer for peer:", peerId);

          await this.updatePeerData(this.userId, { offer: offer });
          console.log("Sent offer to peer:", peerId);
        }

        if (peerData.offer && !pc.remoteDescription) {
          console.log("Received offer from peer:", peerId);
          await this.handleOffer(peerId, peerData.offer);
        } else if (
          peerData.answer &&
          pc.localDescription &&
          !pc.remoteDescription
        ) {
          console.log("Received answer from peer:", peerId);
          await this.handleAnswer(peerId, peerData.answer);
        } else if (peerData.ice && pc.remoteDescription) {
          console.log("Received ICE candidate from peer:", peerId);
          await this.handleIceCandidate(peerId, peerData.ice);
        }
      } catch (error) {
        console.error("Error processing peer:", peerId, error);
      }
    }
  }

  handleFirebaseDisconnection() {
    console.log("Handling Firebase disconnection");
    this.isReconnecting = true;

    // Clear any existing timeout
    if (this.firebaseReconnectTimeout) {
      clearTimeout(this.firebaseReconnectTimeout);
    }

    // Set a timeout to attempt reconnection
    this.firebaseReconnectTimeout = setTimeout(() => {
      if (this.isReconnecting) {
        console.log("Attempting to reconnect to Firebase...");
        this.setupRoomListener();
      }
    }, 5000); // Try to reconnect after 5 seconds
  }

  async handleFirebaseReconnection() {
    console.log("Handling Firebase reconnection");
    this.isReconnecting = false;

    if (this.firebaseReconnectTimeout) {
      clearTimeout(this.firebaseReconnectTimeout);
    }

    try {
      // Re-initialize peer data
      await this.updatePeerData(this.userId, {
        joined: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        isMuted: this.isMuted,
        isSpeaking: false,
      });

      // Restart room listener
      this.setupRoomListener();
    } catch (error) {
      console.error("Error handling reconnection:", error);
      this.handleFirebaseDisconnection(); // Try again if failed
    }
  }

  debugAudioLevels() {
    // clear any existing interval
    if (this.audioDebugInterval) {
      clearInterval(this.audioDebugInterval);
    }

    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // monitor local stream
    if (this.localStream) {
      const localSource = audioContext.createMediaStreamSource(
        this.localStream
      );
      const localAnalyser = audioContext.createAnalyser();
      localAnalyser.fftSize = 256;
      localSource.connect(localAnalyser);

      const localDataArray = new Float32Array(localAnalyser.frequencyBinCount);

      console.log("Local audio stream active:", this.localStream.active);
      console.log(
        "Local audio tracks:",
        this.localStream.getAudioTracks().map((track) => ({
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        }))
      );
    }

    // monitor remote streams
    this.audioDebugInterval = setInterval(() => {
      // log peer connection states
      Object.entries(this.peerConnections).forEach(([peerId, pc]) => {
        console.log(`Peer ${peerId} connection state:`, {
          iceConnectionState: pc.iceConnectionState,
          connectionState: pc.connectionState,
          signalingState: pc.signalingState,
          remoteStreams: pc.getReceivers().map((receiver) => ({
            track: {
              enabled: receiver.track?.enabled,
              muted: receiver.track?.muted,
              readyState: receiver.track?.readyState,
            },
            transport: {
              state: receiver.transport?.state,
              bytesReceived: receiver.transport?.bytesReceived,
            },
          })),
        });
      });

      // log audio elements state
      Object.entries(this.remoteAudioElements).forEach(([peerId, audio]) => {
        console.log(`Remote audio element ${peerId}:`, {
          readyState: audio.readyState,
          paused: audio.paused,
          muted: audio.muted,
          volume: audio.volume,
          currentTime: audio.currentTime,
          srcObject: {
            active: audio.srcObject?.active,
            tracks: audio.srcObject?.getTracks().map((track) => ({
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState,
            })),
          },
        });
      });
    }, 5000); // log every 5 seconds
  }

  async createPeerConnection(peerId) {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: ["stun:stun.l.google.com:19302"] },
          { urls: ["stun:stun1.l.google.com:19302"] },
          {
            urls: [
              "turn:openrelay.metered.ca:80",
              "turn:openrelay.metered.ca:443",
              "turns:openrelay.metered.ca:443",
            ],
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });

      // Add local stream tracks with voice optimization
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          if (track.kind === "audio") {
            // Set specific audio processing constraints
            track
              .applyConstraints({
                autoGainControl: true,
                echoCancellation: true,
                noiseSuppression: true,
                latency: 0,
                volume: 1.0,
              })
              .catch((e) =>
                console.error("Error applying audio constraints:", e)
              );
          }
          console.log("Adding voice track to peer connection:", {
            id: track.id,
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            label: track.label,
          });
          pc.addTrack(track, this.localStream);
        });
      }

      // Handle incoming voice tracks
      pc.ontrack = (event) => {
        if (event.track.kind === "audio") {
          console.log("Received voice track:", {
            id: event.track.id,
            kind: event.track.kind,
            enabled: event.track.enabled,
            muted: event.track.muted,
            readyState: event.track.readyState,
          });

          // Create a simple audio element for direct playback
          const audio = new Audio();
          audio.autoplay = true;
          audio.volume = 1.0;

          // Create new MediaStream with the received track
          const stream = new MediaStream([event.track]);
          audio.srcObject = stream;

          // Debug audio element state
          setInterval(() => {
            console.log("Audio element state:", {
              currentTime: audio.currentTime,
              paused: audio.paused,
              volume: audio.volume,
              muted: audio.muted,
              readyState: audio.readyState,
              error: audio.error,
            });
          }, 2000);

          // Ensure audio starts playing
          const startPlayback = async () => {
            try {
              await audio.play();
              console.log("Voice playback started successfully");
            } catch (error) {
              console.error("Error starting voice playback:", error);
              // Retry playback after user interaction
              document.addEventListener(
                "click",
                () => {
                  audio.play().catch(console.error);
                },
                { once: true }
              );
            }
          };

          audio.oncanplay = startPlayback;

          // Store audio element reference
          this.remoteAudioElements[peerId] = audio;

          // Create separate audio context for monitoring levels only
          const monitorContext = new (window.AudioContext ||
            window.webkitAudioContext)();
          const monitorSource = monitorContext.createMediaStreamSource(stream);
          const analyser = monitorContext.createAnalyser();
          analyser.fftSize = 2048;

          monitorSource.connect(analyser);

          // Monitor voice levels without affecting playback
          const dataArray = new Float32Array(analyser.frequencyBinCount);
          const checkVoiceLevel = () => {
            analyser.getFloatTimeDomainData(dataArray);
            const rms = Math.sqrt(
              dataArray.reduce((acc, val) => acc + val * val, 0) /
                dataArray.length
            );
            const db = 20 * Math.log10(Math.max(rms, 1e-10));
            if (db > -50) {
              console.log(
                `Remote voice level for peer ${peerId} (dB):`,
                db.toFixed(2)
              );
            }
            requestAnimationFrame(checkVoiceLevel);
          };
          checkVoiceLevel();

          if (this.onRemoteStream) {
            this.onRemoteStream(peerId, stream);
          }
        }
      };

      // Enhanced ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("ICE candidate:", {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port,
          });

          const serializedCandidate = {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
            usernameFragment: event.candidate.usernameFragment,
          };
          this.updatePeerData(peerId, { ice: serializedCandidate });
        }
      };

      // Monitor ICE gathering state
      pc.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", pc.iceGatheringState);
      };

      // Enhanced connection state monitoring
      pc.oniceconnectionstatechange = () => {
        console.log(`ICE Connection State (${peerId}):`, pc.iceConnectionState);

        switch (pc.iceConnectionState) {
          case "checking":
            console.log("Attempting to establish connection...");
            break;
          case "connected":
            console.log("Connection established successfully");
            this.reconnectAttempts[peerId] = 0;
            break;
          case "failed":
            console.log("Connection failed - attempting fallback options");
            this.handleConnectionFailure(peerId);
            break;
          case "disconnected":
            console.log("Connection lost - attempting to recover");
            this.handleConnectionFailure(peerId);
            break;
        }
      };

      this.peerConnections[peerId] = pc;
      return pc;
    } catch (error) {
      console.error("Error creating peer connection:", error);
      throw error;
    }
  }

  setupDataChannel(dataChannel, peerId) {
    this.dataChannels[peerId] = dataChannel;

    dataChannel.onopen = () => {
      console.log(`Data channel opened with peer: ${peerId}`);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed with peer: ${peerId}`);
    };

    dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onDataReceived) {
          this.onDataReceived(peerId, data);
        }
      } catch (error) {
        console.error("Error processing data channel message:", error);
      }
    };
  }

  async handleConnectionFailure(peerId) {
    console.warn(`Connection failed/disconnected for peer: ${peerId}`);

    this.reconnectAttempts[peerId] = (this.reconnectAttempts[peerId] || 0) + 1;

    if (this.reconnectAttempts[peerId] <= this.MAX_RECONNECT_ATTEMPTS) {
      console.log(
        `Attempting reconnection ${this.reconnectAttempts[peerId]}/${this.MAX_RECONNECT_ATTEMPTS}`
      );

      const pc = this.peerConnections[peerId];
      if (pc) {
        // Try to restart ICE
        try {
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          await this.updatePeerData(peerId, { offer: offer });
          console.log("ICE restart initiated");
        } catch (error) {
          console.error("Error during ICE restart:", error);
          // If ICE restart fails, try full reconnection
          await this.cleanupPeerConnection(peerId);
          await this.createPeerConnection(peerId);
        }
      } else {
        await this.createPeerConnection(peerId);
      }
    } else {
      console.error(`Max reconnection attempts reached for peer: ${peerId}`);
      this.cleanupPeerConnection(peerId);
    }
  }

  // Method to send character updates
  sendCharacterUpdate(characterData) {
    Object.entries(this.dataChannels).forEach(([peerId, channel]) => {
      if (channel.readyState === "open") {
        channel.send(
          JSON.stringify({
            type: "characterUpdate",
            data: characterData,
          })
        );
      }
    });
  }

  async handleOffer(peerId, offer) {
    try {
      let pc = this.peerConnections[peerId];

      // If we don't have a connection yet, create one
      if (!pc) {
        pc = await this.createPeerConnection(peerId);
      }

      // Only set remote description if we're in a valid state
      if (pc.signalingState === "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.updatePeerData(peerId, { answer: answer });
      }
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }

  async handleAnswer(peerId, answer) {
    try {
      const pc = this.peerConnections[peerId];
      if (!pc) return;

      // Only set remote description if we're in have-local-offer state
      if (pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  }

  async handleIceCandidate(peerId, ice) {
    try {
      const pc = this.peerConnections[peerId];
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(ice));
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  }

  async updatePeerData(peerId, data) {
    try {
      console.log("Updating peer data for:", peerId, "with:", data);
      const update = {};
      const path = `peers.${peerId}`;

      // If updating our own peer data
      if (peerId === this.userId) {
        Object.entries(data).forEach(([key, value]) => {
          update[`${path}.${key}`] = value;
        });
      } else {
        // If updating data related to another peer (like offers/answers)
        Object.entries(data).forEach(([key, value]) => {
          update[`${path}.${key}`] = value;
        });
      }

      await updateDoc(this.roomRef, update);
      console.log("Peer data updated successfully");
    } catch (error) {
      if (error.code === "permission-denied") {
        console.error(
          "Firestore permission denied. Please check your security rules:",
          error
        );
      } else {
        console.error("Error updating peer data:", error);
      }
    }
  }

  async cleanupPeerConnection(peerId) {
    const pc = this.peerConnections[peerId];
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.oniceconnectionstatechange = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch (err) {
        console.error("Error closing peer connection:", err);
      }
      delete this.peerConnections[peerId];

      // Clean up audio element
      if (this.remoteAudioElements?.[peerId]) {
        this.remoteAudioElements[peerId].srcObject = null;
        delete this.remoteAudioElements[peerId];
      }
    }
  }

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        this.isMuted = !this.isMuted;
        audioTrack.enabled = !this.isMuted;
        console.log(
          "Local audio track muted:",
          this.isMuted,
          "enabled:",
          audioTrack.enabled
        );

        // Update mute state in Firebase
        if (this.userId && this.roomRef) {
          updateDoc(this.roomRef, {
            [`peers.${this.userId}.isMuted`]: this.isMuted,
          }).catch(console.error);
        }
      }
    }
  }

  updateSpeakingState(isSpeaking) {
    if (this.userId && this.roomRef) {
      updateDoc(this.roomRef, {
        [`peers.${this.userId}.isSpeaking`]: isSpeaking,
      }).catch(console.error);
    }
  }

  getLocalStream() {
    return this.localStream;
  }

  async disconnect() {
    if (this.connectionUnsubscribe) {
      this.connectionUnsubscribe();
    }
    if (this.audioDebugInterval) {
      clearInterval(this.audioDebugInterval);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }

    // Clean up all peer connections
    await Promise.all(
      Object.keys(this.peerConnections).map((peerId) =>
        this.cleanupPeerConnection(peerId)
      )
    );

    this.localStream = null;

    // Remove peer from room
    if (this.userId && this.roomRef) {
      try {
        const roomSnapshot = await getDoc(this.roomRef);
        if (roomSnapshot.exists()) {
          const data = roomSnapshot.data();
          const peers = { ...data.peers };
          delete peers[this.userId];
          await updateDoc(this.roomRef, { peers });
        }
      } catch (error) {
        console.error("Error cleaning up peer data:", error);
      }
    }
  }

  startHeartbeat() {
    console.log("Starting heartbeat");
    setInterval(async () => {
      if (this.userId && this.roomRef) {
        try {
          await updateDoc(this.roomRef, {
            [`peers.${this.userId}.lastHeartbeat`]: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Error updating heartbeat:", error);
        }
      }
    }, 5000);
  }
}

export default new WebRTCService();
