(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const video = $('preview');
  let inputURL, outputURL, recorder, stream, timer, busy = false, cancelled = false, previewing = false;
  const status = text => { $('status').textContent = text; };
  const range = () => {
    const start = Number($('start').value), end = Number($('end').value);
    if (!$('start').value || !$('end').value || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > video.duration) throw Error('Choose a start before the end, within the video duration.');
    return { start, end };
  };
  const seek = time => new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.001) return resolve();
    const cleanup = () => { clearTimeout(timeout); video.removeEventListener('seeked', done); video.removeEventListener('error', failed); };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(Error('Cannot seek this video. Try a different file.')); };
    const timeout = setTimeout(failed, 10000);
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', failed, { once: true });
    video.currentTime = time;
  });
  function resetOutput() {
    $('download').hidden = true; $('download').removeAttribute('href');
    if (outputURL) URL.revokeObjectURL(outputURL);
    outputURL = null;
  }
  function cleanup() {
    clearInterval(timer); video.pause(); stream?.getTracks().forEach(track => track.stop());
    stream = null; recorder = null; busy = false; video.controls = true;
    $('source').disabled = false; $('controls').disabled = !Number.isFinite(video.duration);
    $('cancel').hidden = true; $('progress').hidden = true;
  }
  function abort(message) {
    cancelled = true; status(message);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else cleanup();
  }
  $('source').onchange = () => {
    video.pause(); previewing = false; resetOutput(); $('controls').disabled = true;
    if (inputURL) URL.revokeObjectURL(inputURL);
    const file = $('source').files[0];
    if (!file) { video.removeAttribute('src'); video.load(); return; }
    inputURL = URL.createObjectURL(file); video.src = inputURL;
    status('Reading video…');
  };
  video.onloadedmetadata = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return status('This file has no usable duration. Try another video.');
    $('start').value = '0'; $('end').value = String(video.duration);
    $('start').max = $('end').max = String(video.duration); $('controls').disabled = false;
    status(`Ready · ${video.duration.toFixed(2)} seconds. Preview your selection before exporting.`);
  };
  video.onerror = () => { if (busy) abort('Video decoding failed; export cancelled.'); else { $('controls').disabled = true; status('This browser cannot play this video. Try an MP4 or WebM file.'); } };
  $('mute').onchange = () => { video.muted = $('mute').checked; resetOutput(); };
  for (const id of ['start', 'end']) $(id).oninput = () => { previewing = false; video.pause(); resetOutput(); };
  $('play').onclick = async () => {
    try { const {start} = range(); await seek(start); video.muted = $('mute').checked; previewing = true; await video.play(); }
    catch (error) { previewing = false; status(error.message); }
  };
  video.ontimeupdate = () => { if (previewing && video.currentTime >= Number($('end').value)) { video.pause(); previewing = false; } };
  $('export').onclick = async () => {
    if (busy) return;
    try {
      const {start, end} = range();
      const capture = video.captureStream || video.mozCaptureStream;
      if (!capture || !window.MediaRecorder) throw Error('Video export is not supported in this browser. Try desktop Chrome or Firefox.');
      const mime = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw Error('No supported video export format was found.');
      busy = true; cancelled = false; previewing = false; resetOutput();
      $('controls').disabled = true; $('source').disabled = true; video.controls = false;
      $('cancel').hidden = false; video.pause(); await seek(start);
      if (cancelled) return cleanup();
      video.muted = $('mute').checked; video.playbackRate = 1;
      stream = capture.call(video);
      if ($('mute').checked) stream.getAudioTracks().forEach(track => { stream.removeTrack(track); track.stop(); });
      if (!stream.getVideoTracks().length) throw Error('This browser cannot capture this video. Try another browser or file.');
      recorder = new MediaRecorder(stream, {mimeType: mime});
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => abort('Recording failed; no finished export was created.');
      recorder.onstop = () => {
        if (!cancelled && chunks.length) {
          const blob = new Blob(chunks, {type: mime}); outputURL = URL.createObjectURL(blob);
          $('download').href = outputURL;
          $('download').download = `marketingmind-edit.${mime.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
          $('download').hidden = false; status('Export ready. Download and review the video before publishing.');
        } else if (!cancelled) status('No video data was recorded. Try another browser.');
        cleanup();
      };
      recorder.start(250); await video.play();
      $('progress').hidden = false; status('Exporting… Keep this tab visible.');
      timer = setInterval(() => {
        $('progress').value = Math.min(1, (video.currentTime - start) / (end - start));
        if (video.currentTime >= end || video.ended) { clearInterval(timer); video.pause(); if (recorder?.state === 'recording') recorder.stop(); }
      }, 40);
    } catch (error) { abort(error.message); }
  };
  $('cancel').onclick = () => abort('Export cancelled. Your source video is unchanged.');
  document.addEventListener('visibilitychange', () => { if (document.hidden && busy) abort('Export cancelled because the tab was hidden. Keep it visible and try again.'); });
  window.addEventListener('beforeunload', event => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
})();
