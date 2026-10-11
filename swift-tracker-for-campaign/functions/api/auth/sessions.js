// Returns current admin session context for the dashboard
import { requireAdmin, jsonResponse, unauthorized } from '../../_utils/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await requireAdmin(request, env);
  if (!session) return unauthorized();

  const row = await env.DB.prepare(
    `SELECT id, ip, country, user_agent, login_at, expires_at
     FROM admin_sessions WHERE id = ?`
  ).bind(session.id).first();

  if (!row) return unauthorized();

  const ua = row.user_agent || '';
  return jsonResponse({
    ip: row.ip || 'unknown',
    country: row.country || 'unknown',
    browser: detectBrowser(ua),
    device: detectDevice(ua),
    userAgent: ua,
    loginAt: row.login_at,
    expiresAt: row.expires_at
  });
}

function detectBrowser(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  return 'Unknown';
}

function detectDevice(ua) {
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}