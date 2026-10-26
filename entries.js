// Entry management keeps review progress when content changes.
const detailDayCategories = {};
function renderDetail(){
 const filtered=state.items.filter(x=>(!detailCategory||x.category===detailCategory)&&(!detailStatus||(detailStatus==='顽固'?x.wrong_count>=3:x.status===detailStatus)));
 const dates=[...new Set(filtered.map(x=>x.created_at))].sort().reverse();
 const grouped=dates.map(date=>{
  const rows=filtered.filter(x=>x.created_at===date), dayCats=cats.filter(c=>rows.some(x=>x.category===c));
  const active=dayCats.includes(detailDayCategories[date])?detailDayCategories[date]:dayCats[0];
  const tabs=dayCats.length>1?`<div class="day-tabs">${dayCats.map(c=>`<button type="button" class="${c===active?'active':''}" data-day-tab="${date}" data-category="${c}">${c.replace('-','')} (${rows.filter(x=>x.category===c).length})</button>`).join('')}</div>`:'';
  const panels=dayCats.map(c=>`<div class="day-panel ${c===active?'active':''}" data-day-panel="${date}" data-category="${c}"><div class="detail-list">${rows.filter(x=>x.category===c).map(x=>{const editable=x.created_at===today();return `<article class="detail-entry"><div class="detail-copy"><div class="detail-text ${x.status==='已掌握'?'green':x.wrong_count>=3?'red':''}">${esc(x.text)}</div><div class="detail-prompt">题目：${esc(x.prompt||x.text)}</div><div class="detail-meta">第 ${Math.min((x.stage||0)+1,6)}/6 轮 · ${x.status}${x.wrong_count>=3?' · 顽固':''}</div></div>${editable?`<div class="entry-actions"><button type="button" class="entry-action" data-edit-entry="${x.id}">编辑</button><button type="button" class="entry-action entry-action-delete" data-delete-entry="${x.id}">删除</button></div>`:'<span class="entry-locked">已归档</span>'}</article>`}).join('')}</div></div>`).join('');
  return `<section><div class="date-group-title">${date.replaceAll('-','.')}<small>${rows.length} 条</small></div>${tabs}${panels}</section>`;
 }).join('');
 const filters=[['','全部'],['复习中','复习中'],['顽固','顽固'],['已掌握','已掌握']].map(([value,label])=>`<button type="button" class="${detailStatus===value?'active':''}" data-detail-status="${value}">${label} (${state.items.filter(x=>(!detailCategory||x.category===detailCategory)&&(!value||(value==='顽固'?x.wrong_count>=3:x.status===value))).length})</button>`).join('');
 const catFilters=`<div class="day-tabs detail-category-tabs"><button type="button" class="${!detailCategory?'active':''}" data-detail-cat="">全部分类</button>${cats.map(c=>`<button type="button" class="${detailCategory===c?'active':''}" data-detail-cat="${c}">${c.replace('-','')}</button>`).join('')}</div>`;
 subPage('录入信息',`${catFilters}<div class="filter">${filters}</div><p class="subtle">按录入时间分组，可编辑题目与答案</p>${grouped||'<div class="empty">没有符合条件的录入信息</div>'}`);
 const page=document.getElementById('detail');
 page.querySelectorAll('[data-detail-cat]').forEach(b=>b.onclick=()=>{detailCategory=b.dataset.detailCat;renderDetail()});
 page.querySelectorAll('[data-detail-status]').forEach(b=>b.onclick=()=>{detailStatus=b.dataset.detailStatus;renderDetail()});
 page.querySelectorAll('[data-day-tab]').forEach(b=>b.onclick=()=>{detailDayCategories[b.dataset.dayTab]=b.dataset.category;renderDetail()});
 page.querySelectorAll('[data-edit-entry]').forEach(b=>b.onclick=()=>editEntry(Number(b.dataset.editEntry)));
 page.querySelectorAll('[data-delete-entry]').forEach(b=>b.onclick=()=>confirmDeleteEntry(Number(b.dataset.deleteEntry)));
}
function editEntry(id){
 const item=state.items.find(x=>x.id===id);if(!item||item.created_at!==today()){toast('只有今天录入的信息可以编辑');return}
 editingEntryId=id;captureCat=item.category;current='capture';render();
}
function confirmDeleteEntry(id){
 const item=state.items.find(x=>x.id===id);if(!item)return;if(item.created_at!==today()){toast('只有今天录入的信息可以删除');return}
 openSheet(`<h3>删除这条录入信息？</h3><p class="delete-preview"></p><p class="setting-help">删除后将从错题库、复习任务及相关历史中移除。本次删除后可立即撤销。</p><button type="button" class="danger" id="confirmDeleteEntry">删除这条信息</button><button type="button" id="cancelDeleteEntry">取消</button>`);
 document.querySelector('.delete-preview').textContent=item.text;
 document.getElementById('cancelDeleteEntry').onclick=closeSheet;
 document.getElementById('confirmDeleteEntry').onclick=()=>{
  const index=state.items.findIndex(x=>x.id===id);if(index<0)return;
  const logs=state.logs.filter(x=>x.item_id===id);state.trash=state.trash||[];
  const record={item:{...item},logs,deleted_at:new Date().toISOString()};state.trash.push(record);
  state.items.splice(index,1);state.logs=state.logs.filter(x=>x.item_id!==id);delete marked[id];save();closeSheet();render();
  const el=document.getElementById('toast');el.textContent='已删除 ';const undo=document.createElement('button');undo.type='button';undo.textContent='撤销';el.appendChild(undo);el.classList.add('show');
  const timer=setTimeout(()=>el.classList.remove('show'),7000);
  undo.onclick=()=>{clearTimeout(timer);if(!state.items.some(x=>x.id===id)){state.items.splice(Math.min(index,state.items.length),0,record.item);state.logs.push(...record.logs);state.trash=state.trash.filter(x=>x!==record);save();render()}toast('已恢复这条信息')};
 };
}

function renderEditCapture(){
 const item=state.items.find(x=>x.id===editingEntryId);if(!item){editingEntryId=null;current='detail';render();return}
 const page=document.getElementById('capture');
 page.innerHTML=`<button type="button" class="back" id="cancelEditPage" aria-label="返回">‹</button><h1 class="title" style="display:inline-block;margin-left:4px">编辑录入</h1><div class="tabs capture-tabs">${cats.map(c=>`<button type="button" class="${c===item.category?'active':''}" data-edit-cat="${c}">${c.replace('-','')}</button>`).join('')}</div><p class="subtle entry-help">题目和答案可分别编辑；同步转化会覆盖另一栏内容。</p><div class="entry-pair"><label class="entry-field">题目 <small>首页展示这些题目</small><textarea id="editQuestionInput" rows="3">${esc(item.prompt||'')}</textarea></label><div class="batch-sync-line"><button type="button" class="convert-btn" id="editSync">同步转化</button><span id="editSyncDirection">答案 → 题目</span></div><label class="entry-field">答案 <small>学习时需要写出的内容</small><textarea id="editAnswerInput" rows="3">${esc(item.text||'')}</textarea></label></div><p id="editConversionStatus" class="conversion-status">修改后点击保存，录入日期和复习轮次会保留。</p><button type="button" class="save enabled" id="saveEditedEntry">保存修改</button>`;
 const q=document.getElementById('editQuestionInput'),a=document.getElementById('editAnswerInput'),sync=document.getElementById('editSync');
 const source=()=>a.value.trim()?a:q; const refresh=()=>{sync.disabled=!q.value.trim()&&!a.value.trim();document.getElementById('editSyncDirection').textContent=source()===a?'答案 → 题目':'题目 → 答案'};
 q.oninput=refresh;a.oninput=refresh;
 sync.onclick=async()=>{const from=source(),to=from===a?q:a;const values=batchParts(from.value);const results=await Promise.all(values.filter(Boolean).map(convertCaptureValue));to.value=results.map(x=>x.value||'').join('、');document.getElementById('editConversionStatus').textContent='已覆盖另一栏内容，可继续手动调整。';refresh()};
 page.querySelectorAll('[data-edit-cat]').forEach(b=>b.onclick=()=>{captureCat=b.dataset.editCat;item.category=captureCat;page.querySelectorAll('[data-edit-cat]').forEach(x=>x.classList.toggle('active',x===b))});
 document.getElementById('cancelEditPage').onclick=()=>{editingEntryId=null;current='detail';render()};
 document.getElementById('saveEditedEntry').onclick=()=>{const question=q.value.trim(),answer=a.value.trim();if(!question||!answer){toast('请完整填写题目和答案');return}Object.assign(item,{prompt:question,text:answer,updated_at:new Date().toISOString()});save();editingEntryId=null;current='detail';render();toast('修改已保存')};refresh();
}
