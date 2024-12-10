import AudioManager from './audio/AudioManager';

// in your game initialization
const audioManager = AudioManager.getInstance();
audioManager.startPlaylist();

// optionally set initial volume
audioManager.setVolume(0.5); // 50% volume 