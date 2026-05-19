const tenantId = OneLearnStorage.getTenantId();
const courseId = new URLSearchParams(location.search).get('course') || 'legal-001';
const session = OneLearnStorage.read('session', null);

if (!session) {
  location.href = `./login.html?tenant=${tenantId}`;
}

const $ = id => document.getElementById(id);

const els = {
  loader: $('playerLoader'),
  welcome: $('welcomeText'),
  dash: $('dashboardBtn'),

  drawerBtn: $('chapterDrawerBtn'),
  drawer: $('chapterDrawer'),
  drawerClose: $('chapterDrawerClose'),

  title: $('courseTitle'),
  desc: $('courseDesc'),
  toggle: $('courseDetailToggle'),
  detail: $('courseDetailPanel'),

  thumb: $('courseThumbnailBox'),
  inst: $('instructorText'),
  due: $('dueDateText'),
  cat: $('categoryText'),
  detailCompletion: $('detailCompletionText'),
  policyChips: $('coursePolicyChips'),

  chCount: $('chapterCountBadge'),
  outline: $('courseOutline'),
  cPct: $('courseProgressText'),
  cFill: $('courseTrackFill'),
  chProg: $('chapterProgressText'),

  stage: $('playerStage'),
  video: $('video'),
  wrap: $('videoWrap'),
  hint: $('videoCenterHint'),
  overlay: $('videoOverlay'),
  overlayClose: $('completeOverlayClose'),

  time: $('timeText'),
  timeline: $('timeline'),
  fill: $('timelineFill'),

  play: $('playBtn'),
  rate: $('rateSelect'),
  volume: $('volumeInput'),
  cc: $('ccBtn'),
  full: $('fullscreenBtn'),
  rotate: $('rotateBtn'),

  help: $('helpBtn'),
  helpOverlay: $('helpOverlay'),
  helpClose: $('helpCloseBtn'),

  identity: $('identityModal'),
  code: $('identityCode'),
  input: $('identityInput'),
  submit: $('identitySubmitBtn'),
  idMsg: $('identityMessage'),

  chapterTitle: $('chapterTitle'),
  chapterDesc: $('chapterDesc'),
  chapterIndex: $('chapterIndexText'),
  prev: $('prevChapterControl'),
  next: $('nextChapterControl'),

  confirm: $('confirmOverlay'),
  confirmText: $('confirmText'),
  confirmOk: $('confirmOk'),
  confirmCancel: $('confirmCancel')
};

let tenant;
let learner;
let course;
let chapters = [];
let current;
let idx = 0;
let progress = {};
let wasPlaying = false;
let identityShown = false;
let pendingMove = null;
let lastTickAt = null;
let controlsTimer = null;
let clickTimer = null;

function key() {
  return `progress:${session.userId}:${courseId}`;
}

function save() {
  OneLearnStorage.write(key(), progress);
}

function fmt(s) {
  s = Number(s || 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function fmtDate(d) {
  if (!d) return '마감 없음';

  const x = new Date(d + 'T00:00:00');
  return `${String(x.getFullYear()).slice(2)}.${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`;
}

function remainText(d) {
  if (!d) return '마감 없음';

  const diff = Math.ceil((new Date(d + 'T23:59:59') - Date.now()) / 86400000);

  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return '오늘 마감';
  return `D+${Math.abs(diff)}`;
}

function isMobile() {
  return matchMedia('(max-width:760px)').matches;
}

function pol(ch) {
  return {
    ...(course.completionPolicy || {}),
    ...(ch?.completionPolicy || {})
  };
}

function state(ch) {
  if (!progress[ch.chapterId]) {
    progress[ch.chapterId] = {
      duration: 0,
      maxAllowedTime: 0,
      actualWatchSeconds: 0,
      identityCheckCount: 0,
      completed: false,
      updatedAt: null
    };
  }

  return progress[ch.chapterId];
}

function complete(ch) {
  const s = state(ch);
  const p = pol(ch);
  const d = s.duration || els.video.duration || 0;

  return d &&
    s.maxAllowedTime / d * 100 >= Number(p.requiredProgressPercent || p.requiredCourseProgressPercent || 95) &&
    s.actualWatchSeconds / d * 100 >= Number(p.requiredActualWatchPercent || 0) &&
    Number(s.identityCheckCount || 0) >= Number(p.identityCheckCount || 0);
}

async function init() {
  try {
    tenant = await OneLearnStorage.fetchJson(`./data/tenants/${tenantId}/tenant.json`);
  } catch {
    tenant = {
      tenantName: '웅진씽크빅',
      brand: {
        primaryColor: '#F47721'
      }
    };
  }

  document.documentElement.style.setProperty('--brand', tenant.brand?.primaryColor || '#F47721');

  try {
    const ld = await OneLearnStorage.fetchJson(`./data/tenants/${tenantId}/learners.json`);
    learner = (ld.learners || []).find(x => x.userId === session.userId) || { name: session.name || '학습자' };
  } catch {
    learner = { name: session.name || '학습자' };
  }

  els.welcome.textContent = `${tenant.tenantName || tenant.displayName || 'OneLearn'} · ${learner.name} 님`;
  els.dash.href = `./dashboard.html?tenant=${tenantId}`;

  try {
    const cl = await OneLearnStorage.fetchJson(`./data/tenants/${tenantId}/courses.json`);
    const m = (cl.courses || []).find(x => x.courseId === courseId);

    if (!m) throw new Error('course not found');

    const d = await OneLearnStorage.fetchJson(m.courseFile);
    course = { ...m, ...d };
  } catch {
    alert('과정 정보를 불러오지 못했습니다.');
    location.href = `./dashboard.html?tenant=${tenantId}`;
    return;
  }

  chapters = course.chapters || [];

  if (!chapters.length) {
    alert('등록된 챕터가 없습니다.');
    location.href = `./dashboard.html?tenant=${tenantId}`;
    return;
  }

  progress = OneLearnStorage.read(key(), {});

  renderBase();
  select(0);

  setTimeout(() => {
    els.loader.classList.add('done');
  }, 450);
}

function renderBase() {
  const p = course.completionPolicy || {};

  els.title.textContent = course.title;
  els.desc.textContent = course.description || '';
  els.inst.textContent = course.instructor?.name || 'OneLearn 전문 강사';
  els.due.textContent = fmtDate(course.dueDate);
  els.cat.textContent = course.category || '-';
  els.detailCompletion.textContent = `${p.requiredCourseProgressPercent || 95}% 이상`;
  els.chCount.textContent = `${chapters.length}개`;

  if (course.thumbnail) {
    els.thumb.classList.add('has-image');
    els.thumb.style.backgroundImage = `url('${course.thumbnail}')`;
  } else {
    els.thumb.classList.remove('has-image');
    els.thumb.style.backgroundImage = '';
  }

  renderPolicyChips();
  renderOutline();
  renderCourse();
}

function buildChips() {
  const p = course.completionPolicy || {};
  const chips = [];

  chips.push({
    label: `⏰ ${remainText(course.dueDate)} · ${fmtDate(course.dueDate)}`,
    cls: 'deadline'
  });

  if (p.preventForwardSeeking) chips.push({ label: '🔒 앞으로 이동 제한' });
  if (p.identityCheckCount) chips.push({ label: `🧑‍💻 본인확인 ${p.identityCheckCount}회` });
  if (p.requiredActualWatchPercent) chips.push({ label: `⏱ 실제 시청 ${p.requiredActualWatchPercent}%` });
  if (p.requiredCourseProgressPercent) chips.push({ label: `✅ 완료 ${p.requiredCourseProgressPercent}%` });
  if (p.maxPlaybackRate) chips.push({ label: `⚡ 최대 ${p.maxPlaybackRate}x` });
  if (p.pauseWhenHidden) chips.push({ label: '👁 화면 이탈 감지' });

  return chips;
}

function renderPolicyChips() {
  const chips = buildChips();

  els.policyChips.innerHTML = chips
    .map(c => `<span class="course-policy-chip ${c.cls || ''}">${c.label}</span>`)
    .join('');
}

function renderOutline() {
  els.outline.innerHTML = '';

  const sections = course.sections?.length
    ? course.sections
    : [{
        sectionId: 'sec-001',
        title: '기본 섹션',
        chapterIds: chapters.map(c => c.chapterId)
      }];

  sections.forEach((sec, si) => {
    const box = document.createElement('section');
    box.className = 'outline-section';

    box.innerHTML = `
      <button class="outline-toggle" type="button">
        <span>섹션${si + 1}. ${sec.title}</span>
        <span class="outline-chevron">▾</span>
      </button>
      <div class="outline-body"></div>
    `;

    box.querySelector('.outline-toggle').onclick = () => {
      box.classList.toggle('collapsed');
    };

    const body = box.querySelector('.outline-body');

    chapters
      .filter(ch => sec.chapterIds.includes(ch.chapterId))
      .forEach(ch => {
        const i = chapters.indexOf(ch);
        const s = state(ch);
        const d = s.duration || 0;
        const r = d ? Math.min(100, s.maxAllowedTime / d * 100) : 0;

        const b = document.createElement('button');
        b.type = 'button';
        b.className = `chapter-button ${i === idx ? 'active' : ''}`;

        b.innerHTML = `
          <strong>${String(i + 1).padStart(2, '0')}. ${ch.title}</strong>
          <div class="chapter-mini-progress">
            <i style="width:${Math.round(r)}%"></i>
          </div>
          <span class="chapter-percent">${Math.round(r)}%</span>
        `;

        b.onclick = () => {
          select(i);
          els.drawer.classList.remove('open');
        };

        body.appendChild(b);
      });

    els.outline.appendChild(box);
  });
}

function select(i) {
  idx = i;
  current = chapters[i];
  identityShown = false;
  lastTickAt = null;

  els.chapterTitle.textContent = current.title;
  els.chapterDesc.textContent = current.description || '';
  els.chapterIndex.textContent = `${idx + 1} / ${chapters.length}`;

  els.video.src = current.src;
  els.video.load();

  els.overlay.classList.add('hidden');
  els.overlay.classList.remove('dismissed');
  els.overlayClose.classList.add('hidden');

  applyPlaybackPolicy();
  renderTime();
  renderOutline();
  showControls();
}

function askMove(i) {
  if (i < 0 || i >= chapters.length || i === idx) return;

  pendingMove = i;
  els.confirmText.textContent = `${i + 1}챕터로 이동하시겠습니까?`;
  els.confirm.classList.remove('hidden');
}

function renderTime() {
  const s = current ? state(current) : {};
  const d = els.video.duration || s.duration || 0;
  const c = els.video.currentTime || 0;
  const r = d ? Math.min(100, c / d * 100) : 0;

  els.time.textContent = `${fmt(c)} / ${fmt(d)} · ${Math.round(r)}%`;
  els.fill.style.width = `${r}%`;

  els.prev.disabled = idx <= 0;
  els.next.disabled = idx >= chapters.length - 1;
}

function renderCourse() {
  let total = 0;
  let done = 0;

  chapters.forEach(ch => {
    const s = state(ch);
    const r = s.duration ? Math.min(100, s.maxAllowedTime / s.duration * 100) : 0;

    total += r;

    if (s.completed) done++;
  });

  const r = Math.round(chapters.length ? total / chapters.length : 0);

  els.cPct.textContent = `${r}%`;
  els.cFill.style.width = `${r}%`;
  els.chProg.textContent = `총 챕터 ${chapters.length}개 중 ${done}개 완료`;
}

function update() {
  const s = state(current);
  const d = els.video.duration || s.duration || 0;

  if (d) s.duration = d;

  const c = els.video.currentTime || 0;

  if (c > s.maxAllowedTime) {
    s.maxAllowedTime = c;
  }

  s.updatedAt = new Date().toISOString();

  if (complete(current)) {
    s.completed = true;

    if (!els.overlay.classList.contains('dismissed')) {
      els.overlay.classList.remove('hidden');
      els.overlayClose.classList.remove('hidden');
    }
  }

  save();
  renderTime();
  renderCourse();
  renderOutline();
}

function openId() {
  wasPlaying = !els.video.paused;
  els.identity.classList.remove('hidden');
  els.video.pause();
}

function closeId() {
  state(current).identityCheckCount++;
  save();

  els.identity.classList.add('hidden');

  if (wasPlaying) {
    setTimeout(() => els.video.play().catch(() => {}), 150);
  }
}

function applyPlaybackPolicy() {
  if (!current) return;

  const p = pol(current);

  if (p.allowPlaybackRate === false) {
    els.rate.value = '1';
    els.rate.disabled = true;
    els.video.playbackRate = 1;
    return;
  }

  els.rate.disabled = false;

  const selected = Number(els.rate.value || 1);
  const min = Number(p.minPlaybackRate || 0.75);
  const max = Number(p.maxPlaybackRate || 2);
  const safe = Math.min(max, Math.max(min, selected));

  els.rate.value = String(safe);
  els.video.playbackRate = safe;
}

function showControls() {
  els.stage.classList.add('controls-visible');

  clearTimeout(controlsTimer);

  if (document.fullscreenElement === els.stage && !els.video.paused) {
    controlsTimer = setTimeout(() => {
      els.stage.classList.remove('controls-visible');
    }, 2800);
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }

  els.stage.requestFullscreen?.();
}

function pulseCenterHint(icon) {
  els.hint.textContent = icon;
  els.hint.classList.add('show');

  setTimeout(() => {
    els.hint.classList.remove('show');
  }, 420);
}

els.video.onloadedmetadata = () => {
  const s = state(current);
  s.duration = els.video.duration;

  if (s.maxAllowedTime) {
    els.video.currentTime = Math.min(s.maxAllowedTime, s.duration);
  }

  save();
  update();
};

els.video.ontimeupdate = () => {
  const s = state(current);
  const p = pol(current);
  const c = els.video.currentTime || 0;
  const now = Date.now();

  if (!els.video.paused) {
    if (lastTickAt) {
      const diff = Math.min(2, Math.max(0, (now - lastTickAt) / 1000));
      s.actualWatchSeconds = (s.actualWatchSeconds || 0) + diff;
    }

    lastTickAt = now;
  } else {
    lastTickAt = null;
  }

  if (
    p.identityCheckCount &&
    !identityShown &&
    s.duration &&
    c > s.duration * .5 &&
    s.identityCheckCount < p.identityCheckCount
  ) {
    identityShown = true;
    openId();
  }

  update();
};

els.video.onended = () => {
  state(current).completed = true;
  save();
  renderCourse();

  if (idx < chapters.length - 1) {
    if (course.playbackPolicy?.autoAdvanceNext) {
      select(idx + 1);
      setTimeout(() => els.video.play().catch(() => {}), 200);
    } else {
      askMove(idx + 1);
    }
  }
};

els.video.onplay = () => {
  els.play.textContent = 'Ⅱ';
  showControls();
};

els.video.onpause = () => {
  els.play.textContent = '▶';
  showControls();
};

els.play.onclick = () => {
  if (els.video.paused) {
    els.video.play();
    pulseCenterHint('▶');
  } else {
    els.video.pause();
    pulseCenterHint('Ⅱ');
  }
};

els.wrap.onclick = e => {
  if (e.target === els.overlayClose) return;

  clearTimeout(clickTimer);

  clickTimer = setTimeout(() => {
    if (els.video.paused) {
      els.video.play();
      pulseCenterHint('▶');
    } else {
      els.video.pause();
      pulseCenterHint('Ⅱ');
    }
  }, 180);
};

els.wrap.ondblclick = () => {
  clearTimeout(clickTimer);
  toggleFullscreen();
};

els.timeline.onclick = e => {
  const rect = els.timeline.getBoundingClientRect();
  const target = (e.clientX - rect.left) / rect.width * (els.video.duration || 0);
  const s = state(current);
  const p = pol(current);

  if (p.preventForwardSeeking && target > s.maxAllowedTime + 1.5 && !s.completed) {
    showControls();
    return;
  }

  els.video.currentTime = target;
  showControls();
};

els.rate.onchange = () => {
  if (!current) return;

  const p = pol(current);

  if (p.allowPlaybackRate === false) {
    els.rate.value = '1';
    els.video.playbackRate = 1;
    return;
  }

  const selected = Number(els.rate.value);
  const min = Number(p.minPlaybackRate || 0.75);
  const max = Number(p.maxPlaybackRate || 2);
  const safe = Math.min(max, Math.max(min, selected));

  els.rate.value = String(safe);
  els.video.playbackRate = safe;
  showControls();
};

els.volume.oninput = () => {
  const v = Number(els.volume.value);

  els.video.volume = v;
  els.video.muted = v === 0;

  showControls();
};

els.cc.onclick = () => {
  els.cc.classList.toggle('cc-on');
  showControls();
};

els.full.onclick = toggleFullscreen;

els.rotate.onclick = async () => {
  try {
    if (!document.fullscreenElement) {
      await els.stage.requestFullscreen();
    }

    const type = screen.orientation?.type || '';

    if (type.includes('landscape')) {
      await screen.orientation.lock('portrait');
    } else {
      await screen.orientation.lock('landscape');
    }
  } catch (e) {
    console.log('orientation lock unavailable', e);
  }
};

els.help.onclick = () => {
  els.helpOverlay.classList.remove('hidden');
};

els.helpClose.onclick = () => {
  els.helpOverlay.classList.add('hidden');
};

els.overlayClose.onclick = e => {
  e.stopPropagation();
  els.overlay.classList.add('hidden', 'dismissed');
  els.overlayClose.classList.add('hidden');
};

els.toggle.onclick = () => {
  const open = els.detail.classList.toggle('hidden') === false;
  els.toggle.textContent = open ? '접기 ∧' : '자세히 >';
};

els.submit.onclick = () => {
  if (els.input.value.trim().toUpperCase() !== els.code.textContent) {
    els.idMsg.textContent = '입력한 문구가 일치하지 않습니다.';
    return;
  }

  closeId();
};

els.drawerBtn.onclick = () => {
  els.drawer.classList.add('open');
};

els.drawerClose.onclick = () => {
  els.drawer.classList.remove('open');
};

els.prev.onclick = () => {
  askMove(idx - 1);
};

els.next.onclick = () => {
  askMove(idx + 1);
};

els.confirmCancel.onclick = () => {
  els.confirm.classList.add('hidden');
};

els.confirmOk.onclick = () => {
  els.confirm.classList.add('hidden');

  if (pendingMove !== null) {
    select(pendingMove);
  }

  pendingMove = null;
};

document.addEventListener('fullscreenchange', () => {
  const fs = document.fullscreenElement === els.stage;

  showControls();

  els.full.textContent = fs ? '⤢' : '⛶';
  els.full.setAttribute('aria-label', fs ? '전체화면 종료' : '전체화면');

  els.rotate.classList.toggle('fullscreen-mobile', fs && isMobile());
  els.rotate.classList.toggle('hidden', !(fs && isMobile()));
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && current && pol(current).pauseWhenHidden) {
    els.video.pause();
  }
});

els.stage.addEventListener('mousemove', showControls);
els.stage.addEventListener('touchstart', showControls, { passive: true });

document.addEventListener('keydown', e => {
  if (!current) return;

  if (e.code === 'Space') {
    e.preventDefault();

    if (els.video.paused) {
      els.video.play();
    } else {
      els.video.pause();
    }

   
