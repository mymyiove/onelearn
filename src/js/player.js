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
  toggleText: $('courseDetailToggleText'),
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
  allowed: $('timelineAllowed'),
  fill: $('timelineFill'),

  play: $('playBtn'),
  rate: $('rateSelect'),
  volume: $('volumeInput'),
  mute: $('muteBtn'),
  cc: $('ccBtn'),
  full: $('fullscreenBtn'),
  rotate: $('rotateBtn'),

  usage: $('usageBtn'),
  usageOverlay: $('usageOverlay'),
  usageClose: $('usageCloseBtn'),

  help: $('helpBtn'),
  helpOverlay: $('helpOverlay'),
  helpClose: $('helpCloseBtn'),

  tooltip: $('onelearnTooltip'),

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
let tooltipTimer = null;
let previousVolume = 1;

function finishLoading() {
  if (!els.loader) return;

  setTimeout(() => {
    els.loader.classList.add('done');
  }, 450);
}

function key() {
  return `progress:${session.userId}:${courseId}`;
}

function logKey() {
  return `learning-log:${session.userId}:${courseId}`;
}

function save() {
  OneLearnStorage.write(key(), progress);
}

function logEvent(type, payload = {}) {
  const logs = OneLearnStorage.read(logKey(), []);

  logs.push({
    type,
    userId: session.userId,
    courseId,
    chapterId: current?.chapterId || null,
    currentTime: els.video?.currentTime || 0,
    timestamp: new Date().toISOString(),
    ...payload
  });

  OneLearnStorage.write(logKey(), logs.slice(-500));
}

function fmt(seconds) {
  const s = Number(seconds || 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function fmtDate(dateString) {
  if (!dateString) return '마감 없음';

  const date = new Date(`${dateString}T00:00:00`);
  return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function remainText(dateString) {
  if (!dateString) return '마감 없음';

  const diff = Math.ceil((new Date(`${dateString}T23:59:59`) - Date.now()) / 86400000);

  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return '오늘 마감';
  return `D+${Math.abs(diff)}`;
}

function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function pol(chapter) {
  return {
    ...(course?.completionPolicy || {}),
    ...(chapter?.completionPolicy || {})
  };
}

function state(chapter) {
  if (!progress[chapter.chapterId]) {
    progress[chapter.chapterId] = {
      duration: 0,
      maxAllowedTime: 0,
      actualWatchSeconds: 0,
      identityCheckCount: 0,
      completed: false,
      updatedAt: null
    };
  }

  return progress[chapter.chapterId];
}

function complete(chapter) {
  const s = state(chapter);
  const p = pol(chapter);
  const duration = s.duration || els.video.duration || 0;

  if (!duration) return false;

  const positionPercent = (s.maxAllowedTime / duration) * 100;
  const actualWatchPercent = (s.actualWatchSeconds / duration) * 100;

  return (
    positionPercent >= Number(p.requiredProgressPercent || p.requiredCourseProgressPercent || 95) &&
    actualWatchPercent >= Number(p.requiredActualWatchPercent || 0) &&
    Number(s.identityCheckCount || 0) >= Number(p.identityCheckCount || 0)
  );
}

async function init() {
  try {
    try {
      tenant = await OneLearnStorage.fetchJson(`./data/tenants/${tenantId}/tenant.json`);
    } catch {
      tenant = {
        tenantName: '웅진씽크빅',
        displayName: 'OneLearn',
        brand: {
          primaryColor: '#F47721'
        }
      };
    }

    document.documentElement.style.setProperty('--brand', tenant.brand?.primaryColor || '#F47721');

    try {
      const learnerData = await OneLearnStorage.fetchJson(`./data/tenants/${tenantId}/learners.json`);
      learner = (learnerData.learners || []).find(x => x.userId === session.userId) || {
        name: session.name || '학습자'
      };
    } catch {
      learner = {
        name: session.name || '학습자'
      };
    }

    if (els.welcome) {
      els.welcome.textContent = `${tenant.tenantName || tenant.displayName || 'OneLearn'} · ${learner.name} 님`;
    }

    if (els.dash) {
      els.dash.href = `./dashboard.html?tenant=${tenantId}`;
    }

    const courseList = await OneLearnStorage.fetchJson(`./data/tenants/${tenantId}/courses.json`);
    const meta = (courseList.courses || []).find(x => x.courseId === courseId);

    if (!meta) {
      alert('과정을 찾을 수 없습니다.');
      location.href = `./dashboard.html?tenant=${tenantId}`;
      return;
    }

    const detail = await OneLearnStorage.fetchJson(meta.courseFile);

    course = {
      ...meta,
      ...detail
    };

    chapters = course.chapters || [];

    if (!chapters.length) {
      alert('등록된 챕터가 없습니다.');
      location.href = `./dashboard.html?tenant=${tenantId}`;
      return;
    }

    progress = OneLearnStorage.read(key(), {});

    renderBase();
    select(0);
    updateSoundIcon();
    setupTooltips();
    logEvent('player_open');
  } catch (error) {
    console.error('[OneLearn Player] init failed:', error);
    alert('과정 정보를 불러오지 못했습니다.');
    location.href = `./dashboard.html?tenant=${tenantId}`;
  } finally {
    finishLoading();
  }
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
    .map(chip => `<span class="course-policy-chip ${chip.cls || ''}">${chip.label}</span>`)
    .join('');
}

function renderOutline() {
  els.outline.innerHTML = '';

  const sections = course.sections?.length
    ? course.sections
    : [
        {
          sectionId: 'sec-001',
          title: '기본 섹션',
          chapterIds: chapters.map(chapter => chapter.chapterId)
        }
      ];

  sections.forEach((section, sectionIndex) => {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'outline-section';

    sectionEl.innerHTML = `
      <button class="outline-toggle" type="button" data-tip="섹션을 접거나 펼칩니다.">
        <span>섹션${sectionIndex + 1}. ${section.title}</span>
        <span class="outline-chevron">▾</span>
      </button>
      <div class="outline-body"></div>
    `;

    sectionEl.querySelector('.outline-toggle').onclick = () => {
      sectionEl.classList.toggle('collapsed');
      setupTooltips();
    };

    const body = sectionEl.querySelector('.outline-body');

    chapters
      .filter(chapter => section.chapterIds.includes(chapter.chapterId))
      .forEach(chapter => {
        const chapterIndex = chapters.indexOf(chapter);
        const chapterState = state(chapter);
        const duration = chapterState.duration || 0;
        const ratio = duration ? Math.min(100, (chapterState.maxAllowedTime / duration) * 100) : 0;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = `chapter-button ${chapterIndex === idx ? 'active' : ''}`;
        button.dataset.tip = '챕터를 선택해 학습을 시작하거나 이어봅니다.';

        button.innerHTML = `
          <strong>${String(chapterIndex + 1).padStart(2, '0')}. ${chapter.title}</strong>
          <div class="chapter-mini-progress">
            <i style="width:${Math.round(ratio)}%"></i>
          </div>
          <span class="chapter-percent">${Math.round(ratio)}%</span>
        `;

        button.onclick = () => {
          select(chapterIndex);
          els.drawer.classList.remove('open');
        };

        body.appendChild(button);
      });

    els.outline.appendChild(sectionEl);
  });

  setupTooltips();
}

function select(nextIndex) {
  idx = nextIndex;
  current = chapters[idx];
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
  logEvent('chapter_changed', { chapterIndex: idx + 1 });
}

function askMove(nextIndex) {
  if (nextIndex < 0 || nextIndex >= chapters.length || nextIndex === idx) return;

  pendingMove = nextIndex;
  els.confirmText.textContent = `${nextIndex + 1}챕터로 이동하시겠습니까?`;
  els.confirm.classList.remove('hidden');
}

function renderTime() {
  const chapterState = current ? state(current) : {};
  const duration = els.video.duration || chapterState.duration || 0;
  const currentTime = els.video.currentTime || 0;
  const ratio = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  const allowedRatio = duration ? Math.min(100, (chapterState.maxAllowedTime / duration) * 100) : 0;

  els.time.textContent = `${fmt(currentTime)} / ${fmt(duration)} · ${Math.round(ratio)}%`;
  els.fill.style.width = `${ratio}%`;

  if (els.allowed) {
    els.allowed.style.width = `${allowedRatio}%`;
  }

  els.prev.disabled = idx <= 0;
  els.next.disabled = idx >= chapters.length - 1;
}

function renderCourse() {
  let total = 0;
  let done = 0;

  chapters.forEach(chapter => {
    const chapterState = state(chapter);
    const ratio = chapterState.duration
      ? Math.min(100, (chapterState.maxAllowedTime / chapterState.duration) * 100)
      : 0;

    total += ratio;

    if (chapterState.completed) {
      done++;
    }
  });

  const courseRatio = Math.round(chapters.length ? total / chapters.length : 0);

  els.cPct.textContent = `${courseRatio}%`;
  els.cFill.style.width = `${courseRatio}%`;
  els.chProg.textContent = `총 챕터 ${chapters.length}개 중 ${done}개 완료`;
}

function update() {
  if (!current) return;

  const chapterState = state(current);
  const duration = els.video.duration || chapterState.duration || 0;

  if (duration) {
    chapterState.duration = duration;
  }

  const currentTime = els.video.currentTime || 0;

  if (currentTime > chapterState.maxAllowedTime) {
    chapterState.maxAllowedTime = currentTime;
  }

  chapterState.updatedAt = new Date().toISOString();

  if (complete(current)) {
    chapterState.completed = true;

    if (!els.overlay.classList.contains('dismissed')) {
      els.overlay.classList.remove('hidden');
      els.overlayClose.classList.remove('hidden');
    }

    logEvent('chapter_completed');
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
  logEvent('identity_check_open');
}

function closeId() {
  state(current).identityCheckCount++;
  save();

  els.identity.classList.add('hidden');

  logEvent('identity_check_pass');

  if (wasPlaying) {
    setTimeout(() => {
      els.video.play().catch(() => {});
    }, 150);
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
  const safeRate = Math.min(max, Math.max(min, selected));

  els.rate.value = String(safeRate);
  els.video.playbackRate = safeRate;
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

  if (els.stage.requestFullscreen) {
    els.stage.requestFullscreen();
  }
}

function pulseCenterHint(icon) {
  els.hint.textContent = icon;
  els.hint.classList.add('show');

  setTimeout(() => {
    els.hint.classList.remove('show');
  }, 420);
}

function updateSoundIcon() {
  const value = Number(els.volume.value || 0);

  if (els.video.muted || value === 0) {
    els.mute.textContent = '🔇';
    els.mute.setAttribute('aria-label', '음소거 해제');
  } else if (value < 0.5) {
    els.mute.textContent = '🔉';
    els.mute.setAttribute('aria-label', '음소거');
  } else {
    els.mute.textContent = '🔊';
    els.mute.setAttribute('aria-label', '음소거');
  }
}

function toggleMute() {
  if (els.video.muted || Number(els.volume.value) === 0) {
    els.video.muted = false;
    els.volume.value = previousVolume || 1;
  } else {
    previousVolume = Number(els.volume.value) || 1;
    els.video.muted = true;
    els.volume.value = 0;
  }

  updateSoundIcon();
  showControls();
  logEvent('mute_toggled', { muted: els.video.muted });
}

function seekBy(seconds) {
  if (!current) return;

  const target = Math.max(0, Math.min((els.video.duration || 0), (els.video.currentTime || 0) + seconds));
  const chapterState = state(current);
  const p = pol(current);

  if (p.preventForwardSeeking && target > chapterState.maxAllowedTime + 1.5 && !chapterState.completed) {
    showControls();
    logEvent('seek_blocked', { target });
    return;
  }

  els.video.currentTime = target;
  showControls();
  logEvent('seek_attempt', { target });
}

function setupTooltips() {
  if (!els.tooltip || isTouchDevice()) return;

  document.querySelectorAll('[data-tip]').forEach(node => {
    if (node.dataset.tooltipReady === 'true') return;

    node.dataset.tooltipReady = 'true';

    node.addEventListener('mouseenter', () => {
      clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(() => showTooltip(node), 900);
    });

    node.addEventListener('mouseleave', hideTooltip);
    node.addEventListener('focus', () => showTooltip(node));
    node.addEventListener('blur', hideTooltip);
  });
}

function showTooltip(node) {
  if (!els.tooltip || !node.dataset.tip) return;

  const rect = node.getBoundingClientRect();

  els.tooltip.textContent = node.dataset.tip;
  els.tooltip.classList.remove('hidden');

  const tooltipRect = els.tooltip.getBoundingClientRect();
  const left = Math.min(
    window.innerWidth - tooltipRect.width - 12,
    Math.max(12, rect.left + rect.width / 2 - tooltipRect.width / 2)
  );
  const top = Math.max(12, rect.top - tooltipRect.height - 10);

  els.tooltip.style.left = `${left}px`;
  els.tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  clearTimeout(tooltipTimer);

  if (els.tooltip) {
    els.tooltip.classList.add('hidden');
  }
}

els.video.onloadedmetadata = () => {
  const chapterState = state(current);
  chapterState.duration = els.video.duration;

  if (chapterState.maxAllowedTime) {
    els.video.currentTime = Math.min(chapterState.maxAllowedTime, chapterState.duration);
  }

  save();
  update();
};

els.video.ontimeupdate = () => {
  const chapterState = state(current);
  const p = pol(current);
  const currentTime = els.video.currentTime || 0;
  const now = Date.now();

  if (!els.video.paused) {
    if (lastTickAt) {
      const diff = Math.min(2, Math.max(0, (now - lastTickAt) / 1000));
      chapterState.actualWatchSeconds = (chapterState.actualWatchSeconds || 0) + diff;
    }

    lastTickAt = now;
  } else {
    lastTickAt = null;
  }

  if (
    p.identityCheckCount &&
    !identityShown &&
    chapterState.duration &&
    currentTime > chapterState.duration * 0.5 &&
    chapterState.identityCheckCount < p.identityCheckCount
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
  logEvent('chapter_completed');

  if (idx < chapters.length - 1) {
    if (course.playbackPolicy?.autoAdvanceNext) {
      select(idx + 1);
      setTimeout(() => {
        els.video.play().catch(() => {});
      }, 200);
    } else {
      askMove(idx + 1);
    }
  }
};

els.video.onplay = () => {
  els.play.textContent = 'Ⅱ';
  showControls();
  logEvent('video_play');
};

els.video.onpause = () => {
  els.play.textContent = '▶';
  showControls();
  logEvent('video_pause');
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

els.wrap.onclick = event => {
  if (event.target === els.overlayClose) return;

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

els.timeline.onclick = event => {
  const rect = els.timeline.getBoundingClientRect();
  const target = ((event.clientX - rect.left) / rect.width) * (els.video.duration || 0);
  const chapterState = state(current);
  const p = pol(current);

  if (p.preventForwardSeeking && target > chapterState.maxAllowedTime + 1.5 && !chapterState.completed) {
    showControls();
    logEvent('seek_blocked', { target });
    return;
  }

  els.video.currentTime = target;
  showControls();
  logEvent('seek_attempt', { target });
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
  const safeRate = Math.min(max, Math.max(min, selected));

  els.rate.value = String(safeRate);
  els.video.playbackRate = safeRate;

  showControls();
  logEvent('rate_changed', { rate: safeRate });
};

els.volume.oninput = () => {
  const value = Number(els.volume.value);

  els.video.volume = value;
  els.video.muted = value === 0;

  if (value > 0) {
    previousVolume = value;
  }

  updateSoundIcon();
  showControls();
  logEvent('volume_changed', { volume: value });
};

els.mute.onclick = () => {
  toggleMute();
};

els.cc.onclick = () => {
  els.cc.classList.toggle('cc-on');
  showControls();
  logEvent('caption_toggled', { on: els.cc.classList.contains('cc-on') });
};

els.full.onclick = () => {
  toggleFullscreen();
};

els.rotate.onclick = async () => {
  try {
    if (!document.fullscreenElement && els.stage.requestFullscreen) {
      await els.stage.requestFullscreen();
    }

    const type = screen.orientation?.type || '';

    if (type.includes('landscape')) {
      await screen.orientation.lock('portrait');
      logEvent('orientation_lock', { orientation: 'portrait' });
    } else {
      await screen.orientation.lock('landscape');
      logEvent('orientation_lock', { orientation: 'landscape' });
    }
  } catch (error) {
    console.log('orientation lock unavailable', error);
    logEvent('orientation_lock_failed');
  }
};

els.usage.onclick = () => {
  document.body.classList.add('usage-on');
  els.usageOverlay.classList.remove('hidden');
};

els.usageClose.onclick = () => {
  document.body.classList.remove('usage-on');
  els.usageOverlay.classList.add('hidden');
};

els.help.onclick = () => {
  els.helpOverlay.classList.remove('hidden');
};

els.helpClose.onclick = () => {
  els.helpOverlay.classList.add('hidden');
};

els.overlayClose.onclick = event => {
  event.stopPropagation();
  els.overlay.classList.add('hidden', 'dismissed');
  els.overlayClose.classList.add('hidden');
};

els.toggle.onclick = () => {
  const open = els.detail.classList.toggle('hidden') === false;

  els.toggle.classList.toggle('open', open);
  els.toggleText.textContent = open ? '접기' : '자세히';
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
  const isFullscreen = document.fullscreenElement === els.stage;

  showControls();

  els.full.textContent = isFullscreen ? '⤢' : '⛶';
  els.full.setAttribute('aria-label', isFullscreen ? '전체화면 종료' : '전체화면');

  els.rotate.classList.toggle('fullscreen-mobile', isFullscreen && isTouchDevice());
  els.rotate.classList.toggle('hidden', !(isFullscreen && isTouchDevice()));

  logEvent(isFullscreen ? 'fullscreen_enter' : 'fullscreen_exit');
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && current && pol(current).pauseWhenHidden) {
    els.video.pause();
    logEvent('tab_hidden_pause');
  }
});

els.stage.addEventListener('mousemove', showControls);
els.stage.addEventListener('touchstart', showControls, { passive: true });

document.addEventListener('keydown', event => {
  if (!current) return;

  const tagName = document.activeElement?.tagName?.toLowerCase();
  const isTyping = tagName === 'input' || tagName === 'textarea' || tagName === 'select';

  if (isTyping && event.code !== 'Escape') return;

  if (event.code === 'Space') {
    event.preventDefault();

    if (els.video.paused) {
      els.video.play();
    } else {
      els.video.pause();
    }

    showControls();
  }

  if (event.key.toLowerCase() === 'f') {
    toggleFullscreen();
  }

  if (event.key.toLowerCase() === 'c') {
    els.cc.click();
  }

  if (event.key.toLowerCase() === 'm') {
    toggleMute();
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    seekBy(5);
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    seekBy(-5);
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    const nextVolume = Math.min(1, Number(els.volume.value) + 0.05);
    els.volume.value = String(nextVolume);
    els.volume.dispatchEvent(new Event('input'));
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const nextVolume = Math.max(0, Number(els.volume.value) - 0.05);
    els.volume.value = String(nextVolume);
    els.volume.dispatchEvent(new Event('input'));
  }

  if (event.code === 'Escape') {
    document.body.classList.remove('usage-on');
    els.usageOverlay.classList.add('hidden');
    els.helpOverlay.classList.add('hidden');
    els.confirm.classList.add('hidden');
  }
});

init().catch(error => {
  console.error('[OneLearn Player] init failed:', error);
  finishLoading();
});
