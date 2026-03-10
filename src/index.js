import { json, error } from './utils.js';
import { authenticate, requireAuth, handleLogin, handleLogout, handleSetup, handleCheckSetup } from './auth.js';
import { handleUpload, handleListFiles, handleDeleteFile, handleShare, handleUnshare, handleDownload, handleGetByShareKey, handleDownloadByShareKey } from './files.js';
import { getUsageStats, updateLimits } from './usage.js';
import { getAppHTML } from './frontend.js';
import { migrate } from './migrate.js';

export default {
  async fetch(request, env) {
    await migrate(env.DB);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
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
