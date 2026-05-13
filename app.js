const video = document.getElementById("trainingVideo");
const videoTitle =  addLog("identity_check_shown", {const videoTitle = document.getElementById("videoTitle");
    reason: "sample_check_at_30_seconds",
  });
}

video.addEventListener("loadedmetadata", () => {
  updateUi();

  addLog("metadata_loaded", {
    duration: video.duration,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
  });
});

video.addEventListener("canplay", () => {
  setStatus("CAN PLAY");

  addLog("canplay", {
    duration: video.duration,
  });
});

video.addEventListener("play", () => {
  lastTickAt = Date.now();
  playPauseBtn.textContent = "일시정지";
  setStatus("PLAYING");
  startHeartbeat();

  addLog("play");
});

video.addEventListener("pause", () => {
  playPauseBtn.textContent = "재생";
  setStatus("PAUSED");

  addLog("pause");
});

video.addEventListener("ended", () => {
  playPauseBtn.textContent = "재생";
  setStatus("ENDED");
  stopHeartbeat();

  addLog("ended", {
    completed: true,
  });
});

video.addEventListener("timeupdate", () => {
  const now = Date.now();

  if (!video.paused && !video.seeking) {
    if (lastTickAt) {
      const delta = (now - lastTickAt) / 1000;

      if (delta > 0 && delta < 3) {
        actualWatchSeconds += delta;
      }
    }

    if (video.currentTime > maxAllowedTime) {
      maxAllowedTime = video.currentTime;
    }

    lastValidTime = video.currentTime;
  }

  lastTickAt = now;

  if (video.currentTime >= 30 && !identityCheckShown) {
    showIdentityCheck();
  }

  updateUi();
});

video.addEventListener("seeking", () => {
  const attemptedTime = video.currentTime;
  const seekTolerance = 2;

  if (attemptedTime > maxAllowedTime + seekTolerance) {
    blockedSeekCount += 1;

    const restoredTime = Math.max(0, lastValidTime || maxAllowedTime);
    video.currentTime = restoredTime;

    addLog("seek_blocked", {
      attemptedTime,
      restoredTime,
      maxAllowedTime,
    });
  } else {
    addLog("seek_allowed", {
      attemptedTime,
    });
  }
});

video.addEventListener("ratechange", () => {
  addLog("speed_changed", {
    playbackRate: video.playbackRate,
  });
});

video.addEventListener("error", () => {
  const error = video.error;

  setStatus("VIDEO ERROR");

  addLog("video_error", {
    code: error?.code,
    message: getVideoErrorMessage(error?.code),
    currentSrc: video.currentSrc,
    src: video.src,
  });
});

function getVideoErrorMessage(code) {
  const messages = {
    1: "MEDIA_ERR_ABORTED: 사용자가 재생을 중단했습니다.",
    2: "MEDIA_ERR_NETWORK: 네트워크 오류가 발생했습니다.",
    3: "MEDIA_ERR_DECODE: 디코딩 오류가 발생했습니다.",
    4: "MEDIA_ERR_SRC_NOT_SUPPORTED: 영상 URL 또는 형식을 지원하지 않습니다.",
  };

  return messages[code] || "알 수 없는 비디오 오류";
}

playPauseBtn.addEventListener("click", async () => {
  try {
    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  } catch (error) {
    addLog("play_failed", {
      message: error.message,
    });
  }
});

backBtn.addEventListener("click", () => {
  video.currentTime = Math.max(0, video.currentTime - 10);

  addLog("back_10_seconds");
});

speedSelect.addEventListener("change", () => {
  video.playbackRate = Number(speedSelect.value);
});

fullscreenBtn.addEventListener("click", async () => {
  const target = video.parentElement;

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
      message: error.message,
    });
  }
});

simulateSeekBtn.addEventListener("click", () => {
  const attempted = video.currentTime + 60;

  addLog("simulate_forward_seek", {
    attempted,
  });

  video.currentTime = attempted;
});

clearLogBtn.addEventListener("click", () => {
  logs = [];
  localStorage.removeItem(STORAGE_KEY);

  actualWatchSeconds = 0;
  maxAllowedTime = 0;
  lastValidTime = 0;
  blockedSeekCount = 0;
  identityCheckShown = false;

  identityOverlay.classList.add("hidden");

  renderLogs();
  updateUi();

  addLog("log_cleared");
});

confirmIdentityBtn.addEventListener("click", async () => {
  identityOverlay.classList.add("hidden");

  addLog("identity_check_confirmed");

  try {
    await video.play();
  } catch (error) {
    addLog("resume_after_identity_failed", {
      message: error.message,
    });
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && !video.paused) {
    video.pause();

    addLog("tab_hidden_pause", {
      reason: "탭 이탈로 일시정지",
    });
  }
});

window.addEventListener("beforeunload", () => {
  addLog("page_unload");
});

init();
const statusBadge = document.getElementById("statusBadge");

const playPauseBtn = document.getElementById("playPauseBtn");
const backBtn = document.getElementById("backBtn");
const speedSelect = document.getElementById("speedSelect");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const timeText = document.getElementById("timeText");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");

const actualWatchText = document.getElementById("actualWatchText");
const maxPositionText = document.getElementById("maxPositionText");
const blockedSeekText = document.getElementById("blockedSeekText");
const logOutput = document.getElementById("logOutput");

const simulateSeekBtn = document.getElementById("simulateSeekBtn");
const clearLogBtn = document.getElementById("clearLogBtn");

const identityOverlay = document.getElementById("identityOverlay");
const confirmIdentityBtn = document.getElementById("confirmIdentityBtn");

const STORAGE_KEY = "legal-video-player-test-log";

let currentVideoMeta = null;
let maxAllowedTime = 0;
let lastValidTime = 0;
let actualWatchSeconds = 0;
let blockedSeekCount = 0;
let lastTickAt = null;
let identityCheckShown = false;
let heartbeatTimer = null;
let logs = loadLogs();

function googleDriveVideoUrl(fileId) {
  const url = new URL("https://drive.google.com/uc");
  url.searchParams.set("export", "download");
  url.searchParams.set("id", fileId);
  return url.toString();
}

function resolveVideoSrc(meta) {
  if (meta.provider === "google-drive") {
    return googleDriveVideoUrl(meta.driveFileId);
  }

  if (meta.provider === "local") {
    return meta.src;
  }

  return meta.src;
}

async function init() {
  renderLogs();

  try {
    const response = await fetch("./data/videos.json", {
      cache: "no-store",
    });

    const videos = await response.json();
    currentVideoMeta = videos[0];

    if (!currentVideoMeta) {
      throw new Error("data/videos.json에 영상 데이터가 없습니다.");
    }

    const src = resolveVideoSrc(currentVideoMeta);

    if (!src) {
      throw new Error("영상 src를 만들 수 없습니다.");
    }

    videoTitle.textContent = currentVideoMeta.title || "제목 없음";

    video.removeAttribute("crossorigin");
    video.src = src;
    video.load();

    console.log("VIDEO SRC:", src);

    addLog("video_loaded", {
      title: currentVideoMeta.title,
      src,
      instruction:
        "이 URL을 새 탭에서 열었을 때 MP4가 바로 다운로드 또는 재생되어야 합니다.",
    });

    setStatus("LOADED");
  } catch (error) {
    videoTitle.textContent = "영상 로드 실패";
    setStatus("ERROR");

    addLog("error", {
      message: error.message,
    });
  }
}

function setStatus(status) {
  statusBadge.textContent = status;
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

function updateUi() {
  const duration = video.duration || 0;
  const current = video.currentTime || 0;
  const progressRatio = duration > 0 ? current / duration : 0;
  const progressPercent = Math.min(100, Math.max(0, progressRatio * 100));

  timeText.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  progressText.textContent = `진도율 ${progressPercent.toFixed(1)}%`;
  progressBar.style.width = `${progressPercent}%`;

  actualWatchText.textContent = `${Math.floor(actualWatchSeconds)}초`;
  maxPositionText.textContent = `${Math.floor(maxAllowedTime)}초`;
  blockedSeekText.textContent = `${blockedSeekCount}회`;
}

function addLog(type, payload = {}) {
  const log = {
    type,
    videoId: currentVideoMeta?.id || null,
    position: Number(video.currentTime || 0).toFixed(2),
    maxAllowedTime: Number(maxAllowedTime || 0).toFixed(2),
    playbackRate: video.playbackRate || 1,
    actualWatchSeconds: Math.floor(actualWatchSeconds),
    createdAt: new Date().toISOString(),
    payload,
  };

  logs.unshift(log);
  logs = logs.slice(0, 80);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  renderLogs();
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function renderLogs() {
  if (!logs.length) {
    logOutput.textContent = "로그 대기 중...";
    return;
  }

  logOutput.textContent = JSON.stringify(logs, null, 2);
}

function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (!video.paused && !video.ended) {
      addLog("heartbeat", {
        currentTime: video.currentTime,
        duration: video.duration,
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

function showIdentityCheck() {
  if (identityCheckShown) return;

  identityCheckShown = true;
  video.pause();
  identityOverlay.classList.remove("hidden");

