const detailDayCategories = {};
let entryEditDraft = null;
let entryEditOriginal = null;
const dateActionIcons = {
 edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
 delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5m4-5v5"/></svg>'
};

function renderDetail(){
 const filtered=state.items.filter(x=>(!detailCategory||x.category===detailCategory)&&(!detailStatus||(detailStatus==='顽固'?x.wrong_count>=3:x.status===detailStatus)));
 const dates=[...new Set(filtered.map(x=>x.created_at))].sort().reverse();
 const grouped=dates.map(date=>{
  const dateItems=state.items.filter(x=>x.created_at===date),rows=filtered.filter(x=>x.created_at===date),dayCats=cats.filter(c=>rows.some(x=>x.category===c));
  const active=dayCats.includes(detailDayCategories[date])?detailDayCategories[date]:dayCats[0];
  const actions=date===today()?`<div class="date-actions"><button type="button" class="date-action" data-edit-date="${date}" aria-label="编辑${date}全部录入信息" title="编辑当天全部信息">${dateActionIcons.edit}</button><button type="button" class="date-action date-action-delete" data-delete-date="${date}" aria-label="删除${date}全部录入信息" title="删除当天全部信息">${dateActionIcons.delete}</button></div>`:'<span class="entry-locked">已归档</span>';
  const tabs=dayCats.length>1?`<div class="day-tabs">${dayCats.map(c=>`<button type="button" class="${c===active?'active':''}" data-day-tab="${date}" data-category="${c}">${c.replace('-','')} (${rows.filter(x=>x.category===c).length})</button>`).join('')}</div>`:'';
  const panels=dayCats.map(c=>`<div class="day-panel ${c===active?'active':''}" data-day-panel="${date}" data-category="${c}"><div class="detail-list">${rows.filter(x=>x.category===c).map(x=>`<article class="detail-entry"><div class="detail-copy"><div class="detail-text ${x.status==='已掌握'?'green':x.wrong_count>=3?'red':''}">${esc(x.text)}</div><div class="detail-prompt">题目：${esc(x.prompt||x.text)}</div><div class="detail-meta">第 ${Math.min((x.stage||0)+1,6)}/6 轮 · ${x.status}${x.wrong_count>=3?' · 顽固':''}</div></div></article>`).join('')}</div></div>`).join('');
  return `<section><div class="date-group-title"><span>${date.replaceAll('-','.')}<small>当天共 ${dateItems.length} 条</small></span>${actions}</div>${tabs}${panels}</section>`;
 }).join('');
 const filters=[['','全部'],['复习中','复习中'],['顽固','顽固'],['已掌握','已掌握']].map(([value,label])=>`<button type="button" class="${detailStatus===value?'active':''}" data-detail-status="${value}">${label} (${state.items.filter(x=>(!detailCategory||x.category===detailCategory)&&(!value||(value==='顽固'?x.wrong_count>=3:x.status===value))).length})</button>`).join('');
 const catFilters=`<div class="day-tabs detail-category-tabs"><button type="button" class="${!detailCategory?'active':''}" data-detail-cat="">全部分类</button>${cats.map(c=>`<button type="button" class="${detailCategory===c?'active':''}" data-detail-cat="${c}">${c.replace('-','')}</button>`).join('')}</div>`;
 subPage('录入信息',`${catFilters}<div class="filter">${filters}</div><p class="subtle">当天录入的全部分类可一起编辑或删除</p>${grouped||'<div class="empty">没有符合条件的录入信息</div>'}`);
 const page=document.getElementById('detail');
 page.querySelectorAll('[data-detail-cat]').forEach(b=>b.onclick=()=>{detailCategory=b.dataset.detailCat;renderDetail()});
 page.querySelectorAll('[data-detail-status]').forEach(b=>b.onclick=()=>{detailStatus=b.dataset.detailStatus;renderDetail()});
 page.querySelectorAll('[data-day-tab]').forEach(b=>b.onclick=()=>{detailDayCategories[b.dataset.dayTab]=b.dataset.category;renderDetail()});
 page.querySelectorAll('[data-edit-date]').forEach(b=>b.onclick=()=>editDate(b.dataset.editDate));
 page.querySelectorAll('[data-delete-date]').forEach(b=>b.onclick=()=>confirmDeleteDate(b.dataset.deleteDate));
}

function editDate(date){
 if(date!==today()){toast('只有今天录入的信息可以编辑');return}
 const items=state.items.filter(x=>x.created_at===date);if(!items.length)return;
 editingEntryDate=date;entryEditOriginal=JSON.stringify(items);
 entryEditDraft=new Map(cats.map(category=>{const rows=items.filter(x=>x.category===category);return [category,{question:rows.map(x=>x.prompt||x.text||'').join('、'),answer:rows.map(x=>x.text||'').join('、'),sourceField:'answer'}]}));
 captureCat=cats.find(category=>items.some(x=>x.category===category))||cats[0];
 current='capture';render();window.scrollTo({top:0,behavior:'instant'});
}

function confirmDeleteDate(date){
 const items=state.items.filter(x=>x.created_at===date);if(!items.length)return;
 if(date!==today()){toast('只有今天录入的信息可以删除');return}
 openSheet(`<h3>删除当天全部录入信息？</h3><p class="delete-preview"></p><p class="setting-help">当天所有分类的 ${items.length} 条信息及相关复习历史都会一起删除。本次操作可在 7 秒内撤销。</p><button type="button" class="danger" id="confirmDeleteDate">删除当天全部信息</button><button type="button" id="cancelDeleteDate">取消</button>`);
 document.querySelector('.delete-preview').textContent=date.replaceAll('-','.');
 document.getElementById('cancelDeleteDate').onclick=closeSheet;
 document.getElementById('confirmDeleteDate').onclick=()=>{
  const currentItems=state.items.filter(x=>x.created_at===date);
  if(date!==today()||currentItems.length!==items.length){closeSheet();render();toast('日期或信息已变化，请重新操作');return}
  const ids=new Set(currentItems.map(x=>x.id));
  const record={date,items:currentItems.map(item=>({index:state.items.indexOf(item),item:{...item}})),logs:state.logs.filter(x=>ids.has(x.item_id)),deleted_at:new Date().toISOString()};
  state.trash=state.trash||[];state.trash.push(record);state.items=state.items.filter(x=>x.created_at!==date);state.logs=state.logs.filter(x=>!ids.has(x.item_id));
  for(const id of ids)delete marked[id];
  save();closeSheet();render();showUndoDate(record);
 };
}

function showUndoDate(record){
 const el=document.getElementById('toast'),undo=document.createElement('button');
 undo.type='button';undo.textContent='撤销';el.replaceChildren(document.createTextNode('当天信息已删除 '),undo);el.classList.add('show');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),7000);
 undo.onclick=()=>{
  clearTimeout(toastTimer);if(record.items.some(x=>state.items.some(item=>item.id===x.item.id))){toast('部分信息无法恢复');return}
  for(const saved of [...record.items].sort((a,b)=>a.index-b.index))state.items.splice(Math.min(saved.index,state.items.length),0,saved.item);
  state.logs.push(...record.logs);state.trash=(state.trash||[]).filter(x=>x!==record);save();render();toast('当天全部信息已恢复');
 };
}

function cancelDateEdit(){editingEntryDate=null;entryEditDraft=null;current='detail';render()}

function dateEditReady(){
 return !!entryEditDraft&&cats.every(category=>{
  const draft=entryEditDraft.get(category);
  if(!draft.question.trim()&&!draft.answer.trim())return true;
  const q=batchParts(draft.question),a=batchParts(draft.answer);
  return q.length===a.length&&q.every(Boolean)&&a.every(Boolean);
 });
}
function renderDateEditCapture(){
 if(editingEntryDate!==today()||!entryEditDraft){cancelDateEdit();toast('只有今天录入的信息可以编辑');return}
 renderBatchCapture({dateEdit:true});
}
function saveDateEdit(){
 const date=editingEntryDate,items=state.items.filter(x=>x.created_at===date);
 if(date!==today()||JSON.stringify(items)!==entryEditOriginal){cancelDateEdit();toast('日期或信息已变化，请重新编辑');return}
 if(!dateEditReady()){toast('请检查各分类的题目、答案数量，并补全空项');return}
 const updated=[],removedIds=new Set(items.map(x=>x.id)),now=new Date().toISOString();
 for(const category of cats){
  const draft=entryEditDraft.get(category);
  if(!draft.question.trim()&&!draft.answer.trim())continue;
  const questions=batchParts(draft.question),answers=batchParts(draft.answer),original=items.filter(x=>x.category===category),used=new Set();
  const matches=answers.map((answer,i)=>{const match=original.find(x=>!used.has(x.id)&&x.text===answer&&x.prompt===questions[i]);if(match)used.add(match.id);return match});
  answers.forEach((answer,i)=>{
   const item=matches[i]||original.find(x=>!used.has(x.id));
   if(item){used.add(item.id);removedIds.delete(item.id)}
   updated.push(item?{...item,text:answer,prompt:questions[i],updated_at:now}:{id:Date.now()+Math.random(),category,text:answer,prompt:questions[i],created_at:date,stage:0,wrong_count:0,status:'复习中',next_review_at:addDays(date,1),updated_at:now});
  });
 }
 const firstIndex=state.items.findIndex(x=>x.created_at===date);
 state.items=state.items.filter(x=>x.created_at!==date);state.items.splice(firstIndex,0,...updated);
 state.logs=state.logs.filter(x=>!removedIds.has(x.item_id));for(const id of removedIds)delete marked[id];
 save();editingEntryDate=null;entryEditDraft=null;entryEditOriginal=null;current='detail';render();toast('当天全部修改已保存');
}

function showInstallGuide(){
 const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 openSheet(`<h3>${standalone?'已从桌面应用打开':'添加到手机主屏幕'}</h3><div class="install-guide-brand"><img src="icons/apple-touch-icon.png" alt="错题本应用图标"><div><strong>艾宾浩斯错题本</strong><span>点桌面图标，即可开始复习</span></div></div><div class="install-guide"><h4>iPhone / iPad</h4><ol><li>用 Safari 浏览器打开本应用。</li><li>点击分享按钮（方框向上箭头）。</li><li>选择“添加到主屏幕”；如有“作为网页 App 打开”选项，请开启，再点击“添加”。</li></ol><h4>Android 手机</h4><ol><li>用 Chrome 浏览器打开本应用。</li><li>点右上角 ⋮ → 添加到主屏幕 → 安装。</li></ol><p class="setting-help">请先添加图标，再从图标中录入和复习。学习数据保存在当前设备；手机与 iPad 各自保存。</p></div><button type="button" id="closeInstallGuide">知道了</button>`);
 document.getElementById('closeInstallGuide').onclick=closeSheet;
}
