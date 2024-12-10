import { updateDoc } from 'firebase/firestore';

// assuming these are defined in component scope
const peerConnection: RTCPeerConnection;
const roomRef: DocumentReference;
const userId: string;

const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
  try {
    if (peerConnection.signalingState !== "stable") {
      await peerConnection.setRemoteDescription(answer);
    }
  } catch (error) {
    console.error("Error handling answer:", error);
  }
};

const handleICECandidate = async (event: RTCPeerConnectionIceEvent) => {
  if (event.candidate) {
    const serializedCandidate = {
      candidate: event.candidate.candidate,
      sdpMLineIndex: event.candidate.sdpMLineIndex,
      sdpMid: event.candidate.sdpMid,
      usernameFragment: event.candidate.usernameFragment
    };

    try {
      await updateDoc(roomRef, {
        [`peers.${userId}.ice`]: serializedCandidate
      });
    } catch (error) {
      console.error("Error updating peer data:", error);
    }
  }
};

const handleReceivedICECandidate = (serializedCandidate: any) => {
  if (serializedCandidate) {
    const candidate = new RTCIceCandidate(serializedCandidate);
    peerConnection.addIceCandidate(candidate).catch(error => {
      console.error("Error adding received ICE candidate:", error);
    });
  }
};

// add this function to initialize audio
const initializeAudio = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // add tracks to peer connection
    stream.getAudioTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });
    
    // set up audio level monitoring
    const audioContext = new AudioContext();
    const mediaStreamSource = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    mediaStreamSource.connect(analyser);
    
    // monitor audio levels
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const audioLevel = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
      
      // update UI or state based on audio level
      if (audioLevel > 0) {
        console.log('Audio detected:', audioLevel);
        // update mic indicator here
      }
      
      requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
    
  } catch (error) {
    console.error('Error accessing microphone:', error);
  }
};

// modify your existing peer connection setup
const setupPeerConnection = () => {
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };
  
  peerConnection = new RTCPeerConnection(configuration);
  
  // handle incoming audio tracks
  peerConnection.ontrack = (event) => {
    const remoteStream = new MediaStream();
    event.streams[0].getAudioTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
    
    // create audio element for remote audio
    const remoteAudio = new Audio();
    remoteAudio.srcObject = remoteStream;
    remoteAudio.play().catch(console.error);
  };
  
  initializeAudio();
};

// add this to your room joining logic
const updatePlayerName = async (name: string) => {
  try {
    await updateDoc(roomRef, {
      [`players.${userId}.name`]: name
    });
  } catch (error) {
    console.error('Error updating player name:', error);
  }
};

// in your component that displays player names
const displayPlayerName = (playerId: string) => {
  // make sure you're subscribing to the players collection in firebase
  onSnapshot(roomRef, (snapshot) => {
    const data = snapshot.data();
    if (data?.players?.[playerId]?.name) {
      // update the display name in your UI
      setPlayerName(data.players[playerId].name);
    }
  });
};

peerConnection.oniceconnectionstatechange = () => {
  console.log('ICE Connection State:', peerConnection.iceConnectionState);
};

peerConnection.onsignalingstatechange = () => {
  console.log('Signaling State:', peerConnection.signalingState);
};

peerConnection.onconnectionstatechange = () => {
  console.log('Connection State:', peerConnection.connectionState);
}; 