// modify the handleAnswer function to check connection state properly
const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
  try {
    // only set remote description if we're in have-local-offer state
    if (peerConnection.signalingState === "have-local-offer") {
      await peerConnection.setRemoteDescription(answer);
    } else {
      console.log("Ignoring answer in", peerConnection.signalingState, "state");
    }
  } catch (error) {
    console.error("Error handling answer:", error);
  }
};

// modify the ICE candidate handling
const handleICECandidate = async (event: RTCPeerConnectionIceEvent) => {
  if (event.candidate) {
    // serialize the candidate before storing
    const serializedCandidate = {
      candidate: event.candidate.toJSON(), // convert to JSON format
    };

    try {
      await updateDoc(roomRef, {
        [`peers.${userId}.ice`]: serializedCandidate,
      });
    } catch (error) {
      console.error("Error updating peer data:", error);
    }
  }
};

// modify how we handle received ICE candidates
const handleReceivedICECandidate = async (serializedCandidate: any) => {
  if (serializedCandidate?.candidate) {
    try {
      // reconstruct the ICE candidate from the serialized data
      const candidate = new RTCIceCandidate(serializedCandidate.candidate);

      // only add if connection isn't closed
      if (peerConnection.connectionState !== "closed") {
        await peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error("Error adding received ICE candidate:", error);
    }
  }
};

// modify the peer connection setup
const setupPeerConnection = () => {
  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  peerConnection = new RTCPeerConnection(configuration);

  // add connection state logging
  peerConnection.oniceconnectionstatechange = () => {
    console.log("ICE Connection State:", peerConnection.iceConnectionState);
  };

  peerConnection.onsignalingstatechange = () => {
    console.log("Signaling State:", peerConnection.signalingState);
  };

  peerConnection.onconnectionstatechange = () => {
    console.log("Connection State:", peerConnection.connectionState);

    // cleanup on connection closed
    if (
      peerConnection.connectionState === "closed" ||
      peerConnection.connectionState === "failed"
    ) {
      cleanupPeerConnection();
    }
  };

  // handle ICE candidates
  peerConnection.onicecandidate = handleICECandidate;

  return peerConnection;
};

// add cleanup function
const cleanupPeerConnection = async () => {
  if (peerConnection) {
    peerConnection.close();
    // clean up Firebase data
    try {
      await updateDoc(roomRef, {
        [`peers.${userId}`]: deleteField(),
      });
    } catch (error) {
      console.error("Error cleaning up peer data:", error);
    }
  }
};
