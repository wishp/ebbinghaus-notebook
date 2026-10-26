// Entry management keeps review progress when content changes.
const detailDayCategories = {};
let entryEditDraft=null;
const canManageEntry=item=>!!item&&item.created_at===today();
function cancelEntryEdit(){editingEntryId=null;entryEditDraft=null;current='detail';render()}

function renderDetail(){
 const filtered=state.items.filter(x=>(!detailCategory||x.category===detailCategory)&&(!detailStatus||(detailStatus==='顽固'?x.wrong_count>=3:x.status===detailStatus)));
 const dates=[...new Set(filtered.map(x=>x.created_at))].sort().reverse();
 const grouped=dates.map(date=>{
  const rows=filtered.filter(x=>x.created_at===date), dayCats=cats.filter(c=>rows.some(x=>x.category===c));
  const active=dayCats.includes(detailDayCategories[date])?detailDayCategories[date]:dayCats[0];
  const tabs=dayCats.length>1?`<div class="day-tabs">${dayCats.map(c=>`<button type="button" class="${c===active?'active':''}" data-day-tab="${date}" data-category="${c}">${c.replace('-','')} (${rows.filter(x=>x.category===c).length})</button>`).join('')}</div>`:'';
  const panels=dayCats.map(c=>`<div class="day-panel ${c===active?'active':''}" data-day-panel="${date}" data-category="${c}"><div class="detail-list">${rows.filter(x=>x.category===c).map(x=>{const editable=canManageEntry(x);return `<article class="detail-entry"><div class="detail-copy"><div class="detail-text ${x.status==='已掌握'?'green':x.wrong_count>=3?'red':''}">${esc(x.text)}</div><div class="detail-prompt">题目：${esc(x.prompt||x.text)}</div><div class="detail-meta">第 ${Math.min((x.stage||0)+1,6)}/6 轮 · ${x.status}${x.wrong_count>=3?' · 顽固':''}</div></div>${editable?`<div class="entry-actions"><button type="button" class="entry-action" data-edit-entry="${x.id}">编辑</button><button type="button" class="entry-action entry-action-delete" data-delete-entry="${x.id}">删除</button></div>`:'<span class="entry-locked">已归档</span>'}</article>`}).join('')}</div></div>`).join('');
  return `<section><div class="date-group-title">${date.replaceAll('-','.')}<small>${rows.length} 条</small></div>${tabs}${panels}</section>`;
 }).join('');
 const filters=[['','全部'],['复习中','复习中'],['顽固','顽固'],['已掌握','已掌握']].map(([value,label])=>`<button type="button" class="${detailStatus===value?'active':''}" data-detail-status="${value}">${label} (${state.items.filter(x=>(!detailCategory||x.category===detailCategory)&&(!value||(value==='顽固'?x.wrong_count>=3:x.status===value))).length})</button>`).join('');
 const catFilters=`<div class="day-tabs detail-category-tabs"><button type="button" class="${!detailCategory?'active':''}" data-detail-cat="">全部分类</button>${cats.map(c=>`<button type="button" class="${detailCategory===c?'active':''}" data-detail-cat="${c}">${c.replace('-','')}</button>`).join('')}</div>`;
 subPage('录入信息',`${catFilters}<div class="filter">${filters}</div><p class="subtle">仅当天录入的信息可编辑和删除</p>${grouped||'<div class="empty">没有符合条件的录入信息</div>'}`);
 const page=document.getElementById('detail');
 page.querySelectorAll('[data-detail-cat]').forEach(b=>b.onclick=()=>{detailCategory=b.dataset.detailCat;renderDetail()});
 page.querySelectorAll('[data-detail-status]').forEach(b=>b.onclick=()=>{detailStatus=b.dataset.detailStatus;renderDetail()});
 page.querySelectorAll('[data-day-tab]').forEach(b=>b.onclick=()=>{detailDayCategories[b.dataset.dayTab]=b.dataset.category;renderDetail()});
 page.querySelectorAll('[data-edit-entry]').forEach(b=>b.onclick=()=>editEntry(Number(b.dataset.editEntry)));
 page.querySelectorAll('[data-delete-entry]').forEach(b=>b.onclick=()=>confirmDeleteEntry(Number(b.dataset.deleteEntry)));
}
function editEntry(id){
 const item=state.items.find(x=>x.id===id);if(!canManageEntry(item)){toast('只有今天录入的信息可以编辑');return}
 editingEntryId=id;entryEditDraft={answer:item.text||'',question:item.prompt||'',sourceField:'answer'};captureCat=item.category;current='capture';render();window.scrollTo({top:0,behavior:'instant'});
}
function confirmDeleteEntry(id){
 const item=state.items.find(x=>x.id===id);if(!item)return;if(!canManageEntry(item)){toast('只有今天录入的信息可以删除');return}
 openSheet(`<h3>删除这条录入信息？</h3><p class="delete-preview"></p><p class="setting-help">删除后将从错题库、复习任务及相关历史中移除。本次删除后可立即撤销。</p><button type="button" class="danger" id="confirmDeleteEntry">删除这条信息</button><button type="button" id="cancelDeleteEntry">取消</button>`);
 document.querySelector('.delete-preview').textContent=item.text;
 document.getElementById('cancelDeleteEntry').onclick=closeSheet;
 document.getElementById('confirmDeleteEntry').onclick=()=>{
  const index=state.items.findIndex(x=>x.id===id);if(index<0)return;if(!canManageEntry(state.items[index])){closeSheet();render();toast('已过录入当天，无法删除');return}
  const logs=state.logs.filter(x=>x.item_id===id);state.trash=state.trash||[];
  const record={item:{...item},logs,deleted_at:new Date().toISOString()};state.trash.push(record);
  state.items.splice(index,1);state.logs=state.logs.filter(x=>x.item_id!==id);delete marked[id];save();closeSheet();render();
  const el=document.getElementById('toast');el.textContent='已删除 ';const undo=document.createElement('button');undo.type='button';undo.textContent='撤销';el.appendChild(undo);el.classList.add('show');
  const timer=setTimeout(()=>el.classList.remove('show'),7000);
  undo.onclick=()=>{clearTimeout(timer);if(!state.items.some(x=>x.id===id)){state.items.splice(Math.min(index,state.items.length),0,record.item);state.logs.push(...record.logs);state.trash=state.trash.filter(x=>x!==record);save();render()}toast('已恢复这条信息')};
 };
}

function renderEditCapture(){
 const item=state.items.find(x=>x.id===editingEntryId);
 if(!canManageEntry(item)){editingEntryId=null;entryEditDraft=null;current='detail';render();toast('只有今天录入的信息可以编辑');return}
 renderBatchCapture(item);
}
function showInstallGuide(){
 const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 openSheet(`<h3>${standalone?'已从桌面应用打开':'添加到手机主屏幕'}</h3><div class="install-guide-brand"><img src="icons/apple-touch-icon.png" alt="错题本应用图标"><div><strong>艾宾浩斯错题本</strong><span>点桌面图标，即可开始复习</span></div></div><div class="install-guide"><h4>iPhone / iPad</h4><ol><li>用 Safari 浏览器打开本应用。</li><li>点击分享按钮（方框向上箭头）。</li><li>选择“添加到主屏幕”；如有“作为网页 App 打开”选项，请开启，再点击“添加”。</li></ol><h4>Android 手机</h4><ol><li>用 Chrome 浏览器打开本应用。</li><li>点右上角 ⋮ → 添加到主屏幕 → 安装。</li></ol><p class="setting-help">请先添加图标，再从图标中录入和复习。学习数据保存在当前设备；手机与 iPad 各自保存。</p></div><button type="button" id="closeInstallGuide">知道了</button>`);
 document.getElementById('closeInstallGuide').onclick=closeSheet;
}
