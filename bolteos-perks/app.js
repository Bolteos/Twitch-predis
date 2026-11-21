'use strict';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),simple=query.get('modo')==='reparto', overlay=simple || query.has('overlay'), live=!simple && (query.has('directo') || overlay);
if(live)document.documentElement.classList.add('legacy-live');
if(overlay)document.documentElement.classList.add('overlay');
let room=query.get('room')||localStorage.getItem('circus-room');
if(!/^[a-f0-9]{32}$/.test(room||'')){room=crypto.randomUUID().replaceAll('-','');localStorage.setItem('circus-room',room)}
const defaults={theme:'carnival',role:'survivor',volume:60,duration:20,zoom:100,deckZoom:100,hideDeck:true,animation:'classic',pace:1,font:'alice',nameScale:100};
let prefs={...defaults},perks=[],catalogRole='survivor',last='',busy=false,pending=null,epoch=0,hideTimer,referenceStartTimer,saveTimer,saveVersion=0,settingsDirty=false,initialized=false,displayIds=[],activeEventId=null;
const completedEvents=new Set();let saveChain=Promise.resolve();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const anims=new Set(),playing=new Set();
const sounds={shuffle:new Audio('audio/cards-shuffle-kenney-v4.wav'),reference:new Audio('audio/dbd-reference.wav')};
Object.values(sounds).forEach(a=>{a.preload='auto';a.load()});
const fontStacks={alice:"'Alice',Georgia,serif",georgia:'Georgia,serif',palatino:"'Palatino Linotype',Palatino,serif",trebuchet:"'Trebuchet MS',Arial,sans-serif",courier:"'Courier New',monospace"};
function applyFont(font){document.documentElement.style.setProperty('--perk-font',fontStacks[font]||fontStacks.alice)}
function applyNameScale(scale){const value=Math.max(70,Math.min(140,Number(scale)||100));document.documentElement.style.setProperty('--name-scale',(value/100).toFixed(2));const text=$('namescaletext');if(text)text.textContent=Math.round(value)+'%'}
function installFontControl(){const pace=$('pace');if(!pace||$('font'))return;const box=document.createElement('div');box.innerHTML='<label class="label" for="font">Fuente del nombre</label><select id="font"><option value="alice">Alice · teatral</option><option value="georgia">Georgia · clásica</option><option value="palatino">Palatino · elegante</option><option value="trebuchet">Trebuchet · limpia</option><option value="courier">Courier New · máquina</option></select>';const size=document.createElement('div');size.className='settings';size.innerHTML='<label for="nameScale">Tamaño del nombre <output id="namescaletext">100%</output></label><input id="nameScale" type="range" min="70" max="140" step="5" value="100">';pace.closest('div').after(box);box.after(size);$('font').addEventListener('change',changed);$('nameScale').addEventListener('input',changed)}
installFontControl();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function options(){return{theme:$('theme').value,role:prefs.role,volume:+$('volume').value,duration:+$('duration').value,zoom:+$('zoom').value,deckZoom:+$('deckzoom').value,hideDeck:$('hideDeck').checked,animation:$('animation').value,pace:+$('pace').value,font:$('font').value,nameScale:+$('nameScale').value}}
function applyPrefs(p){prefs={...defaults,...p};$('theme').value=prefs.theme;$('stage').dataset.theme=prefs.theme;$('volume').value=prefs.volume;$('duration').value=prefs.duration;$('zoom').value=prefs.zoom;$('deckzoom').value=prefs.deckZoom;$('hideDeck').checked=!!prefs.hideDeck;$('animation').value=prefs.animation;$('pace').value=prefs.pace;$('font').value=prefs.font;$('nameScale').value=prefs.nameScale;applyFont(prefs.font);applyNameScale(prefs.nameScale);$('voltext').textContent=prefs.volume+'%';$('zoomtext').textContent=prefs.zoom+'%';$('deckzoomtext').textContent=prefs.deckZoom+'%';document.querySelectorAll('[data-role]').forEach(b=>b.classList.toggle('selected',b.dataset.role===prefs.role));$('count').textContent=perks.filter(p=>p.role===prefs.role).length+' perks en este mazo';updateLinks()}
function simpleLink(settings, height) {
  const url = new URL('./', location.href);
  url.searchParams.set('modo','reparto');
  for (const [key,value] of Object.entries(settings)) {
    if (value !== defaults[key]) url.searchParams.set(key,String(value));
  }
  if (height === 2160) url.searchParams.set('resolution','2160');
  return url.href;
}
function simpleSettings() {
  const result = {...defaults};
  const fields = {theme:'theme',volume:'volume',duration:'duration',zoom:'zoom',deckZoom:'deckzoom',animation:'animation',pace:'pace',font:'font',nameScale:'nameScale'};
  for (const [key,id] of Object.entries(fields)) {
    if (!query.has(key)) continue;
    const field = $(id);
    field.value = query.get(key);
    if (field.value !== '') result[key] = typeof defaults[key] === 'number' ? Number(field.value) : field.value;
  }
  result.role = query.get('role') === 'killer' ? 'killer' : 'survivor';
  result.hideDeck = query.get('hideDeck') !== 'false';
  return result;
}
function updateLinks(){const h=+$('resolution').value;$('obsdimensions').textContent=(h===2160?'3840 × 2160':'1920 × 1080');if(!live){
  $('obsurl').value=simpleLink(prefs,h);
  return;
} $('obsurl').value=new URL('./',location.href).href+'?overlay=1&room='+room+'&resolution='+h;$('triggerurl').value='http://127.0.0.1:17842/api/trigger?room='+room;const triggerBox=$('triggerurl').closest('.linkbox'),triggerHint=triggerBox?.querySelector('p');if(triggerHint)triggerHint.textContent='Usa una acción de solicitud HTTP con método GET. Este enlace envía la orden sin abrir una página.';document.querySelectorAll('.help li').forEach(item=>{if(item.textContent.includes('En Stream Deck:'))item.textContent='En Stream Deck: usa una acción o plugin de solicitud HTTP, selecciona el método GET y pega el enlace de activación. No uses Sistema → Sitio web, porque esa acción siempre abre el navegador.'})}
function resize(){const v=$('viewport'),scale=Math.min(v.clientWidth/1920,v.clientHeight/1080);$('stage').style.transform=overlay?'translate(-50%,-50%) scale('+scale+')':'scale('+scale+')'}
new ResizeObserver(resize).observe($('viewport'));
function zoomSize(zoom){const z=zoom/100,s=$('stage').style;s.setProperty('--zoom',z);for(const[k,n]of [['cw',250],['ch',390],['icon',185],['name',26],['pad',20],['radius',14]])s.setProperty('--'+k,n*z+'px')}
function transform(cx,cy,angle,z,scale=1){return 'translate3d('+(cx-125*z)+'px,'+(cy-195*z)+'px,0) rotate('+angle+'deg) scale('+scale+')'}
function target(i,z,style){return{x:960+(i-1.5)*300*z,y:540+(style==='fan'?[28,-8,-8,28][i]:0),r:style==='fan'?[-6,-2,2,6][i]:style==='cascade'?[-3,2,-2,3][i]:0}}
function deckPose(zoom){const scale=.33*zoom/100;return{scale,y:925,x:960,transform:'translate3d(0,385px,0) scale('+scale+')'} }
function showRestDeck(){const d=$('deck'),p=deckPose(prefs.deckZoom);d.style.opacity='1';d.style.transform=p.transform;}
function makeDeck(){for(let i=0;i<10;i++){const d=document.createElement('div');d.className='deck-layer';d.dataset.index=i;d.style.transform='translate('+(i*.9)+'px,'+(i*1.2)+'px)';$('deckstack').append(d)}}
makeDeck();
function normalizeIcon(img){if(img.dataset.normalized||!img.complete||!img.naturalWidth)return;img.dataset.normalized='1';try{const c=document.createElement('canvas'),w=img.naturalWidth,h=img.naturalHeight;c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);const d=x.getImageData(0,0,w,h),a=d.data,seed=[a[0],a[1],a[2]],seen=new Uint8Array(w*h),q=[];const push=(px,py)=>{if(px<0||py<0||px>=w||py>=h)return;const i=py*w+px;if(seen[i])return;const j=i*4;if(a[j+3]===0)return;const diff=Math.max(Math.abs(a[j]-seed[0]),Math.abs(a[j+1]-seed[1]),Math.abs(a[j+2]-seed[2]));if(diff>38)return;seen[i]=1;q.push(i)};for(let x0=0;x0<w;x0++){push(x0,0);push(x0,h-1)}for(let y0=0;y0<h;y0++){push(0,y0);push(w-1,y0)}for(let n=0;n<q.length;n++){const i=q[n],j=i*4;a[j+3]=0;const px=i%w,py=(i/w)|0;push(px-1,py);push(px+1,py);push(px,py-1);push(px,py+1)}if(q.length){x.putImageData(d,0,0);img.src=c.toDataURL('image/png')}}catch{}}
function prepIcon(img){img.crossOrigin='anonymous';img.addEventListener('load',()=>normalizeIcon(img),{once:true});}
function buildCards(ids){displayIds=ids;$('cards').replaceChildren();ids.forEach((id,i)=>{const p=perks.find(p=>p.id===id);if(!p)return;const c=document.createElement('div');c.className='card';const rot=document.createElement('div');rot.className='rotator';const back=document.createElement('div');back.className='face back';const front=document.createElement('div');front.className='face front';const img=document.createElement('img');prepIcon(img);img.src=p.icon?.replace(/^\//,'')||('perk/'+encodeURIComponent(p.id)+'.webp');img.alt=p.name;img.decoding='async';const h=document.createElement('h3');h.textContent=p.name;const emblem=document.createElement('div');emblem.className='perk-emblem';emblem.append(img);front.append(emblem,h);rot.append(back,front);c.append(rot);$('cards').append(c)})}
const survivorGroups=[
['Dwight Fairfield',['Bond','Prove_Thyself','Leader']],
['Meg Thomas',['QuickQuiet','Sprint_Burst','Adrenaline']],
['Claudette Morel',['Empathy','Botany_Knowledge','Self_Care']],
['Jake Park',['Iron_Will','Calm_Spirit','Saboteur']],
['Nea Karlsson',['Balanced_Landing','Urban_Evasion','Streetwise']],
['Laurie Strode',['SoleSurvivor','ObjectOfObsession','DecisiveStrike']],
['Ace Visconti',['Up_The_Ante','Open_Handed','Ace_In_The_Hole']],
['Bill Overbeck',['LeftBehind','BorrowedTime','SelfSufficient']],
['Feng Min',['Technician','Lithe','Alert']],
['David King',['WereGonnaLiveForever','DeadHard','NoMither']],
['Quentin Smith',['Pharmacy','Vigil','WakeUp']],
['Detective Tapp',['Tenacity','DetectivesHunch','StakeOut']],
['Kate Denson',['WindowsOfOpportunity','BoilOver','Dance_with_me']],
['Adam Francis',['Deliverance','Autodidact','Diversion']],
['Jeff Johansen',['Breakdown','Aftercare','Distortion']],
['Jane Romero',['Solidarity','HeadOn','Poised']],
['Ash Williams',['FlipFlop','BuckleUp','TheMettleOfMan']],
['Nancy Wheeler',['BetterTogether','Fixated','InnerStrength']],
['Steve Harrington',['Babysitter','Camaraderie','SecondWind']],
['Yui Kimura',['LuckyBreak','AnyMeansNecessary','Breakout']],
['Zarina Kassir',['OffTheRecord','RedHerring','ForThePeople']],
['Cheryl Mason',['SoulGuard','BloodPact','RepressedAlliance']],
['Felix Richter',['Visionary','BuiltToLast','DesperateMeasures']],
['Élodie Rakoto',['S24P01','S24P02','S24P03']],
['Yun-Jin Lee',['S25P02','S25P03','Fast_Track']],
['Jill Valentine',['S26P01','S26P02','S26P03']],
['Leon S. Kennedy',['S27P02','S27P03','Bite_The_Bullet']],
['Mikaela Reid',['S28P01','S28P02','S28P03']],
['Jonah Vasquez',['S29P01','S29P02','S29P03']],
['Yoichi Asakawa',['S30P01','S30P02','S30P03']],
['Haddie Kaur',['S31P01','S31P02','S31P03']],
['Ada Wong',['S32P01','S32P02','S32P03']],
['Rebecca Chambers',['S33P01','S33P02','S33P03']],
['Vittorio Toscano',['S34P01','S34P02','Quick_Gambit']],
['Thalita Lyra',['S35P01','S35P02','S35P03']],
['Renato Lyra',['S36P01','S36P02','S36P03']],
['Gabriel Soma',['S37P01','S37P02','S37P03']],
['Nicolas Cage',['S38P01','S38P02','S38P03']],
['Ellen Ripley',['S39P01','S39P02','S39P03']],
['Alan Wake',['S40P01','S40P02','S40P03']],
['Sable Ward',['S41P01','S41P02','S41P03']],
['Aestri Yazar / Baermar Urek',['S42P01','S42P02','S42P03']],
['Lara Croft',['S43P01','S43P02','S43P03']],
['Trevor Belmont',['S44P01','S44P02','S44P03']],
['Taurie Cain',['S45P01','S45P02','S45P03']],
['Orela Rose',['S46P01','S46P02','S46P03']],
['Rick Grimes',['S47P01','S47P02','S47P03']],
['Michonne Grimes',['S48P01','S48P02','S48P03']],
['Vee Boonyasak',['S49P01','S49P02','S49P03']],
['Kwon Tae-young',['A_Place_For_Us','Five_Moves_Ahead','Flow_State']],
['Dustin Henderson',['Bada_Bada_Boom','Change_Of_Plan','Teamwork_Full_Circuit']],
['Eleven',['Extrasensory_Perception','We_See_You','Teamwork_Soft_Spoken']],
['Shane Wiigwaas',['Cross_Examination','Lend_A_Hand','Wide_Open_Throttle']],
['Aurora Stardotter',['Fruits_Of_Your_Labor','Salvations_Cry','Boon_Steadfast']],
['Perks generales',['Dark_Sense','Deja_Vu','Hope','Kindred','Lightweight','No_One_Left_Behind','Plunderers_Instinct','Premonition','Resilience','Slippery_Meat','Small_Game','Spine_Chill','This_Is_Not_Happening','WellMakeIt']]
];
const survivorOwner=Object.fromEntries(survivorGroups.flatMap(([owner,ids])=>ids.map(id=>[id,owner])));
function catalogItem(p){const item=document.createElement('div');item.className='catalog-item';const img=document.createElement('img');prepIcon(img);img.src=p.icon?.replace(/^\//,'')||('perk/'+encodeURIComponent(p.id)+'.webp');img.alt=p.name;img.loading='lazy';img.decoding='async';const name=document.createElement('span');name.textContent=p.name;item.append(img,name);return item}
function renderCatalog(){const list=perks.filter(p=>p.role===catalogRole),grid=$('cataloggrid');grid.replaceChildren();if(!list.length){$('catalogcount').textContent='0 perks';grid.className='catalog-grid';grid.removeAttribute('style');const empty=document.createElement('div');empty.className='catalog-empty';empty.textContent='No hay perks disponibles para este mazo.';grid.append(empty);return}if(catalogRole!=='survivor'){$('catalogcount').textContent=list.length+' perks';grid.className='catalog-grid';grid.removeAttribute('style');for(const p of list)grid.append(catalogItem(p));return}const groups=new Map();for(const p of list){const owner=survivorOwner[p.id]||'Perks generales';if(!groups.has(owner))groups.set(owner,[]);groups.get(owner).push(p)}$('catalogcount').textContent=list.length+' perks · '+groups.size+' grupos';grid.className='catalog-groups';grid.style.display='block';grid.style.maxHeight='620px';grid.style.overflow='auto';grid.style.padding='2px 8px 4px 2px';const owners=[...new Set([...survivorGroups.map(([owner])=>owner),...groups.keys()])].filter(owner=>groups.has(owner));for(const owner of owners){const section=document.createElement('section');section.className='catalog-group';section.style.marginBottom='14px';section.style.border='1px solid #3b3048';section.style.borderRadius='10px';section.style.background='#1d1628';section.style.overflow='hidden';const header=document.createElement('div');header.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid #3b3048;background:#231b30';const title=document.createElement('h3');title.textContent=owner;title.style.cssText='margin:0;color:#e5dcef;font:18px Georgia,serif';const count=document.createElement('span');count.textContent=groups.get(owner).length+' perks';count.style.cssText='color:#aaa2b6;font-size:12px;white-space:nowrap';header.append(title,count);const items=document.createElement('div');items.className='catalog-grid';items.style.maxHeight='none';items.style.overflow='visible';items.style.padding='10px';for(const p of groups.get(owner))items.append(catalogItem(p));section.append(header,items);grid.append(section)}}
function staticHand(){if(busy||!displayIds.length)return;zoomSize(prefs.zoom);const z=prefs.zoom/100;document.querySelectorAll('.card').forEach((c,i)=>{const t=target(i,z,prefs.animation);c.style.transform=transform(t.x,t.y,t.r,z);c.style.opacity='1';c.classList.add('revealed');c.querySelector('.rotator').style.transform='rotateY(180deg)'});showRestDeck()}
function sample(r){const pool=perks.filter(p=>p.role===r).map(p=>p.id);for(let i=pool.length-1;i>0;i--){const a=new Uint32Array(1);crypto.getRandomValues(a);const j=Math.floor(a[0]/4294967296*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}return pool.slice(0,4)}
async function motion(el,frames,duration,token,extra={}){if(token!==epoch)return false;const f=reduced?[frames[0],frames.at(-1)]:frames;const a=el.animate(f,{duration:reduced?100:duration,easing:'cubic-bezier(.22,.68,.25,1)',fill:'forwards',...extra});anims.add(a);let ok=true;await a.finished.catch(()=>ok=false);anims.delete(a);if(!ok||token!==epoch){a.cancel();return false}const end=frames.at(-1);for(const k of ['transform','opacity'])if(end[k]!==undefined)el.style[k]=end[k];a.cancel();return true}
const referenceAudioOnsets=[160,1112,2080,3023],referenceCardStarts=referenceAudioOnsets.map(t=>t-referenceAudioOnsets[0]),referenceTravelMs=950,referenceAudioStartDelay=referenceTravelMs-referenceAudioOnsets[0],referenceFadeMs=720;
function playShuffleSound(volume,pace=1){if(!volume||!sounds.shuffle)return;const a=sounds.shuffle.cloneNode(true);a.preload='auto';a.volume=Math.max(0,Math.min(1,volume/100));a.playbackRate=1/pace;a.preservesPitch=true;playing.add(a);a.onended=()=>playing.delete(a);try{a.load();const attempt=a.play();if(attempt?.catch)attempt.catch(()=>{playing.delete(a);if(!overlay)$('notice').textContent='Haz clic en la vista previa para habilitar el audio. En OBS, usa «Interactuar» sobre la fuente una vez.'})}catch{playing.delete(a);if(!overlay)$('notice').textContent='Haz clic en la vista previa para habilitar el audio. En OBS, usa «Interactuar» sobre la fuente una vez.'}}
function clearAudioFade(a){if(a._fadeTimer){clearInterval(a._fadeTimer);a._fadeTimer=null}}
function playReferenceAudio(volume){if(!volume||!sounds.reference)return;const a=sounds.reference.cloneNode(true),baseVolume=Math.max(0,Math.min(1,volume/100)),fadeSeconds=referenceFadeMs/1000;a.preload='auto';a.volume=baseVolume;playing.add(a);a._fadeTimer=setInterval(()=>{const duration=a.duration;if(!Number.isFinite(duration)||duration<=fadeSeconds)return;if(a.currentTime>=duration-fadeSeconds)a.volume=baseVolume*Math.max(0,Math.min(1,(duration-a.currentTime)/fadeSeconds))},25);a.onended=()=>{clearAudioFade(a);playing.delete(a)};try{a.load();const attempt=a.play();if(attempt?.catch)attempt.catch(()=>{clearAudioFade(a);playing.delete(a);if(!overlay)$('notice').textContent='Haz clic en la vista previa para habilitar el audio. En OBS, usa «Interactuar» sobre la fuente una vez.'})}catch{clearAudioFade(a);playing.delete(a);if(!overlay)$('notice').textContent='Haz clic en la vista previa para habilitar el audio. En OBS, usa «Interactuar» sobre la fuente una vez.'}}
function cancelRun(){if(activeEventId)completedEvents.add(activeEventId);activeEventId=null;epoch++;clearTimeout(hideTimer);clearTimeout(referenceStartTimer);referenceStartTimer=null;for(const a of anims)a.cancel();anims.clear();for(const a of playing){clearAudioFade(a);a.pause()}playing.clear();busy=false;pending=null;$('deal').disabled=false;$('demo').disabled=false}
function hide(){cancelRun();$('stage').classList.add('hidden');$('stage').classList.remove('active')}
const artwork = {
  carnival: ['card.webp?v=rabbit-ornate-4', 'card-front-gothic-v4.webp?v=theatrical-1'],
  navidad: ['navidad-reverso.webp', 'navidad-frente.webp']
};
async function preload(theme) {
  const skins = artwork[theme] || artwork.carnival;
  const images = [...document.querySelectorAll('.front img'), ...skins.map(src => {
    const img = new Image();
    img.src = src;
    return img;
  })];
  await Promise.race([Promise.all(images.map(img => img.decode().catch(()=>{}))), pause(1800)]);
}
function flightFrames(i, z, deck, target, style) {
  const sx = deck.x, sy = deck.y, dx = target.x - sx, dy = target.y - sy;
  const side = i < 2 ? -1 : 1;
  let bend = 0, lift = 0, turn = 0;
  if (style === 'cascade') { bend = i % 2 ? 95 : -95; lift = 125; turn = 14 * Math.sign(bend); }
  if (style === 'fan') { lift = 135; turn = (i - 1.5) * 18; }
  if (style === 'orbit') { bend = side * 335; lift = 185; turn = side * 92; }
  // Sample one continuous curve so movement never stops at an intermediate waypoint.
  return Array.from({length:25}, (_,step) => {
    const t = step / 24, arc = 4*t*(1-t);
    const x = sx + dx*t + bend*arc;
    const y = sy + dy*t - lift*arc;
    const scale = deck.scale/z + (1-deck.scale/z)*t;
    return {transform:transform(x,y,target.r*t + turn*arc,z,scale), opacity:1, offset:t};
  });
}
async function dealOne(c,i,e,token){const z=e.zoom/100,t=target(i,z,e.style);await pause(referenceCardStarts[i]??(i*referenceCardStarts.at(-1)));if(token!==epoch)return;
const frames=flightFrames(i,z,deckPose(e.deckZoom),t,e.style);
c.style.zIndex=10+i;const rot=c.querySelector('.rotator');rot.style.transform='rotateY(0deg)';if(!await motion(c,frames,referenceTravelMs,token))return;if(reduced)await pause(referenceTravelMs-100);await motion(rot,[{transform:'rotateY(0deg)'},{transform:'rotateY(180deg)'}],500,token);c.classList.add('revealed')}
async function animate(event){if(event.action==='hide'){hide();return}if(event.id&&(event.id===activeEventId||completedEvents.has(event.id)))return;if(busy){pending=event;return}activeEventId=event.id||null;const e={...defaults,...event};e.soundVolume=Number(e.volume??prefs.volume);e.style=e.style||(['classic','cascade','fan','orbit'].includes(e.animation)?e.animation:'classic');const token=++epoch;busy=true;clearTimeout(hideTimer);$('deal').disabled=true;$('demo').disabled=true;$('stage').dataset.theme=e.theme;zoomSize(e.zoom);buildCards(e.ids);await Promise.all([preload(e.theme),document.fonts.load('26px Alice').catch(()=>{})]);if(token!==epoch)return;
const d=$('deck'),deckStart=.65*e.deckZoom/100,deckFull=.85*e.deckZoom/100,rest=deckPose(e.deckZoom);$('stage').classList.remove('hidden');$('stage').classList.add('active');d.style.opacity='0';d.style.transform='translate3d(0,30px,0) scale('+deckStart+')';
await motion(d,[{opacity:0,transform:'translate3d(0,0,0) scale('+deckStart+')'},{opacity:1,transform:'translate3d(0,0,0) scale('+deckFull+')'}],400*e.pace,token);if(token!==epoch)return;
playShuffleSound(e.soundVolume,e.pace);const layers=[...document.querySelectorAll('.deck-layer')];await Promise.all(layers.map((layer,i)=>{const side=i<5?-1:1,base='translate('+(i*.9)+'px,'+(i*1.2)+'px)';return motion(layer,[{transform:base},{transform:'translate('+(side*120)+'px,'+(-20+i*3)+'px) rotate('+(side*12)+'deg)',offset:.25},{transform:'translate('+(side*50)+'px,'+(i*5)+'px) rotate('+(side*-3)+'deg)',offset:.65},{transform:base}],1020*e.pace,token,{iterations:3,easing:'cubic-bezier(.45,0,.2,1)'})}));if(token!==epoch)return;
await pause(160*e.pace);if(token!==epoch)return;const settleScale=rest.scale*1.045,nearScale=rest.scale*1.12;await motion(d,[{transform:'translate3d(0,0,0) scale('+deckFull+')',offset:0},{transform:'translate3d(0,285px,0) scale('+nearScale+')',offset:.62},{transform:'translate3d(0,398px,0) scale('+settleScale+')',offset:.88},{transform:rest.transform,offset:1}],780*e.pace,token,{easing:'cubic-bezier(.16,1,.3,1)'});if(token!==epoch)return;
referenceStartTimer=setTimeout(()=>{referenceStartTimer=null;if(token===epoch)playReferenceAudio(e.soundVolume)},referenceAudioStartDelay);await Promise.all([...document.querySelectorAll('.card')].map((c,i)=>dealOne(c,i,e,token)));clearTimeout(referenceStartTimer);referenceStartTimer=null;if(token!==epoch)return;if(e.hideDeck){await motion(d,[{opacity:1},{opacity:0}],360*e.pace,token)}else{d.style.opacity='1'}if(token!==epoch)return;busy=false;if(activeEventId)completedEvents.add(activeEventId);activeEventId=null;if(completedEvents.size>32)completedEvents.delete(completedEvents.values().next().value);$('deal').disabled=false;$('demo').disabled=false;
if(e.duration>0)hideTimer=setTimeout(hide,e.duration*1000);if(pending){const next=pending;pending=null;await animate(next)}else if(prefs.zoom!==e.zoom||prefs.deckZoom!==e.deckZoom)staticHand()}
const previewKey = 'bolteos-preview-'+room;
async function request(path,opts={}) {
  if(path==='/api/perks'){
    const response=await fetch('perks.json');
    if(!response.ok) throw Error('No se pudo cargar el catálogo.');
    return response.json();
  }
  if(live){
    const response=await fetch('http://127.0.0.1:17842'+path,{cache:'no-store',...opts});
    if(!response.ok) throw Error('El conector del directo no pudo procesar la acción.');
    return response.json();
  }
  const state=JSON.parse(localStorage.getItem(previewKey)||'{}');
  const body=opts.body?JSON.parse(opts.body):{};
  if(path.startsWith('/api/settings')) {
    state.settings=body;
    localStorage.setItem(previewKey,JSON.stringify(state));
  }
  if(path.startsWith('/api/control')) {
    const styles=['classic','cascade','fan','orbit'];
    return {...body,id:crypto.randomUUID(),at:Date.now(),ids:sample(body.role),style:body.animation==='random'?styles[Math.floor(Math.random()*4)]:body.animation};
  }
  return state;
}
async function saveSettings(){clearTimeout(saveTimer);const version=++saveVersion,p={...options()};settingsDirty=true;$('notice').textContent='Guardando ajustes…';try{const write=()=>request('/api/settings?room='+room,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});saveChain=saveChain.catch(()=>{}).then(write);await saveChain;if(version===saveVersion){settingsDirty=false;$('notice').textContent=live?'Ajustes guardados para OBS y Stream Deck.':'Ajustes guardados en este navegador.'}}catch(e){if(version===saveVersion)$('notice').textContent=e.message}}
function changed(){saveVersion++;prefs={...options()};applyPrefs(prefs);staticHand();settingsDirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(saveSettings,300)}
async function send(action){$('notice').textContent='Enviando…';try{await saveSettings();const e=await request('/api/control?room='+room,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...options()})});last=e.id;await animate(e);$('notice').textContent=action==='hide'?'Cartas ocultas.':(live?'Reparto enviado al overlay.':'Reparto en la mesa.')}catch(e){$('notice').textContent=e.message;$('deal').disabled=busy}}
async function poll(){try{const e=await request('/api/state?room='+room);$('connection').textContent=live?'Directo conectado':'Modo web';if(e.settings&&!settingsDirty&&JSON.stringify(e.settings)!==JSON.stringify(prefs)){applyPrefs(e.settings);if(!busy)staticHand()}if(e.id&&e.id!==last){const first=!last;last=e.id;if(!first||Date.now()-e.at<7000)animate(e).catch(()=>{$('notice').textContent='No se pudo completar la animación.';hide()})}}catch(e){$('connection').textContent='Sin conexión';if(!overlay)$('notice').textContent=e.message}if(live)setTimeout(poll,700)}
document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{prefs.role=b.dataset.role;changed()});for(const id of ['theme','volume','duration','animation','pace','zoom','deckzoom','hideDeck'])$(id).addEventListener(id==='volume'||id==='zoom'||id==='deckzoom'?'input':'change',changed);document.querySelectorAll('[data-catalog-role]').forEach(b=>b.onclick=()=>{catalogRole=b.dataset.catalogRole;document.querySelectorAll('[data-catalog-role]').forEach(x=>x.classList.toggle('selected',x===b));renderCatalog()});$('resolution').onchange=()=>{localStorage.setItem('circus-resolution',$('resolution').value);updateLinks()};$('deal').onclick=()=>send('deal');$('clear').onclick=()=>send('hide');$('demo').onclick=()=>{const o=options(),styles=['classic','cascade','fan','orbit'];animate({action:'deal',localPreview:true,ids:sample(o.role),...o,style:o.animation==='random'?styles[Math.floor(Math.random()*4)]:o.animation}).catch(()=>hide())};document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const input=$(b.dataset.copy);try{await navigator.clipboard.writeText(input.value);b.textContent='Copiado';setTimeout(()=>b.textContent='Copiar',1500)}catch{input.select();$('notice').textContent='Copia el enlace seleccionado con Ctrl+C.'}});
(async()=>{try{perks=await request('/api/perks');$('total').textContent=perks.length;if(!overlay)renderCatalog();if(simple){
  applyPrefs(simpleSettings());
  $('stage').classList.add('hidden');
  initialized=true;
  resize();
  const styles=['classic','cascade','fan','orbit'];
  await animate({...prefs,ids:sample(prefs.role),style:prefs.animation==='random'?styles[Math.floor(Math.random()*4)]:prefs.animation});
  return;
}const state=await request('/api/state?room='+room);applyPrefs(state.settings||defaults);$('resolution').value=query.get('resolution')==='2160'||localStorage.getItem('circus-resolution')==='2160'?'2160':'1080';updateLinks();if(overlay)$('stage').classList.add('hidden');else{buildCards(sample(prefs.role));staticHand()}initialized=true;resize();poll()}catch(e){$('notice').textContent=e.message;$('connection').textContent=live?'Abre el conector y permite el acceso a la red local.':'No se pudo cargar el mazo'}})();
