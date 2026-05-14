(function () {
  function getTenantId() {
    return new URLSearchParams(window.location.search).get("tenant") || window.OneLearnConfig.defaultTenantId;
  }
  function key(name) { return `onelearn:${getTenantId()}:${name}`; }
  function read(name, fallback) {
    try { const raw = localStorage.getItem(key(name)); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  }
  function write(name, value) { localStorage.setItem(key(name), JSON.stringify(value)); }
  function remove(name) { localStorage.removeItem(key(name)); }
  async function fetchJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`${path} 파일을 불러오지 못했습니다.`);
    return res.json();
  }
  window.OneLearnStorage = { getTenantId, key, read, write, remove, fetchJson };
})();
