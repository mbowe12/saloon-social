class AudioManager {
  static instance;
  audio;
  playlist;
  currentTrack = 0;
  isPlaying = false;

  constructor() {
    this.audio = new Audio();
    this.playlist = [
      "/assets/audio/Armando_Trovajoli-Lattesa.mp3",
      "/assets/audio/Bruno_Nicolai-Ringo_Come_to_Fight.mp3",
      "/assets/audio/Claudio_Tallino-Killer_Adios.mp3",
      "/assets/audio/Francesco_De_Masi-Seven_Men.mp3",
      "/assets/audio/Luis_Bacalov-La_pecora_nera.mp3",
      "/assets/audio/Luis_Bacalov-Western_Ballad.mp3",
      "/assets/audio/Piero_Piccioni-Sycamore_Trails.mp3",
    ];

    this.audio.addEventListener("ended", () => {
      this.playNext();
    });
  }

  static getInstance() {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  startPlaylist() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.playTrack(this.currentTrack);
    }
  }

  stopPlaylist() {
    this.isPlaying = false;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  playTrack(index) {
    if (index >= 0 && index < this.playlist.length) {
      this.audio.src = this.playlist[index];
      this.audio.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
  }

  playNext() {
    if (this.isPlaying) {
      this.currentTrack = (this.currentTrack + 1) % this.playlist.length;
      this.playTrack(this.currentTrack);
    }
  }

  setVolume(volume) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume() {
    return this.audio.volume;
  }
}

export default AudioManager;
