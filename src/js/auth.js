const tenantId = OneLearnStorage.getTenantId();
const fallbackTenant = { tenantId: "woongjin", tenantName: "웅진씽크빅", displayName: "웅진 OneLearn", brand: { primaryColor: "#F47721" } };
const fallbackLearners = [{ userId: "usr-001", tenantId: "woongjin", name: "정호준", email: "test@company.com", department: "교육사업팀", employeeNo: "10018177", tempPassword: "10018177", role: "learner", status: "invited", mustChangePassword: true, emailVerified: false, termsAccepted: false, privacyAccepted: false }];
const els = {
  tenantKicker: document.getElementById("tenantKicker"), tenantHeadline: document.getElementById("tenantHeadline"), tenantSubtitle: document.getElementById("tenantSubtitle"), stepTitle: document.getElementById("stepTitle"), stepDesc: document.getElementById("stepDesc"), loginForm: document.getElementById("loginForm"), verifyForm: document.getElementById("verifyForm"), passwordForm: document.getElementById("passwordForm"), emailInput: document.getElementById("emailInput"), passwordInput: document.getElementById("passwordInput"), codeInput: document.getElementById("codeInput"), newPasswordInput: document.getElementById("newPasswordInput"), newPasswordConfirmInput: document.getElementById("newPasswordConfirmInput"), authMessage: document.getElementById("authMessage"), backToLoginBtn: document.getElementById("backToLoginBtn")
};
let tenant = fallbackTenant, learners = fallbackLearners, currentLearner = null;
function showStep(step) {
  [els.loginForm, els.verifyForm, els.passwordForm].forEach(form => form.classList.add("hidden"));
  if (step === "login") { els.loginForm.classList.remove("hidden"); els.stepTitle.textContent = "이메일과 초기 비밀번호를 입력해주세요"; els.stepDesc.textContent = "초기 비밀번호는 안내받은 임시 비밀번호 또는 사번입니다."; }
  if (step === "verify") { els.verifyForm.classList.remove("hidden"); els.stepTitle.textContent = "이메일 인증을 완료해주세요"; els.stepDesc.textContent = "테스트 단계에서는 인증 코드 123456을 입력하면 됩니다."; }
  if (step === "password") { els.passwordForm.classList.remove("hidden"); els.stepTitle.textContent = "최초 비밀번호를 변경해주세요"; els.stepDesc.textContent = "안전한 계정 관리를 위해 새 비밀번호를 설정합니다."; }
}
function setMessage(message) { els.authMessage.textContent = message || ""; }
function getLearnerOverrides() { return OneLearnStorage.read("learnerOverrides", {}); }
function saveLearnerOverride(userId, patch) { const overrides = getLearnerOverrides(); overrides[userId] = { ...(overrides[userId] || {}), ...patch }; OneLearnStorage.write("learnerOverrides", overrides); }
function applyOverrides(learner) { const overrides = getLearnerOverrides(); return { ...learner, ...(overrides[learner.userId] || {}) }; }
function finishLogin(learner) {
  const nextLearner = applyOverrides(learner);
  OneLearnStorage.write("session", { userId: nextLearner.userId, email: nextLearner.email, loggedInAt: new Date().toISOString() });
  location.href = `./dashboard.html?tenant=${encodeURIComponent(tenantId)}`;
}
function renderTenantCopy() {
  const displayName = tenant.displayName || tenant.tenantName || "OneLearn";
  els.tenantKicker.textContent = displayName;
  els.tenantHeadline.innerHTML = `${displayName}에<br />오신 것을<br />환영합니다`;
  els.tenantSubtitle.textContent = "오늘도 한 걸음 성장해볼까요? 추천 과정과 학습 현황을 한 곳에서 확인할 수 있습니다.";
  document.documentElement.style.setProperty("--brand", tenant.brand?.primaryColor || "#F47721");
}
async function init() {
  try { tenant = await OneLearnStorage.fetchJson(`./data/tenants/${tenantId}/tenant.json`); } catch (error) { tenant = fallbackTenant; }
  try { const learnerData = await OneLearnStorage.fetchJson(`./data/tenants/${tenantId}/learners.json`); learners = learnerData.learners && learnerData.learners.length ? learnerData.learners : fallbackLearners; } catch (error) { learners = fallbackLearners; }
  learners = learners.map(applyOverrides);
  renderTenantCopy();
}
els.loginForm.addEventListener("submit", event => {
  event.preventDefault(); setMessage("");
  const email = els.emailInput.value.trim().toLowerCase();
  const password = els.passwordInput.value.trim();
  const learner = learners.find(item => String(item.email || "").toLowerCase() === email);
  if (!learner) return setMessage("등록된 학습자 이메일이 아닙니다. 테스트 계정은 test@company.com 입니다.");
  const validPassword = learner.password || learner.tempPassword || learner.employeeNo;
  if (password !== validPassword) return setMessage("비밀번호가 일치하지 않습니다. 테스트 초기 비밀번호는 10018177 입니다.");
  currentLearner = learner;
  if (!learner.emailVerified) return showStep("verify");
  if (learner.mustChangePassword) return showStep("password");
  finishLogin(learner);
});
els.verifyForm.addEventListener("submit", event => {
  event.preventDefault();
  if (els.codeInput.value.trim() !== OneLearnConfig.testVerificationCode) return setMessage("인증 코드가 올바르지 않습니다. 테스트 코드는 123456 입니다.");
  saveLearnerOverride(currentLearner.userId, { emailVerified: true });
  currentLearner = applyOverrides(currentLearner);
  if (currentLearner.mustChangePassword) showStep("password"); else finishLogin(currentLearner);
});
els.passwordForm.addEventListener("submit", event => {
  event.preventDefault();
  const pw = els.newPasswordInput.value.trim(); const confirm = els.newPasswordConfirmInput.value.trim();
  if (pw.length < 8) return setMessage("새 비밀번호는 8자 이상을 권장합니다.");
  if (pw !== confirm) return setMessage("새 비밀번호와 확인 값이 일치하지 않습니다.");
  saveLearnerOverride(currentLearner.userId, { password: pw, mustChangePassword: false, status: "active" });
  currentLearner = applyOverrides(currentLearner);
  finishLogin(currentLearner);
});
els.backToLoginBtn.addEventListener("click", () => showStep("login"));
init().catch(error => setMessage(error.message));
