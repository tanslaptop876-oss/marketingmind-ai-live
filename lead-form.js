const byId=id=>document.getElementById(id);
let publicConfig=null,turnstileToken='';

function setText(id,value){if(value)byId(id).textContent=value}
function loadTurnstile(siteKey){
  const script=document.createElement('script');
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async=true;script.defer=true;
  script.onload=()=>window.turnstile.render('#turnstileWidget',{sitekey:siteKey,theme:'light',callback:token=>{turnstileToken=token;byId('submitLead').disabled=false},'expired-callback':()=>{turnstileToken='';byId('submitLead').disabled=true}});
  script.onerror=()=>{byId('setupNotice').textContent='Secure verification could not load. Please refresh and try again.'};
  document.head.append(script);
}

async function boot(){
  try{
    const response=await fetch('/api/form-config',{cache:'no-store'}),config=await response.json();
    publicConfig=config;setText('businessName',config.business.name);setText('businessCategory',config.business.category);setText('brandInitial',(config.business.name||'S')[0]);setText('formTitle',config.form.title);setText('formIntro',config.form.intro);setText('submitLead',config.form.button);setText('successMessage',config.form.success);document.title=`${config.form.title} — ${config.business.name}`;
    byId('leadService').innerHTML=config.form.services.map(service=>`<option>${String(service).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}</option>`).join('');
    if(config.ready){byId('setupNotice').textContent='Secure online enquiries are available.';byId('setupNotice').classList.add('ready');loadTurnstile(config.turnstile.siteKey)}
    else{byId('setupNotice').textContent='Online enquiries are being connected. Please contact the business directly for now.';byId('submitLead').textContent='Setup in progress'}
  }catch{byId('setupNotice').textContent='Online booking status is temporarily unavailable. Please try again later.'}
}

byId('publicLeadForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!publicConfig?.ready||!turnstileToken)return;
  const button=byId('submitLead'),form=event.currentTarget,data=Object.fromEntries(new FormData(form));button.disabled=true;button.textContent='Sending…';
  try{
    const response=await fetch(publicConfig.endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...data,consent:byId('leadConsent').checked,turnstileToken})}),result=await response.json();
    if(!response.ok||!result.ok)throw new Error(result.error||'submission_failed');
    byId('formWrap').hidden=true;byId('setupNotice').hidden=true;byId('successState').hidden=false;form.reset();turnstileToken='';
  }catch{byId('setupNotice').hidden=false;byId('setupNotice').classList.remove('ready');byId('setupNotice').textContent='Your request could not be sent. Please check your details and try again.';button.disabled=false;button.textContent=publicConfig.form.button;window.turnstile?.reset()}
});
byId('sendAnother').addEventListener('click',()=>{byId('successState').hidden=true;byId('formWrap').hidden=false;byId('setupNotice').hidden=false;byId('setupNotice').classList.add('ready');byId('setupNotice').textContent='Secure online enquiries are available.';byId('submitLead').disabled=true;byId('submitLead').textContent=publicConfig.form.button;window.turnstile?.reset()});
boot();

