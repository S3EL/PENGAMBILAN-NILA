// KeepCount - simple full working build

// DOM
const taskTitle = qs('#taskTitle');
const modeSelect = qs('#modeSelect');
const deadlineRow = qs('#deadlineRow');
const durationRow = qs('#durationRow');
const taskDeadline = qs('#taskDeadline');
const taskDuration = qs('#taskDuration');
const addBtn = qs('#addBtn');
const clearBtn = qs('#clearBtn');
const taskListEl = qs('#taskList');
const topInfo = qs('#topInfo');

const floating = qs('#floating');
const fTitle = qs('#fTitle');
const fMeta = qs('#fMeta');
const fCountdown = qs('#fCountdown');
const doneBtn = qs('#doneBtn');
const closeBtn = qs('#closeBtn');

// settings
const bgColor = qs('#bgColor');
const fontSelect = qs('#fontSelect');

// storage keys
const SAVE_KEY = 'keepcount_v1_state';
const SET_KEY = 'keepcount_v1_settings';

// helper
function qs(sel){return document.querySelector(sel)}
function uid(){return 't_'+Math.random().toString(36).slice(2,9)}

// state
let state = {
  tasks: [], // {id,title,deadlineIso,mode,durationMin,completed}
  coins: 0,
  streak: 0,
  widgetPos: null,
  widgetHidden: false
};
let settings = {
  bg: getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#071023',
  font: 'Poppins, sans-serif'
};

function loadAll(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw) state = JSON.parse(raw);
  }catch(e){}
  try{
    const rs = localStorage.getItem(SET_KEY);
    if(rs) settings = JSON.parse(rs);
  }catch(e){}
}
function saveAll(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){}
  try{ localStorage.setItem(SET_KEY, JSON.stringify(settings)); }catch(e){}
}

// UI apply
function applySettings(){
  document.body.style.background = settings.bg;
  document.body.style.fontFamily = settings.font;
  bgColor.value = settings.bg;
  fontSelect.value = settings.font;
  updateTopInfo();
  restoreWidgetPos();
}
function updateTopInfo(){
  topInfo.textContent = `💰 ${state.coins} Coins | 🔥 ${state.streak}-Day Streak`;
}

// tasks rendering
function renderTasks(){
  taskListEl.innerHTML = '';
  // sort by soonest
  state.tasks.sort((a,b)=> new Date(a.deadlineIso) - new Date(b.deadlineIso));
  if(state.tasks.length===0){
    const p = document.createElement('div'); p.className='small muted'; p.textContent='Tidak ada tugas';
    taskListEl.appendChild(p); updateWidgetFromNext(); return;
  }
  state.tasks.forEach(t=>{
    const el = document.createElement('div'); el.className='task';
    const left = document.createElement('div'); left.className='left';
    const title = document.createElement('div'); title.className='title'; title.textContent=t.title;
    const meta = document.createElement('div'); meta.className='meta';
    meta.textContent = t.mode==='deadline' ? formatDate(t.deadlineIso) : `Timer • ${t.durationMin}m`;
    left.appendChild(title); left.appendChild(meta);

    const actions = document.createElement('div'); actions.className='actions';
    const done = document.createElement('button'); done.className='mini'; done.textContent='✓'; done.onclick = ()=> completeTask(t.id);
    const skip = document.createElement('button'); skip.className='mini'; skip.textContent='⤴'; skip.title='Tunda 5 menit'; skip.onclick=()=> skipTask(t.id);
    const del = document.createElement('button'); del.className='mini'; del.textContent='🗑'; del.onclick=()=> deleteTask(t.id);

    actions.appendChild(done); actions.appendChild(skip); actions.appendChild(del);
    el.appendChild(left); el.appendChild(actions);
    taskListEl.appendChild(el);
  });
  updateWidgetFromNext();
}

function formatDate(iso){
  try{
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2,'0');
    const min = String(d.getMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }catch(e){return ''}
}

// add task
addBtn.addEventListener('click', ()=>{
  const title = taskTitle.value.trim();
  if(!title){ alert('Isi nama tugas.'); return; }
  const mode = modeSelect.value;
  if(mode==='deadline'){
    if(!taskDeadline.value){ alert('Pilih tanggal & waktu.'); return; }
    const iso = new Date(taskDeadline.value).toISOString();
    state.tasks.push({id:uid(), title, deadlineIso:iso, mode:'deadline', durationMin:null, completed:false});
  } else {
    const d = Number(taskDuration.value);
    if(!d || d<=0){ alert('Masukkan durasi menit valid.'); return; }
    const iso = new Date(Date.now()+d*60000).toISOString();
    state.tasks.push({id:uid(), title, deadlineIso:iso, mode:'timer', durationMin:d, completed:false});
  }
  taskTitle.value=''; taskDeadline.value=''; taskDuration.value='';
  saveAll(); renderTasks(); updateTopInfo();
});

// clear all
clearBtn.addEventListener('click', ()=>{
  if(confirm('Hapus semua data?')){
    state = {tasks:[], coins:0, streak:0, widgetPos:null, widgetHidden:false};
    saveAll(); renderTasks(); applySettings();
  }
});

// complete/skip/delete
function completeTask(id){
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  t.completed = true;
  state.coins = (state.coins||0)+10;
  state.streak = (state.streak||0)+1;
  saveAll(); renderTasks(); updateTopInfo();
}
function skipTask(id){
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  const d = new Date(t.deadlineIso); d.setMinutes(d.getMinutes()+5); t.deadlineIso = d.toISOString();
  saveAll(); renderTasks();
}
function deleteTask(id){
  state.tasks = state.tasks.filter(x=>x.id!==id); saveAll(); renderTasks(); updateTopInfo();
}

// widget logic
function getNextPending(){ return state.tasks.filter(t=>!t.completed).sort((a,b)=>new Date(a.deadlineIso)-new Date(b.deadlineIso))[0] || null; }
let widgetActiveId = null;
let ticker = null;

function updateWidgetFromNext(){
  const next = getNextPending();
  if(!next){ fTitle.textContent='Tidak ada tugas'; fMeta.textContent='—'; fCountdown.textContent='—'; widgetActiveId=null; if(!settings.widgetHidden) floating.style.display='none'; return;}
  widgetActiveId=next.id;
  fTitle.textContent = next.title;
  fMeta.textContent = next.mode==='deadline' ? formatDate(next.deadlineIso) : `Timer • ${next.durationMin}m`;
  if(!settings.widgetHidden) floating.style.display='block';
}

function tickWidget(){
  if(!widgetActiveId){ fCountdown.textContent='—'; return; }
  const t = state.tasks.find(x=>x.id===widgetActiveId); if(!t){ fCountdown.textContent='—'; return; }
  const diff = new Date(t.deadlineIso).getTime() - Date.now();
  if(diff<=0){ fCountdown.textContent='Lewat waktu!'; fCountdown.style.color='#ff7b7b'; return; }
  const days = Math.floor(diff/86400000);
  const hrs = Math.floor((diff%86400000)/3600000);
  const mins = Math.floor((diff%3600000)/60000);
  const secs = Math.floor((diff%60000)/1000);
  fCountdown.style.color='';
  if(days>0) fCountdown.textContent = `${days}d ${hrs}h ${mins}m`;
  else if(hrs>0) fCountdown.textContent = `${hrs}h ${mins}m ${secs}s`;
  else if(mins>0) fCountdown.textContent = `${mins}m ${secs}s`;
  else fCountdown.textContent = `${secs}s`;
}

function startTicker(){
  if(ticker) clearInterval(ticker);
  ticker = setInterval(tickWidget, 1000);
  tickWidget();
}

// widget actions
doneBtn.addEventListener('click', ()=>{
  if(!widgetActiveId) return;
  completeTask(widgetActiveId);
});
closeBtn.addEventListener('click', ()=>{
  floating.style.display='none';
  settings.widgetHidden = true; saveAll();
});

// drag handlers
let dragging=false, offsetX=0, offsetY=0;
floating.addEventListener('pointerdown', (e)=>{
  if(e.target.closest('button')) return;
  dragging=true; floating.classList.add('grabbing');
  const rect = floating.getBoundingClientRect();
  offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
  floating.setPointerCapture(e.pointerId);
});
window.addEventListener('pointermove', (e)=>{
  if(!dragging) return;
  let x = e.clientX - offsetX, y = e.clientY - offsetY;
  const margin = 8;
  const w = floating.offsetWidth, h = floating.offsetHeight;
  x = Math.max(margin, Math.min(window.innerWidth - w - margin, x));
  y = Math.max(margin+60, Math.min(window.innerHeight - h - margin, y)); // avoid topbar
  floating.style.left = x + 'px'; floating.style.top = y + 'px'; floating.style.right='';
});
window.addEventListener('pointerup', (e)=>{
  if(!dragging) return;
  dragging=false; floating.classList.remove('grabbing');
  try{ floating.releasePointerCapture(e.pointerId); }catch(e){}
  state.widgetPos = {left: floating.style.left || null, top: floating.style.top || null}; saveAll();
});

// restore pos
function restoreWidgetPos(){
  if(state.widgetPos && state.widgetPos.left){
    floating.style.left = state.widgetPos.left; floating.style.top = state.widgetPos.top; floating.style.right='';
  } else {
    floating.style.right = '20px'; floating.style.top = '20px';
  }
}

// settings inputs
bgColor.addEventListener('input', (e)=>{ settings.bg = e.target.value; settings.bg && (document.body.style.background = settings.bg); saveAll(); });
fontSelect.addEventListener('change', (e)=>{ settings.font = e.target.value; document.body.style.fontFamily = settings.font; saveAll(); });

// init
function init(){
  loadAll();
  applySettings();
  renderTasks();
  startTicker();
  // show/hide widget saved flag
  if(settings.widgetHidden) floating.style.display='none';
}
init();

// small helpers for console
window.KeepCount = { state, settings, saveAll, loadAll, renderTasks };
