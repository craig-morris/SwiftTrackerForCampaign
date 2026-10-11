// Global middleware: security headers, country/UA firewall, tracked-domain header.
const DEFAULT_BLOCKED_COUNTRIES = ['T1'];
const BLOCKED_UA_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i,
  /python-requests/i, /go-http-client/i, /java/i, /phantomjs/i,
  /selenium/i, /headless/i
];

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const country = request.headers.get('CF-IPCountry') || 'XX';
  const userAgent = request.headers.get('User-Agent') || '';
  const isTrackingEndpoint = url.pathname.startsWith('/api/track/');

  // Firewall: blocked countries
  try {
    const blocked = await env.DB.prepare(
      `SELECT rule_value FROM firewall_rules
       WHERE rule_type = 'block_country' AND active = 1`
    ).all();
    const list = blocked.results?.map(r => r.rule_value) || [];
    const blockList = list.length ? list : DEFAULT_BLOCKED_COUNTRIES;

    if (blockList.includes(country)) {
      if (isTrackingEndpoint) return transparentPixel();
      return new Response('Access Denied', { status: 403 });
    }
  } catch {
    // DB unavailable — don't fail open on firewall
  }

  // Firewall: block bad user agents on tracking endpoints
  if (isTrackingEndpoint) {
    for (const pattern of BLOCKED_UA_PATTERNS) {
      if (pattern.test(userAgent)) {
        if (url.pathname.endsWith('/open')) return transparentPixel();
        return new Response('Access Denied', { status: 403 });
      }
    }
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  headers.set('X-Tracking-Domain', url.host);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function transparentPixel() {
  return new Response(
    atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
    { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } }
  );
}