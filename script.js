/* ===============================
   GLOBAL STATE
================================ */
const grid = document.getElementById("grid");
const loader = document.getElementById("loader");
const genresBox = document.getElementById("genres");
const chatLog = document.getElementById("chatLog");
const chatInput = document.getElementById("chatInput");

let animePool = [];
let renderedIDs = new Set();   // 🔥 HARD DUPLICATE BLOCK
let page = 1;
let loading = false;
let finished = false;

let watchlist = JSON.parse(localStorage.watchlist || "{}");
let ratings = JSON.parse(localStorage.ratings || "{}");
let clicks = JSON.parse(localStorage.clicks || "{}");

/* ===============================
   LOADER
================================ */
function startLoad(){ loader.className="loading"; }
function endLoad(){
 loader.className="loaded";
 setTimeout(()=>loader.className="",400);
}

/* ===============================
   FETCH ANI LIST
================================ */
async function fetchAni(query, vars={}){
 const r = await fetch("https://graphql.anilist.co",{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body:JSON.stringify({query, variables:vars})
 });
 return (await r.json()).data;
}

/* ===============================
   HOME LOAD (FAST)
================================ */
async function loadHome(){
 if(loading || finished) return;
 loading = true;
 startLoad();

 const d = await fetchAni(`
 query($p:Int){
  Page(page:$p, perPage:20){
   media(type:ANIME, sort:POPULARITY_DESC){
    id
    title{romaji}
    coverImage{large}
    genres
    description
   }
  }
 }`,{p:page++});

 if(!d?.Page?.media?.length){
  finished = true;
  endLoad();
  return;
 }

 d.Page.media.forEach(a=>{
  if(!renderedIDs.has(a.id)){
   animePool.push(a);
  }
 });

 applyAI();
 renderBatch(20);

 loading = false;
 endLoad();
}

/* ===============================
   AI SORTING
================================ */
function applyAI(){
 animePool.forEach(a=>{
  let s = 0;
  if(watchlist[a.id]) s+=20;
  if(ratings[a.id]) s+=ratings[a.id]*5;
  if(clicks[a.id]) s+=clicks[a.id]*2;
  a.__score = s;
 });
 animePool.sort((a,b)=>b.__score-a.__score);
}

/* ===============================
   RENDER BATCH (NO DUPLICATES)
================================ */
function renderBatch(n){
 let count = 0;
 while(animePool.length && count<n){
  const a = animePool.shift();
  if(renderedIDs.has(a.id)) continue;

  renderedIDs.add(a.id);
  renderCard(a);
  count++;
 }
}

/* ===============================
   CARD
================================ */
function renderCard(a){
 if(!a.coverImage) return;

 const c = document.createElement("div");
 c.className = "card";
 c.innerHTML = `
  <img loading="lazy" src="${a.coverImage.large}">
  <div class="banner">${a.title.romaji}</div>
 `;
 c.onclick = ()=>{
  clicks[a.id]=(clicks[a.id]||0)+1;
  localStorage.clicks = JSON.stringify(clicks);
  openModal(a);
 };
 grid.appendChild(c);
}

/* ===============================
   INFINITE SCROLL (THROTTLED)
================================ */
let scrollLock=false;
window.addEventListener("scroll",()=>{
 if(scrollLock) return;
 scrollLock=true;
 setTimeout(()=>scrollLock=false,200);

 if(window.innerHeight + window.scrollY > document.body.offsetHeight - 400){
  loadHome();
 }
});

/* ===============================
   SEARCH (NO API CALL)
================================ */
function searchAnime(q){
 q=q.toLowerCase();
 grid.innerHTML="";
 renderedIDs.clear();

 animePool
  .filter(a=>a.title.romaji.toLowerCase().includes(q))
  .slice(0,50)
  .forEach(a=>{
   renderedIDs.add(a.id);
   renderCard(a);
  });
}

/* ===============================
   MODAL
================================ */
function openModal(a){
 const m=document.createElement("div");
 m.className="modal";
 m.innerHTML=`
 <div class="modal-box">
  <button onclick="this.closest('.modal').remove()">❌</button>
  <h2>${a.title.romaji}</h2>
  <p>${a.description||""}</p>
 </div>`;
 document.body.appendChild(m);
}

/* ===============================
   GENRE
================================ */
async function loadGenre(g){
 grid.innerHTML="";
 animePool=[];
 renderedIDs.clear();
 page=1;
 finished=false;

 const d = await fetchAni(`
 query($g:String){
  Page(perPage:50){
   media(type:ANIME, genre_in:[$g]){
    id title{romaji}
    coverImage{large}
    genres description
   }
  }
 }`,{g});

 d.Page.media.forEach(a=>{
  if(!renderedIDs.has(a.id)){
   renderedIDs.add(a.id);
   renderCard(a);
  }
 });
}

/* ===============================
   CHATBOT
================================ */
function chatSearch(){
 const t = chatInput.value.toLowerCase();
 if(!t) return;

 chatLog.innerHTML="🤖 Thinking...";
 const w = t.split(" ");

 const r = [...renderedIDs].map(id=>animePool.find(a=>a.id===id)).filter(Boolean);

 const res = r
  .map(a=>{
   let s=0;
   w.forEach(x=>{
    if(a.title.romaji.toLowerCase().includes(x)) s+=5;
    if(a.description?.toLowerCase().includes(x)) s+=3;
   });
   return {...a,score:s};
  })
  .filter(a=>a.score>0)
  .sort((a,b)=>b.score-a.score)
  .slice(0,30);

 grid.innerHTML="";
 renderedIDs.clear();
 res.forEach(a=>{
  renderedIDs.add(a.id);
  renderCard(a);
 });

 chatLog.innerHTML=`Found ${res.length} anime`;
 setTimeout(()=>chatLog.innerHTML="",8000);
}

/* ===============================
   INIT
================================ */
loadHome();
