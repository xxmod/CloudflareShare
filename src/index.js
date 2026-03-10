import { json, error } from './utils.js';
import { authenticate, requireAuth, handleLogin, handleLogout, handleSetup, handleCheckSetup } from './auth.js';
import { handleUpload, handleListFiles, handleDeleteFile, handleShare, handleUnshare, handleDownload, handleGetByShareKey, handleDownloadByShareKey, handleBatchDelete, handleBatchShare, handleBatchUnshare } from './files.js';
import { getUsageStats, updateLimits } from './usage.js';
import { getAppHTML, getSharePageHTML } from './frontend.js';
import { migrate } from './migrate.js';

export default {
  async fetch(request, env) {
    await migrate(env.DB);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // --- Public share page: /s/:id?key=xxx ---
      if (path.match(/^\/s\/[0-9a-f-]{36}$/)) {
        const fileId = path.split('/')[2];
        const key = url.searchParams.get('key');
        if (!key) {
          return new Response(keyInputPageHTML(fileId), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        const file = await env.DB.prepare(
          'SELECT id, filename, size, content_type, share_key FROM files WHERE id = ? AND share_key = ?'
        ).bind(fileId, key).first();
        if (!file) return error('File not found or invalid key', 404);
        return new Response(getSharePageHTML(file), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      // --- Public key-based share API (no auth) ---
      if (path === '/api/share' && method === 'GET') {
        return handleGetByShareKey(url.searchParams.get('key'), env);
      }
      if (path === '/api/share/download' && method === 'GET') {
        return handleDownloadByShareKey(url.searchParams.get('key'), env);
      }

      // --- API routes ---
      if (path.startsWith('/api/')) {
        // Auth routes (no auth required)
        if (path === '/api/auth/check' && method === 'GET') return handleCheckSetup(env);
        if (path === '/api/auth/setup' && method === 'POST') return handleSetup(request, env);
        if (path === '/api/auth/login' && method === 'POST') return handleLogin(request, env);
        if (path === '/api/auth/logout' && method === 'POST') return handleLogout(request, env);
        if (path === '/api/auth/me' && method === 'GET') {
          const token = await authenticate(request, env);
          return token ? json({ ok: true }) : error('Unauthorized', 401);
        }

        // Public file download with key
        const dlMatch = path.match(/^\/api\/files\/([0-9a-f-]{36})\/download$/);
        if (dlMatch && method === 'GET') {
          const key = url.searchParams.get('key');
          if (key) {
            return handleDownload(dlMatch[1], env, true, key);
          }
          // Auth required for non-key downloads
          const authErr = await requireAuth(request, env);
          if (authErr) return authErr;
          return handleDownload(dlMatch[1], env);
        }

        // All other API routes require auth
        const authErr = await requireAuth(request, env);
        if (authErr) return authErr;

        // Files
        if (path === '/api/files' && method === 'GET') return handleListFiles(env);
        if (path === '/api/files/upload' && method === 'POST') return handleUpload(request, env);

        const fileIdMatch = path.match(/^\/api\/files\/([0-9a-f-]{36})$/);
        if (fileIdMatch && method === 'DELETE') return handleDeleteFile(fileIdMatch[1], env);

        const shareMatch = path.match(/^\/api\/files\/([0-9a-f-]{36})\/share$/);
        if (shareMatch && method === 'POST') return handleShare(shareMatch[1], env);

        const unshareMatch = path.match(/^\/api\/files\/([0-9a-f-]{36})\/unshare$/);
        if (unshareMatch && method === 'POST') return handleUnshare(unshareMatch[1], env);

        // Batch operations
        if (path === '/api/files/batch-delete' && method === 'POST') {
          const { ids } = await request.json();
          return handleBatchDelete(ids, env);
        }
        if (path === '/api/files/batch-share' && method === 'POST') {
          const { ids } = await request.json();
          return handleBatchShare(ids, env);
        }
        if (path === '/api/files/batch-unshare' && method === 'POST') {
          const { ids } = await request.json();
          return handleBatchUnshare(ids, env);
        }

        // Usage
        if (path === '/api/usage' && method === 'GET') return json(await getUsageStats(env));
        if (path === '/api/usage/limits' && method === 'PUT') {
          const body = await request.json();
          await updateLimits(env, body);
          return json({ ok: true });
        }

        return error('Not found', 404);
      }

      // --- Serve frontend ---
      return new Response(getAppHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });

    } catch (e) {
      console.error(e);
      return error('Internal server error: ' + e.message, 500);
    }
  },
};

function keyInputPageHTML(fileId) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>输入密钥 - CloudflareShare</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#000}.card{max-width:400px;margin:100px auto;border:3px solid #000;padding:40px}h2{margin-bottom:16px;font-size:20px}input{padding:10px;border:2px solid #000;width:100%;font-size:14px;margin-bottom:16px}input:focus{outline:none;box-shadow:2px 2px 0 #000}button{padding:10px 20px;background:#000;color:#fff;border:none;cursor:pointer;font-size:14px;width:100%}button:hover{background:#333}</style>
</head>
<body>
<div class="card">
<h2>输入分享密钥</h2>
<p style="margin-bottom:16px;color:#666;font-size:14px">请输入密钥以访问分享的文件</p>
<input type="text" id="key" placeholder="请输入密钥" autofocus onkeydown="if(event.key==='Enter')go()">
<button onclick="go()">访问</button>
</div>
<script>function go(){const k=document.getElementById('key').value.trim();if(k)window.location.href='/s/${fileId}?key='+encodeURIComponent(k);}</script>
</body></html>`;
}
