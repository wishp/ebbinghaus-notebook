async function convertCaptureValue(value){return convertCaptureValueFor(captureCat,value)}
async function convertCaptureValueFor(category,value){
 if(!value)return {value:"",unknown:true};
 if(category.startsWith("语文")){
  if(/[\u3400-\u9fff]/.test(value))return toPinyin(value);
  const candidates=findReverseWords(value);
  return {value:candidates.length===1?candidates[0]:"",unknown:candidates.length!==1,candidates};
 }
 if(/[㐀-鿿]/.test(value))return translateChineseEnglish(value);
 const translated=translateEnglish(value);return translated.unknown?{value,unknown:true,untranslated:true}:translated;
}
function renderBatchCapture(options={}){
 const dateEdit=!!options.dateEdit;
 state.batchDrafts=state.batchDrafts||{};
 if(!state.batchDrafts[captureCat]){
  const previous=state.entryDrafts?.[captureCat],old=parseEntries(state.drafts[captureCat]||"");
  state.batchDrafts[captureCat]=previous&&!previous.legacy&&(previous.answer||previous.question)
   ?{answer:previous.answer,question:previous.question}
   :{answer:old.map(x=>x.answer).join("、"),question:old.map(x=>x.prompt).join("、")};
 }
 const draft=dateEdit?entryEditDraft.get(captureCat):state.batchDrafts[captureCat];
 const capturePage=document.getElementById("capture");
 let syncVersion=0;
 let sourceField=draft.sourceField||(draft.answer?"answer":"question");
 const page=document.getElementById("capture");
 page.innerHTML=`${dateEdit?'<div class="entry-page-heading"><button type="button" class="back" id="cancelDateEdit" aria-label="返回录入信息">‹</button><h1 class="title">编辑当天录入信息</h1></div><p class="subtle">'+editingEntryDate.replaceAll('-','.')+' · 切换分类批量修改，最后统一保存</p>':'<h1 class="title">错题录入</h1>' }<div class="tabs capture-tabs">${cats.map(c=>`<button type="button" class="${c===captureCat?"active":""}" data-cat="${c}">${c.replace("-","")}</button>`).join("")}</div><p class="subtle entry-help">任意一栏输入内容，用顿号分隔。同步转化以最后编辑的一栏为准，生成另一栏。</p><div class="entry-pair"><label class="entry-field">题目 <small>首页展示这些题目</small><textarea id="questionInput" rows="3" placeholder="多个题目用顿号分隔">${esc(draft.question)}</textarea></label><div class="batch-sync-line"><button type="button" class="convert-btn" id="syncBatch">同步转化</button><span id="syncDirection"></span></div><label class="entry-field">答案 <small>多个内容用顿号分隔</small><textarea id="answerInput" rows="3" placeholder="例如：朋友、学习">${esc(draft.answer)}</textarea></label></div><p id="conversionStatus" class="conversion-status" role="status">常用词优先本地转化，可手动修改；英语未收录的内容将提交至 MyMemory 联网翻译。</p><div id="candidatePanel"></div><div id="batchPreview" class="batch-preview"></div><button type="button" class="save" id="saveEntry">保存本批内容</button>`;
 const fields={answer:document.getElementById("answerInput"),question:document.getElementById("questionInput")};
 const button=document.getElementById("saveEntry"),status=document.getElementById("conversionStatus");
 const pairs=()=>{
  const a=batchParts(fields.answer.value),q=batchParts(fields.question.value);
  return {a,q,ready:!!fields.answer.value.trim()&&a.length===q.length&&a.every(Boolean)&&q.every(Boolean)};
 };
 const resolveSource=()=>{
  if(!fields[sourceField].value.trim()&&fields[sourceField==="answer"?"question":"answer"].value.trim())sourceField=sourceField==="answer"?"question":"answer";
  return sourceField;
 };
 const refresh=()=>{
  resolveSource();
  const {a,q,ready}=pairs();
  const canSave=dateEdit?dateEditReady():ready;
  button.disabled=!canSave;
  button.classList.toggle("enabled",canSave);
  button.textContent=dateEdit?"保存全部修改":ready?`保存 ${a.length} 条内容`:"保存本批内容";
  document.getElementById("syncBatch").disabled=!fields.answer.value.trim()&&!fields.question.value.trim();
  document.getElementById("syncDirection").textContent=sourceField==="answer"?"答案 → 题目":"题目 → 答案";
  document.getElementById("batchPreview").innerHTML=(fields.answer.value.trim()||fields.question.value.trim())
   ?Array.from({length:Math.max(a.length,q.length)},(_,i)=>`<div class="batch-preview-row"><span>${i+1}</span><div><small>题目</small>${q[i]?esc(q[i]):"<em>待补充题目</em>"}</div><div><small>答案</small>${a[i]?esc(a[i]):"<em>待补充答案</em>"}</div></div>`).join("")
   :"";
 };
 Object.keys(fields).forEach(field=>{
  fields[field].oninput=()=>{
   syncVersion++;draft[field]=fields[field].value;sourceField=field;draft.sourceField=field;
   document.getElementById("candidatePanel").innerHTML="";
   if(!dateEdit)save();status.textContent="点击同步转化生成"+(field==="answer"?"题目":"答案")+"。";refresh();
  };
 });
 document.getElementById("syncBatch").onclick=async()=>{
  resolveSource();
  const source=fields[sourceField],targetField=sourceField==="answer"?"question":"answer",target=fields[targetField];
  const values=batchParts(source.value);
  if(!source.value.trim())return;
  const version=++syncVersion,category=captureCat;
  status.textContent="正在同步转化…";
  const results=await Promise.all(values.map(convertCaptureValue));
  if(version!==syncVersion||captureCat!==category||current!=="capture"||!capturePage.contains(fields.answer)||document.getElementById("answerInput")!==fields.answer)return;
  target.value=results.map(x=>x.value||"").join("、");
  draft[targetField]=target.value;draft[sourceField]=source.value;draft.sourceField=sourceField;if(!dateEdit)save();
  status.textContent=results.some(x=>x.untranslated)?"部分内容暂未译出，已保留原文，请手动调整。":results.some(x=>x.unknown)?"有歧义的拼音请选择候选词，未识别的内容请在对应空项补充。":"已按常用译法同步并覆盖原内容，可直接修改后保存。";
  refresh();
  const panel=document.getElementById("candidatePanel");
  panel.innerHTML=results.map((x,i)=>x.candidates?.length>1?`<label class="candidate-choice">第${i+1}项「${esc(values[i])}」<select data-choice="${i}"><option value="">请选择对应词语</option>${x.candidates.map((word,j)=>`<option value="${j}">${esc(word)}</option>`).join("")}</select></label>`:"").join("");
  panel.querySelectorAll("[data-choice]").forEach(select=>{
   select.onchange=()=>{
    const i=+select.dataset.choice,parts=batchParts(target.value);
    parts[i]=select.value===""?"":results[i].candidates[+select.value];target.value=parts.join("、");
    draft[targetField]=target.value;if(!dateEdit)save();refresh();
   };
  });
 };
 document.querySelectorAll("[data-cat]").forEach(button=>{
  button.onclick=()=>{syncVersion++;captureCat=button.dataset.cat;render()};
 });
 button.onclick=()=>{
  if(dateEdit){saveDateEdit();return}
  const {a,q,ready}=pairs();
  if(!ready)return;
  a.forEach((value,i)=>state.items.push({id:Date.now()+Math.random(),category:captureCat,text:value,prompt:q[i],created_at:today(),stage:0,wrong_count:0,status:"复习中",next_review_at:addDays(today(),1)}));
  delete state.batchDrafts[captureCat];delete state.entryDrafts?.[captureCat];state.drafts[captureCat]="";
  save();renderBatchCapture();toast("已保存"+a.length+"条");document.getElementById("answerInput").focus();
 };
 if(dateEdit)document.getElementById("cancelDateEdit").onclick=cancelDateEdit;
 refresh();
}
