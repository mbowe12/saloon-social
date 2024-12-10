class AudioManager {
  private static instance: AudioManager;
  private audio: HTMLAudioElement;
  private playlist: string[];
  private currentTrack: number = 0;
  private isPlaying: boolean = false;

  private constructor() {
    this.audio = new Audio();
    // update these with your actual filenames
    this.playlist = [
      '/assets/audio/Armando_Trovajoli-Lattesa.mp3',
      '/assets/audio/Bruno_Nicolai-Ringo_Come_to_Fight.mp3',
      '/assets/audio/Claudio_Tallino-Killer_Adios.mp3',
      '/assets/audio/Francesco_De_Masi-Seven_Men.mp3',
      '/assets/audio/Luis_Bacalov-La_pecora_nera.mp3',
      '/assets/audio/Luis_Bacalov-Western_Ballad.mp3',
      '/assets/audio/Piero_Piccioni-Sycamore_Trails.mp3'
    ];

    // set up event listeners
    this.audio.addEventListener('ended', () => {
      this.playNext();
    });
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public startPlaylist() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.playTrack(this.currentTrack);
    }
  }

  public stopPlaylist() {
    this.isPlaying = false;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  private playTrack(index: number) {
    if (index >= 0 && index < this.playlist.length) {
      this.audio.src = this.playlist[index];
      this.audio.play().catch(error => {
        console.error('Error playing audio:', error);
      });
    }
  }

  private playNext() {
    if (this.isPlaying) {
      this.currentTrack = (this.currentTrack + 1) % this.playlist.length;
      this.playTrack(this.currentTrack);
    }
  }

  // volume control methods
  public setVolume(volume: number) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  public getVolume(): number {
    return this.audio.volume;
  }
}

export default AudioManager; 