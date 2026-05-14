const params = new URLSearchParams(window.location.search);
const TENANT_ID = params.get("tenant") || "woongjin";
const COURSE_ID = params.get("course") || "legal-001";
const COURSE_URL = `./data/tenants/${TENANT_ID}/courses/${COURSE_ID}.json`;
const STORAGE_PREFIX = "onelearn-mvp-02";

const els = {
  courseTitle: document.getElementById("courseTitle"),
  courseHeadline: document.getElementById("courseHeadline"),
  courseSubtitle: document.getElementById("courseSubtitle"),
  courseStatusBadge: document.getElementById("courseStatusBadge"),
  courseProgressNumber: document.getElementById("courseProgressNumber"),
  courseProgressText: document.getElementById("courseProgressText"),
  courseCompleteText: document.getElementById("courseCompleteText"),
  courseRing: document.getElementById("courseRing"),
  chapterCountBadge: document.getElementById("chapterCountBadge"),
  chapterList: document.getElementById("chapterList"),
  policyList: document.getElementById("policyList"),
  chapterTitle: document.getElementById("chapterTitle"),
  chapterDescription: document.getElementById("chapterDescription"),
  chapterStatusBadge: document.getElementById("chapterStatusBadge"),
  video: document.getElementById("trainingVideo"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  identityOverlay: document.getElementById("identityOverlay"),
  completionOverlay: document.getElementById("completionOverlay"),
  completionMessage: document.getElementById("completionMessage"),
  nextChapterBtn: document.getElementById("nextChapterBtn"),
  timeText: document.getElementById("timeText"),
  progressText: document.getElementById("progressText"),
  progressBar: document.getElementById("progressBar"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  backBtn: document.getElementById("backBtn"),
  speedSelect: document.getElementById("speedSelect"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  simulateSeekBtn: document.getElementById("simulateSeekBtn"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  actualWatchText: document.getElementById("actualWatchText"),
  maxPositionText: document.getElementById("maxPositionText"),
  blockedSeekText: document.getElementById("blockedSeekText"),
  identityText: document.getElementById("identityText"),
  logOutput: document.getElementById("logOutput"),
  eventCountBadge: document.getElementById("eventCountBadge"),
  userModal: document.getElementById("userModal"),
  userForm: document.getElementById("userForm"),
  userNameInput: document.getElementById("userNameInput"),
  userEmailInput: document.getElementById("userEmailInput"),
  userDeptInput: document.getElementById("userDeptInput"),
  userNoInput: document.getElementById("userNoInput"),
  resetUserBtn: document.getElementById("resetUserBtn"),
  confirmIdentityBtn: document.getElementById("confirmIdentityBtn")
};

let course = null;
let user = null;
let currentChapterIndex = 0;
let currentChapter = null;
let currentPolicy = null;

let logs = [];
let progress = {};

let maxAllowedTime = 0;
let lastValidTime = 0;
let actualWatchSeconds = 0;
let blockedSeekCount = 0;
let identityPassedCount = 0;
let identityCheckTargets = [];
let identityCheckShownTargets = new Set();
let lastTickAt = null;
let heartbeatTimer = null;
let isRestoringSeek = false;

function storageKey(name) {
  const courseId = course?.courseId || "unknown-course";
  const userId = user?.id || "anonymous";
  return `${STORAGE_PREFIX}:${name}:${courseId}:${userId}`;
}

function userStorageKey() {
  return `${STORAGE_PREFIX}:user`;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";

  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function percent(value) {
  return `${Math.round(value)}%`;
}

function mergePolicy(coursePolicy, chapterPolicy) {
  return {
    ...coursePolicy,
    ...chapterPolicy
  };
}

function loadUser() {
  try {
    const raw = localStorage.getItem(userStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUser(nextUser) {
  localStorage.setItem(userStorageKey(), JSON.stringify(nextUser));
}

function showUserModal() {
  els.userModal.classList.remove("hidden");
}

function hideUserModal() {
  els.userModal.classList.add("hidden");
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(storageKey("progress"));
    progress = raw ? JSON.parse(raw) : {};
  } catch {
    progress = {};
  }
}

function saveProgress() {
  localStorage.setItem(storageKey("progress"), JSON.stringify(progress));
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(storageKey("logs"));
    logs = raw ? JSON.parse(raw) : [];
  } catch {
    logs = [];
  }
}

function saveLogs() {
  localStorage.setItem(storageKey("logs"), JSON.stringify(logs.slice(0, 160)));
}

function getChapterProgress(chapterId) {
  if (!progress[chapterId]) {
    progress[chapterId] = {
      chapterId,
      duration: 0,
      maxAllowedTime: 0,
      actualWatchSeconds: 0,
      blockedSeekCount: 0,
      identityPassedCount: 0,
      completed: false,
      completedAt: null,
      lastPosition: 0,
      updatedAt: new Date().toISOString()
    };
  }

  return progress[chapterId];
}

function addLog(type, payload = {}) {
  const log = {
    id: createId("evt"),
    type,
    userId: user?.id || null,
    userName: user?.name || null,
    userEmail: user?.email || null,
    courseId: course?.courseId || null,
    chapterId: currentChapter?.chapterId || null,
    chapterTitle: currentChapter?.title || null,
    position: Number(els.video.currentTime || 0).toFixed(2),
    maxAllowedTime: Number(maxAllowedTime || 0).toFixed(2),
    actualWatchSeconds: Math.floor(actualWatchSeconds),
    playbackRate: els.video.playbackRate || 1,
    createdAt: new Date().toISOString(),
    payload
  };

  logs.unshift(log);
  logs = logs.slice(0, 160);
  saveLogs();
  renderLogs();
}

function renderLogs() {
  els.eventCountBadge.textContent = String(logs.length);

  if (!logs.length) {
    els.logOutput.textContent = "로그 대기 중...";
    return;
  }

  els.logOutput.textContent = JSON.stringify(logs.slice(0, 40), null, 2);
}

async function init() {
  user = loadUser();

  try {
    const response = await fetch(COURSE_URL, { cache: "no-store" });
    course = await response.json();

    if (!course || !Array.isArray(course.chapters) || !course.chapters.length) {
      throw new Error("course.json에 챕터 데이터가 없습니다.");
    }

    if (!user) {
      showUserModal();
    } else {
      hideUserModal();
    }

    loadProgress();
    loadLogs();

    renderCourse();
    loadChapter(0);
    renderLogs();

    addLog("course_loaded", {
      chapterCount: course.chapters.length,
      courseTitle: course.title
    });
  } catch (error) {
    els.courseTitle.textContent = "강의 로드 실패";
    els.chapterTitle.textContent = "강의 데이터를 불러오지 못했습니다.";
    els.courseStatusBadge.textContent = "ERROR";
    console.error(error);
  }
}

function renderCourse() {
  els.courseTitle.textContent = course.title || "OneLearn Course";
  els.courseHeadline.textContent = course.brand?.tagline || "틀어놓는 교육이 아니라, 증명되는 학습으로.";
  els.courseSubtitle.textContent = course.subtitle || "";
  els.chapterCountBadge.textContent = `${course.chapters.length}개`;

  renderChapterList();
  updateCourseProgress();
}

function renderChapterList() {
  els.chapterList.innerHTML = "";

  course.chapters.forEach((chapter, index) => {
    const state = getChapterProgress(chapter.chapterId);
    const duration = state.duration || 0;
    const ratio = duration > 0 ? clamp((state.maxAllowedTime / duration) * 100, 0, 100) : 0;

    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "ol-chapter-item",
      index === currentChapterIndex ? "active" : "",
      state.completed ? "complete" : ""
    ].join(" ").trim();

    button.innerHTML = `
      <span class="ol-chapter-number">CHAPTER ${String(index + 1).padStart(2, "0")}</span>
      <span class="ol-chapter-name">${chapter.title}</span>
      <div class="ol-chapter-progress"><span style="width:${ratio}%"></span></div>
    `;

    button.addEventListener("click", () => {
      loadChapter(index);
    });

    els.chapterList.appendChild(button);
  });
}

function loadChapter(index) {
  currentChapterIndex = index;
  currentChapter = course.chapters[index];
  currentPolicy = mergePolicy(course.completionPolicy || {}, currentChapter.completionPolicy || {});

  const state = getChapterProgress(currentChapter.chapterId);

  maxAllowedTime = state.maxAllowedTime || 0;
  lastValidTime = state.lastPosition || 0;
  actualWatchSeconds = state.actualWatchSeconds || 0;
  blockedSeekCount = state.blockedSeekCount || 0;
  identityPassedCount = state.identityPassedCount || 0;
  identityCheckShownTargets = new Set();

  els.chapterTitle.textContent = currentChapter.title;
  els.chapterDescription.textContent = currentChapter.description || "";
  els.chapterStatusBadge.textContent = state.completed ? "COMPLETED" : "READY";
  els.loadingOverlay.classList.remove("hidden");
  els.identityOverlay.classList.add("hidden");
  els.completionOverlay.classList.add("hidden");

  els.video.pause();
  els.video.src = currentChapter.src;
  els.video.load();

  renderSpeedOptions();
  renderPolicy();
  renderChapterList();
  updateUi();

  addLog("chapter_loaded", {
    chapterIndex: index,
    src: currentChapter.src,
    policy: currentPolicy
  });
}

function renderSpeedOptions() {
  const allow = currentPolicy.allowPlaybackRate !== false;
  const min = Number(currentPolicy.minPlaybackRate || 0.75);
  const max = Number(currentPolicy.maxPlaybackRate || 2);

  const baseRates = [0.75, 1, 1.25, 1.5, 1.75, 2];
  const rates = baseRates.filter((rate) => rate >= min && rate <= max);

  els.speedSelect.innerHTML = "";

  rates.forEach((rate) => {
    const option = document.createElement("option");
    option.value = String(rate);
    option.textContent = `${rate}x`;
    if (rate === 1) option.selected = true;
    els.speedSelect.appendChild(option);
  });

  els.speedSelect.disabled = !allow;
  els.video.playbackRate = 1;
}

function renderPolicy() {
  const items = [
    ["배속", currentPolicy.allowPlaybackRate === false ? "비허용" : `허용, 최대 ${currentPolicy.maxPlaybackRate || 2}x`],
    ["앞으로 이동", currentPolicy.preventForwardSeeking === false ? "허용" : "차단"],
    ["챕터 진도 기준", `${currentPolicy.requiredProgressPercent || currentPolicy.requiredCourseProgressPercent || 95}%`],
    ["실제 재생시간 기준", `${currentPolicy.requiredActualWatchPercent || 0}%`],
    ["본인확인", `${currentPolicy.identityCheckCount || 0}회`],
    ["수료 후 탐색", currentPolicy.allowSeekingAfterCompletion ? "허용" : "정책 유지"]
  ];

  els.policyList.innerHTML = items
    .map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`)
    .join("");
}

function buildIdentityTargets(duration) {
  const count = Number(currentPolicy.identityCheckCount || 0);
  identityCheckTargets = [];

  if (!duration || count <= 0) return;

  for (let i = 1; i <= count; i += 1) {
    const ratio = (i / (count + 1));
    identityCheckTargets.push(Math.floor(duration * ratio));
  }
}

function updateChapterState(extra = {}) {
  if (!currentChapter) return;

  const state = getChapterProgress(currentChapter.chapterId);

  state.duration = els.video.duration || state.duration || 0;
  state.maxAllowedTime = Math.max(state.maxAllowedTime || 0, maxAllowedTime || 0);
  state.actualWatchSeconds = Math.max(state.actualWatchSeconds || 0, actualWatchSeconds || 0);
  state.blockedSeekCount = blockedSeekCount;
  state.identityPassedCount = identityPassedCount;
  state.lastPosition = els.video.currentTime || state.lastPosition || 0;
  state.updatedAt = new Date().toISOString();

  Object.assign(state, extra);

  progress[currentChapter.chapterId] = state;
  saveProgress();
}

function evaluateChapterCompletion() {
  const duration = els.video.duration || 0;
  if (!duration || !currentChapter) return false;

  const state = getChapterProgress(currentChapter.chapterId);
  if (state.completed) return true;

  const requiredProgress = Number(
    currentPolicy.requiredProgressPercent ||
    currentPolicy.requiredCourseProgressPercent ||
    95
  );

  const requiredActual = Number(currentPolicy.requiredActualWatchPercent || 0);
  const progressRatio = (maxAllowedTime / duration) * 100;
  const actualRatio = (actualWatchSeconds / duration) * 100;
  const requiredIdentity = Number(currentPolicy.identityCheckCount || 0);

  const passed =
    progressRatio >= requiredProgress &&
    actualRatio >= requiredActual &&
    identityPassedCount >= requiredIdentity;

  if (passed) {
    updateChapterState({
      completed: true,
      completedAt: new Date().toISOString()
    });

    els.chapterStatusBadge.textContent = "COMPLETED";
    showCompletionOverlay();
    addLog("chapter_completed", {
      progressRatio,
      actualRatio,
      requiredProgress,
      requiredActual,
      identityPassedCount
    });

    renderChapterList();
    updateCourseProgress();
  }

  return passed;
}

function updateCourseProgress() {
  if (!course) return;

  const chapters = course.chapters || [];
  if (!chapters.length) return;

  let totalRatio = 0;
  let completedCount = 0;

  chapters.forEach((chapter) => {
    const state = getChapterProgress(chapter.chapterId);
    const duration = state.duration || 0;
    const ratio = duration > 0 ? clamp((state.maxAllowedTime / duration) * 100, 0, 100) : 0;
    totalRatio += ratio;
    if (state.completed) completedCount += 1;
  });

  const courseRatio = totalRatio / chapters.length;
  const requiredCourseProgress = Number(course.completionPolicy?.requiredCourseProgressPercent || 95);
  const requireAll = course.completionPolicy?.requireAllChaptersCompleted !== false;

  const courseCompleted =
    courseRatio >= requiredCourseProgress &&
    (!requireAll || completedCount === chapters.length);

  els.courseProgressNumber.textContent = percent(courseRatio);
  els.courseProgressText.textContent = `${percent(courseRatio)} 완료`;
  els.courseRing.style.setProperty("--progress", `${courseRatio}%`);

  if (courseCompleted) {
    els.courseCompleteText.textContent = "강의 수료 조건을 충족했습니다.";
    els.courseStatusBadge.textContent = "COMPLETED";
  } else {
    els.courseCompleteText.textContent = `${completedCount}/${chapters.length}개 챕터 완료`;
    els.courseStatusBadge.textContent = "IN PROGRESS";
  }
}

function showCompletionOverlay() {
  const hasNext = currentChapterIndex < course.chapters.length - 1;

  els.completionMessage.textContent = hasNext
    ? "다음 챕터로 이동할 수 있습니다."
    : "모든 챕터 학습 상태를 확인했습니다.";

  els.nextChapterBtn.textContent = hasNext ? "다음 챕터로 이동" : "강의 진도 확인";
  els.completionOverlay.classList.remove("hidden");
}

function updateUi() {
  const duration = els.video.duration || 0;
  const current = els.video.currentTime || 0;
  const chapterRatio = duration > 0 ? clamp((maxAllowedTime / duration) * 100, 0, 100) : 0;

  els.timeText.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  els.progressText.textContent = `챕터 진도 ${chapterRatio.toFixed(1)}%`;
  els.progressBar.style.width = `${chapterRatio}%`;

  els.actualWatchText.textContent = `${Math.floor(actualWatchSeconds)}초`;
  els.maxPositionText.textContent = `${Math.floor(maxAllowedTime)}초`;
  els.blockedSeekText.textContent = `${blockedSeekCount}회`;
  els.identityText.textContent = `${identityPassedCount}회`;

  updateChapterState();
}

function showIdentityCheck(target) {
  els.video.pause();
  els.identityOverlay.classList.remove("hidden");
  identityCheckShownTargets.add(target);

  addLog("identity_check_shown", {
    target
  });
}

function maybeShowIdentityCheck() {
  if (!identityCheckTargets.length) return;

  const current = els.video.currentTime || 0;

  identityCheckTargets.forEach((target) => {
    if (current >= target && !identityCheckShownTargets.has(target)) {
      showIdentityCheck(target);
    }
  });
}

function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (!els.video.paused && !els.video.ended) {
      addLog("heartbeat", {
        currentTime: els.video.currentTime,
        duration: els.video.duration
      });
    }
  }, 15000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

els.video.addEventListener("loadedmetadata", () => {
  els.loadingOverlay.classList.add("hidden");

  const state = getChapterProgress(currentChapter.chapterId);
  const duration = els.video.duration || 0;

  state.duration = duration;
  buildIdentityTargets(duration);

  if (state.lastPosition && state.lastPosition < duration) {
    els.video.currentTime = state.lastPosition;
  }

  updateUi();
  saveProgress();

  addLog("metadata_loaded", {
    duration,
    videoWidth: els.video.videoWidth,
    videoHeight: els.video.videoHeight
  });
});

els.video.addEventListener("canplay", () => {
  els.loadingOverlay.classList.add("hidden");
  els.chapterStatusBadge.textContent = getChapterProgress(currentChapter.chapterId).completed
    ? "COMPLETED"
    : "CAN PLAY";

  addLog("canplay", {
    duration: els.video.duration
  });
});

els.video.addEventListener("play", () => {
  lastTickAt = Date.now();
  els.playPauseBtn.textContent = "일시정지";
  els.chapterStatusBadge.textContent = "PLAYING";
  startHeartbeat();
  addLog("play");
});

els.video.addEventListener("pause", () => {
  els.playPauseBtn.textContent = "재생";

  if (!getChapterProgress(currentChapter.chapterId).completed) {
    els.chapterStatusBadge.textContent = "PAUSED";
  }

  addLog("pause");
});

els.video.addEventListener("ended", () => {
  stopHeartbeat();
  maxAllowedTime = Math.max(maxAllowedTime, els.video.duration || 0);
  updateUi();
  evaluateChapterCompletion();

  addLog("ended");
});

els.video.addEventListener("timeupdate", () => {
  const now = Date.now();

  if (!els.video.paused && !els.video.seeking) {
    if (lastTickAt) {
      const delta = (now - lastTickAt) / 1000;
      if (delta > 0 && delta < 3) {
        actualWatchSeconds += delta;
      }
    }

    if (els.video.currentTime > maxAllowedTime) {
      maxAllowedTime = els.video.currentTime;
    }

    lastValidTime = els.video.currentTime;
  }

  lastTickAt = now;

  maybeShowIdentityCheck();
  updateUi();
  evaluateChapterCompletion();
});

els.video.addEventListener("seeking", () => {
  if (isRestoringSeek) return;

  const state = getChapterProgress(currentChapter.chapterId);
  const completed = state.completed;
  const preventForward =
    currentPolicy.preventForwardSeeking !== false &&
    !(completed && currentPolicy.allowSeekingAfterCompletion);

  if (!preventForward) {
    addLog("seek_allowed", {
      attemptedTime: els.video.currentTime,
      reason: "policy_allowed"
    });
    return;
  }

  const attemptedTime = els.video.currentTime;
  const tolerance = 2;

  if (attemptedTime > maxAllowedTime + tolerance) {
    blockedSeekCount += 1;
    isRestoringSeek = true;

    const restoredTime = Math.max(0, lastValidTime || maxAllowedTime || 0);
    els.video.currentTime = restoredTime;

    setTimeout(() => {
      isRestoringSeek = false;
    }, 120);

    addLog("seek_blocked", {
      attemptedTime,
      restoredTime,
      maxAllowedTime
    });
  } else {
    addLog("seek_allowed", {
      attemptedTime,
      reason: "within_watched_range"
    });
  }
});

els.video.addEventListener("ratechange", () => {
  const allow = currentPolicy.allowPlaybackRate !== false;
  const maxRate = Number(currentPolicy.maxPlaybackRate || 2);
  const minRate = Number(currentPolicy.minPlaybackRate || 0.75);

  if (!allow) {
    els.video.playbackRate = 1;
    return;
  }

  if (els.video.playbackRate > maxRate) {
    els.video.playbackRate = maxRate;
  }

  if (els.video.playbackRate < minRate) {
    els.video.playbackRate = minRate;
  }

  addLog("rate_changed", {
    playbackRate: els.video.playbackRate
  });
});

els.video.addEventListener("error", () => {
  els.loadingOverlay.classList.add("hidden");
  els.chapterStatusBadge.textContent = "VIDEO ERROR";

  addLog("video_error", {
    code: els.video.error?.code,
    currentSrc: els.video.currentSrc,
    src: els.video.src
  });
});

els.playPauseBtn.addEventListener("click", async () => {
  try {
    if (els.video.paused) {
      await els.video.play();
    } else {
      els.video.pause();
    }
  } catch (error) {
    addLog("play_failed", {
      message: error.message
    });
  }
});

els.backBtn.addEventListener("click", () => {
  els.video.currentTime = Math.max(0, els.video.currentTime - 10);
  addLog("back_10_seconds");
});

els.speedSelect.addEventListener("change", () => {
  els.video.playbackRate = Number(els.speedSelect.value);
});

els.fullscreenBtn.addEventListener("click", async () => {
  const target = document.querySelector(".ol-video-frame");

  try {
    if (!document.fullscreenElement) {
      await target.requestFullscreen();
      addLog("fullscreen_enter");
    } else {
      await document.exitFullscreen();
      addLog("fullscreen_exit");
    }
  } catch (error) {
    addLog("fullscreen_failed", {
      message: error.message
    });
  }
});

els.simulateSeekBtn.addEventListener("click", () => {
  const attempted = els.video.currentTime + 60;
  addLog("simulate_forward_seek", { attempted });
  els.video.currentTime = attempted;
});

els.clearLogBtn.addEventListener("click", () => {
  logs = [];
  saveLogs();
  renderLogs();
  addLog("logs_cleared");
});

els.confirmIdentityBtn.addEventListener("click", async () => {
  identityPassedCount += 1;
  els.identityOverlay.classList.add("hidden");

  updateChapterState({
    identityPassedCount
  });

  addLog("identity_check_passed", {
    identityPassedCount
  });

  try {
    await els.video.play();
  } catch (error) {
    addLog("resume_after_identity_failed", {
      message: error.message
    });
  }
});

els.nextChapterBtn.addEventListener("click", () => {
  const hasNext = currentChapterIndex < course.chapters.length - 1;
  els.completionOverlay.classList.add("hidden");

  if (hasNext) {
    loadChapter(currentChapterIndex + 1);
  } else {
    updateCourseProgress();
  }
});

els.userForm.addEventListener("submit", (event) => {
  event.preventDefault();

  user = {
    id: createId("usr"),
    name: els.userNameInput.value.trim(),
    email: els.userEmailInput.value.trim(),
    department: els.userDeptInput.value.trim(),
    employeeNo: els.userNoInput.value.trim(),
    createdAt: new Date().toISOString()
  };

  saveUser(user);
  hideUserModal();

  loadProgress();
  loadLogs();
  renderLogs();
  addLog("user_registered", user);
});

els.resetUserBtn.addEventListener("click", () => {
  localStorage.removeItem(userStorageKey());
  user = null;
  showUserModal();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && currentPolicy?.pauseWhenHidden !== false && !els.video.paused) {
    els.video.pause();
    addLog("tab_hidden_pause");
  }
});

window.addEventListener("beforeunload", () => {
  updateChapterState();
});

init();
