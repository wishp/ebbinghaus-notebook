let pendingReviewSchedule=null;

function reviewScheduleSettings(){
 const settings=state.settings||{};
 const integer=(value,fallback,min,max)=>Number.isInteger(value)&&value>=min&&value<=max?value:fallback;
 return {threshold:integer(settings.scheduleThreshold,20,0,10000),days:integer(settings.scheduleDays,7,1,30),cap:integer(settings.scheduleCap,10,1,200),dailyLimit:[5,10,15,20,25,30,35,40,45,50].includes(settings.dailyReviewLimit)?settings.dailyReviewLimit:20};
}

function addScheduleSetting(){
 const settings=reviewScheduleSettings(),section=document.querySelector('#profile .profile-settings');
 if(!section)return;
 const old=document.getElementById('scheduleSetting');if(old)old.remove();
 const oldLimit=document.getElementById('dailyReviewLimitSetting');if(oldLimit)oldLimit.remove();
 const limitButton=document.createElement('button');
 limitButton.type='button';limitButton.id='dailyReviewLimitSetting';limitButton.className='profile-setting setting-button';
 limitButton.innerHTML=`<span>每日复习数量上限</span><small>${settings.dailyLimit} 条 <em>›</em></small>`;
 limitButton.onclick=editDailyReviewLimit;section.append(limitButton);
 const button=document.createElement('button');
 button.type='button';button.id='scheduleSetting';button.className='profile-setting setting-button';
 button.innerHTML=`<span>安排复习</span><small>超过 ${settings.threshold} 条时 <em>›</em></small>`;
 button.onclick=editReviewScheduleSettings;section.append(button);
}

function editDailyReviewLimit(){
 const settings=reviewScheduleSettings();
 openSheet(`<h3>每日复习数量上限</h3><p class="setting-help">三个分类合计的预计每日复习量，包含首次复习和后续复习。新录入内容会按剩余额度分配，日期不足时向后延长。</p><div class="daily-limit-options">${[5,10,15,20,25,30,35,40,45,50].map(n=>`<label><input type="radio" name="dailyReviewLimit" value="${n}" ${n===settings.dailyLimit?'checked':''}>${n} 条</label>`).join('')}</div><p class="setting-help">仅影响新录入内容的排期。已有任务不自动改期，漏复习等情况可能使实际数量超过上限。</p><button type="button" id="saveDailyReviewLimit" class="sheet-primary">保存设置</button><button type="button" id="cancelDailyReviewLimit">取消</button>`);
 document.getElementById('cancelDailyReviewLimit').onclick=closeSheet;
 document.getElementById('saveDailyReviewLimit').onclick=()=>{
  const selected=document.querySelector('input[name="dailyReviewLimit"]:checked'),value=Number(selected?.value);
  if(![5,10,15,20,25,30,35,40,45,50].includes(value))return;
  state.settings.dailyReviewLimit=value;save();closeSheet();render();toast('每日复习数量上限已设为 '+value+' 条');
 };
}

function editReviewScheduleSettings(){
 const settings=reviewScheduleSettings();
 openSheet(`<h3>安排复习</h3><div class="schedule-setting-fields"><label>触发数量（条）<input id="scheduleThreshold" type="number" min="0" max="10000" step="1" inputmode="numeric" value="${settings.threshold}"></label><p class="setting-help">本次三个分类合计超过此数量时，保存前展示安排页面。未超过时，按每日总量上限自动排期保存；设为 0 时，每次保存都先展示安排页面。</p><label>默认分散天数<input id="scheduleDefaultDays" type="number" min="1" max="30" step="1" inputmode="numeric" value="${settings.days}"></label><label>每日首次复习上限（条）<input id="scheduleDefaultCap" type="number" min="1" max="200" step="1" inputmode="numeric" value="${settings.cap}"></label></div><p id="scheduleSettingError" class="form-error" role="alert"></p><button id="saveScheduleSettings" type="button" class="sheet-primary">保存设置</button><button id="cancelScheduleSettings" type="button">取消</button>`);
 document.getElementById('cancelScheduleSettings').onclick=closeSheet;
 document.getElementById('saveScheduleSettings').onclick=()=>{
  const threshold=Number(document.getElementById('scheduleThreshold').value),days=Number(document.getElementById('scheduleDefaultDays').value),cap=Number(document.getElementById('scheduleDefaultCap').value);
  if(!document.getElementById('scheduleThreshold').value.trim()||!Number.isInteger(threshold)||threshold<0||threshold>10000||!Number.isInteger(days)||days<1||days>30||!Number.isInteger(cap)||cap<1||cap>200){document.getElementById('scheduleSettingError').textContent='请输入整数：触发数量 0–10000、天数 1–30、每日上限 1–200。';return}
  Object.assign(state.settings,{scheduleThreshold:threshold,scheduleDays:days,scheduleCap:cap});save();closeSheet();render();toast('安排复习设置已保存');
 };
}

function captureDraftSignature(){return JSON.stringify(cats.map(category=>[category,state.batchDrafts?.[category]?.question||'',state.batchDrafts?.[category]?.answer||'']))}

function beginCaptureSave(batches){
 const settings=reviewScheduleSettings(),count=batches.reduce((sum,batch)=>sum+batch.count,0);
 const entries=batches.flatMap(batch=>batch.a.map(text=>({category:batch.category,text})));
 const plan=autoReviewSchedule(state.items,entries,addDays(today(),1),settings);
 if(count>settings.threshold||plan.remaining){
  pendingReviewSchedule={signature:captureDraftSignature(),date:today(),days:plan.days.length,cap:settings.cap};
  renderReviewSchedule();window.scrollTo({top:0,behavior:'instant'});return;
 }
 if(persistCaptureBatch(batches,plan.startDates))toast(`已保存全部 ${count} 条，按每日 ${settings.dailyLimit} 条上限安排复习`);
}

function autoReviewSchedule(items,entries,startDate,settings){
 let days=settings.days,plan;
 do{plan=buildReviewSchedule(items,entries,startDate,days,settings.cap,settings.dailyLimit);if(!plan.remaining||days===365)return plan;days=Math.min(365,days*2)}while(true);
}

function persistCaptureBatch(batches,startDates){
 const date=today(),items=batches.flatMap(batch=>batch.a.map((value,i)=>({id:Date.now()+Math.random(),category:batch.category,text:value,prompt:batch.q[i],created_at:date,stage:0,wrong_count:0,status:'复习中'})));
 if(items.length!==startDates.length||startDates.some(day=>!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<=date))throw Error('首次复习日期无效');
 items.forEach((item,i)=>{item.first_review_at=startDates[i];item.next_review_at=startDates[i]});
 // Keep drafts and items together if the device cannot persist the new batch.
 const snapshot=JSON.stringify(state);
 state.items.push(...items);
 for(const batch of batches){delete state.batchDrafts[batch.category];delete state.entryDrafts?.[batch.category];state.drafts[batch.category]=''}
 try{save()}catch(error){state=JSON.parse(snapshot);toast('保存失败，草稿已保留，请检查设备存储空间');return false}
 pendingReviewSchedule=null;renderBatchCapture();toast('已保存全部 '+items.length+' 条内容');document.getElementById('answerInput').focus();return true;
}

function buildReviewSchedule(items,entries,startDate,days,cap,dailyLimit=Infinity){
 const horizon=days+intervals.reduce((sum,n)=>sum+n,0),dates=Array.from({length:horizon},(_,i)=>addDays(startDate,i));
 const indices=new Map(dates.map((date,i)=>[date,i])),existing=Array(horizon).fill(0),followups=Array(horizon).fill(0),starts=Array(days).fill(0),assigned=Array.from({length:days},()=>[]);
 for(const item of items){
  if(item.status!=='复习中'||!/^\d{4}-\d{2}-\d{2}$/.test(item.next_review_at||''))continue;
  let date=item.next_review_at<startDate?startDate:item.next_review_at,stage=Math.min(Math.max(item.stage||0,0),intervals.length-1);
  while(date<=dates[horizon-1]){const i=indices.get(date);if(i!==undefined)existing[i]++;date=addDays(date,intervals[stage]);stage=Math.min(stage+1,intervals.length-1)}
 }
 const load=[...existing],offsets=[0];for(const interval of intervals)offsets.push(offsets[offsets.length-1]+interval);
 // The current review engine repeats the final interval until mastered.
 while(offsets[offsets.length-1]+intervals[intervals.length-1]<horizon)offsets.push(offsets[offsets.length-1]+intervals[intervals.length-1]);
 const startDates=Array(entries.length).fill(null);
 // Minimize the increase in squared daily load, including later review rounds.
 for(let index=0;index<entries.length;index++){
  let best=-1,cost=Infinity;
  for(let d=0;d<days;d++){
   const projected=offsets.filter(offset=>d+offset<horizon);
   if(starts[d]>=cap||projected.some(offset=>load[d+offset]>=dailyLimit))continue;
   const candidate=projected.reduce((sum,offset)=>sum+2*load[d+offset]+1,0)/projected.length;
   if(candidate<cost){cost=candidate;best=d}
  }
  if(best<0)break;
  starts[best]++;assigned[best].push(entries[index]);startDates[index]=dates[best];
  for(const offset of offsets){if(best+offset>=horizon)break;load[best+offset]++;if(offset)followups[best+offset]++}
 }
 return {days:dates.slice(0,days).map((date,i)=>({date,existing:existing[i],first:starts[i],followups:followups[i],total:load[i],entries:assigned[i]})),startDates,remaining:startDates.filter(date=>date===null).length};
}

function renderReviewSchedule(){
 const pending=pendingReviewSchedule;
 if(!pending){renderBatchCapture();return}
 const batches=captureBatchSummary().filter(batch=>batch.count);
 if(pending.signature!==captureDraftSignature()||batches.some(batch=>!batch.ready)||!batches.length){pendingReviewSchedule=null;renderBatchCapture();toast('录入内容已变化，请重新保存并安排');return}
 const entries=batches.flatMap(batch=>batch.a.map(text=>({category:batch.category,text}))),page=document.getElementById('capture');
 page.innerHTML=`<div class="entry-page-heading"><button type="button" class="back" id="backToCapture" aria-label="返回录入">‹</button><h1 class="title">安排复习</h1></div><div class="capture-batch-summary"><div class="capture-batch-total"><span>本次录入</span><strong>共 ${entries.length} 条</strong></div><div class="capture-batch-counts">${batches.map(batch=>`<span>${batch.category.replace('-','')} ${batch.count} 条</span>`).join('')}</div></div><div class="schedule-controls"><label>分散天数<input id="reviewScheduleDays" type="number" min="1" max="365" step="1" inputmode="numeric" value="${pending.days}"></label><label>每日首次复习上限<input id="reviewScheduleCap" type="number" min="1" max="200" step="1" inputmode="numeric" value="${pending.cap}"></label></div><div class="schedule-heading"><h2>每日任务预览</h2><small>从明天开始</small></div><div class="schedule-legend"><span><i></i>已有任务</span><span><i class="schedule-first"></i>首次复习</span><span><i class="schedule-repeat"></i>后续复习</span></div><div id="reviewScheduleList" class="schedule-list"></div><p id="reviewScheduleStatus" class="conversion-status" role="status"></p><p class="setting-help">每日总量上限 <strong>${reviewScheduleSettings().dailyLimit} 条</strong>，包含已有任务、首次及后续复习；可在个人中心修改。已有任务不改期，实际数量会随漏复习等情况变化。</p><button type="button" class="save enabled" id="confirmReviewSchedule">确认安排并保存全部 ${entries.length} 条内容</button>`;
 const days=document.getElementById('reviewScheduleDays'),cap=document.getElementById('reviewScheduleCap'),list=document.getElementById('reviewScheduleList'),status=document.getElementById('reviewScheduleStatus'),confirm=document.getElementById('confirmReviewSchedule');
 const update=()=>{
  const n=Number(days.value),limit=Number(cap.value);
  if(!Number.isInteger(n)||n<1||n>365||!Number.isInteger(limit)||limit<1||limit>200){confirm.disabled=true;list.innerHTML='';status.textContent='请输入 1–365 天、每日首次复习上限 1–200 条的整数。';return null}
  pending.days=n;pending.cap=limit;
  const plan=buildReviewSchedule(state.items,entries,addDays(today(),1),n,limit,reviewScheduleSettings().dailyLimit),maximum=Math.max(1,...plan.days.map(day=>day.total));
  list.innerHTML=plan.days.map(day=>`<details class="schedule-day"><summary><span class="schedule-date">${day.date.slice(5).replace('-','.')}<small>${day.date.slice(0,4)}</small></span><span class="schedule-day-main"><span class="schedule-track"><i style="width:${day.existing/maximum*100}%"></i><i class="schedule-first" style="width:${day.first/maximum*100}%"></i><i class="schedule-repeat" style="width:${day.followups/maximum*100}%"></i></span><span class="schedule-count">已有 ${day.existing} · 首次 ${day.first} · 后续 ${day.followups}</span></span><strong>${day.total}<small> 条</small></strong></summary><div class="schedule-words">${day.entries.length?cats.map(category=>{const words=day.entries.filter(entry=>entry.category===category);return words.length?`<div><span>${category.replace('-','')} · 首次 ${words.length} 条</span><p>${words.map(entry=>esc(entry.text)).join('、')}</p></div>`:''}).join(''):'当天不安排新的内容'}</div></details>`).join('');
  confirm.disabled=plan.remaining>0;confirm.classList.toggle('enabled',!confirm.disabled);
  status.textContent=plan.remaining?`还有 ${plan.remaining} 条未安排。请增加分散天数，或在个人中心提高每日复习数量上限。`:`全部 ${entries.length} 条已安排，每日总量上限 ${reviewScheduleSettings().dailyLimit} 条；确认后保存。`;
  return plan;
 };
 days.oninput=update;cap.oninput=update;
 document.getElementById('backToCapture').onclick=()=>{pendingReviewSchedule=null;renderBatchCapture()};
 confirm.onclick=()=>{
  if(pending.signature!==captureDraftSignature()){pendingReviewSchedule=null;renderBatchCapture();toast('草稿已变化，请重新安排');return}
  if(pending.date!==today()){pending.date=today();update();toast('日期已变化，已重新排期，请确认后保存');return}
  const plan=update();if(!plan||plan.remaining)return;
  confirm.disabled=true;persistCaptureBatch(batches,plan.startDates);
 };
 update();
}
