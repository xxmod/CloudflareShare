export function getSharePageHTML(file) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>文件分享 - ${escapeHtml(file.filename)}</title>
<style>${baseStyles()}
.share-card{max-width:480px;margin:80px auto;border:2px solid #000;padding:40px;width:90%;box-sizing:border-box}
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
.container{max-width:1360px;margin:0 auto;padding:20px}
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
.table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
.login-card{max-width:400px;margin:100px auto;border:3px solid #000;padding:40px}
.login-card h2{margin-bottom:24px;font-size:24px}
.upload-status{border:2px solid #000;padding:14px;margin:-8px 0 16px;background:#fafafa}
.upload-meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:12px;margin-bottom:8px;color:#444}
.upload-current{font-size:13px;font-weight:700;margin-bottom:8px;word-break:break-all}
.folder-row td{background:#f7f7f7;border-top:2px solid #000;border-bottom:1px solid #eee;font-weight:700}
.folder-name{display:flex;align-items:center;gap:8px}
.folder-toggle{background:none;border:none;font-size:14px;cursor:pointer;color:#000;padding:0}
.folder-path{font-size:12px;color:#666;font-weight:400}
.file-subpath{font-size:12px;color:#666;margin-top:2px}
.file-actions{display:flex;gap:8px;flex-wrap:nowrap;align-items:center}
.share-tree{border:2px solid #000;padding:12px;background:#fff}
.share-tree-item{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid #eee}
.share-tree-item:last-child{border-bottom:none}
.share-tree-path{font-size:13px;font-weight:700;word-break:break-all}
.share-tree-meta{font-size:12px;color:#666;margin-top:2px}
@media(max-width:640px){
.container{padding:12px}
header{flex-wrap:wrap;gap:8px}
header h1{font-size:18px}
nav{display:flex;gap:4px}
nav button{padding:5px 8px;font-size:11px}
.tab-bar{overflow-x:auto;-webkit-overflow-scrolling:touch}
.tab{padding:8px 12px;font-size:11px;white-space:nowrap}
.upload-zone{padding:20px 12px}
.upload-zone p{font-size:13px}
.card{padding:14px}
table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap;max-width:100%}
th,td{padding:6px 8px;font-size:12px}
.file-actions{gap:4px;flex-wrap:wrap}
.file-actions .btn{padding:4px 8px;font-size:11px}
.usage-grid{grid-template-columns:1fr}
.modal{padding:20px;max-width:95vw}
.share-info{font-size:12px !important;letter-spacing:1px !important}
.upload-status{padding:10px}
.upload-meta{font-size:11px;gap:8px}
.upload-current{font-size:12px}
#batchBar{font-size:12px;padding:8px 10px}
}
`;
}

function appScript() {
  return `
const API = '/api';
let currentTab = 'files';
let uploadState = null;
let currentUploadXHR = null;
let uploadCanceled = false;
const expandedFolders = new Set();
const selectedIds = new Set();
let currentFiles = [];
let folderLookup = {};

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
  <div style="max-width:400px;margin:60px auto;padding:20px">
    <h1 style="text-align:center;margin-bottom:8px;font-size:26px;letter-spacing:-1px">CloudflareShare</h1>
    <p style="text-align:center;color:#999;font-size:13px;margin-bottom:32px">文件存储与分享</p>
    <div style="display:flex;flex-direction:column;gap:24px">
      <div class="card">
        <h3 style="margin-bottom:16px">管理员登录</h3>
        <div class="form-group"><label>用户名</label><input id="lu" type="text" placeholder="用户名" autocomplete="username"></div>
        <div class="form-group"><label>密码</label><input id="lp" type="password" placeholder="密码" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()"></div>
        <button class="btn" style="width:100%" onclick="doLogin()">登录</button>
      </div>
      <div class="card">
        <h3 style="margin-bottom:8px">文件下载</h3>
        <p style="font-size:13px;color:#666;margin-bottom:16px">输入分享密钥以查找并下载文件</p>
        <div class="form-group"><label>分享密钥</label><input id="shareKeyInput" type="text" placeholder="输入密钥..." onkeydown="if(event.key==='Enter')lookupKey()"></div>
        <button class="btn btn-outline" style="width:100%" onclick="lookupKey()">查找文件</button>
        <div id="keyResult" style="margin-top:12px"></div>
      </div>
    </div>
  </div>\`;
}

async function lookupKey() {
  const key = document.getElementById('shareKeyInput').value.trim();
  if (!key) { toast('请输入密钥'); return; }
  const r = document.getElementById('keyResult');
  r.innerHTML = '<div style="padding:8px;font-size:13px;color:#999">查找中...</div>';
  try {
    const res = await fetch('/api/share?key=' + encodeURIComponent(key));
    const data = await res.json();
    if (data.error) {
      r.innerHTML = \`<div style="padding:12px;border:1px solid #ddd;color:#666;font-size:13px">\${esc(data.error)}</div>\`;
      return;
    }
    if (data.type === 'folder') {
      r.innerHTML = renderSharedFolderResult(key, data);
      return;
    }
    r.innerHTML = \`<div style="padding:12px;border:2px solid #000">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px">\${esc(data.filename)}</div>
      <div style="font-size:12px;color:#666;margin-bottom:12px">\${formatSize(data.size)}</div>
      <a href="/api/share/download?key=\${encodeURIComponent(key)}" class="btn btn-sm" style="display:inline-block">下载文件</a>
    </div>\`;
  } catch(e) { r.innerHTML = '<div style="padding:12px;border:1px solid #ddd;color:#666;font-size:13px">查找失败</div>'; }
}
window.lookupKey = lookupKey;

function renderSharedFolderResult(key, data) {
  return \`<div style="padding:12px;border:2px solid #000">
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">文件夹：\${esc(data.folderName || '未命名文件夹')}</div>
    <div style="font-size:12px;color:#666;margin-bottom:12px">\${data.files.length} 个文件</div>
    <div class="share-tree">\${data.files.map(file => \`<div class="share-tree-item">
      <div>
        <div class="share-tree-path">\${esc(getShareDisplayPath(file, data.folderName))}</div>
        <div class="share-tree-meta">\${formatSize(file.size)}</div>
      </div>
      <a href="/api/share/download?key=\${encodeURIComponent(key)}&id=\${encodeURIComponent(file.id)}" class="btn btn-sm">下载</a>
    </div>\`).join('')}</div>
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
      <nav>
        <button class="btn btn-sm btn-outline" onclick="showPasswordModal()">修改密码</button>
        <button class="btn btn-sm btn-outline" onclick="doLogout()">退出</button>
      </nav>
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
  <div class="upload-zone" id="dropzone" style="cursor:default">
    <p style="font-size:15px;font-weight:700;margin-bottom:4px">拖拽文件到此处上传</p>
    <p style="font-size:12px;color:#666;margin-bottom:12px">或使用按钮选择文件 / 文件夹</p>
    <div style="display:flex;gap:8px;justify-content:center">
      <label class="btn btn-sm" style="cursor:pointer">选择文件<input type="file" id="fileInput" style="display:none" multiple accept="*/*" onchange="uploadFiles(this.files, false)"></label>
      <label class="btn btn-sm btn-outline" style="cursor:pointer">上传文件夹<input type="file" id="folderInput" style="display:none" webkitdirectory accept="*/*" onchange="uploadFiles(this.files, true)"></label>
    </div>
  </div>
  <div id="uploadStatus"></div>
  <div id="batchBar" style="display:none;margin-bottom:10px;padding:10px 14px;border:2px solid #000;align-items:center;gap:8px;flex-wrap:wrap">
    <span id="batchCount" style="font-size:13px;font-weight:700;margin-right:4px"></span>
    <button class="btn btn-sm btn-outline" onclick="batchShare()">批量分享</button>
    <button class="btn btn-sm btn-outline" onclick="batchUnshare()">批量取消分享</button>
    <button class="btn btn-sm btn-outline" onclick="batchMoveToFolder()">移入文件夹</button>
    <button class="btn btn-sm btn-danger" onclick="batchDelete()">批量删除</button>
    <button class="btn btn-sm" style="margin-left:auto" onclick="clearSelect()">取消全选</button>
  </div>
  <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn btn-sm btn-outline" onclick="showCreateFolderModal()">+ 新建文件夹</button>
  </div>
  <div id="fileList"><div class="empty">加载中...</div></div>\`;

  const dz = document.getElementById('dropzone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); uploadFiles(e.dataTransfer.files, false); });

  renderUploadStatus();

  const r = await api('/files');
  const files = await r.json();
  currentFiles = files;
  const fl = document.getElementById('fileList');
  if (!files.length) { fl.innerHTML = '<div class="empty">暂无文件</div>'; return; }

  fl.innerHTML = renderFileTable(files);
  updateBatch();
}
window.loadFiles = loadFiles;

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

window.cancelUpload = function() {
  if (!uploadState || !uploadState.active) return;
  uploadCanceled = true;
  setUploadState({
    ...uploadState,
    currentFile: '正在取消上传...',
  });
  if (currentUploadXHR) {
    currentUploadXHR.abort();
  }
};

async function uploadFiles(fileList, isFolder = false) {
  if (uploadState && uploadState.active) {
    toast('已有上传任务进行中');
    return;
  }
  const files = Array.from(fileList);
  if (!files.length) return;
  const folderName = isFolder ? getFolderRoot(files) : null;
  const folderId = isFolder ? crypto.randomUUID() : null;
  const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
  let done = 0;
  let failed = 0;
  let uploadedBytes = 0;

  uploadCanceled = false;

  setUploadState({
    active: true,
    mode: isFolder ? 'folder' : 'files',
    label: isFolder ? folderName : '文件上传',
    totalFiles: files.length,
    completedFiles: 0,
    successFiles: 0,
    failedFiles: 0,
    totalBytes,
    uploadedBytes: 0,
    currentFile: files[0].webkitRelativePath || files[0].name,
    currentPercent: 0,
  });

  for (const file of files) {
    if (uploadCanceled) break;
    const relativePath = file.webkitRelativePath || file.name;

    try {
      const data = await uploadSingleFile(file, {
        folderName,
        relativePath,
        folderId,
        isFolder,
      }, loaded => {
        if (uploadCanceled) return;
        setUploadState({
          active: true,
          mode: isFolder ? 'folder' : 'files',
          label: isFolder ? folderName : '文件上传',
          totalFiles: files.length,
          completedFiles: done + failed,
          successFiles: done,
          failedFiles: failed,
          totalBytes,
          uploadedBytes: uploadedBytes + loaded,
          currentFile: relativePath,
          currentPercent: file.size ? Math.min(100, loaded / file.size * 100) : 100,
        });
      });
      if (uploadCanceled) break;
      if (data.error) failed++;
      else done++;
    } catch (e) {
      if (uploadCanceled || e.message === 'Upload canceled') break;
      failed++;
    }

    if (uploadCanceled) break;

    uploadedBytes += file.size || 0;
    setUploadState({
      active: true,
      mode: isFolder ? 'folder' : 'files',
      label: isFolder ? folderName : '文件上传',
      totalFiles: files.length,
      completedFiles: done + failed,
      successFiles: done,
      failedFiles: failed,
      totalBytes,
      uploadedBytes,
      currentFile: relativePath,
      currentPercent: 100,
    });
  }

  setUploadState({
    active: false,
    mode: isFolder ? 'folder' : 'files',
    label: isFolder ? folderName : '文件上传',
    totalFiles: files.length,
    completedFiles: done + failed,
    successFiles: done,
    failedFiles: failed,
    totalBytes,
    uploadedBytes,
    currentFile: uploadCanceled ? '已取消上传' : (failed ? '部分文件上传失败' : '上传完成'),
    currentPercent: 100,
  });

  const input = document.getElementById(isFolder ? 'folderInput' : 'fileInput');
  if (input) input.value = '';
  currentUploadXHR = null;
  
  if (uploadCanceled) toast('上传已取消');
  else toast(files.length === 1 ? (done ? \`已上传：\${files[0].name}\` : '上传失败') : \`上传完成：\${done} 成功，\${failed} 失败\`);
  
  setTimeout(() => {
    if (uploadState && !uploadState.active) {
      uploadState = null;
      renderUploadStatus();
    }
  }, 5000);
  loadFiles();
}
window.uploadFiles = uploadFiles;

function uploadSingleFile(file, meta, onProgress) {
  return new Promise(async (resolve, reject) => {
    let uploadInfo;
    try {
      const initRes = await api('/files/upload/direct/init', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
          folderName: meta?.folderName || null,
          relativePath: meta?.relativePath || null,
          folderId: meta?.folderId || null,
        }),
      });
      uploadInfo = await initRes.json();
      if (!initRes.ok || uploadInfo.error) {
        reject(new Error(uploadInfo.error || 'Upload initialization failed'));
        return;
      }
    } catch (error) {
      reject(error);
      return;
    }

    const xhr = new XMLHttpRequest();
    currentUploadXHR = xhr;
    xhr.open('PUT', uploadInfo.uploadUrl);
    xhr.upload.onprogress = event => {
      if (uploadCanceled) { xhr.abort(); return; }
      if (event.lengthComputable) onProgress(event.loaded);
    };
    xhr.onload = async () => {
      currentUploadXHR = null;
      if (uploadCanceled) {
        reject(new Error('Upload canceled'));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error('Direct upload failed'));
        return;
      }

      try {
        const completeRes = await api('/files/upload/direct/complete', {
          method: 'POST',
          body: JSON.stringify({
            id: uploadInfo.id,
            r2Key: uploadInfo.r2Key,
            filename: uploadInfo.filename,
            size: uploadInfo.size,
            contentType: uploadInfo.contentType,
            folderName: uploadInfo.folderName,
            relativePath: uploadInfo.relativePath,
            folderId: uploadInfo.folderId,
          }),
        });
        const data = await completeRes.json();
        if (!completeRes.ok || data.error) {
          reject(new Error(data.error || 'Upload finalize failed'));
          return;
        }
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => {
      currentUploadXHR = null;
      reject(new Error('Upload failed'));
    };
    xhr.onabort = () => {
      currentUploadXHR = null;
      reject(new Error('Upload canceled'));
    };
    xhr.send(file);
  });
}

function getFolderRoot(files) {
  const firstPath = files[0]?.webkitRelativePath || '';
  return firstPath.split('/')[0] || 'folder';
}

function setUploadState(next) {
  uploadState = next;
  renderUploadStatus();
}

function renderUploadStatus() {
  const el = document.getElementById('uploadStatus');
  if (!el) return;
  if (!uploadState) {
    el.innerHTML = '';
    return;
  }

  const overallPercent = uploadState.totalBytes
    ? Math.min(100, uploadState.uploadedBytes / uploadState.totalBytes * 100)
    : 100;

  if (!el.querySelector('.upload-status')) {
    el.innerHTML = '<div class="upload-status">'
      + '<div class="upload-meta">'
      + '<span id="uploadLabel"></span>'
      + '<span id="uploadMode"></span>'
      + '<span id="uploadCount"></span>'
      + '<span id="uploadResult"></span>'
      + '</div>'
      + '<div class="upload-current" id="uploadCurrent"></div>'
      + '<div class="progress-bar"><div class="progress-bar-fill" id="uploadProgressFill"></div></div>'
      + '<div class="upload-meta" style="margin-top:8px;margin-bottom:0">'
      + '<span id="uploadOverall"></span>'
      + '<span id="uploadCurrentPercent"></span>'
      + '<span id="uploadBytes"></span>'
      + '</div>'
      + '<button id="uploadCancelBtn" class="btn btn-sm btn-outline" style="margin-top:12px;width:100%">取消上传</button>'
      + '</div>';
    el.querySelector('#uploadCancelBtn')?.addEventListener('click', () => window.cancelUpload());
  }

  el.querySelector('#uploadLabel').textContent = '目标：' + (uploadState.label || '');
  el.querySelector('#uploadMode').textContent = '模式：' + (uploadState.mode === 'folder' ? '文件夹上传' : '文件上传');
  el.querySelector('#uploadCount').textContent = '进度：' + uploadState.completedFiles + '/' + uploadState.totalFiles;
  el.querySelector('#uploadResult').textContent = '结果：' + uploadState.successFiles + ' 成功 / ' + uploadState.failedFiles + ' 失败';
  el.querySelector('#uploadCurrent').textContent = '当前：' + (uploadState.currentFile || '');
  el.querySelector('#uploadProgressFill').style.width = overallPercent + '%';
  el.querySelector('#uploadOverall').textContent = '总进度：' + overallPercent.toFixed(1) + '%';
  el.querySelector('#uploadCurrentPercent').textContent = '当前文件：' + (uploadState.currentPercent || 0).toFixed(1) + '%';
  el.querySelector('#uploadBytes').textContent = '已上传：' + formatSize(uploadState.uploadedBytes) + ' / ' + formatSize(uploadState.totalBytes);

  const cancelBtn = el.querySelector('#uploadCancelBtn');
  if (cancelBtn) {
    cancelBtn.style.display = uploadState.active ? 'block' : 'none';
    cancelBtn.disabled = uploadCanceled || !currentUploadXHR;
    cancelBtn.textContent = uploadCanceled ? '正在取消...' : '取消上传';
  }
}

function renderFileTable(files) {
  const grouped = groupFiles(files);
  folderLookup = Object.fromEntries(grouped.folders.map(folder => [folder.encodedKey, folder]));
  const rows = [];

  for (const folder of grouped.folders) {
    rows.push(renderFolderRow(folder));
    if (expandedFolders.has(folder.encodedKey)) {
      rows.push(folder.files.map(file => renderFileRow(file, true, folder.name)).join(''));
    }
  }

  if (grouped.files.length) {
    rows.push(grouped.files.map(file => renderFileRow(file, false)).join(''));
  }

  return \`<div class="table-wrap"><table>
    <thead><tr>
      <th style="width:32px"><input type="checkbox" id="selectAll" onchange="toggleSelectAll(this.checked)"></th>
      <th>文件 / 文件夹</th><th>大小</th><th>上传时间</th><th>分享状态</th><th>操作</th>
    </tr></thead>
    <tbody>\${rows.join('')}</tbody></table></div>\`;
}

function groupFiles(files) {
  const folders = new Map();
  const normalFiles = [];

  for (const file of files) {
    if (file.folder_name) {
      const groupKey = file.folder_id || 'legacy:' + file.folder_name;
      const encodedKey = encodeURIComponent(groupKey);
      if (!folders.has(groupKey)) {
        folders.set(groupKey, {
          key: groupKey,
          encodedKey,
          name: file.folder_name,
          folderId: file.folder_id,
          files: [],
          totalSize: 0,
          folderShareKey: null,
        });
      }
      const folder = folders.get(groupKey);
      folder.files.push(file);
      folder.totalSize += Number(file.size || 0);
      if (file.folder_share_key) folder.folderShareKey = file.folder_share_key;
    } else {
      normalFiles.push(file);
    }
  }

  return {
    folders: [...folders.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    files: normalFiles,
  };
}

function renderFolderRow(folder) {
  const encoded = folder.encodedKey;
  const count = folder.files.filter(file => selectedIds.has(file.id)).length;
  const allSelected = count > 0 && count === folder.files.length;
  const partialSelected = count > 0 && count < folder.files.length;
  return \`<tr class="folder-row">
    <td><input type="checkbox" class="folder-check" data-folder="\${encoded}" onchange="toggleFolderSelection('\${encoded}', this.checked)" \${allSelected ? 'checked' : ''} \${partialSelected ? 'data-partial="1"' : ''}></td>
    <td>
      <div class="folder-name">
        <button class="folder-toggle" onclick="toggleFolderCollapse('\${encoded}')">\${expandedFolders.has(encoded) ? '▾' : '▸'}</button>
        <span>文件夹：\${esc(folder.name)}</span>
      </div>
      <div class="folder-path">\${folder.files.length} 个文件</div>
    </td>
    <td>\${formatSize(folder.totalSize)}</td>
    <td>\${folder.files[0]?.uploaded_at || '-'}</td>
    <td>\${folder.folderShareKey ? '<span style="color:#000">●文件夹已分享</span>' : '<span style="color:#666">○未分享</span>'}</td>
    <td><div class="file-actions">
      <button class="btn btn-sm btn-outline" onclick="toggleFolderSelection('\${encoded}', true)">选择</button>
      <button class="btn btn-sm btn-outline" onclick="showRenameFolderModal('\${encoded}')">重命名</button>
      \${folder.folderShareKey
        ? \`<button class="btn btn-sm btn-outline" onclick="showFolderShareInfo('\${encoded}')">分享信息</button>
           <button class="btn btn-sm btn-danger" onclick="unshareFolder('\${encoded}')">取消分享</button>\`
        : \`<button class="btn btn-sm btn-outline" onclick="shareFolder('\${encoded}')">分享文件夹</button>\`}
      <button class="btn btn-sm btn-danger" onclick="deleteFolder('\${encoded}')">删除文件夹</button>
    </div></td>
  </tr>\`;
}

function renderFileRow(file, isNested, folderName) {
  const encodedFolder = file.folder_name ? encodeURIComponent(file.folder_id || 'legacy:' + file.folder_name) : '';
  const subpath = isNested ? getFolderSubpath(file, folderName) : '';
  return \`<tr>
    <td><input type="checkbox" class="file-check" data-id="\${file.id}" data-folder="\${encodedFolder}" onchange="setFileSelection('\${file.id}', this.checked)" \${selectedIds.has(file.id) ? 'checked' : ''}></td>
    <td>
      <div>\${esc(file.filename)}</div>
      \${subpath ? \`<div class="file-subpath">\${esc(subpath)}</div>\` : ''}
    </td>
    <td>\${formatSize(file.size)}</td>
    <td>\${file.uploaded_at}</td>
    <td>\${file.share_key ? '<span style="color:#000">●已分享</span>' : file.folder_share_key ? '<span style="color:#666">◐文件夹已分享</span>' : '<span style="color:#999">○未分享</span>'}</td>
    <td><div class="file-actions">
      <button class="btn btn-sm" onclick="downloadFile('\${file.id}')">下载</button>
      <button class="btn btn-sm btn-outline" onclick="showRenameFileModal('\${file.id}','\${esc(file.filename).replace(/'/g, "\\\\'")}')">重命名</button>
      \${file.share_key
        ? \`<button class="btn btn-sm btn-outline" onclick="showShareInfo('\${file.id}','\${file.share_key}')">分享信息</button>
           <button class="btn btn-sm btn-danger" onclick="unshareFile('\${file.id}')">取消分享</button>\`
        : \`<button class="btn btn-sm btn-outline" onclick="shareFile('\${file.id}')">分享</button>\`}
      \${!isNested ? \`<button class="btn btn-sm btn-outline" onclick="showMoveFileModal('\${file.id}')">移入文件夹</button>\` : \`<button class="btn btn-sm btn-outline" onclick="removeFromFolder(['\${file.id}'])">移出</button>\`}
      <button class="btn btn-sm btn-danger" onclick="deleteFile('\${file.id}')">删除</button>
    </div></td>
  </tr>\`;
}

function getFolderSubpath(file, folderName) {
  if (!file.relative_path) return '';
  const prefix = folderName + '/';
  return file.relative_path.startsWith(prefix) ? file.relative_path.slice(prefix.length) : file.relative_path;
}

async function downloadFile(id) {
  window.open(API + '/files/' + id + '/download', '_blank');
}
window.downloadFile = downloadFile;

async function shareFile(id) {
  showCustomKeyModal('分享文件', async (customKey) => {
    const r = await api('/files/' + id + '/share', { method: 'POST', body: JSON.stringify({ customKey: customKey || undefined }) });
    const d = await r.json();
    if (d.error) { toast(d.error); return; }
    toast('分享链接已创建');
    loadFiles();
    showShareInfo(id, d.shareKey);
  });
}
window.shareFile = shareFile;

function showShareInfo(id, key) {
  const shareLink = location.origin + '/s/' + id + '?key=' + encodeURIComponent(key);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = \`<div class="modal">
    <h3>分享信息</h3>
    <div class="form-group"><label>密钥</label>
    <div class="share-info" style="font-size:20px;font-weight:700;letter-spacing:3px">\${esc(key)}</div>
    <button class="btn btn-sm" style="margin-top:8px" onclick="navigator.clipboard.writeText('\${key}');toast('密钥已复制')">复制密钥</button>
    </div>
    <div class="form-group"><label>分享链接（含密钥）</label>
    <div class="share-info">\${esc(shareLink)}</div>
    <button class="btn btn-sm" style="margin-top:8px" onclick="navigator.clipboard.writeText('\${shareLink}');toast('链接已复制')">复制链接</button>
    </div>
    <div class="actions" style="margin-top:4px">
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

// --- Batch operations ---
function getSelectedIds() {
  return [...selectedIds];
}

function setFileSelection(id, checked) {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateBatch();
}
window.setFileSelection = setFileSelection;

function updateBatch() {
  const ids = getSelectedIds();
  const bar = document.getElementById('batchBar');
  if (!bar) return;
  bar.style.display = ids.length > 0 ? 'flex' : 'none';
  const ct = document.getElementById('batchCount');
  if (ct) ct.textContent = ids.length + ' 个文件已选';
  const sa = document.getElementById('selectAll');
  if (sa) {
    sa.indeterminate = ids.length > 0 && ids.length < currentFiles.length;
    sa.checked = currentFiles.length > 0 && ids.length === currentFiles.length;
  }

  document.querySelectorAll('.file-check').forEach(input => {
    input.checked = selectedIds.has(input.dataset.id);
  });

  document.querySelectorAll('.folder-check').forEach(folderCheck => {
    const folder = folderLookup[folderCheck.dataset.folder];
    const checked = folder ? folder.files.filter(file => selectedIds.has(file.id)).length : 0;
    const total = folder ? folder.files.length : 0;
    folderCheck.indeterminate = checked > 0 && checked < total;
    folderCheck.checked = total > 0 && checked === total;
  });
}
window.updateBatch = updateBatch;

function toggleSelectAll(checked) {
  selectedIds.clear();
  if (checked) currentFiles.forEach(file => selectedIds.add(file.id));
  updateBatch();
}
window.toggleSelectAll = toggleSelectAll;

function clearSelect() {
  const sa = document.getElementById('selectAll');
  if (sa) sa.checked = false;
  selectedIds.clear();
  updateBatch();
}
window.clearSelect = clearSelect;

function toggleFolderCollapse(encodedFolder) {
  if (expandedFolders.has(encodedFolder)) expandedFolders.delete(encodedFolder);
  else expandedFolders.add(encodedFolder);
  loadFiles();
}
window.toggleFolderCollapse = toggleFolderCollapse;

function toggleFolderSelection(encodedFolder, checked) {
  const folder = folderLookup[encodedFolder];
  if (!folder) return;
  folder.files.forEach(file => {
    if (checked) selectedIds.add(file.id);
    else selectedIds.delete(file.id);
  });
  updateBatch();
}
window.toggleFolderSelection = toggleFolderSelection;

function getFolderIds(encodedFolder) {
  return folderLookup[encodedFolder]?.files.map(file => file.id) || [];
}

async function shareFolder(encodedFolder) {
  const folder = folderLookup[encodedFolder];
  if (!folder) return;
  showCustomKeyModal('分享文件夹', async (customKey) => {
    const r = await api('/folders/share', {
      method: 'POST',
      body: JSON.stringify({ folderId: folder.folderId, folderName: folder.name, customKey: customKey || undefined }),
    });
    const d = await r.json();
    if (d.error) { toast(d.error); return; }
    toast('文件夹分享已创建');
    loadFiles();
    showFolderShareModal(folder.name, d.shareKey, d.fileCount);
  });
}
window.shareFolder = shareFolder;

async function unshareFolder(encodedFolder) {
  const folder = folderLookup[encodedFolder];
  if (!folder) return;
  if (!confirm('确认取消该文件夹的分享？')) return;
  const r = await api('/folders/unshare', {
    method: 'POST',
    body: JSON.stringify({ folderId: folder.folderId, folderName: folder.name }),
  });
  const d = await r.json();
  if (d.error) { toast(d.error); return; }
  toast('文件夹分享已取消');
  loadFiles();
}
window.unshareFolder = unshareFolder;

function showFolderShareInfo(encodedFolder) {
  const folder = folderLookup[encodedFolder];
  if (!folder?.folderShareKey) return;
  showFolderShareModal(folder.name, folder.folderShareKey, folder.files.length);
}
window.showFolderShareInfo = showFolderShareInfo;

function showFolderShareModal(folderName, key, fileCount) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = \`<div class="modal">
    <h3>文件夹分享信息</h3>
    <p style="font-size:13px;color:#666;margin-bottom:16px">对方在首页输入该密钥后，可以查看“\${esc(folderName)}”的目录结构并按需下载其中的文件。</p>
    <div class="form-group"><label>文件夹</label><div class="share-info">\${esc(folderName)}（\${fileCount} 个文件）</div></div>
    <div class="form-group"><label>分享密钥</label><div class="share-info" style="font-size:20px;font-weight:700;letter-spacing:3px">\${esc(key)}</div></div>
    <div class="actions">
      <button class="btn btn-sm" onclick="navigator.clipboard.writeText('\${key}');toast('密钥已复制')">复制密钥</button>
      <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">关闭</button>
    </div>
  </div>\`;
  document.body.appendChild(overlay);
}

async function deleteFolder(encodedFolder) {
  const ids = getFolderIds(encodedFolder);
  if (!ids.length) return;
  if (!confirm(\`确认删除该文件夹中的 \${ids.length} 个文件？\`)) return;
  const r = await api('/files/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) });
  const d = await r.json();
  toast(\`已删除 \${d.deleted} 个文件\`);
  loadFiles();
}
window.deleteFolder = deleteFolder;

function getShareDisplayPath(file, folderName) {
  if (!file.relative_path) return file.filename;
  const prefix = (folderName || '') + '/';
  return file.relative_path.startsWith(prefix) ? file.relative_path.slice(prefix.length) : file.relative_path;
}

async function batchDelete() {
  const ids = getSelectedIds();
  if (!ids.length) return;
  if (!confirm(\`确认删除 \${ids.length} 个文件？\`)) return;
  const r = await api('/files/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) });
  const d = await r.json();
  toast(\`已删除 \${d.deleted} 个文件\`);
  loadFiles();
}
window.batchDelete = batchDelete;

async function batchShare() {
  const ids = getSelectedIds();
  if (!ids.length) return;
  showCustomKeyModal('批量分享', async (customKey) => {
    const r = await api('/files/batch-share', { method: 'POST', body: JSON.stringify({ ids, customKey: customKey || undefined }) });
    const d = await r.json();
    if (d.error) { toast(d.error); return; }
    toast(\`已为 \${d.shared} 个文件创建分享\`);
    loadFiles();
  });
}
window.batchShare = batchShare;

async function batchUnshare() {
  const ids = getSelectedIds();
  if (!ids.length) return;
  if (!confirm(\`确认取消 \${ids.length} 个文件的分享？\`)) return;
  const r = await api('/files/batch-unshare', { method: 'POST', body: JSON.stringify({ ids }) });
  const d = await r.json();
  toast(\`已取消 \${d.unshared} 个文件的分享\`);
  loadFiles();
}
window.batchUnshare = batchUnshare;

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

function showPasswordModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = \`<div class="modal">
    <h3>修改密码</h3>
    <div class="form-group"><label>当前密码</label><input id="cpOld" type="password" autocomplete="current-password"></div>
    <div class="form-group"><label>新密码</label><input id="cpNew" type="password" autocomplete="new-password"></div>
    <div class="form-group"><label>确认新密码</label><input id="cpConfirm" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')submitPasswordChange()"></div>
    <div class="actions">
      <button class="btn btn-sm" onclick="submitPasswordChange()">确认修改</button>
      <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button>
    </div>
  </div>\`;
  document.body.appendChild(overlay);
}
window.showPasswordModal = showPasswordModal;

async function submitPasswordChange() {
  const currentPassword = document.getElementById('cpOld')?.value || '';
  const newPassword = document.getElementById('cpNew')?.value || '';
  const confirmPassword = document.getElementById('cpConfirm')?.value || '';
  if (!currentPassword || !newPassword) { toast('请填写完整密码信息'); return; }
  if (newPassword !== confirmPassword) { toast('两次输入的新密码不一致'); return; }
  const r = await api('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const d = await r.json();
  if (d.error) { toast(d.error); return; }
  document.querySelector('.modal-overlay')?.remove();
  toast('密码已修改，请重新登录');
  renderLogin();
}
window.submitPasswordChange = submitPasswordChange;

// --- Custom key modal ---
function showCustomKeyModal(title, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = \`<div class="modal">
    <h3>\${esc(title)}</h3>
    <div class="form-group">
      <label>自定义密钥（可选）</label>
      <input id="ckInput" type="text" placeholder="留空自动生成，仅支持字母数字_-，2-64位" maxlength="64">
      <div style="font-size:11px;color:#999;margin-top:4px">支持字母、数字、下划线、横线。留空则自动生成随机密钥。</div>
    </div>
    <div class="actions">
      <button class="btn btn-sm" id="ckConfirmBtn">确认分享</button>
      <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button>
    </div>
  </div>\`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#ckInput');
  input.focus();
  const confirmBtn = overlay.querySelector('#ckConfirmBtn');
  const doConfirm = () => {
    const val = input.value.trim();
    if (val && !/^[a-zA-Z0-9_\\-]{2,64}$/.test(val)) {
      toast('密钥只能包含字母、数字、下划线和横线，长度2-64位');
      return;
    }
    overlay.remove();
    onConfirm(val || null);
  };
  confirmBtn.onclick = doConfirm;
  input.onkeydown = e => { if (e.key === 'Enter') doConfirm(); };
}

// --- Rename modals ---
function showRenameFileModal(id, currentName) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = \`<div class="modal">
    <h3>重命名文件</h3>
    <div class="form-group"><label>新文件名</label><input id="rfInput" type="text" value="\${esc(currentName)}"></div>
    <div class="actions">
      <button class="btn btn-sm" id="rfConfirmBtn">确认</button>
      <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button>
    </div>
  </div>\`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#rfInput');
  input.focus();
  input.select();
  const doConfirm = async () => {
    const val = input.value.trim();
    if (!val) { toast('文件名不能为空'); return; }
    const r = await api('/files/' + id + '/rename', { method: 'POST', body: JSON.stringify({ newName: val }) });
    const d = await r.json();
    if (d.error) { toast(d.error); return; }
    overlay.remove();
    toast('已重命名');
    loadFiles();
  };
  overlay.querySelector('#rfConfirmBtn').onclick = doConfirm;
  input.onkeydown = e => { if (e.key === 'Enter') doConfirm(); };
}
window.showRenameFileModal = showRenameFileModal;

function showRenameFolderModal(encodedFolder) {
  const folder = folderLookup[encodedFolder];
  if (!folder) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = \`<div class="modal">
    <h3>重命名文件夹</h3>
    <div class="form-group"><label>新文件夹名</label><input id="rfdInput" type="text" value="\${esc(folder.name)}"></div>
    <div class="actions">
      <button class="btn btn-sm" id="rfdConfirmBtn">确认</button>
      <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button>
    </div>
  </div>\`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#rfdInput');
  input.focus();
  input.select();
  const doConfirm = async () => {
    const val = input.value.trim();
    if (!val) { toast('文件夹名不能为空'); return; }
    const r = await api('/folders/rename', { method: 'POST', body: JSON.stringify({ folderId: folder.folderId, folderName: folder.name, newName: val }) });
    const d = await r.json();
    if (d.error) { toast(d.error); return; }
    overlay.remove();
    toast('已重命名');
    loadFiles();
  };
  overlay.querySelector('#rfdConfirmBtn').onclick = doConfirm;
  input.onkeydown = e => { if (e.key === 'Enter') doConfirm(); };
}
window.showRenameFolderModal = showRenameFolderModal;

// --- Create folder ---
function showCreateFolderModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = \`<div class="modal">
    <h3>新建文件夹</h3>
    <div class="form-group"><label>文件夹名称</label><input id="cfInput" type="text" placeholder="输入文件夹名称"></div>
    <div class="actions">
      <button class="btn btn-sm" id="cfConfirmBtn">创建</button>
      <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button>
    </div>
  </div>\`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#cfInput');
  input.focus();
  const doConfirm = async () => {
    const val = input.value.trim();
    if (!val) { toast('文件夹名不能为空'); return; }
    const r = await api('/folders/create', { method: 'POST', body: JSON.stringify({ name: val }) });
    const d = await r.json();
    if (d.error) { toast(d.error); return; }
    overlay.remove();
    toast('文件夹已创建');
    loadFiles();
  };
  overlay.querySelector('#cfConfirmBtn').onclick = doConfirm;
  input.onkeydown = e => { if (e.key === 'Enter') doConfirm(); };
}
window.showCreateFolderModal = showCreateFolderModal;

// --- Move to folder ---
function showMoveFileModal(fileId) {
  showMoveModal([fileId]);
}
window.showMoveFileModal = showMoveFileModal;

function batchMoveToFolder() {
  const ids = getSelectedIds();
  if (!ids.length) return;
  showMoveModal(ids);
}
window.batchMoveToFolder = batchMoveToFolder;

function showMoveModal(fileIds) {
  const folders = Object.values(folderLookup);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  let folderOptions = folders.map(f =>
    \`<div style="padding:8px 12px;border:1px solid #ddd;margin-bottom:4px;cursor:pointer;font-size:13px" class="move-opt" data-fid="\${esc(f.folderId || '')}" data-fname="\${esc(f.name)}">\${esc(f.name)} (\${f.files.length} 个文件)</div>\`
  ).join('');
  if (!folders.length) folderOptions = '<div style="padding:12px;color:#999;font-size:13px">暂无文件夹，请先创建</div>';
  overlay.innerHTML = \`<div class="modal">
    <h3>移入文件夹</h3>
    <p style="font-size:13px;color:#666;margin-bottom:12px">选择目标文件夹（\${fileIds.length} 个文件）</p>
    <div style="max-height:300px;overflow-y:auto;margin-bottom:16px">\${folderOptions}</div>
    <div class="actions">
      <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button>
    </div>
  </div>\`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.move-opt').forEach(el => {
    el.onmouseover = () => el.style.background = '#f0f0f0';
    el.onmouseout = () => el.style.background = '';
    el.onclick = async () => {
      const fid = el.dataset.fid;
      const fname = el.dataset.fname;
      const r = await api('/files/move', { method: 'POST', body: JSON.stringify({ fileIds, targetFolderId: fid || undefined, targetFolderName: fname }) });
      const d = await r.json();
      if (d.error) { toast(d.error); return; }
      overlay.remove();
      toast(\`已移动 \${d.moved} 个文件\`);
      selectedIds.clear();
      loadFiles();
    };
  });
}

async function removeFromFolder(fileIds) {
  if (!confirm(\`确认将 \${fileIds.length} 个文件移出文件夹？\`)) return;
  const r = await api('/files/remove-from-folder', { method: 'POST', body: JSON.stringify({ fileIds }) });
  const d = await r.json();
  if (d.error) { toast(d.error); return; }
  toast(\`已移出 \${d.moved} 个文件\`);
  loadFiles();
}
window.removeFromFolder = removeFromFolder;

// --- Init ---
checkAuth();
`;
}
