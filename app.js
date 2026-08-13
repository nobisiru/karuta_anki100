const $=s=>document.querySelector(s);
const shuffle=a=>{a=[...a];for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const diff={easy:{name:'やさしい',ms:10000},normal:{name:'ふつう',ms:5000},hard:{name:'むずかしい',ms:2500},master:{name:'名人',ms:1200}};
let difficulty='easy',choiceCount=3,order=[],q=0,answers=[],revealed=false,locked=false,startTime=0,cpuTimer=null,userPts=0,cpuPts=0;
function show(id){['startScreen','gameScreen','resultScreen','reviewScreen'].forEach(x=>$('#'+x).classList.remove('active'));$('#'+id).classList.add('active')}
document.querySelectorAll('.diffBtn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.diffBtn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');difficulty=b.dataset.diff});
document.querySelectorAll('.modeBtn').forEach(b=>b.onclick=()=>startGame(+b.dataset.count));
function startGame(n){choiceCount=n;order=shuffle(QUESTION_POOL).slice(0,10);q=0;answers=[];userPts=cpuPts=0;$('#userPts').textContent=0;$('#cpuPts').textContent=0;$('#brand').textContent=`${n}択・${diff[difficulty].name}`;show('gameScreen');render()}
function distribute(s){const n=s.length,a=Math.ceil(n/3),b=Math.ceil((n-a)/2);return[s.slice(0,a),s.slice(a,a+b),s.slice(a+b)]}
function col(s){const d=document.createElement('div');d.className='poem-col';[...s].forEach(c=>{const x=document.createElement('span');x.className='poem-char';x.textContent=c;d.appendChild(x)});return d}
function chooseDistractors(cur,count){
  let pool=ALL_LOWER.filter(x=>x.lower!==cur.lower);
  if(difficulty==='hard'||difficulty==='master'){
    const first=cur.lower.slice(0,1), second=cur.lower.slice(0,2);
    let close=[];
    if(difficulty==='master') close=shuffle(pool.filter(x=>x.lower.startsWith(second)));
    const sameFirst=shuffle(pool.filter(x=>x.lower.startsWith(first)&&!close.some(c=>c.id===x.id)));
    const picked=[...close,...sameFirst].slice(0,count);
    if(picked.length<count){
      const rest=shuffle(pool.filter(x=>!picked.some(p=>p.id===x.id))).slice(0,count-picked.length);
      return [...picked,...rest];
    }
    return picked;
  }
  return shuffle(pool).slice(0,count);
}
function render(){
  clearTimeout(cpuTimer);revealed=locked=false;const cur=order[q];
  $('#progress').textContent=`${q+1} / 10`;$('#prompt').textContent=cur.key;$('#upperRest').textContent=cur.rest;$('#hint').textContent='札が表になるまで1秒…';$('#feedback').textContent='';$('#feedback').className='feedback';
  const distractors=chooseDistractors(cur,choiceCount-1);
  const opts=shuffle([{id:cur.id,key:cur.key,lower:cur.lower,correct:true},...distractors.map(x=>({id:x.id,key:x.id,lower:x.lower,correct:false}))]);
  const box=$('#cards');box.className='cards '+(choiceCount===5?'five':'');box.innerHTML='';
  opts.forEach(p=>{const b=document.createElement('button');b.className='card';b.dataset.correct=p.correct?'1':'0';const fl=document.createElement('div');fl.className='card-flipper';const back=document.createElement('div');back.className='face back';const front=document.createElement('div');front.className='face front';const inn=document.createElement('div');inn.className='card-inner';const grid=document.createElement('div');grid.className='poem-grid';distribute(p.lower).forEach(s=>grid.appendChild(col(s)));inn.appendChild(grid);front.appendChild(inn);fl.append(back,front);b.appendChild(fl);b.onclick=()=>pick(b,p,cur);box.appendChild(b)});
  setTimeout(()=>{document.querySelectorAll('.card').forEach(c=>c.classList.add('revealed'));revealed=true;startTime=performance.now();$('#hint').textContent='相手より早く正しい札をタップ！';const jitter=.9+Math.random()*.2;cpuTimer=setTimeout(()=>cpuTake(cur),diff[difficulty].ms*jitter)},1000)
}
function cpuTake(cur){if(locked)return;locked=true;cpuPts++;$('#cpuPts').textContent=cpuPts;const c=[...document.querySelectorAll('.card')].find(x=>x.dataset.correct==='1');c?.classList.add('taken');const sec=(performance.now()-startTime)/1000;answers.push({p:cur,result:'cpu',sec});$('#feedback').className='feedback ng';$('#feedback').textContent=`相手が取りました　${sec.toFixed(2)}秒`;setTimeout(next,900)}
function pick(btn,p,cur){if(!revealed||locked)return;const sec=(performance.now()-startTime)/1000;if(!p.correct){btn.classList.add('wrong');$('#feedback').className='feedback ng';$('#feedback').textContent='× ちがう札です';return}locked=true;clearTimeout(cpuTimer);userPts++;$('#userPts').textContent=userPts;btn.classList.add('userwin');answers.push({p:cur,result:'user',sec});$('#feedback').className='feedback ok';$('#feedback').textContent=`○ あなたが取りました！ ${sec.toFixed(2)}秒`;setTimeout(next,750)}
function next(){q++;q>=10?finish():render()}
function finish(){const ua=answers.filter(a=>a.result==='user'),avg=ua.length?ua.reduce((s,a)=>s+a.sec,0)/ua.length:0;$('#accuracy').textContent=Math.round(userPts/10*100)+'%';$('#avgTime').textContent=(avg?avg.toFixed(2):'—')+(avg?'秒':'');$('#battleScore').textContent=`${userPts}-${cpuPts}`;$('#battleResult').textContent=userPts>cpuPts?'勝利！':userPts<cpuPts?'敗北':'引き分け';show('resultScreen')}
$('#reviewBtn').onclick=()=>{const list=$('#reviewList');list.innerHTML='';answers.forEach((a,i)=>{const d=document.createElement('div');d.className='review-item '+(a.result==='user'?'win':'lose');d.innerHTML=`<div class="review-key">${i+1}. ${a.p.key}</div><div class="review-upper">${a.p.key}${a.p.rest}</div><div class="review-answer">正解：${a.p.lower}</div><div class="review-result">${a.result==='user'?'あなたが取得':'相手に取られた'} ／ ${a.sec.toFixed(2)}秒</div>`;list.appendChild(d)});show('reviewScreen')};
$('#homeBtn').onclick=$('#reviewHome').onclick=()=>show('startScreen');