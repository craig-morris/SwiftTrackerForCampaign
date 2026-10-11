// POST /api/domain/rotate
// Admin: force rotate to the next healthy domain, or auto (no body).
// This is the REAL rotation — it flips the active flag in D1.
import { requireAdmin, jsonResponse, unauthorized } from '../../_utils/auth.js';
import { rotateDomain } from '../../_utils/domains.js';
import { notify } from '../../_utils/telegram.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await requireAdmin(request, env);
  if (!session) return unauthorized();

  let body = {};
  try { body = await request.json(); } catch {}

  const reason = body.reason || 'manual rotation from dashboard';
  const result = await rotateDomain(env, reason);

  if (!result.rotated) {
    await notify(env,
      `⚠️ *Domain Rotation Failed*\n` +
      `📝 ${result.error}\n` +
      `🔗 Current: ${result.current || 'none'}`
    );
    return jsonResponse(result, 400);
  }

  await notify(env,
    `🔄 *Domain Rotated*\n` +
    `❌ Old: ${result.oldDomain}\n` +
    `✅ New: ${result.newDomain}\n` +
    `📝 ${reason}\n\n` +
    `All new emails should now use *${result.newDomain}*.`
  );

  return jsonResponse(result);
}