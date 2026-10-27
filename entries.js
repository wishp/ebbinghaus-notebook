const detailDayCategories = {};
let entryEditDraft = null;
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
 editingEntryDate=date;entryEditDraft=new Map(items.map(x=>[String(x.id),{question:x.prompt||x.text||'',answer:x.text||'',sourceField:'answer'}]));
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

function renderDateEditCapture(){
 const date=editingEntryDate,items=state.items.filter(x=>x.created_at===date);
 if(date!==today()||!items.length){cancelDateEdit();toast('只有今天录入的信息可以编辑');return}
 const sections=cats.map(category=>{
  const rows=items.filter(x=>x.category===category);if(!rows.length)return'';
  return `<section class="date-edit-category"><h2>${category.replace('-','')}<small>${rows.length} 条</small></h2>${rows.map((item,index)=>{
   const id=String(item.id),draft=entryEditDraft.get(id);
   return `<article class="date-edit-row" data-edit-row="${id}"><div class="date-edit-row-title">第 ${index+1} 条</div><div class="entry-pair"><label class="entry-field">题目 <small>首页展示这些题目</small><textarea rows="2" data-edit-question="${id}">${esc(draft.question)}</textarea></label><div class="batch-sync-line"><button type="button" class="convert-btn" data-edit-sync="${id}">同步转化</button><span data-sync-direction="${id}">${draft.sourceField==='answer'?'答案 → 题目':'题目 → 答案'}</span></div><label class="entry-field">答案 <small>学习时需要写出的内容</small><textarea rows="2" data-edit-answer="${id}">${esc(draft.answer)}</textarea></label><p class="edit-sync-status" data-sync-status="${id}"></p></div></article>`;
  }).join('')}</section>`;
 }).join('');
 const page=document.getElementById('capture');
 page.innerHTML=`<div class="entry-page-heading"><button type="button" class="back" id="cancelDateEdit" aria-label="返回录入信息">‹</button><h1 class="title">编辑当天录入信息</h1></div><p class="subtle entry-help">${date.replaceAll('-','.')} · 共 ${items.length} 条，所有分类一起编辑。同步转化和保存都只影响当天内容。</p><div class="date-edit-groups">${sections}</div><button type="button" class="save enabled" id="saveDateEdit">保存全部修改</button>`;
 page.querySelector('#cancelDateEdit').onclick=cancelDateEdit;
 page.querySelectorAll('[data-edit-question],[data-edit-answer]').forEach(field=>field.oninput=()=>{
  const id=field.dataset.editQuestion||field.dataset.editAnswer,draft=entryEditDraft.get(id);draft[field.hasAttribute('data-edit-question')?'question':'answer']=field.value;draft.sourceField=field.hasAttribute('data-edit-answer')?'answer':'question';
  page.querySelector(`[data-sync-direction="${id}"]`).textContent=draft.sourceField==='answer'?'答案 → 题目':'题目 → 答案';page.querySelector(`[data-sync-status="${id}"]`).textContent='有修改未保存';
 });
 page.querySelectorAll('[data-edit-sync]').forEach(button=>button.onclick=async()=>{
  if(editingEntryDate!==today()){cancelDateEdit();toast('已过录入当天，不能同步修改');return}
  const id=button.dataset.editSync,draft=entryEditDraft.get(id),item=items.find(x=>String(x.id)===id);if(!item)return;
  const source=draft.sourceField,target=source==='answer'?'question':'answer',value=draft[source].trim();if(!value)return;
  button.disabled=true;page.querySelector(`[data-sync-status="${id}"]`).textContent='正在同步转化…';
  try{
   const results=[];for(const part of batchParts(value))results.push(part?await convertCaptureValueFor(item.category,part):{value:''});
   if(editingEntryDate!==today()||!page.isConnected)return;
   draft[target]=results.map(x=>x.value||'').join('、');page.querySelector(`[data-edit-${target}="${id}"]`).value=draft[target];
   page.querySelector(`[data-sync-status="${id}"]`).textContent=results.some(x=>x.unknown)?'部分内容未能自动转化，请检查后手动补充。':'已生成，可继续手动调整。';
  }catch(error){page.querySelector(`[data-sync-status="${id}"]`).textContent='转化失败，请手动填写。'}finally{if(button.isConnected)button.disabled=false}
 });
 page.querySelector('#saveDateEdit').onclick=()=>{
  const currentItems=state.items.filter(x=>x.created_at===date);
  if(date!==today()||currentItems.length!==items.length||currentItems.some(x=>!entryEditDraft.has(String(x.id)))){cancelDateEdit();toast('已过录入当天或信息已变化，未保存修改');return}
  const incomplete=currentItems.find(x=>!entryEditDraft.get(String(x.id)).question.trim()||!entryEditDraft.get(String(x.id)).answer.trim());
  if(incomplete){const field=page.querySelector(`[data-edit-question="${String(incomplete.id)}"]`);field?.focus();toast('请补全当天所有内容的题目和答案');return}
  for(const item of currentItems){const draft=entryEditDraft.get(String(item.id));item.prompt=draft.question.trim();item.text=draft.answer.trim();item.updated_at=new Date().toISOString()}
  save();editingEntryDate=null;entryEditDraft=null;current='detail';render();toast('当天全部修改已保存');
 };
}

function showInstallGuide(){
 const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 openSheet(`<h3>${standalone?'已从桌面应用打开':'添加到手机主屏幕'}</h3><div class="install-guide-brand"><img src="icons/apple-touch-icon.png" alt="错题本应用图标"><div><strong>艾宾浩斯错题本</strong><span>点桌面图标，即可开始复习</span></div></div><div class="install-guide"><h4>iPhone / iPad</h4><ol><li>用 Safari 浏览器打开本应用。</li><li>点击分享按钮（方框向上箭头）。</li><li>选择“添加到主屏幕”；如有“作为网页 App 打开”选项，请开启，再点击“添加”。</li></ol><h4>Android 手机</h4><ol><li>用 Chrome 浏览器打开本应用。</li><li>点右上角 ⋮ → 添加到主屏幕 → 安装。</li></ol><p class="setting-help">请先添加图标，再从图标中录入和复习。学习数据保存在当前设备；手机与 iPad 各自保存。</p></div><button type="button" id="closeInstallGuide">知道了</button>`);
 document.getElementById('closeInstallGuide').onclick=closeSheet;
}
