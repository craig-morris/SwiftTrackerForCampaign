// Dashboard Events API - Returns paginated event data
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Verify session
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/st_session=([^;]+)/);
  if (!match) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const session = await env.DB.prepare(
    `SELECT id FROM admin_sessions WHERE id = ? AND expires_at > datetime('now')`
  ).bind(match[1]).first();

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Pagination
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = (page - 1) * limit;

  // Filters
  const eventType = url.searchParams.get('type') || '';
  const search = url.searchParams.get('search') || '';

  let whereClause = '1=1';
  const bindings = [];

  if (eventType) {
    whereClause += ' AND event_type = ?';
    bindings.push(eventType);
  }

  if (search) {
    whereClause += ' AND (recipient_email LIKE ? OR campaign_subject LIKE ? OR tracking_id LIKE ?)';
    const searchPattern = `%${search}%`;
    bindings.push(searchPattern, searchPattern, searchPattern);
  }

  // Get total count
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM email_events WHERE ${whereClause}`
  ).bind(...bindings).first();

  // Get events
  const events = await env.DB.prepare(
    `SELECT * FROM email_events WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...bindings, limit, offset).all();

  return new Response(JSON.stringify({
    events: events.results,
    pagination: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit)
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}