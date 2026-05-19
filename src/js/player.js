const tenantId = OneLearnStorage.getTenantId();
const courseId = new URLSearchParams(location.search).get('course');
const session = OneLearnStorage.read('session', null);

if (!session) {
  location.href = `./login.html?tenant=${tenantId}`;
}

const $ = id => document.getElementById(id);

const els = {
  loader: $('playerLoader'),

  title: $('courseTitle'),
  desc: $('courseDesc'),
  chips: $('coursePolicyChips'),

  thumb: $('courseThumbnailBox'),
  inst: $('instructorText'),
  due: $('dueDateText'),
  cat: $('categoryText'),
  completion: $('detailCompletionText'),

  outline: $('courseOutline'),

  progress: $('courseProgressText'),
  track: $('courseTrackFill'),
  chapterProg: $('chapterProgressText'),

  video: $('video'),
  play: $('playBtn'),
  rate: $('rateSelect'),
  volume: $('volumeInput'),
  full: $('fullscreenBtn'),
  rotate: $('rotateBtn'),

  time: $('timeText'),
  bar: $('timelineFill'),
  timeline: $('timeline'),

  prev: $('prevChapterControl'),
  next: $('nextChapterControl'),
  index: $('chapterIndexText'),

  titleCh: $('chapterTitle'),
  descCh: $('chapterDesc'),

  stage: $('playerStage')
};

let course, chapters, idx = 0, current;
let progress = {};

/* -----------------------------
   INIT
----------------------------- */

async function init() {
  const cList = await OneLearnStorage.fetchJson(`./data/tenants/${tenantId}/courses.json`);
  const meta = cList.courses.find(c => c.courseId === courseId);

  const detail = await OneLearnStorage.fetchJson(meta.courseFile);
  course = { ...meta, ...detail };

  chapters = course.chapters || [];

  progress = OneLearnStorage.read(`progress:${session.userId}:${courseId}`, {});

  renderCourse();
  renderChapters();

  select(0);

  setTimeout(() => els.loader.classList.add('done'), 300);
}

/* -----------------------------
   COURSE
----------------------------- */

function renderCourse() {
  els.title.textContent = course.title;
  els.desc.textContent = course.description || '';

  els.inst.textContent = course.instructor?.name || '-';
  els.cat.textContent = course.category || '-';
  els.due.textContent = formatDate(course.dueDate);

  const p = course.completionPolicy || {};
  els.completion.textContent = `${p.requiredCourseProgressPercent || 95}% 이상`;

  renderChips();
}

/* ✅ 마감일 우선 배지 */
function renderChips() {
  const p = course.completionPolicy || [];
  let chips = [];

  if (course.dueDate) {
    chips.push({
      label: `⏰ ${formatDate(course.dueDate)}`,
      class: 'deadline'
    });
  }

  if (p.preventForwardSeeking) chips.push({ label: '🔒 앞으로 이동 제한' });
  if (p.identityCheckCount) chips.push({ label: `🧑‍💻 본인확인 ${p.identityCheckCount}회` });
  if (p.requiredActualWatchPercent) chips.push({ label: `⏱ 실제 시청 ${p.requiredActualWatchPercent}%` });
  if (p.maxPlaybackRate) chips.push({ label: `⚡ 최대 ${p.maxPlaybackRate}x` });

  const isMobile = window.innerWidth < 760;

  if (isMobile) {
    // ✅ 모바일: 마감일만 기본 표시
    chips = chips.slice(0, 1);
  }

  els.chips.innerHTML = chips.map(c =>
    `<span class="course-policy-chip ${c.class || ''}">${c.label}</span>`
  ).join('');
}

/* -----------------------------
   CHAPTER
----------------------------- */

function renderChapters() {
  els.outline.innerHTML = '';

  chapters.forEach((ch, i) => {
    const btn = document.createElement('button');
    btn.className = 'chapter-button';
    btn.textContent = `${i + 1}. ${ch.title}`;

    btn.onclick = () => select(i);

    els.outline.appendChild(btn);
  });
}

function select(i) {
  idx = i;
  current = chapters[i];

  els.video.src = current.src;
  els.video.load();

  els.titleCh.textContent = current.title;
  els.descCh.textContent = current.description || '';

  els.index.textContent = `${idx + 1} / ${chapters.length}`;

  updateProgressUI();
}

/* -----------------------------
   VIDEO
----------------------------- */

els.play.onclick = () => {
  if (els.video.paused) els.video.play();
  else els.video.pause();
};

els.video.onplay = () => {
  els.play.textContent = 'Ⅱ';
};

els.video.onpause = () => {
  els.play.textContent = '▶';
};

/* 타임라인 */

els.video.ontimeupdate = () => {
  const c = els.video.currentTime;
  const d = els.video.duration || 0;

  const pct = d ? (c / d) * 100 : 0;

  els.bar.style.width = pct + '%';
  els.time.textContent = `${fmt(c)} / ${fmt(d)} · ${Math.round(pct)}%`;
};

els.timeline.onclick = e => {
  const rect = els.timeline.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;

  els.video.currentTime = ratio * els.video.duration;
};

/* -----------------------------
   CONTROLS
----------------------------- */

els.rate.onchange = () => {
  els.video.playbackRate = Number(els.rate.value);
};

els.volume.oninput = () => {
  els.video.volume = Number(els.volume.value);
};

/* 챕터 이동 */

els.prev.onclick = () => {
  if (idx > 0) select(idx - 1);
};

els.next.onclick = () => {
  if (idx < chapters.length - 1) select(idx + 1);
};

/* -----------------------------
   FULLSCREEN
----------------------------- */

els.full.onclick = () => {
  if (!document.fullscreenElement) {
    els.stage.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};

document.addEventListener('fullscreenchange', () => {
  const fs = document.fullscreenElement === els.stage;

  els.full.textContent = fs ? '⤡' : '⛶';

  // ✅ rotate 버튼 표시
  if (fs) {
    els.rotate.classList.remove('hidden');
  } else {
    els.rotate.classList.add('hidden');
  }
});

/* ✅ ROTATION (핵심) */

els.rotate.onclick = async () => {
  try {
    if (!document.fullscreenElement) {
      await els.stage.requestFullscreen();
    }

    const type = screen.orientation.type;

    if (type.includes('landscape')) {
      await screen.orientation.lock('portrait');
    } else {
      await screen.orientation.lock('landscape');
    }

  } catch (e) {
    console.log('회전 지원 안됨', e);
  }
};

/* -----------------------------
   PROGRESS
----------------------------- */

function updateProgressUI() {
  let total = 0;

  chapters.forEach(ch => {
    const s = progress[ch.chapterId] || {};
    const ratio = s.duration ? (s.maxAllowedTime / s.duration) : 0;
    total += ratio;
  });

  const pct = chapters.length ? (total / chapters.length) * 100 : 0;

  els.progress.textContent = Math.round(pct) + '%';
  els.track.style.width = pct + '%';
  els.chapterProg.textContent = `${idx + 1} / ${chapters.length}`;
}

/* -----------------------------
   UTIL
----------------------------- */

function fmt(s) {
  s = Math.floor(s || 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function formatDate(d) {
  if (!d) return '-';

  const x = new Date(d);
  return `${x.getFullYear().toString().slice(2)}.${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`;
}

init();
