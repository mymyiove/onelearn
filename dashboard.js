const params = new URLSearchParams(window.location.search);
const els.userNameText.textContent = "정보 입력 필요";const TENANT_ID = params.get("tenant") || "woongjin";
  }
}

function getProgressStorageKey(courseId) {
  const userId = user?.id || "anonymous";
  return `${PLAYER_PREFIX}:progress:${courseId}:${userId}`;
}

function loadCourseProgress(courseId) {
  try {
    const raw = localStorage.getItem(getProgressStorageKey(courseId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function formatDate(dateString) {
  if (!dateString) return "마감 없음";

  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getDaysUntilDue(dateString) {
  if (!dateString) return null;

  const today = new Date();
  const due = new Date(`${dateString}T23:59:59`);
  const diff = due.getTime() - today.getTime();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDueText(dateString) {
  const days = getDaysUntilDue(dateString);

  if (days === null) return "마감 없음";
  if (days > 0) return `${days}일 남음`;
  if (days === 0) return "오늘 마감";
  return `${Math.abs(days)}일 지남`;
}

function isUrgent(dateString) {
  const days = getDaysUntilDue(dateString);
  return days !== null && days >= 0 && days <= 7;
}

function calculateCourseProgress(course) {
  const saved = loadCourseProgress(course.courseId);
  const chapters = course.chapters || [];

  if (!chapters.length) {
    return {
      ratio: 0,
      completedChapters: 0,
      totalChapters: 0,
      completed: false,
      lastUpdatedAt: null
    };
  }

  let totalRatio = 0;
  let completedChapters = 0;
  let lastUpdatedAt = null;

  chapters.forEach((chapter) => {
    const state = saved[chapter.chapterId] || {};
    const duration = Number(state.duration || 0);
    const maxAllowedTime = Number(state.maxAllowedTime || 0);
    const ratio = duration > 0 ? Math.min(100, Math.max(0, (maxAllowedTime / duration) * 100)) : 0;

    totalRatio += ratio;

    if (state.completed) {
      completedChapters += 1;
    }

    if (state.updatedAt && (!lastUpdatedAt || new Date(state.updatedAt) > new Date(lastUpdatedAt))) {
      lastUpdatedAt = state.updatedAt;
    }
  });

  const ratio = totalRatio / chapters.length;
  const required = Number(course.completionPolicy?.requiredCourseProgressPercent || 95);
  const requireAll = course.completionPolicy?.requireAllChaptersCompleted !== false;
  const completed = ratio >= required && (!requireAll || completedChapters === chapters.length);

  return {
    ratio,
    completedChapters,
    totalChapters: chapters.length,
    completed,
    lastUpdatedAt
  };
}

function getCourseStatus(course) {
  const progress = calculateCourseProgress(course);

  if (progress.completed) return "completed";
  if (progress.ratio > 0) return "progress";
  return "incomplete";
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`${path} 파일을 불러오지 못했습니다.`);
  }

  return response.json();
}

async function init() {
  setupCustomCursor();

  user = loadUser();
  updateUserNameText();
  fillUserFormFromSavedUser();

  if (!user) {
    showUserModal();
  } else {
    hideUserModal();
  }

  tenant = await fetchJson(`./data/tenants/${TENANT_ID}/tenant.json`);
  const coursesData = await fetchJson(`./data/tenants/${TENANT_ID}/courses.json`);
  const courseList = coursesData.courses || [];

  detailedCourses = await Promise.all(
    courseList.map(async (courseMeta) => {
      const detail = await fetchJson(courseMeta.courseFile);

      return {
        ...courseMeta,
        ...detail,
        required: courseMeta.required ?? detail.required ?? true,
        dueDate: courseMeta.dueDate || detail.dueDate,
        estimatedMinutes: courseMeta.estimatedMinutes || detail.estimatedMinutes || 0,
        category: courseMeta.category || detail.category || "교육"
      };
    })
  );

  renderTenant();
  renderDashboard();
  finishLoading();
}

function renderTenant() {
  if (!tenant) return;

  const displayName = tenant.displayName || tenant.tenantName || "원런";

  if (els.tenantName) {
    els.tenantName.textContent = `${displayName} 교육 대시보드`;
  }

  if (els.heroTitle) {
    els.heroTitle.textContent = user?.name
      ? `${user.name}님에게 배정된 교육`
      : "필수 교육을 확인하고 학습을 시작하세요";
  }

  if (els.heroSubtitle) {
    els.heroSubtitle.textContent =
      tenant.brand?.welcomeMessage ||
      "필수 교육, 진행 중 교육, 수료 완료 교육을 한 곳에서 확인하세요.";
  }

  document.documentElement.style.setProperty(
    "--brand-orange",
    tenant.brand?.primaryColor || "#F47721"
  );
}

function renderDashboard() {
  const enriched = detailedCourses.map((course) => {
    const progress = calculateCourseProgress(course);
    const status = getCourseStatus(course);

    return {
      ...course,
      progress,
      status,
      urgent: isUrgent(course.dueDate)
    };
  });

  const total = enriched.length;
  const completed = enriched.filter((course) => course.status === "completed").length;
  const inProgress = enriched.filter((course) => course.status === "progress").length;
  const urgent = enriched.filter((course) => course.urgent && course.status !== "completed").length;

  if (els.totalCount) els.totalCount.textContent = String(total);
  if (els.completedCount) els.completedCount.textContent = String(completed);
  if (els.inProgressCount) els.inProgressCount.textContent = String(inProgress);
  if (els.urgentCount) els.urgentCount.textContent = String(urgent);

  if (completed > 0) {
    window.setTimeout(fireCelebration, 450);
  }

  const filtered = enriched.filter((course) => {
    const text = `${course.title} ${course.category} ${course.description || ""}`.toLowerCase();
    const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "all") return true;
    if (activeFilter === "required") return Boolean(course.required);
    if (activeFilter === "progress") return course.status === "progress";
    if (activeFilter === "incomplete") return course.status !== "completed";
    if (activeFilter === "completed") return course.status === "completed";
    if (activeFilter === "urgent") return course.urgent && course.status !== "completed";

    return true;
  });

  renderCourses(filtered);
  setupCustomCursor();
}

function getCourseIcon(course) {
  const category = course.category || "";

  if (category.includes("법정")) return "⚖️";
  if (category.includes("스킬")) return "🚀";
  if (category.includes("보안")) return "🛡️";
  if (category.includes("안전")) return "🦺";
  if (category.includes("윤리")) return "🤝";

  return "📚";
}

function renderCourses(courses) {
  if (!els.courseGrid) return;

  els.courseGrid.innerHTML = "";

  if (!courses.length) {
    if (els.emptyState) els.emptyState.classList.remove("hidden");
    return;
  }

  if (els.emptyState) els.emptyState.classList.add("hidden");

  courses.forEach((course) => {
    const progress = course.progress;
    const ratio = Math.round(progress.ratio);

    const statusText =
      course.status === "completed"
        ? "수료 완료"
        : course.status === "progress"
          ? "진행 중"
          : "미수료";

    const actionText =
      course.status === "completed"
        ? "다시 보기"
        : course.status === "progress"
          ? "이어보기"
          : "교육 시작";

    const playerUrl = `./player.html?tenant=${encodeURIComponent(TENANT_ID)}&course=${encodeURIComponent(course.courseId)}`;
    const icon = getCourseIcon(course);

    const card = document.createElement("article");
    card.className = "course-card";

    card.innerHTML = `
      <div class="course-top-icon">${icon}</div>

      <div class="course-meta">
        ${
          course.required
            ? `<span class="course-pill required">필수</span>`
            : `<span class="course-pill">선택</span>`
        }
        <span class="course-pill">${course.category || "교육"}</span>
        <span class="course-pill ${course.status === "completed" ? "completed" : ""}">${statusText}</span>
        ${
          course.urgent && course.status !== "completed"
            ? `<span class="course-pill urgent">마감 임박</span>`
            : ""
        }
      </div>

      <h2 class="course-title">${course.title}</h2>
      <p class="course-desc">${course.description || course.subtitle || "강의 설명이 없습니다."}</p>

      <div class="course-progress-block">
        <div class="course-progress-head">
          <span>전체 진행률</span>
          <strong>${ratio}%</strong>
        </div>
        <div class="course-progress-track">
          <div class="course-progress-fill" style="width:${ratio}%"></div>
        </div>
      </div>

      <div class="course-info-grid">
        <div class="course-info">
          <span>마감일</span>
          <strong>${formatDate(course.dueDate)}</strong>
        </div>
        <div class="course-info">
          <span>남은 기간</span>
          <strong>${getDueText(course.dueDate)}</strong>
        </div>
        <div class="course-info">
          <span>완료 챕터</span>
          <strong>${progress.completedChapters}/${progress.totalChapters}개</strong>
        </div>
        <div class="course-info">
          <span>예상 시간</span>
          <strong>${course.estimatedMinutes || 0}분</strong>
        </div>
      </div>

      <div class="course-actions">
        <a href="${playerUrl}" class="course-action">${actionText}</a>
        <a href="${playerUrl}" class="course-sub-action">상세 보기</a>
      </div>
    `;

    els.courseGrid.appendChild(card);
  });
}

if (els.filterTabs) {
  els.filterTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    activeFilter = button.dataset.filter;

    els.filterTabs.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderDashboard();
  });
}

if (els.searchInput) {
  els.searchInput.addEventListener("input", () => {
    searchQuery = els.searchInput.value.trim();
    renderDashboard();
  });
}

if (els.userForm) {
  els.userForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = els.userNameInput?.value.trim() || "";
    const email = els.userEmailInput?.value.trim() || "";
    const department = els.userDeptInput?.value.trim() || "";
    const employeeNo = els.userNoInput?.value.trim() || "";

    if (!name || !email) {
      alert("이름과 이메일을 입력해주세요.");
      return;
    }

    user = {
      id: createId("usr"),
      name,
      email,
      department,
      employeeNo,
      createdAt: new Date().toISOString()
    };

    saveUser(user);
    updateUserNameText();
    hideUserModal();
    renderTenant();
    renderDashboard();

    if (typeof confetti === "function") {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 },
        colors: ["#F47721", "#FF9A52", "#FFD9A8"]
      });
    }
  });
}

if (els.changeUserBtn) {
  els.changeUserBtn.addEventListener("click", () => {
    localStorage.removeItem(USER_KEY);
    user = null;

    if (els.userNameInput) els.userNameInput.value = "";
    if (els.userEmailInput) els.userEmailInput.value = "";
    if (els.userDeptInput) els.userDeptInput.value = "";
    if (els.userNoInput) els.userNoInput.value = "";

    updateUserNameText();
    showUserModal();
  });
}

if (els.openUserModalBtn) {
  els.openUserModalBtn.addEventListener("click", () => {
    showUserModal();
  });
}

if (els.closeUserModalBtn) {
  els.closeUserModalBtn.addEventListener("click", () => {
    if (!user) {
      alert("처음 이용 시에는 수강자 정보를 먼저 입력해주세요.");
      return;
    }

    hideUserModal();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && user) {
    hideUserModal();
  }
});

init().catch((error) => {
  console.error(error);
  finishLoading();

  if (els.courseGrid) {
    els.courseGrid.innerHTML = `
      <section class="empty-state">
        <div>😵</div>
        <h2>교육 목록을 불러오지 못했습니다</h2>
        <p>${error.message}</p>
      </section>
    `;
  }
});


const USER_KEY = "onelearn-mvp-02:user";
const PLAYER_PREFIX = "onelearn-mvp-02";

const els = {
  pageLoader: document.getElementById("pageLoader"),
  customCursor: document.getElementById("customCursor"),
  tenantName: document.getElementById("tenantName"),
  heroTitle: document.getElementById("heroTitle"),
  heroSubtitle: document.getElementById("heroSubtitle"),
  userNameText: document.getElementById("userNameText"),
  changeUserBtn: document.getElementById("changeUserBtn"),
  openUserModalBtn: document.getElementById("openUserModalBtn"),
  closeUserModalBtn: document.getElementById("closeUserModalBtn"),
  totalCount: document.getElementById("totalCount"),
  inProgressCount: document.getElementById("inProgressCount"),
  completedCount: document.getElementById("completedCount"),
  urgentCount: document.getElementById("urgentCount"),
  filterTabs: document.getElementById("filterTabs"),
  searchInput: document.getElementById("searchInput"),
  courseGrid: document.getElementById("courseGrid"),
  emptyState: document.getElementById("emptyState"),
  userModal: document.getElementById("userModal"),
  userForm: document.getElementById("userForm"),
  userNameInput: document.getElementById("userNameInput"),
  userEmailInput: document.getElementById("userEmailInput"),
  userDeptInput: document.getElementById("userDeptInput"),
  userNoInput: document.getElementById("userNoInput")
};

let tenant = null;
let detailedCourses = [];
let user = null;
let activeFilter = "all";
let searchQuery = "";

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function finishLoading() {
  if (!els.pageLoader) return;

  window.setTimeout(() => {
    els.pageLoader.classList.add("done");
  }, 650);
}

function setupCustomCursor() {
  if (!els.customCursor) return;

  document.addEventListener("mousemove", (event) => {
    els.customCursor.style.left = `${event.clientX}px`;
    els.customCursor.style.top = `${event.clientY}px`;
  });

  document.querySelectorAll("a, button, input, .course-card").forEach((item) => {
    item.addEventListener("mouseenter", () => {
      els.customCursor.classList.add("hover");
    });

    item.addEventListener("mouseleave", () => {
      els.customCursor.classList.remove("hover");
    });
  });
}

function fireCelebration() {
  if (typeof confetti !== "function") return;

  confetti({
    particleCount: 110,
    spread: 80,
    origin: { y: 0.72 },
    colors: ["#F47721", "#FF9A52", "#FFD9A8", "#FFFFFF"]
  });
}

function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUser(nextUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
}

function showUserModal() {
  if (!els.userModal) return;

  els.userModal.classList.remove("hidden");
  els.userModal.style.display = "grid";
}

function hideUserModal() {
  if (!els.userModal) return;

  els.userModal.classList.add("hidden");
  els.userModal.style.display = "none";
}

function fillUserFormFromSavedUser() {
  if (!user) return;

  if (els.userNameInput) els.userNameInput.value = user.name || "";
  if (els.userEmailInput) els.userEmailInput.value = user.email || "";
  if (els.userDeptInput) els.userDeptInput.value = user.department || "";
  if (els.userNoInput) els.userNoInput.value = user.employeeNo || "";
}

function updateUserNameText() {
  if (!els.userNameText) return;

  if (user?.name) {
    els.userNameText.textContent = user.name;
  } else {
