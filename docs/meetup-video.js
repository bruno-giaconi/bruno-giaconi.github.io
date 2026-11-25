/* hls.js 1.7.4 is served locally; playback never starts automatically. */
document.querySelectorAll('[data-meetup-video]').forEach(video => {
  const source = video.querySelector('source');
  const error = video.closest('figure').querySelector('.meetup-video-error');
  const showError = () => { if (error) error.hidden = false; };
  if (!source) return;
  if (source.type !== 'application/vnd.apple.mpegurl') {
    video.addEventListener('error', showError);
    return;
  }
  const url = source.src;
  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({maxBufferLength:20, maxMaxBufferLength:30, backBufferLength:30});
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) { showError(); hls.destroy(); }
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    window.addEventListener('pagehide', () => hls.stopLoad());
    window.addEventListener('pageshow', event => { if (event.persisted) hls.startLoad(); });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.addEventListener('error', showError);
  } else {
    showError();
  }
});
