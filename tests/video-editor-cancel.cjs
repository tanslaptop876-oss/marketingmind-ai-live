const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Proxy({}, {get(target,id){return target[id]??=( {value:'',files:[],hidden:true,removeAttribute(){},pause(){},addEventListener(){},removeEventListener(){}} );}});
const pending = [], recordings = [];
let intervals = 0;
Object.assign(elements.preview, {duration:20,currentTime:0,pause(){},play(){return new Promise(resolve=>pending.push(resolve));},captureStream(){return {getAudioTracks:()=>[],getVideoTracks:()=>[{}],getTracks:()=>[{stop(){}}]};}});
elements.preview.videoWidth=640;elements.preview.videoHeight=360;
elements.aspect.value='source';
elements.renderCanvas.captureStream=()=>({getTracks:()=>[],addTrack(){}});
elements.renderCanvas.getContext=()=>({fillRect(){},drawImage(){}});
class AudioContext {
  constructor(){this.state='running';}
  createMediaStreamDestination(){return {stream:{getAudioTracks:()=>[{clone:()=>({stop(){}})}]}};}
  createGain(){return {gain:{value:1},connect(){}};}
  createMediaElementSource(){return {connect(gain){return gain;}};}
}
class Recorder {
  static isTypeSupported(){return true;}
  constructor(){this.state='inactive';recordings.push(this);}
  start(){this.state='recording';}
  stop(){this.state='inactive';}
}
elements.clipList.replaceChildren=()=>{};
elements.clipList.append=()=>{};
const context={document:{getElementById:id=>elements[id],createElement:()=>({style:{},dataset:{}}),addEventListener(){}},window:{MediaRecorder:Recorder,AudioContext,addEventListener(){}},MediaRecorder:Recorder,URL,Blob,setTimeout,clearTimeout,requestAnimationFrame(){return 1;},cancelAnimationFrame(){},setInterval(){intervals++;return intervals;},clearInterval(){}};
vm.runInNewContext(readFileSync(require('node:path').join(__dirname,'../video-editor.js'),'utf8'),context);
(async()=>{
  elements.start.value='0';elements.end.value='10';
  const first=elements.export.onclick(); await Promise.resolve();
  elements.cancel.onclick();
  assert.equal(elements.source.disabled,false);
  const second=elements.export.onclick();await Promise.resolve();
  recordings[0].ondataavailable({data:new Blob(['old'])});recordings[0].onstop();
  assert.equal(elements.source.disabled,true,'Stale stop must not unlock the active export');
  pending[0]();await first;
  assert.equal(intervals,0,'Cancelled play must not install a progress timer');
  pending[1]();await second;
  assert.equal(intervals,1);
  elements.cancel.onclick();recordings[1].onstop();
  assert.equal(elements.download.hidden,true);
  assert.match(elements.status.textContent,/cancelled/);
  elements.clipList.querySelectorAll=()=>[];
  elements.source.files=[Object.assign(new Blob(['test']),{name:'clip.webm'})];
  elements.preview.readyState=1;
  elements.source.onchange();
  const timeline=elements.exportTimeline.onclick();
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(recordings.length,3);
  elements.cancel.onclick();
  const restart=elements.export.onclick();await Promise.resolve();
  recordings[2].onstop();
  pending[2]();await timeline;
  assert.equal(elements.source.disabled,true,'Cancelled timeline must not clean up the new export');
  assert.equal(intervals,1,'Cancelled timeline must not start a timer after delayed play resolves');
  pending[3]();await restart;
  assert.equal(intervals,2);
  elements.cancel.onclick();
  console.log('PASS: single/timeline cancellation during play, restart, stale recorder callbacks, no cancelled download');
})().catch(error=>{console.error(error);process.exitCode=1;});
