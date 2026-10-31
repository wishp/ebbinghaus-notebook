const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function fixture(){
 const nodes=new Map(),messages=[];let date='2026-10-30',failSave=false,saveCount=0;
 const get=id=>{
  if(!nodes.has(id)){
   const element={value:'',textContent:'',disabled:false,classList:{toggle(){}},focus(){},scrollIntoView(){},contains(){return true},querySelectorAll(){return []},insertAdjacentHTML(){}};
   let html='';Object.defineProperty(element,'innerHTML',{get:()=>html,set:value=>{html=value;for(const match of value.matchAll(/<input\b[^>]*id="([^"]+)"[^>]*value="([^"]*)"/g))get(match[1]).value=match[2]}});
   nodes.set(id,element);
  }
  return nodes.get(id);
 };
 const context={console,Date,Math,Map,Set,cats:['语文-生字','语文-拼音','英语-词句'],intervals:[1,2,4,7,15,30],current:'capture',captureCat:'语文-生字',state:{items:[],drafts:{},batchDrafts:{},settings:{}},today:()=>date,addDays:(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10),batchParts:value=>value.split(/[、，,\n]/).map(word=>word.trim()),parseEntries:()=>[],esc:value=>String(value).replace(/[&<>]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[character])),save(){if(failSave)throw Error('quota');saveCount++},toast:message=>messages.push(message),openSheet:html=>{get('sheet').innerHTML=html},closeSheet(){},render(){},window:{scrollTo(){}},document:{getElementById:get,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({})}};
 vm.createContext(context);
 for(const file of ['capture.js','schedule.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 context.renderBatchCapture=()=>{get('answerInput').focus()};
 return {context,get,messages,setDate:value=>date=value,failSave:()=>failSave=true,saves:()=>saveCount,pending:()=>vm.runInContext('pendingReviewSchedule',context)};
}
function drafts(f,count){
 f.context.state.batchDrafts=Object.fromEntries(f.context.cats.map((category,c)=>[category,{answer:Array.from({length:c===0?count:0},(_,i)=>'词'+i).join('、'),question:Array.from({length:c===0?count:0},(_,i)=>'题'+i).join('、')}]));
 return f.context.captureBatchSummary().filter(batch=>batch.count);
}
function entries(n){return Array.from({length:n},(_,i)=>({text:'词'+i,category:'语文-生字'}))}

test('defaults and strict threshold: 20 direct, 21 preview without writes',()=>{
 const small=fixture();assert.equal(small.context.reviewScheduleSettings().threshold,20);
 small.context.beginCaptureSave(drafts(small,20));assert.equal(small.context.state.items.length,20);assert.equal(small.pending(),null);
 assert(small.context.state.items.every(item=>item.created_at==='2026-10-30'&&item.first_review_at>='2026-10-31'&&item.next_review_at===item.first_review_at));
 const large=fixture();large.context.beginCaptureSave(drafts(large,21));assert.equal(large.context.state.items.length,0);assert(large.pending());assert.equal(large.saves(),0);
 large.get('backToCapture').onclick();assert.equal(large.pending(),null);assert.equal(large.context.captureBatchSummary()[0].count,21);
});

test('capacity, exact-once assignment, deterministic planning and existing-load preference',()=>{
 const {context:c}=fixture(),rows=entries(48),busy=[{status:'复习中',stage:0,next_review_at:'2026-10-31'}];
 const existing=Array.from({length:25},()=>({...busy[0]})),copy=JSON.stringify(existing);
 const plan=c.buildReviewSchedule(existing,rows,'2026-10-31',7,10);
 assert.equal(plan.remaining,0);assert.equal(plan.days.reduce((n,day)=>n+day.first,0),48);
 assert(plan.days.every(day=>day.first<=10));assert.equal(plan.days.flatMap(day=>day.entries).length,48);assert.equal(new Set(plan.days.flatMap(day=>day.entries)).size,48);
 assert(plan.days.some(day=>day.followups>0));assert.equal(JSON.stringify(existing),copy);
 assert.equal(JSON.stringify(plan),JSON.stringify(c.buildReviewSchedule(existing,rows,'2026-10-31',7,10)));
 const insufficient=c.buildReviewSchedule([],rows,'2026-10-31',7,5);assert.equal(insufficient.remaining,13);
 const lighter=c.buildReviewSchedule(existing,entries(1),'2026-10-31',7,10);assert.notEqual(lighter.startDates[0],'2026-10-31');
});

test('overdue and mastered forecasts, stage boundaries, year rollover',()=>{
 const {context:c}=fixture();
 const plan=c.buildReviewSchedule([{status:'复习中',stage:5,next_review_at:'2025-01-01'},{status:'已掌握',stage:0,next_review_at:'2026-12-31'}],entries(3),'2026-12-31',3,1);
 assert.equal(plan.days[0].existing,1);assert.equal(plan.days[1].existing,0);assert.equal(plan.startDates.length,3);assert(plan.startDates.includes('2027-01-01'));assert.equal(plan.remaining,0);
});

test('preview validates inputs, blocks insufficient capacity and persists chosen dates across categories',()=>{
 const f=fixture(),c=f.context;c.state.settings.dailyReviewLimit=50;drafts(f,21);c.state.batchDrafts[c.cats[2]]={question:'苹果',answer:'apple'};
 c.beginCaptureSave(c.captureBatchSummary().filter(batch=>batch.count));
 f.get('reviewScheduleDays').value='1';f.get('reviewScheduleCap').value='1';f.get('reviewScheduleDays').oninput();assert(f.get('confirmReviewSchedule').disabled);
 f.get('confirmReviewSchedule').onclick();assert.equal(c.state.items.length,0);
 f.get('reviewScheduleDays').value='';f.get('reviewScheduleDays').oninput();assert(f.get('confirmReviewSchedule').disabled);
 f.get('reviewScheduleDays').value='7';f.get('reviewScheduleCap').value='4';f.get('reviewScheduleCap').oninput();assert(!f.get('confirmReviewSchedule').disabled);
 f.get('confirmReviewSchedule').onclick();assert.equal(c.state.items.length,22);assert.equal(f.pending(),null);assert.equal(c.captureBatchSummary().reduce((n,b)=>n+b.count,0),0);
 assert.equal(c.state.items.filter(item=>item.category===c.cats[2]).length,1);assert(new Set(c.state.items.map(item=>item.next_review_at)).size>1);assert(c.state.items.every(item=>item.first_review_at===item.next_review_at&&item.created_at==='2026-10-30'));
});

test('midnight and changed drafts require a fresh confirmation',()=>{
 const f=fixture();f.context.beginCaptureSave(drafts(f,21));f.setDate('2026-10-31');f.get('confirmReviewSchedule').onclick();assert.equal(f.context.state.items.length,0);assert.equal(f.pending().date,'2026-10-31');
 f.get('confirmReviewSchedule').onclick();assert(f.context.state.items.every(item=>item.created_at==='2026-10-31'&&item.next_review_at>'2026-10-31'));
 const changed=fixture();changed.context.beginCaptureSave(drafts(changed,21));changed.context.state.batchDrafts['语文-生字'].answer='修改';changed.get('confirmReviewSchedule').onclick();assert.equal(changed.context.state.items.length,0);assert.equal(changed.pending(),null);
});

test('storage failure rolls back both saved items and draft clearing',()=>{
 const f=fixture();f.context.beginCaptureSave(drafts(f,21));const before=JSON.stringify(f.context.state);f.failSave();f.get('confirmReviewSchedule').onclick();assert.equal(JSON.stringify(f.context.state),before);assert(f.pending());assert(f.messages.at(-1).includes('草稿已保留'));
});

test('settings validate and store threshold zero as always arrange',()=>{
 const f=fixture();f.context.editReviewScheduleSettings();f.get('scheduleThreshold').value='';f.get('saveScheduleSettings').onclick();assert.equal(f.saves(),0);
 f.get('scheduleThreshold').value='0';f.get('saveScheduleSettings').onclick();assert.equal(f.context.state.settings.scheduleThreshold,0);assert.equal(f.saves(),1);
 f.context.beginCaptureSave(drafts(f,1));assert(f.pending());assert.equal(f.context.state.items.length,0);
});

test('daily cap counts existing plus first plus follow-ups, preserving existing dates',()=>{
 const {context:c}=fixture(),items=Array.from({length:15},()=>({status:'复习中',stage:0,next_review_at:'2026-10-31'})),snapshot=JSON.stringify(items);
 const plan=c.buildReviewSchedule(items,entries(25),'2026-10-31',30,50,20);
 assert.equal(plan.remaining,0);assert(plan.days.every(day=>day.total<=20));assert(plan.days[0].first<=5);assert.equal(JSON.stringify(items),snapshot);
 // Reforecast all saved entries to check dates beyond the first review window, too.
 const combined=items.concat(plan.startDates.map(day=>({status:'复习中',stage:0,next_review_at:day})));
 const forecast=c.buildReviewSchedule(combined,[],'2026-10-31',30,50,20);assert(forecast.days.every(day=>day.total<=20));
});

test('all 5-step daily limits are accepted; automatic extension respects daily quota',()=>{
 const {context:c}=fixture();for(const limit of [5,10,15,20,25,30,35,40,45,50]){c.state.settings.dailyReviewLimit=limit;assert.equal(c.reviewScheduleSettings().dailyLimit,limit)}
 c.state.settings.dailyReviewLimit=17;assert.equal(c.reviewScheduleSettings().dailyLimit,20);
 const plan=c.autoReviewSchedule([],entries(48),'2026-10-31',{days:7,cap:50,dailyLimit:5});assert.equal(plan.remaining,0);assert(plan.days.length>7);assert(plan.days.every(day=>day.total<=5));
});

test('small successive batches also account for saved workload; no auto-moving existing items',()=>{
 const f=fixture(),c=f.context;c.state.settings.dailyReviewLimit=5;
 c.state.items=Array.from({length:7},(_,i)=>({id:i,status:'复习中',stage:0,next_review_at:'2026-10-31'}));
 c.beginCaptureSave(drafts(f,3));assert.equal(f.pending(),null);assert.equal(c.state.items.length,10);assert(c.state.items.slice(0,7).every(item=>item.next_review_at==='2026-10-31'));assert(c.state.items.slice(7).every(item=>item.next_review_at>'2026-10-31'));
 const first=JSON.stringify(c.state.items);c.beginCaptureSave(drafts(f,3));assert.equal(c.state.items.length,13);assert.equal(JSON.stringify(c.state.items.slice(0,10)),first);
});

test('hard daily capacity blocks saving when no available dates and retains drafts',()=>{
 const f=fixture(),c=f.context;c.state.settings.dailyReviewLimit=5;c.state.settings.scheduleThreshold=100;
 c.state.items=Array.from({length:30},(_,day)=>Array.from({length:5},()=>({status:'复习中',stage:5,next_review_at:c.addDays('2026-10-31',day)}))).flat();
 c.beginCaptureSave(drafts(f,1));assert(f.pending());assert.equal(f.pending().days,365);assert(f.get('confirmReviewSchedule').disabled);f.get('confirmReviewSchedule').onclick();assert.equal(c.state.items.length,150);assert.equal(c.captureBatchSummary()[0].count,1);
});
