const tenantId=OneLearnStorage.getTenantId();const params=new URLSearchParams(location.search);let courseId=params.get('course')||params.get('courseId')||params.get('id')||'';let session=OneLearnStorage.read('session',null);const onelearnDevMode=params.get('dev')==='1'||params.get('preview')==='1';if(!session&&onelearnDevMode){session={userId:params.get('userId')||'demo',name:params.get('name')||'테스트 학습자',devSession:true};OneLearnStorage.write('session',session)}if(!session)location.href=`./login.html?tenant=${tenantId}`;const $=id=>document.getElementById(id);const els={loader:$('playerLoader'),welcome:$('welcomeText'),dash:$('dashboardBtn'),brandHome:$('brandHomeLink'),drawerBtn:$('chapterDrawerBtn'),drawer:$('chapterDrawer'),drawerClose:$('chapterDrawerClose'),title:$('courseTitle'),desc:$('courseDesc'),toggle:$('courseDetailToggle'),toggleText:$('courseDetailToggleText'),detail:$('courseDetailPanel'),thumb:$('courseThumbnailBox'),inst:$('instructorText'),due:$('dueDateText'),cat:$('categoryText'),detailCompletion:$('detailCompletionText'),policyChips:$('coursePolicyChips'),chCount:$('chapterCountBadge'),outline:$('courseOutline'),cPct:$('courseProgressText'),cFill:$('courseTrackFill'),chProg:$('chapterProgressText'),stage:$('playerStage'),video:$('video'),wrap:$('videoWrap'),hint:$('videoCenterHint'),overlay:$('videoOverlay'),overlayClose:$('completeOverlayClose'),time:$('timeText'),timeline:$('timeline'),allowed:$('timelineAllowed'),fill:$('timelineFill'),play:$('playBtn'),rate:$('rateSelect'),volume:$('volumeInput'),mute:$('muteBtn'),cc:$('ccBtn'),full:$('fullscreenBtn'),rotate:$('rotateBtn'),usage:$('usageBtn'),usageOverlay:$('usageOverlay'),usageClose:$('usageCloseBtn'),usagePrev:$('usagePrevBtn'),usageNext:$('usageNextBtn'),usageTitle:$('usageStepTitle'),usageText:$('usageStepText'),usageCount:$('usageStepCount'),help:$('helpBtn'),helpOverlay:$('helpOverlay'),helpClose:$('helpCloseBtn'),chapterTitle:$('chapterTitle'),chapterDesc:$('chapterDesc'),chapterIndex:$('chapterIndexText'),prev:$('prevChapterControl'),next:$('nextChapterControl'),confirm:$('confirmOverlay'),confirmText:$('confirmText'),confirmOk:$('confirmOk'),confirmCancel:$('confirmCancel'),fsPrompt:$('fullscreenChapterPrompt'),fsConfirmText:$('fullscreenConfirmText'),fsConfirmOk:$('fullscreenConfirmOk'),fsConfirmCancel:$('fullscreenConfirmCancel'),toast:$('playerToast'),identity:$('identityModal'),code:$('identityCode'),input:$('identityInput'),submit:$('identitySubmitBtn'),idMsg:$('identityMessage'),tooltip:$('onelearnTooltip')};let tenant,learner,course,chapters=[],current,idx=0,progress={},pendingMove=null,toastTimer=null,controlsTimer=null,usageStep=1,drawerWasOpenBeforeUsage=false,drawerOpenedByUsage=false,lastTickAt=null,previousVolume=1,identityShown=false,wasPlaying=false,clickTimer=null,tooltipTimer=null,lastCompletedLogChapterId=null;const usageSteps=[['① 과정 정보','과정명, 마감일, 핵심 수료 조건을 확인합니다.'],['② 챕터와 전체 진행률','챕터 목록, 전체 진행률, 챕터별 학습률을 확인합니다.'],['③ 현재 챕터 정보','현재 학습 중인 챕터 제목과 설명을 확인합니다.'],['④ 영상 영역','한 번 누르면 재생/일시정지, 두 번 누르면 전체화면으로 전환됩니다.'],['⑤ 진행바','진한 영역은 현재 위치, 옅은 영역은 이미 학습해 다시 이동 가능한 최대 위치입니다.'],['⑥ 컨트롤바','재생, 배속, 자막, 음소거, 음량, 화면 회전, 전체화면을 조절합니다.'],['⑦ 사용법과 문제 해결','사용법은 화면 안내, 문제가 있나요는 재생 문제 해결 가이드입니다.']];function finish(){setTimeout(()=>els.loader?.classList.add('done'),400)}function normalize(p){if(!p)return'';return p.startsWith('http')||p.startsWith('./')||p.startsWith('/')?p:`./${p}`}async function fj(p){return OneLearnStorage.fetchJson(normalize(p))}function key(){return`progress:${session.userId}:${courseId}`}function logKey(){return`learning-log:${session.userId}:${courseId||'unknown'}`}function save(){OneLearnStorage.write(key(),progress)}function logEvent(type,payload={}){try{const logs=OneLearnStorage.read(logKey(),[]);logs.push({type,userId:session.userId,courseId,chapterId:current?.chapterId||null,currentTime:els.video?.currentTime||0,timestamp:new Date().toISOString(),...payload});OneLearnStorage.write(logKey(),logs.slice(-500))}catch(e){}}function fmt(s){s=Number(s||0);return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`}function fmtDate(d){if(!d)return'마감 없음';const x=new Date(`${d}T00:00:00`);return Number.isNaN(x.getTime())?String(d):`${String(x.getFullYear()).slice(2)}.${String(x.getMonth()+1).padStart(2,'0')}.${String(x.getDate()).padStart(2,'0')}`}function remain(d){if(!d)return'마감 없음';const v=Math.ceil((new Date(`${d}T23:59:59`)-Date.now())/86400000);return v>0?`D-${v}`:v===0?'오늘 마감':`D+${Math.abs(v)}`}function isMobile(){return matchMedia('(max-width:760px)').matches}function isFull(){return document.fullscreenElement===els.stage}function pol(ch){return{...(course?.completionPolicy||{}),...(ch?.completionPolicy||{})}}function state(ch){if(!ch)return{};ch.chapterId=ch.chapterId||ch.id||`chapter-${chapters.indexOf(ch)+1}`;if(!progress[ch.chapterId])progress[ch.chapterId]={duration:0,maxAllowedTime:0,actualWatchSeconds:0,identityCheckCount:0,completed:false,updatedAt:null};return progress[ch.chapterId]}function complete(ch){const s=state(ch),p=pol(ch),d=s.duration||els.video.duration||0;if(!d)return false;return(s.maxAllowedTime/d)*100>=Number(p.requiredProgressPercent||p.requiredCourseProgressPercent||95)&&(s.actualWatchSeconds/d)*100>=Number(p.requiredActualWatchPercent||0)&&Number(s.identityCheckCount||0)>=Number(p.identityCheckCount||0)}async function loadDetail(m){const id=m.courseId||m.id||courseId;for(const p of [m.courseFile,m.file,m.detailFile,m.path,`./data/tenants/${tenantId}/courses/${id}.json`,`./data/tenants/${tenantId}/${id}.json`].filter(Boolean)){try{return await fj(p)}catch{}}return m}async function init(){try{try{tenant=await fj(`./data/tenants/${tenantId}/tenant.json`)}catch{tenant={tenantName:'웅진씽크빅',brand:{primaryColor:'#F47721'}}}document.documentElement.style.setProperty('--brand',tenant.brand?.primaryColor||'#F47721');try{const ld=await fj(`./data/tenants/${tenantId}/learners.json`);learner=(ld.learners||[]).find(x=>x.userId===session.userId)||{name:session.name||'학습자'}}catch{learner={name:session.name||'학습자'}}els.welcome.textContent=`${tenant.tenantName||tenant.displayName||'OneLearn'} · ${learner.name} 님`;els.dash.href=`./dashboard.html?tenant=${tenantId}`;els.brandHome.href=`./dashboard.html?tenant=${tenantId}`;const cl=await fj(`./data/tenants/${tenantId}/courses.json`),list=cl.courses||cl.items||[];let meta=list.find(x=>String(x.courseId||x.id)===String(courseId))||list[0];if(!meta)throw new Error('course not found');courseId=meta.courseId||meta.id||courseId;const detail=await loadDetail(meta);course={...meta,...detail,courseId};chapters=course.chapters||[];if(!chapters.length)throw new Error('chapters empty');progress=OneLearnStorage.read(key(),{});renderBase();select(0);updateSound();setupTooltips();logEvent('player_open')}catch(e){console.error(e);els.title.textContent='과정 정보를 불러오지 못했습니다';showToast('과정 정보를 불러오지 못했습니다.')}finally{finish()}}function renderBase(){const p=course.completionPolicy||{},due=course.dueDate||course.deadline;els.title.textContent=course.title||course.name||'제목 없음';els.desc.textContent=course.description||'';els.inst.textContent=course.instructor?.name||course.instructor||'OneLearn 전문 강사';els.due.textContent=fmtDate(due);els.cat.textContent=course.category||'-';els.detailCompletion.textContent=`${p.requiredCourseProgressPercent||95}% 이상`;els.chCount.textContent=`${chapters.length}개`;if(course.thumbnail){els.thumb.classList.add('has-image');els.thumb.style.backgroundImage=`url('${course.thumbnail}')`}els.policyChips.innerHTML=[`<span class="course-policy-chip deadline">⏰ ${remain(due)} · ${fmtDate(due)}</span>`,p.preventForwardSeeking?'<span class="course-policy-chip">🔒 앞으로 이동 제한</span>':'',p.identityCheckCount?`<span class="course-policy-chip">🧑‍💻 본인확인 ${p.identityCheckCount}회</span>`:'',p.requiredActualWatchPercent?`<span class="course-policy-chip">⏱ 실제 시청 ${p.requiredActualWatchPercent}%</span>`:''].join('');renderOutline();renderCourse()}function renderOutline(){els.outline.innerHTML='';const secs=course.sections?.length?course.sections:[{title:'기본 섹션',chapterIds:chapters.map(c=>c.chapterId||c.id)}];secs.forEach((sec,si)=>{const box=document.createElement('section');box.className='outline-section';box.innerHTML=`<button class="outline-toggle" type="button"><span>섹션${si+1}. ${sec.title}</span><span class="outline-chevron">▾</span></button><div class="outline-body"></div>`;box.querySelector('.outline-toggle').onclick=()=>box.classList.toggle('collapsed');const body=box.querySelector('.outline-body');chapters.filter(ch=>!sec.chapterIds||sec.chapterIds.includes(ch.chapterId||ch.id)).forEach(ch=>{const i=chapters.indexOf(ch),s=state(ch),r=s.duration?Math.min(100,s.maxAllowedTime/s.duration*100):0;const b=document.createElement('button');b.type='button';b.className=`chapter-button ${i===idx?'active':''}`;b.innerHTML=`<strong>${String(i+1).padStart(2,'0')}. ${ch.title||ch.name}</strong><div class="chapter-mini-progress"><i style="width:${Math.round(r)}%"></i></div><span class="chapter-percent">${Math.round(r)}%</span>`;b.onclick=()=>{requestMove(i);if(!document.body.classList.contains('usage-on'))els.drawer.classList.remove('open')};body.appendChild(b)});els.outline.appendChild(box)})}function select(i){idx=i;current=chapters[idx];current.chapterId=current.chapterId||current.id||`chapter-${idx+1}`;identityShown=false;lastTickAt=null;lastCompletedLogChapterId=null;els.chapterTitle.textContent=current.title||current.name||`챕터 ${idx+1}`;els.chapterDesc.textContent=current.description||'';els.chapterIndex.textContent=`${idx+1} / ${chapters.length}`;els.video.src=normalize(current.src||current.videoUrl||current.url||current.file||'');els.video.load();els.overlay.classList.add('hidden');els.overlayClose.classList.add('hidden');applyPlaybackPolicy();renderTime();renderOutline();showControls();logEvent('chapter_changed',{chapterIndex:idx+1})}function applyPlaybackPolicy(){const p=pol(current);if(p.allowPlaybackRate===false){els.rate.value='1';els.rate.disabled=true;els.video.playbackRate=1;return}els.rate.disabled=false;const min=Number(p.minPlaybackRate||.75),max=Number(p.maxPlaybackRate||2),safe=Math.min(max,Math.max(min,Number(els.rate.value||1)));els.rate.value=String(safe);els.video.playbackRate=safe}function canMove(t){const p=course.playbackPolicy||{};if(t<0||t>=chapters.length||t===idx)return{ok:false,msg:'이동할 수 없는 챕터입니다.'};if(p.allowChapterNavigation===false)return{ok:false,msg:'관리자 설정으로 챕터 이동이 제한되어 있습니다.'};if(t>idx&&p.requireCurrentChapterCompleteBeforeNext&&!state(current).completed)return{ok:false,msg:'현재 챕터 완료 후 다음 챕터로 이동할 수 있습니다.'};return{ok:true}}function requestMove(t){const r=canMove(t);if(!r.ok){logEvent('chapter_move_blocked',{targetIndex:t+1,reason:r.msg});return showToast(r.msg)}if((course.playbackPolicy||{}).confirmChapterMove===false)return select(t);pendingMove=t;const txt=`${t+1}챕터로 이동하시겠습니까?`;if(isFull()){els.fsConfirmText.textContent=txt;els.fsPrompt.classList.remove('hidden')}else{els.confirmText.textContent=txt;els.confirm.classList.remove('hidden')}}function renderTime(){const s=state(current),d=els.video.duration||s.duration||0,c=els.video.currentTime||0,r=d?Math.min(100,c/d*100):0,ar=d?Math.min(100,s.maxAllowedTime/d*100):0;els.time.textContent=`${fmt(c)} / ${fmt(d)} · ${Math.round(r)}%`;els.fill.style.width=`${r}%`;els.allowed.style.width=`${ar}%`;els.prev.disabled=idx<=0;els.next.disabled=idx>=chapters.length-1}function renderCourse(){let total=0,done=0;chapters.forEach(ch=>{const s=state(ch),r=s.duration?Math.min(100,s.maxAllowedTime/s.duration*100):0;total+=r;if(s.completed)done++});const cr=Math.round(chapters.length?total/chapters.length:0);els.cPct.textContent=`${cr}%`;els.cFill.style.width=`${cr}%`;els.chProg.textContent=`총 챕터 ${chapters.length}개 중 ${done}개 완료`}function update(){if(!current)return;const s=state(current),d=els.video.duration||s.duration||0;if(d)s.duration=d;const c=els.video.currentTime||0;if(c>s.maxAllowedTime)s.maxAllowedTime=c;s.updatedAt=new Date().toISOString();if(complete(current)){const was=s.completed;s.completed=true;if(!was&&lastCompletedLogChapterId!==current.chapterId){logEvent('chapter_completed');lastCompletedLogChapterId=current.chapterId}els.overlay.classList.remove('hidden');els.overlayClose.classList.remove('hidden')}save();renderTime();renderCourse()}function showToast(m){clearTimeout(toastTimer);els.toast.textContent=m;els.toast.classList.remove('hidden');toastTimer=setTimeout(()=>els.toast.classList.add('hidden'),1800)}function showControls(){els.stage.classList.add('controls-visible');clearTimeout(controlsTimer);if(isFull()&&!els.video.paused)controlsTimer=setTimeout(()=>els.stage.classList.remove('controls-visible'),2800)}function toggleFullscreen(){if(document.fullscreenElement)return document.exitFullscreen?.();(els.stage.requestFullscreen||els.stage.webkitRequestFullscreen)?.call(els.stage)}function updateSound(){const v=Number(els.volume.value||0);els.mute.textContent=(els.video.muted||v===0)?'🔇':v<.5?'🔉':'🔊'}function setUsageStep(s){usageStep=Math.max(1,Math.min(7,s));els.usageTitle.textContent=usageSteps[usageStep-1][0];els.usageText.textContent=usageSteps[usageStep-1][1];els.usageCount.textContent=`${usageStep} / 7`;document.body.classList.toggle('usage-step-bottom',usageStep>=5);document.querySelectorAll('[data-guide]').forEach(n=>n.classList.toggle('usage-active',Number(n.dataset.guide)===usageStep));if(isMobile()&&usageStep===2){if(!drawerOpenedByUsage)drawerWasOpenBeforeUsage=els.drawer.classList.contains('open');els.drawer.classList.add('open');drawerOpenedByUsage=true}else if(drawerOpenedByUsage&&!drawerWasOpenBeforeUsage)els.drawer.classList.remove('open')}function closeUsage(){document.body.classList.remove('usage-on','usage-step-bottom');els.usageOverlay.classList.add('hidden');document.querySelectorAll('[data-guide]').forEach(n=>n.classList.remove('usage-active'));if(drawerOpenedByUsage&&!drawerWasOpenBeforeUsage)els.drawer.classList.remove('open');drawerOpenedByUsage=false}function setupTooltips(){}function openIdentity(){wasPlaying=!els.video.paused;els.identity.classList.remove('hidden');els.video.pause();logEvent('identity_check_open')}function passIdentity(){state(current).identityCheckCount++;save();els.identity.classList.add('hidden');logEvent('identity_check_pass');if(wasPlaying)setTimeout(()=>els.video.play().catch(()=>{}),150)}els.video.onloadedmetadata=()=>{const s=state(current);s.duration=els.video.duration;if(s.maxAllowedTime)els.video.currentTime=Math.min(s.maxAllowedTime,s.duration);save();update()};els.video.ontimeupdate=()=>{const s=state(current),p=pol(current),c=els.video.currentTime||0,now=Date.now();if(!els.video.paused){if(lastTickAt)s.actualWatchSeconds=(s.actualWatchSeconds||0)+Math.min(2,(now-lastTickAt)/1000);lastTickAt=now}else lastTickAt=null;if(p.identityCheckCount&&!identityShown&&s.duration&&c>s.duration*.5&&s.identityCheckCount<p.identityCheckCount){identityShown=true;openIdentity()}update()};els.video.onplay=()=>{els.play.textContent='Ⅱ';showControls();logEvent('video_play')};els.video.onpause=()=>{els.play.textContent='▶';showControls();logEvent('video_pause')};els.play.onclick=()=>els.video.paused?els.video.play():els.video.pause();els.wrap.onclick=e=>{if(e.target===els.overlayClose)return;clearTimeout(clickTimer);clickTimer=setTimeout(()=>els.video.paused?els.video.play():els.video.pause(),180)};els.wrap.ondblclick=()=>{clearTimeout(clickTimer);toggleFullscreen()};els.timeline.onclick=e=>{const rect=els.timeline.getBoundingClientRect(),target=((e.clientX-rect.left)/rect.width)*(els.video.duration||0),s=state(current),p=pol(current);if(p.preventForwardSeeking&&target>s.maxAllowedTime+1.5&&!s.completed){showToast('아직 학습하지 않은 구간으로 이동할 수 없습니다.');logEvent('seek_blocked',{target});return}els.video.currentTime=target;logEvent('seek_attempt',{target})};els.rate.onchange=()=>applyPlaybackPolicy();els.volume.oninput=()=>{els.video.volume=Number(els.volume.value);els.video.muted=Number(els.volume.value)===0;if(Number(els.volume.value)>0)previousVolume=Number(els.volume.value);updateSound()};els.mute.onclick=()=>{if(els.video.muted||Number(els.volume.value)===0){els.video.muted=false;els.volume.value=previousVolume||1}else{previousVolume=Number(els.volume.value)||1;els.video.muted=true;els.volume.value=0}updateSound()};els.cc.onclick=()=>els.cc.classList.toggle('cc-on');els.full.onclick=toggleFullscreen;els.rotate.onclick=async()=>{try{if(!isFull())await els.stage.requestFullscreen?.();if(screen.orientation?.lock){const type=screen.orientation.type||'';await screen.orientation.lock(type.includes('landscape')?'portrait':'landscape')}}catch(e){showToast('이 브라우저에서는 화면 회전 고정이 제한될 수 있습니다.')}};els.overlayClose.onclick=e=>{e.stopPropagation();els.overlay.classList.add('hidden');els.overlayClose.classList.add('hidden')};els.toggle.onclick=()=>{const open=!els.detail.classList.toggle('detail-collapsed');els.toggle.classList.toggle('open',open);els.toggleText.textContent=open?'접기':'자세히'};els.drawerBtn.onclick=()=>els.drawer.classList.add('open');els.drawerClose.onclick=()=>els.drawer.classList.remove('open');els.prev.onclick=()=>requestMove(idx-1);els.next.onclick=()=>requestMove(idx+1);els.confirmCancel.onclick=()=>els.confirm.classList.add('hidden');els.confirmOk.onclick=()=>{els.confirm.classList.add('hidden');if(pendingMove!==null)select(pendingMove);pendingMove=null};els.fsConfirmCancel.onclick=()=>els.fsPrompt.classList.add('hidden');els.fsConfirmOk.onclick=()=>{els.fsPrompt.classList.add('hidden');if(pendingMove!==null)select(pendingMove);pendingMove=null};els.usage.onclick=()=>{document.body.classList.add('usage-on');els.usageOverlay.classList.remove('hidden');drawerWasOpenBeforeUsage=els.drawer.classList.contains('open');drawerOpenedByUsage=false;setUsageStep(1)};els.usageClose.onclick=closeUsage;els.usagePrev.onclick=()=>setUsageStep(usageStep-1);els.usageNext.onclick=()=>setUsageStep(usageStep+1);els.help.onclick=()=>els.helpOverlay.classList.remove('hidden');els.helpClose.onclick=()=>els.helpOverlay.classList.add('hidden');els.submit.onclick=()=>{if(els.input.value.trim().toUpperCase()!==els.code.textContent)return els.idMsg.textContent='입력한 문구가 일치하지 않습니다.';passIdentity()};document.addEventListener('visibilitychange',()=>{if(document.hidden&&current&&pol(current).pauseWhenHidden){els.video.pause();logEvent('tab_hidden_pause')}});document.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName?.toLowerCase(),typing=tag==='input'||tag==='textarea'||tag==='select';if(typing&&e.key!=='Escape')return;if(e.code==='Space'){e.preventDefault();els.video.paused?els.video.play():els.video.pause()}if(e.key.toLowerCase()==='f')toggleFullscreen();if(e.key.toLowerCase()==='m')els.mute.click();if(e.key.toLowerCase()==='c')els.cc.click();if(e.key==='ArrowRight'){e.preventDefault();els.video.currentTime=Math.min(els.video.duration||0,els.video.currentTime+5)}if(e.key==='ArrowLeft'){e.preventDefault();els.video.currentTime=Math.max(0,els.video.currentTime-5)}if(e.key==='Escape'){closeUsage();els.helpOverlay.classList.add('hidden');els.confirm.classList.add('hidden');els.fsPrompt.classList.add('hidden')}});init();

/* === v03 PLAYER JS-ONLY RESTRICTION RESTORE / HARDENING ===
   기준: 사용자가 공유한 안정 player.js 보존
   목적: 로그인 테스트 진입(dev=1/preview=1) + 제한 기능 우회 경로 보강
   포함 금지: player.html / player.css / common.css / storage.js / login 관련 변경 없음
*/
let onelearnInternalSeekV03 = false;
let onelearnLastSeekBlockAtV03 = 0;
let onelearnCourseCompletedLoggedV03 = false;

function onelearnPolicyV03(ch){
  return { ...(course?.completionPolicy || {}), ...(ch?.completionPolicy || {}) };
}
function onelearnStateV03(ch){ return state(ch); }
function onelearnDurationV03(){ return Number(els.video.duration || onelearnStateV03(current).duration || 0); }
function onelearnAllowedTimeV03(){ return Number(onelearnStateV03(current).maxAllowedTime || 0); }
function onelearnCanForwardToV03(target){
  const p = onelearnPolicyV03(current);
  const s = onelearnStateV03(current);
  if(!p.preventForwardSeeking || s.completed) return true;
  return Number(target || 0) <= Number(s.maxAllowedTime || 0) + 1.25;
}
function onelearnBlockedSeekV03(target, source='unknown'){
  const now = Date.now();
  if(now - onelearnLastSeekBlockAtV03 > 700){
    showToast('아직 학습하지 않은 구간으로 이동할 수 없습니다.');
    logEvent('seek_blocked', { target, source, maxAllowedTime: onelearnAllowedTimeV03() });
    onelearnLastSeekBlockAtV03 = now;
  }
  onelearnInternalSeekV03 = true;
  const rollback = Math.max(0, Math.min(onelearnAllowedTimeV03(), onelearnDurationV03() || onelearnAllowedTimeV03()));
  els.video.currentTime = rollback;
  setTimeout(()=>{ onelearnInternalSeekV03 = false; }, 80);
}
function onelearnGuardedSeekV03(target, source='unknown'){
  target = Math.max(0, Math.min(Number(target || 0), onelearnDurationV03() || Number(target || 0)));
  if(!onelearnCanForwardToV03(target)) return onelearnBlockedSeekV03(target, source);
  onelearnInternalSeekV03 = true;
  els.video.currentTime = target;
  setTimeout(()=>{ onelearnInternalSeekV03 = false; }, 80);
  logEvent('seek_attempt', { target, source });
}

/* 배속 제한: allowPlaybackRate / minPlaybackRate / maxPlaybackRate 보정 */
function applyPlaybackPolicy(){
  const p = onelearnPolicyV03(current);
  const allow = p.allowPlaybackRate !== false;
  const min = Number(p.minPlaybackRate || 0.75);
  const max = Number(p.maxPlaybackRate || 2);
  Array.from(els.rate.options || []).forEach(opt=>{
    const v = Number(opt.value || 1);
    opt.disabled = !allow || v < min || v > max;
  });
  if(!allow){
    els.rate.value = '1';
    els.rate.disabled = true;
    els.video.playbackRate = 1;
    logEvent('rate_forced', { reason:'allowPlaybackRate_false', rate:1 });
    return;
  }
  els.rate.disabled = false;
  let requested = Number(els.rate.value || els.video.playbackRate || 1);
  let safe = Math.min(max, Math.max(min, requested));
  const hasEnabledOption = Array.from(els.rate.options || []).some(o=>!o.disabled && Number(o.value)===safe);
  if(!hasEnabledOption){
    const fallback = Array.from(els.rate.options || []).find(o=>!o.disabled) || els.rate.options[1];
    safe = Number(fallback?.value || 1);
  }
  els.rate.value = String(safe);
  if(Number(els.video.playbackRate) !== safe) els.video.playbackRate = safe;
}

/* 챕터 이동 정책: 기존 canMove를 더 엄격하게 보강 */
function canMove(t){
  const p = course?.playbackPolicy || {};
  if(t < 0 || t >= chapters.length || t === idx) return {ok:false,msg:'이동할 수 없는 챕터입니다.'};
  if(p.allowChapterNavigation === false) return {ok:false,msg:'관리자 설정으로 챕터 이동이 제한되어 있습니다.'};
  if(t < idx && p.allowPreviousChapter === false) return {ok:false,msg:'이전 챕터 이동이 제한되어 있습니다.'};
  if(t > idx && p.allowNextChapter === false) return {ok:false,msg:'다음 챕터 이동이 제한되어 있습니다.'};
  if(t > idx && p.requireCurrentChapterCompleteBeforeNext && !onelearnStateV03(current).completed){
    return {ok:false,msg:'현재 챕터 완료 후 다음 챕터로 이동할 수 있습니다.'};
  }
  return {ok:true};
}

/* 본인확인: identityCheckCount 2회 이상도 분산 체크 */
function onelearnIdentityCheckpointNeededV03(){
  const p = onelearnPolicyV03(current);
  const required = Number(p.identityCheckCount || 0);
  if(!required) return false;
  const s = onelearnStateV03(current);
  const passed = Number(s.identityCheckCount || 0);
  if(passed >= required) return false;
  const d = onelearnDurationV03();
  if(!d) return false;
  const ratio = (els.video.currentTime || 0) / d;
  const nextCheckpoint = (passed + 1) / (required + 1);
  return ratio >= nextCheckpoint;
}
function onelearnCheckCourseCompletedV03(){
  if(onelearnCourseCompletedLoggedV03 || !chapters.length) return;
  const allDone = chapters.every(ch=>onelearnStateV03(ch).completed);
  if(allDone){
    onelearnCourseCompletedLoggedV03 = true;
    logEvent('course_completed', { completedChapters: chapters.length });
  }
}

/* 핵심 timeupdate 재정의: 기존 제한 기능 유지 + 본인확인 다회 지원 + course_completed */
els.video.ontimeupdate = ()=>{
  if(!current) return;
  const s = onelearnStateV03(current), d = onelearnDurationV03(), c = els.video.currentTime || 0, now = Date.now();
  if(d) s.duration = d;
  if(!els.video.paused){
    if(lastTickAt) s.actualWatchSeconds = (s.actualWatchSeconds || 0) + Math.min(2, (now - lastTickAt) / 1000);
    lastTickAt = now;
  }else{
    lastTickAt = null;
  }
  if(c > (s.maxAllowedTime || 0)) s.maxAllowedTime = c;
  s.updatedAt = new Date().toISOString();
  if(onelearnIdentityCheckpointNeededV03()) openIdentity();
  if(complete(current)){
    const was = s.completed;
    s.completed = true;
    if(!was && lastCompletedLogChapterId !== current.chapterId){
      logEvent('chapter_completed');
      lastCompletedLogChapterId = current.chapterId;
    }
    els.overlay.classList.remove('hidden');
    els.overlayClose.classList.remove('hidden');
  }
  save();
  renderTime();
  renderCourse();
  onelearnCheckCourseCompletedV03();
};

/* seeking 이벤트 방어: 브라우저/키보드/외부 코드 우회 차단 */
els.video.addEventListener('seeking', ()=>{
  if(onelearnInternalSeekV03 || !current) return;
  const target = Number(els.video.currentTime || 0);
  if(!onelearnCanForwardToV03(target)) onelearnBlockedSeekV03(target, 'video_seeking');
});
els.video.addEventListener('ratechange', ()=>{
  if(!current) return;
  const before = Number(els.video.playbackRate || 1);
  applyPlaybackPolicy();
  if(Number(els.video.playbackRate || 1) !== before){
    logEvent('rate_blocked', { requested: before, applied: Number(els.video.playbackRate || 1) });
  }
});

/* timeline 클릭도 제한 함수 경유 */
els.timeline.onclick = e=>{
  const rect = els.timeline.getBoundingClientRect();
  const target = ((e.clientX - rect.left) / rect.width) * (onelearnDurationV03() || 0);
  onelearnGuardedSeekV03(target, 'timeline');
};

/* 키보드 이동도 제한 함수 경유 */
document.addEventListener('keydown', e=>{
  const tag = document.activeElement?.tagName?.toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if(typing) return;
  if(e.key === 'ArrowRight'){
    e.preventDefault();
    onelearnGuardedSeekV03((els.video.currentTime || 0) + 5, 'keyboard_right');
  }
  if(e.key === 'ArrowLeft'){
    e.preventDefault();
    onelearnGuardedSeekV03((els.video.currentTime || 0) - 5, 'keyboard_left');
  }
}, true);

/* 사용법 2번: 모바일 챕터 드로어 자동 열림 / 다른 단계 닫힘 */
function setUsageStep(s){
  usageStep = Math.max(1, Math.min(7, s));
  els.usageTitle.textContent = usageSteps[usageStep-1][0];
  els.usageText.textContent = usageSteps[usageStep-1][1];
  els.usageCount.textContent = `${usageStep} / 7`;
  document.body.classList.toggle('usage-step-bottom', usageStep >= 5);
  document.querySelectorAll('[data-guide]').forEach(n=>n.classList.toggle('usage-active', Number(n.dataset.guide) === usageStep));
  if(isMobile() && usageStep === 2){
    if(!drawerOpenedByUsage) drawerWasOpenBeforeUsage = els.drawer.classList.contains('open');
    els.drawer.classList.add('open');
    drawerOpenedByUsage = true;
  }else if(drawerOpenedByUsage && !drawerWasOpenBeforeUsage){
    els.drawer.classList.remove('open');
  }
}

/* 모바일 챕터 드로어 바깥 터치 닫힘 */
els.drawerBtn.addEventListener('click', e=>{ e.stopPropagation(); els.drawer.classList.add('open'); });
document.addEventListener('click', e=>{
  if(!isMobile()) return;
  if(els.drawer.classList.contains('open') && !e.target.closest('#chapterDrawer') && !e.target.closest('#chapterDrawerBtn')){
    els.drawer.classList.remove('open');
  }
});

/* 초기 정책 재적용 */
setTimeout(()=>{ try{ applyPlaybackPolicy(); renderCourse(); }catch(e){} }, 500);
