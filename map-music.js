const MapMusic = (() => {
  const tracks = Object.freeze({
    town: 'assets/audio/street.mp3',
    forest: 'assets/audio/forest.mp3',
    river: 'assets/audio/forest.mp3',
    altar: 'assets/audio/altar.mp3'
  });

  function trackForMap(map) { return tracks[map] || null; }

  function create(makeAudio = path => new Audio(path)) {
    const players = new Map();
    let activeTrack = null;
    let unlocked = false;
    let muted = false;
    let suspended = false;

    function playerFor(path) {
      if (!players.has(path)) {
        const audio = makeAudio(path);
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = 0.45;
        players.set(path, audio);
      }
      return players.get(path);
    }

    function playActive() {
      if (!activeTrack || !unlocked || muted || suspended) return;
      const audio = playerFor(activeTrack);
      if (!audio.paused) return;
      const attempt = audio.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
    }

    function select(map) {
      const nextTrack = trackForMap(map);
      if (nextTrack === activeTrack) return;
      if (activeTrack) playerFor(activeTrack).pause();
      activeTrack = nextTrack;
      playActive();
    }

    function unlock() {
      unlocked = true;
      playActive();
    }

    function setMuted(value) {
      muted = !!value;
      if (muted && activeTrack) playerFor(activeTrack).pause();
      else playActive();
    }

    function setSuspended(value) {
      suspended = !!value;
      if (suspended && activeTrack) playerFor(activeTrack).pause();
      else playActive();
    }

    return { select, unlock, setMuted, isMuted: () => muted, setSuspended };
  }

  return { trackForMap, create };
})();

if (typeof module !== 'undefined') module.exports = MapMusic;
