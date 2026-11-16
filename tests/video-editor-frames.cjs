const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Proxy({}, {get:(obj,id)=>obj[id]??=( {value:'',files:[],hidden:true,removeAttribute(){},pause(){},addEventListener(){},removeEventListener(){}} )});
const timeouts=new Map(),events=new Map();let clock=0,draws=0,requests=0,frames=0;
Object.assign(elements.preview,{duration:6,currentTime:0,videoWidth:640,videoHeight:360,readyState:2,play:async()=>{}});
elements.aspect.value='source';elements.start.value='0';elements.end.value='6';
elements.renderCanvas.getContext=()=>({fillRect(){},drawImage(){draws++}});
elements.renderCanvas.captureStream=()=>({getTracks:()=>[],getVideoTracks:()=>[{requestFrame(){requests++}}],addTrack(){}});
elements.exportResult.getVideoPlaybackQuality=()=>({totalVideoFrames:frames});
elements.exportResult.addEventListener=(type,fn)=>events.set(type,fn);
elements.exportResult.removeEventListener=(type,fn)=>{if(events.get(type)===fn)events.delete(type)};
elements.exportResult.play=async()=>{};
class AudioContext {constructor(){this.state='running'}createMediaStreamDestination(){return {stream:{getAudioTracks:()=>[]}}}createGain(){return {gain:{},connect(){}}}createMediaElementSource(){return {connect:g=>g}}}
let recording;
class Recorder{static isTypeSupported(){return true}constructor(){recording=this;this.state='inactive'}start(){this.state='recording'}stop(){this.state='inactive'}}
let buttons=[];elements.clipList.replaceChildren=()=>{buttons=[]};elements.clipList.append=button=>buttons.push(button);
const context={document:{getElementById:id=>elements[id],createElement:()=>({style:{},dataset:{}}),addEventListener(){}},window:{AudioContext,MediaRecorder:Recorder,addEventListener(){}},MediaRecorder:Recorder,URL,Blob,setTimeout(fn){const id=++clock;timeouts.set(id,fn);return id},clearTimeout:id=>timeouts.delete(id),setInterval:()=>1,clearInterval(){},requestAnimationFrame(){throw Error('Export must not depend on animation-frame delivery')},cancelAnimationFrame(){}};
vm.runInNewContext(fs.readFileSync(require.resolve('../video-editor.js'),'utf8'),context);
(async()=>{
 await elements.export.onclick();assert.equal(draws,1);assert.equal(requests,1);
 const [id,tick]=timeouts.entries().next().value;timeouts.delete(id);tick();assert.equal(draws,2);assert.equal(requests,2);
 elements.preview.readyState=1;const [id2,tick2]=timeouts.entries().next().value;timeouts.delete(id2);tick2();assert.equal(draws,2,'Do not draw before decoded data is ready');
 recording.ondataavailable({data:new Blob(['video'])});recording.onstop();assert.equal(timeouts.size,0,'Cleanup stops frame production');assert.equal(elements.verifyExport.hidden,false);
 await elements.verifyExport.onclick();frames=180;elements.exportResult.currentTime=6;elements.exportResult.ended=true;events.get('ended')();assert.match(elements.exportReview.textContent,/180 decoded frames/);
 await elements.verifyExport.onclick();frames=184;elements.exportResult.currentTime=6;events.get('ended')();assert.match(elements.exportReview.textContent,/Playback warning: only 4/);
 await elements.verifyExport.onclick();elements.exportResult.ended=false;events.get('pause')();assert.match(elements.exportReview.textContent,/interrupted/);assert.equal(elements.verifyExport.disabled,false);
 elements.source.files=['first','second'].map(name=>Object.assign(new Blob(['fixture']),{name}));elements.source.onchange();elements.preview.onloadedmetadata();
 elements.start.value='1';elements.end.value='4';buttons[1].onclick();elements.preview.onloadedmetadata();
 elements.start.value='0';elements.end.value='3';buttons[0].onclick();elements.preview.onloadedmetadata();assert.equal(elements.start.value,'1');assert.equal(elements.end.value,'4','Clip switch preserves edits even before a change event');
 console.log('PASS: capture without rAF, explicit frame requests, readiness, cleanup, playback count/warning, interruption and trim persistence');
})().catch(e=>{console.error(e);process.exitCode=1});
