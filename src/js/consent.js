const tenantId = OneLearnStorage.getTenantId();
const session = OneLearnStorage.read("session", null);
if (!session) location.replace(`./login.html?tenant=${encodeURIComponent(tenantId)}`);
const els = { welcomeText: document.getElementById("welcomeText"), termsCheck: document.getElementById("termsCheck"), privacyCheck: document.getElementById("privacyCheck"), learningLogCheck: document.getElementById("learningLogCheck"), acceptBtn: document.getElementById("acceptBtn"), message: document.getElementById("consentMessage") };
let learner = null;
const fallbackTenant = { displayName: "웅진 OneLearn" };
const fallbackLearner = { userId: session.userId, name: "정호준", email: session.email };
function getOverrides() { return OneLearnStorage.read("learnerOverrides", {}); }
function saveOverride(userId, patch) { const overrides = getOverrides(); overrides[userId] = { ...(overrides[userId] || {}), ...patch }; OneLearnStorage.write("learnerOverrides", overrides); }
async function init() {
  let tenant = fallbackTenant;
  try { tenant = await OneLearnStorage.fetchJson(`./data/tenants/${tenantId}/tenant.json`); } catch {}
  try {
    const data = await OneLearnStorage.fetchJson(`./data/tenants/${tenantId}/learners.json`);
    const overrides = getOverrides();
    learner = (data.learners || []).map(item => ({ ...item, ...(overrides[item.userId] || {}) })).find(item => item.userId === session.userId) || fallbackLearner;
  } catch { learner = fallbackLearner; }
  els.welcomeText.textContent = `${tenant.displayName || tenant.tenantName} · ${learner.name} 님`;
  if (learner.termsAccepted && learner.privacyAccepted) location.replace(`./dashboard.html?tenant=${encodeURIComponent(tenantId)}`);
}
els.acceptBtn.addEventListener("click", () => {
  els.message.textContent = "";
  if (!els.termsCheck.checked || !els.privacyCheck.checked || !els.learningLogCheck.checked) { els.message.textContent = "모든 필수 확인 항목을 체크해주세요."; return; }
  saveOverride(learner.userId, { termsAccepted: true, privacyAccepted: true, learningLogAccepted: true, termsVersion: OneLearnConfig.termsVersion, privacyVersion: OneLearnConfig.privacyVersion, consentAcceptedAt: new Date().toISOString() });
  location.href = `./dashboard.html?tenant=${encodeURIComponent(tenantId)}`;
});
init().catch(error => { els.message.textContent = error.message; });
