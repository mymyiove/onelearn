const params = new URLSearchParams(window.location.search);const params = new URLSearchParams(window.location <span>예상 시간</span>
          <strong>${course.estimatedMinutes || 0}분</strong>
        </div>
      </div>

      <div class="course-actions">
        <a class="course-action" href="${playerUrl}">${actionText}</a>
        <a class="course-sub-action" href="${playerUrl}">상세 보기</a>
      </div>
    `;

    els.courseGrid.appendChild(card);
  });
}

els.filterTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  activeFilter = button.dataset.filter;

  els.filterTabs.querySelectorAll("button").forEach((item) => {
    item.classList.toggle("active", item === button);
  });

  renderDashboard();
});

els.searchInput.addEventListener("input", () => {
  searchQuery = els.searchInput.value.trim();
  renderDashboard();
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

  els.userNameText.textContent = user.name;
  renderTenant();
  renderDashboard();
});

els.changeUserBtn.addEventListener("click", () => {
  localStorage.removeItem(USER_KEY);
  user = null;

  els.userNameInput.value = "";
  els.userEmailInput.value = "";
  els.userDeptInput.value = "";
  els.userNoInput.value = "";
  els.userNameText.textContent = "정보 입력 필요";

  showUserModal();
});

init().catch((error) => {
  console.error(error);

  els.courseGrid.innerHTML = `
    <section class="empty-state">
      <h2>교육 목록을 불러오지 못했습니다</h2>
      <p>${error.message}</p>
    </section>
  `;
});
const TENANT_ID = params.get("tenant") || "woongjin";

const USER_KEY = "onelearn-mvp-02:user";
const PLAYER_PREFIX = "onelearn-mvp-02";

const els = {
  tenantName: document.getElementById("tenantName"),
  heroTitle: document.getElementById("heroTitle"),
  heroSubtitle: document.getElementById("heroSubtitle"),
  userNameText: document.getElementById("userNameText"),
  changeUserBtn: document.getElementById("changeUserBtn"),
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
  els.userModal.classList.remove("hidden");
}

function hideUserModal() {
  els.userModal.classList.add("hidden");
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
  user = loadUser();

  if (!user) {
    showUserModal();
  } else {
    hideUserModal();
    els.userNameText.textContent = user.name || "사용자";
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
}

function renderTenant() {
  const displayName = tenant.displayName || tenant.tenantName || "원런";

  els.tenantName.textContent = `${displayName} 교육 대시보드`;
  els.heroTitle.textContent = user?.name
    ? `${user.name}님에게 배정된 교육`
    : "나에게 배정된 교육";
  els.heroSubtitle.textContent =
    tenant.brand?.welcomeMessage ||
    "필수 교육, 진행 중 교육, 수료 완료 교육을 한 곳에서 확인하세요.";

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

  els.totalCount.textContent = String(total);
  els.completedCount.textContent = String(completed);
  els.inProgressCount.textContent = String(inProgress);
  els.urgentCount.textContent = String(urgent);

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
}

function renderCourses(courses) {
  els.courseGrid.innerHTML = "";

  if (!courses.length) {
    els.emptyState.classList.remove("hidden");
    return;
  }

  els.emptyState.classList.add("hidden");

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

    const card = document.createElement("article");
    card.className = "course-card";

    card.innerHTML = `
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
