let updatingApp=false;
async function checkAppUpdate(button){
 if(updatingApp)return;
 if(!/^https?:$/.test(location.protocol)){toast("发布后可在手机上检查更新，当前是本地文件预览");return}
 updatingApp=true;const label=button.innerHTML;button.disabled=true;button.innerHTML="正在检查更新…";
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch("version.json?check="+Date.now(),{cache:"no-store",signal:controller.signal});if(!response.ok)throw Error("版本信息读取失败");const latest=await response.json();if(latest.build===APP_RELEASE.build){toast("当前已是最新版本 "+latest.version);return}
  if(!("serviceWorker" in navigator))throw Error("当前浏览器无法更新离线应用");
  save();const registration=await navigator.serviceWorker.register("sw.js",{updateViaCache:"none"});await registration.update();
  const worker=await new Promise((resolve,reject)=>{if(registration.waiting)return resolve(registration.waiting);let attached=null;const timeout=setTimeout(()=>reject(Error("更新暂未就绪，请稍后再试")),25000);const inspect=()=>{if(registration.waiting){clearTimeout(timeout);resolve(registration.waiting);return}const candidate=registration.installing;if(candidate&&candidate!==attached){attached=candidate;candidate.addEventListener("statechange",()=>{if(candidate.state==="installed"){clearTimeout(timeout);resolve(candidate)}else if(candidate.state==="redundant"){clearTimeout(timeout);reject(Error("新版本下载失败，请稍后再试"))}})}};registration.addEventListener("updatefound",inspect);inspect()});
  button.innerHTML="下载完成，正在更新…";let refreshed=false;const reload=()=>{if(refreshed)return;refreshed=true;location.reload()};navigator.serviceWorker.addEventListener("controllerchange",reload,{once:true});worker.postMessage({type:"SKIP_WAITING"});setTimeout(()=>{if(!refreshed){button.disabled=false;button.innerHTML=label;updatingApp=false;toast("请关闭并重新打开应用完成更新")}},10000);
 }catch(error){toast(error.name==="AbortError"?"网络连接超时，请联网后重试":error.message||"更新失败，请稍后重试")}finally{clearTimeout(timer);if(button.innerHTML!=="下载完成，正在更新…"){button.disabled=false;button.innerHTML=label;updatingApp=false}}
}
