export function getSharePageHTML(file) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>文件分享 - ${escapeHtml(file.filename)}</title>
<style>${baseStyles()}
.share-card{max-width:480px;margin:80px auto;border:2px solid #000;padding:40px}
.share-card h2{margin:0 0 24px;font-size:20px}
.file-info{margin-bottom:24px;padding:16px;background:#f5f5f5;border:1px solid #ddd}
.file-info p{margin:4px 0;font-size:14px}
</style>
</head>
<body>
<div class="share-card">
<h2>文件分享</h2>
<div class="file-info">
<p><strong>文件名：</strong>${escapeHtml(file.filename)}</p>
<p><strong>大小：</strong>${formatSize(file.size)}</p>
<p><strong>类型：</strong>${escapeHtml(file.content_type)}</p>
</div>
<a href="/api/files/${file.id}/download?key=${file.share_key}" class="btn" style="display:inline-block;text-align:center;width:100%;box-sizing:border-box">下载文件</a>
</div>
</body></html>`;
}

export function getAppHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CloudflareShare</title>
<style>${baseStyles()}${appStyles()}</style>
</head>
<body>
<div id="app"></div>
<script>${appScript()}</script>
</body></html>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function baseStyles() {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#fff;color:#000;line-height:1.6}
a{color:#000;text-decoration:underline}
.btn{display:inline-block;padding:10px 20px;background:#000;color:#fff;border:none;cursor:pointer;font-size:14px;text-decoration:none;transition:background .2s}
.btn:hover{background:#333}
.btn-outline{background:#fff;color:#000;border:2px solid #000}
.btn-outline:hover{background:#000;color:#fff}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-danger{background:#fff;color:#000;border:2px solid #000}
.btn-danger:hover{background:#000;color:#fff}
input,select{padding:10px;border:2px solid #000;background:#fff;color:#000;font-size:14px;width:100%}
input:focus{outline:none;box-shadow:2px 2px 0 #000}
`;
}

function appStyles() {
  return `
.container{max-width:960px;margin:0 auto;padding:20px}
header{border-bottom:3px solid #000;padding:16px 0;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
header h1{font-size:22px;letter-spacing:-1px}
nav button{margin-left:8px}
.card{border:2px solid #000;padding:20px;margin-bottom:16px}
.card h3{margin-bottom:12px;font-size:16px;border-bottom:1px solid #ddd;padding-bottom:8px}
table{width:100%;border-collapse:collapse}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #eee;font-size:13px}
th{border-bottom:2px solid #000;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:1px}
.upload-zone{border:3px dashed #000;padding:40px;text-align:center;cursor:pointer;transition:background .2s;margin-bottom:20px}
.upload-zone:hover,.upload-zone.dragover{background:#f0f0f0}
.tab-bar{display:flex;border-bottom:3px solid #000;margin-bottom:24px}
.tab{padding:10px 20px;cursor:pointer;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;border-bottom:3px solid transparent;margin-bottom:-3px}
.tab.active{border-bottom-color:#000}
.tab:hover{background:#f5f5f5}
.progress-bar{height:8px;background:#eee;margin-top:4px}
.progress-bar-fill{height:100%;background:#000;transition:width .3s}
.usage-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.usage-item{padding:12px;border:1px solid #ddd}
.usage-item label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666}
.usage-item .value{font-size:20px;font-weight:700;margin:4px 0}
.toast{position:fixed;top:20px;right:20px;padding:12px 20px;background:#000;color:#fff;font-size:13px;z-index:1000;opacity:0;transition:opacity .3s}
.toast.show{opacity:1}
.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:999}
.modal{background:#fff;border:3px solid #000;padding:32px;max-width:500px;width:90%}
.modal h3{margin-bottom:16px}
.form-group{margin-bottom:16px}
.form-group label{display:block;margin-bottom:4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.share-info{background:#f5f5f5;padding:12px;border:1px solid #ddd;margin-top:8px;font-size:12px;word-break:break-all}
.empty{text-align:center;padding:40px;color:#999}
.login-card{max-width:400px;margin:100px auto;border:3px solid #000;padding:40px}
.login-card h2{margin-bottom:24px;font-size:24px}
`;
}

function appScript() {
  return `
const API = '/api';
let currentTab = 'files';

const app = document.getElementById('app');

function toast(msg, duration=3000) {
  const t = document.createElement('div');
  t.className = 'toast show';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, duration);
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (res.status === 401 && !path.includes('/auth/')) {
    renderLogin();
    throw new Error('Unauthorized');
  }
  return res;
}

function formatSize(b) {
  if (!b) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(b)/Math.log(k));
  return parseFloat((b/Math.pow(k,i)).toFixed(2)) + ' ' + s[i];
}

function formatNum(n) {
  return Number(n||0).toLocaleString();
}

// --- Auth ---
async function checkAuth() {
  try {
    const r = await fetch(API + '/auth/check');
    const d = await r.json();
    if (d.needsSetup) { renderSetup(); return; }
    const r2 = await fetch(API + '/auth/me');
    if (r2.status === 401) { renderLogin(); return; }
    renderApp();
  } catch(e) { renderLogin(); }
}

function renderSetup() {
  app.innerHTML = \`
  <div class="login-card">
    <h2>初始设置</h2>
    <p style="margin-bottom:20px;color:#666;font-size:14px">创建管理员账户</p>
    <div class="form-group"><label>用户名</label><input id="su" type="text" placeholder="admin"></div>
    <div class="form-group"><label>密码 (至少6位)</label><input id="sp" type="password" placeholder="••••••"></div>
    <button class="btn" style="width:100%" onclick="doSetup()">创建账户</button>
  </div>\`;
}

async function doSetup() {
  const u = document.getElementById('su').value;
  const p = document.getElementById('sp').value;
  const r = await api('/auth/setup', { method: 'POST', body: JSON.stringify({username:u,password:p}) });
  const d = await r.json();
  if (d.error) { toast(d.error); return; }
  toast('账户创建成功');
  renderLogin();
}
window.doSetup = doSetup;

function renderLogin() {
  app.innerHTML = \`
  <div class="login-card">
    <h2>CloudflareShare</h2>
    <div class="form-group"><label>用户名</label><input id="lu" type="text" placeholder="用户名"></div>
    <div class="form-group"><label>密码</label><input id="lp" type="password" placeholder="密码" onkeydown="if(event.key==='Enter')doLogin()"></div>
    <button class="btn" style="width:100%" onclick="doLogin()">登录</button>
  </div>\`;
}

async function doLogin() {
  const u = document.getElementById('lu').value;
  const p = document.getElementById('lp').value;
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({username:u,password:p}) });
  const d = await r.json();
  if (d.error) { toast(d.error); return; }
  renderApp();
}
window.doLogin = doLogin;

async function doLogout() {
  await api('/auth/logout', { method: 'POST' });
  renderLogin();
}
window.doLogout = doLogout;

// --- Main App ---
function renderApp() {
  app.innerHTML = \`
  <div class="container">
    <header>
      <h1>CloudflareShare</h1>
      <nav><button class="btn btn-sm btn-outline" onclick="doLogout()">退出</button></nav>
    </header>
    <div class="tab-bar">
      <div class="tab \${currentTab==='files'?'active':''}" onclick="switchTab('files')">文件管理</div>
      <div class="tab \${currentTab==='usage'?'active':''}" onclick="switchTab('usage')">用量统计</div>
      <div class="tab \${currentTab==='limits'?'active':''}" onclick="switchTab('limits')">限额设置</div>
    </div>
    <div id="content"></div>
  </div>\`;
  loadTab();
}

function switchTab(tab) {
  currentTab = tab;
  renderApp();
}
window.switchTab = switchTab;

function loadTab() {
  if (currentTab === 'files') loadFiles();
  else if (currentTab === 'usage') loadUsage();
  else if (currentTab === 'limits') loadLimits();
}

// --- Files ---
async function loadFiles() {
  const c = document.getElementById('content');
  c.innerHTML = \`
  <div class="upload-zone" id="dropzone" onclick="document.getElementById('fileInput').click()">
    <p style="font-size:16px;font-weight:700;margin-bottom:4px">点击或拖拽上传文件</p>
    <p style="font-size:13px;color:#666">支持任意文件类型</p>
    <input type="file" id="fileInput" style="display:none" multiple onchange="uploadFiles(this.files)">
  </div>
  <div id="fileList"><div class="empty">加载中...</div></div>\`;

  const dz = document.getElementById('dropzone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); uploadFiles(e.dataTransfer.files); });

  const r = await api('/files');
  const files = await r.json();
  const fl = document.getElementById('fileList');
  if (!files.length) { fl.innerHTML = '<div class="empty">暂无文件</div>'; return; }

  fl.innerHTML = \`<table>
    <thead><tr><th>文件名</th><th>大小</th><th>上传时间</th><th>分享状态</th><th>操作</th></tr></thead>
    <tbody>\${files.map(f => \`<tr>
      <td>\${esc(f.filename)}</td>
      <td>\${formatSize(f.size)}</td>
      <td>\${f.uploaded_at}</td>
      <td>\${f.share_key ? '<span style="color:#000">●已分享</span>' : '<span style="color:#999">○未分享</span>'}</td>
      <td class="actions">
        <button class="btn btn-sm" onclick="downloadFile('\${f.id}')">下载</button>
        \${f.share_key
          ? \`<button class="btn btn-sm btn-outline" onclick="showShareInfo('\${f.id}','\${f.share_key}')">链接</button>
             <button class="btn btn-sm btn-danger" onclick="unshareFile('\${f.id}')">取消分享</button>\`
          : \`<button class="btn btn-sm btn-outline" onclick="shareFile('\${f.id}')">分享</button>\`}
        <button class="btn btn-sm btn-danger" onclick="deleteFile('\${f.id}')">删除</button>
      </td>
    </tr>\`).join('')}</tbody></table>\`;
}
window.loadFiles = loadFiles;

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function uploadFiles(fileList) {
  for (const file of fileList) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(API + '/files/upload', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.error) { toast('上传失败: ' + d.error); continue; }
      toast('已上传: ' + file.name);
    } catch(e) { toast('上传失败'); }
  }
  loadFiles();
}
window.uploadFiles = uploadFiles;

async function downloadFile(id) {
  window.open(API + '/files/' + id + '/download', '_blank');
}
window.downloadFile = downloadFile;

async function shareFile(id) {
  const r = await api('/files/' + id + '/share', { method: 'POST' });
  const d = await r.json();
  if (d.error) { toast(d.error); return; }
  toast('分享链接已创建');
  loadFiles();
  showShareInfo(id, d.shareKey);
}
window.shareFile = shareFile;

function showShareInfo(id, key) {
  const url = location.origin + '/s/' + id + '?key=' + key;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = \`<div class="modal">
    <h3>分享链接</h3>
    <div class="form-group"><label>完整链接 (含密钥)</label>
    <div class="share-info" id="shareUrl">\${esc(url)}</div></div>
    <div class="form-group"><label>密钥</label>
    <div class="share-info">\${esc(key)}</div></div>
    <div class="actions">
      <button class="btn btn-sm" onclick="navigator.clipboard.writeText('\${url}');toast('已复制')">复制链接</button>
      <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">关闭</button>
    </div>
  </div>\`;
  document.body.appendChild(overlay);
}
window.showShareInfo = showShareInfo;

async function unshareFile(id) {
  if (!confirm('确认取消分享？')) return;
  await api('/files/' + id + '/unshare', { method: 'POST' });
  toast('已取消分享');
  loadFiles();
}
window.unshareFile = unshareFile;

async function deleteFile(id) {
  if (!confirm('确认删除文件？')) return;
  await api('/files/' + id, { method: 'DELETE' });
  toast('已删除');
  loadFiles();
}
window.deleteFile = deleteFile;

// --- Usage ---
async function loadUsage() {
  const r = await api('/usage');
  const d = await r.json();
  const c = document.getElementById('content');
  c.innerHTML = \`
  <div class="card"><h3>今日用量 (\${d.daily.date})</h3>
  <div class="usage-grid">
    \${usageItem('D1 读取', d.daily.d1_reads, d.limits.daily_d1_reads)}
    \${usageItem('D1 写入', d.daily.d1_writes, d.limits.daily_d1_writes)}
    \${usageItem('R2 A类操作', d.daily.r2_class_a, d.limits.daily_r2_class_a)}
    \${usageItem('R2 B类操作', d.daily.r2_class_b, d.limits.daily_r2_class_b)}
  </div></div>
  <div class="card"><h3>本月用量 (\${d.monthly.month})</h3>
  <div class="usage-grid">
    \${usageItem('D1 读取', d.monthly.d1_reads, d.limits.monthly_d1_reads)}
    \${usageItem('D1 写入', d.monthly.d1_writes, d.limits.monthly_d1_writes)}
    \${usageItem('R2 A类操作', d.monthly.r2_class_a, d.limits.monthly_r2_class_a)}
    \${usageItem('R2 B类操作', d.monthly.r2_class_b, d.limits.monthly_r2_class_b)}
    \${usageItem('R2 存储空间', d.monthly.r2_storage_bytes, d.limits.r2_storage_limit_bytes, true)}
  </div></div>\`;
}

function usageItem(label, used, limit, isBytes=false) {
  const pct = limit > 0 ? Math.min(100, (used/limit)*100) : 0;
  const display = isBytes ? formatSize(used) + ' / ' + formatSize(limit) : formatNum(used) + ' / ' + formatNum(limit);
  return \`<div class="usage-item">
    <label>\${label}</label>
    <div class="value">\${display}</div>
    <div class="progress-bar"><div class="progress-bar-fill" style="width:\${pct}%"></div></div>
    <div style="font-size:11px;color:#999;margin-top:2px">\${pct.toFixed(1)}%</div>
  </div>\`;
}

// --- Limits ---
async function loadLimits() {
  const r = await api('/usage');
  const d = await r.json();
  const L = d.limits;
  const c = document.getElementById('content');
  c.innerHTML = \`
  <div class="card"><h3>限额设置</h3>
  <form onsubmit="saveLimits(event)">
    <div class="usage-grid">
      \${limitField('daily_d1_reads', '每日D1读取', L.daily_d1_reads)}
      \${limitField('daily_d1_writes', '每日D1写入', L.daily_d1_writes)}
      \${limitField('monthly_d1_reads', '每月D1读取', L.monthly_d1_reads)}
      \${limitField('monthly_d1_writes', '每月D1写入', L.monthly_d1_writes)}
      \${limitField('daily_r2_class_a', '每日R2 A类', L.daily_r2_class_a)}
      \${limitField('daily_r2_class_b', '每日R2 B类', L.daily_r2_class_b)}
      \${limitField('monthly_r2_class_a', '每月R2 A类', L.monthly_r2_class_a)}
      \${limitField('monthly_r2_class_b', '每月R2 B类', L.monthly_r2_class_b)}
      \${limitField('r2_storage_limit_bytes', 'R2存储限额(字节)', L.r2_storage_limit_bytes)}
    </div>
    <div style="margin-top:16px"><button type="submit" class="btn">保存设置</button></div>
  </form></div>\`;
}

function limitField(name, label, value) {
  return \`<div class="form-group"><label>\${label}</label><input name="\${name}" type="number" value="\${value}"></div>\`;
}

async function saveLimits(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = {};
  for (const [k,v] of fd.entries()) data[k] = parseInt(v);
  const r = await api('/usage/limits', { method: 'PUT', body: JSON.stringify(data) });
  const d = await r.json();
  if (d.error) { toast(d.error); return; }
  toast('设置已保存');
}
window.saveLimits = saveLimits;

// --- Init ---
checkAuth();
`;
}
