const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Proxy({}, {get(target,id){return target[id]??=( {value:'',files:[],hidden:true,removeAttribute(){},pause(){},addEventListener(){},removeEventListener(){}} );}});
const pending = [], recordings = [];
let intervals = 0;const gains=[],events=[],ticks=[];
Object.assign(elements.preview, {duration:20,currentTime:0,pause(){},play(){return new Promise(resolve=>pending.push(resolve));},captureStream(){return {getAudioTracks:()=>[],getVideoTracks:()=>[{}],getTracks:()=>[{stop(){}}]};}});
elements.preview.videoWidth=640;elements.preview.videoHeight=360;
elements.aspect.value='source';
elements.renderCanvas.captureStream=()=>({getTracks:()=>[],addTrack(){}});
elements.renderCanvas.getContext=()=>({fillRect(){},drawImage(){}});
class AudioContext {
  constructor(){this.state='running';this.destination={};}
  createMediaStreamDestination(){return {stream:{getAudioTracks:()=>[{clone:()=>({stop(){}})}]}};}
  createGain(){const gain={gain:{value:1},connections:[],connect(dest){this.connections.push(dest);}};gains.push(gain);return gain;}
  createMediaElementSource(){return {connect(gain){return gain;}};}
}
class Recorder {
  static isTypeSupported(){return true;}
  constructor(){this.state='inactive';recordings.push(this);}
  start(){this.state='recording';events.push('start');}
  pause(){this.state='paused';events.push('pause');}
  resume(){this.state='recording';events.push('resume');}
  stop(){this.state='inactive';events.push('stop');}
}
elements.clipList.replaceChildren=()=>{};
elements.clipList.append=()=>{};
const context={document:{getElementById:id=>elements[id],createElement:()=>({style:{},dataset:{}}),addEventListener(){}},window:{MediaRecorder:Recorder,AudioContext,addEventListener(){}},MediaRecorder:Recorder,URL,Blob,setTimeout,clearTimeout,requestAnimationFrame(){return 1;},cancelAnimationFrame(){},setInterval(fn){ticks.push(fn);intervals++;return intervals;},clearInterval(){}};
let time=0;const listeners={};
elements.preview.addEventListener=(name,fn)=>{listeners[name]=fn;};
elements.preview.removeEventListener=(name)=>{delete listeners[name];};
Object.defineProperty(elements.preview,'currentTime',{get:()=>time,set:value=>{time=value;queueMicrotask(()=>listeners.seeked?.());}});
vm.runInNewContext(readFileSync(require('node:path').join(__dirname,'../video-editor.js'),'utf8'),context);

(async()=>{
  const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
  elements.source.files=['a','b'].map(name=>Object.assign(new Blob(['test']),{name:name+'.webm'}));
  elements.preview.readyState=1;
  elements.source.onchange();
  elements.start.value='0';elements.end.value='10';
  elements.originalVolume.value='0.7';elements.musicVolume.value='0.3';
  const preview=elements.play.onclick();await flush();pending.shift()();await preview;
  assert.equal(gains[0].gain.value,1,'Preview audio reaches speakers');
  assert.equal(gains[1].gain.value,.7,'Preview respects original volume');
  assert.ok(gains[1].connections.includes(gains[0]));
  // A muted native preview and changed playback speed must not leak into export.
  elements.preview.muted=true;elements.preview.playbackRate=2;
  elements.music.files=[new Blob(['music'])];
  elements.musicPreview.play=async()=>events.push('music-play');
  elements.musicPreview.pause=()=>events.push('music-pause');
  const timeline=elements.exportTimeline.onclick();await flush();
  assert.equal(elements.preview.muted,false);
  assert.equal(elements.preview.playbackRate,1);
  assert.equal(gains[0].gain.value,0,'Export is recorded without speaker monitoring');
  assert.equal(gains[1].gain.value,.7);
  pending.shift()();await flush();
  elements.preview.currentTime=20;ticks[0]();await flush();
  assert.ok(events.includes('pause'),'Recorder pauses between clips');
  assert.ok(events.includes('music-pause'),'Music pauses with the recorder');
  assert.ok(events.includes('resume'),'Recorder resumes for the second clip');
  pending.shift()();await flush();elements.preview.currentTime=20;ticks[1]();await timeline;
  assert.equal(recordings[0].state,'inactive');
  recordings[0].onstop();
  assert.equal(gains[0].gain.value,1,'Cleanup restores speaker monitoring');
  console.log('PASS: preview audio routing, export volume/mute/speed, clip-boundary recording/music pause, monitor restoration');
})().catch(error=>{console.error(error);process.exitCode=1;});
