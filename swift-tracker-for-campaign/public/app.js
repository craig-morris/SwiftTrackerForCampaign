// SwiftTrackerForCampaign — Dashboard App
(function () {
  'use strict';

  const state = { page: 1, limit: 50, eventType: '', search: '', totalPages: 1 };

  /* ---------- Utilities ---------- */
  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }
  function formatDate(s) {
    if (!s) return '—';
    const d = new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z'));
    return d.toLocaleString();
  }
  function timeAgo(s) {
    if (!s) return '';
    const d = new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z'));
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  }

  /* ---------- Toasts ---------- */
  function toast(type, title, message, duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <div class="toast-icon">${icons[type] || 'ℹ'}</div>
      <div class="toast-body">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close" aria-label="Close">×</button>
    `;
    container.appendChild(el);

    const remove = () => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 200);
    };
    el.querySelector('.toast-close').addEventListener('click', remove);
    if (duration > 0) setTimeout(remove, duration);
  }

  /* ---------- Modal ---------- */
  function confirmModal({ title, message, icon = '⚠️', confirmText = 'Confirm', danger = true }) {
    return new Promise(resolve => {
      const overlay = document.getElementById('modalOverlay');
      const iconEl = document.getElementById('modalIcon');
      const titleEl = document.getElementById('modalTitle');
      const msgEl = document.getElementById('modalMessage');
      const cancelBtn = document.getElementById('modalCancel');
      const confirmBtn = document.getElementById('modalConfirm');

      iconEl.textContent = icon;
      titleEl.textContent = title;
      msgEl.textContent = message;
      confirmBtn.textContent = confirmText;
      confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';

      overlay.style.display = 'flex';

      const cleanup = () => {
        overlay.style.display = 'none';
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
      };

      const newCancel = document.getElementById('modalCancel');
      const newConfirm = document.getElementById('modalConfirm');

      newCancel.addEventListener('click', () => { cleanup(); resolve(false); });
      newConfirm.addEventListener('click', () => { cleanup(); resolve(true); });
      overlay.addEventListener('click', e => {
        if (e.target === overlay) { cleanup(); resolve(false); }
      }, { once: true });
    });
  }

  /* ---------- Session ---------- */
  async function loadSession() {
    try {
      const res = await fetch('/api/auth/session');
      if (res.status === 401) { window.location.href = '/login.html'; return; }
      const data = await res.json();

      document.getElementById('sessIP').textContent = data.ip;
      document.getElementById('sessCountry').textContent = data.country;
      document.getElementById('sessDevice').textContent = data.device;
      document.getElementById('sessBrowser').textContent = data.browser;
      document.getElementById('sessLogin').textContent = formatDate(data.loginAt);
      document.getElementById('sessExpires').textContent = formatDate(data.expiresAt);

      const greeting = getGreeting();
      const loginTime = timeAgo(data.loginAt);
      document.getElementById('welcomeGreeting').textContent = `${greeting} 👋`;
      document.getElementById('welcomeSubtext').textContent =
        `Signed in from ${data.browser} on ${data.device} · ${data.country} · ${loginTime}`;

      toast('success', 'Session active', `Signed in from ${data.country}`, 3000);
    } catch (e) {
      console.error('loadSession:', e);
      document.getElementById('sessionBadge').textContent = 'Error';
    }
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 5)  return 'Still up';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  /* ---------- Stats ---------- */
  async function loadStats() {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.status === 401) { window.location.href = '/login.html'; return; }
      const data = await res.json();

      const totals = {};
      for (const t of data.totals) totals[t.event_type] = t.count;

      document.getElementById('statOpens').textContent = (totals.open || 0).toLocaleString();
      document.getElementById('statClicks').textContent = (totals.click || 0).toLocaleString();
      document.getElementById('statUnsubs').textContent = (totals.unsubscribe || 0).toLocaleString();
      document.getElementById('statRecipients').textContent = (data.uniqueRecipients || 0).toLocaleString();
      document.getElementById('activeDomainValue').textContent =
        data.activeDomain ? data.activeDomain.domain : 'No active domain';
    } catch (e) { console.error('loadStats:', e); }
  }

  /* ---------- Domains ---------- */
  async function loadDomains() {
    const tbody = document.getElementById('domainTableBody');
    try {
      const res = await fetch('/api/domain/list');
      if (res.status === 401) { window.location.href = '/login.html'; return; }
      const data = await res.json();

      if (!data.domains.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No domains configured.</td></tr>';
      } else {
        tbody.innerHTML = data.domains.map(d => {
          const activeBadge = d.active ? '<span class="badge-active">ACTIVE</span>' : '';
          return `
            <tr class="${d.active ? 'row-active' : ''}">
              <td><span class="domain-status domain-status-${escapeHtml(d.status)}">${escapeHtml(d.status)}</span></td>
              <td class="mono">${activeBadge}${escapeHtml(d.domain)}</td>
              <td>${escapeHtml(d.label || '—')}</td>
              <td class="mono">${d.priority}</td>
              <td class="mono">${(d.events_7d || 0).toLocaleString()}</td>
              <td class="mono">${d.spam_24h || 0}</td>
              <td class="domain-actions">
                ${!d.active && d.status !== 'disabled'
                  ? `<button class="btn btn-xs btn-primary" data-action="activate" data-id="${d.id}">Activate</button>` : ''}
                ${d.status === 'disabled'
                  ? `<button class="btn btn-xs btn-outline" data-action="enable" data-id="${d.id}">Enable</button>`
                  : `<button class="btn btn-xs btn-outline" data-action="disable" data-id="${d.id}">Disable</button>`}
                ${!d.active
                  ? `<button class="btn btn-xs btn-danger" data-action="delete" data-id="${d.id}">Delete</button>` : ''}
              </td>
            </tr>`;
        }).join('');
      }

      const log = document.getElementById('rotationLog');
      if (!data.rotations.length) {
        log.innerHTML = '<li class="rotation-empty">No rotations yet.</li>';
      } else {
        log.innerHTML = data.rotations.slice(0, 8).map(r => `
          <li class="rotation-item">
            <span class="rotation-time">${formatDate(r.rotated_at)}</span>
            <span class="rotation-old">${escapeHtml(r.old_domain)}</span>
            <span class="rotation-arrow">→</span>
            <span class="rotation-new">${escapeHtml(r.new_domain)}</span>
            <span class="rotation-reason">${escapeHtml(r.reason || '')}</span>
          </li>`).join('');
      }
    } catch (e) { console.error('loadDomains:', e); }
  }

  /* ---------- Events ---------- */
  async function loadEvents() {
    const tbody = document.getElementById('eventsBody');
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Loading events…</td></tr>';
    try {
      const params = new URLSearchParams({ page: state.page, limit: state.limit });
      if (state.eventType) params.set('type', state.eventType);
      if (state.search) params.set('search', state.search);

      const res = await fetch(`/api/dashboard/events?${params}`);
      if (res.status === 401) { window.location.href = '/login.html'; return; }
      const data = await res.json();

      state.totalPages = data.pagination.totalPages;

      if (!data.events.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No events found.</td></tr>';
      } else {
        tbody.innerHTML = data.events.map(e => {
          const emoji = e.event_type === 'open' ? '📬' : e.event_type === 'click' ? '🔗' : '🚫';
          return `
            <tr>
              <td><span class="event-badge event-${e.event_type}">${emoji} ${escapeHtml(e.event_type)}</span></td>
              <td class="cell-email">${escapeHtml(e.recipient_email || '—')}</td>
              <td class="cell-subject" title="${escapeHtml(e.campaign_subject || '')}">${escapeHtml(e.campaign_subject || '—')}</td>
              <td class="cell-dest">${e.destination_url
                ? `<a href="${escapeHtml(e.destination_url)}" target="_blank" rel="noopener" title="${escapeHtml(e.destination_url)}">${escapeHtml(e.destination_url.slice(0, 40))}…</a>`
                : '—'}</td>
              <td class="cell-ip">${escapeHtml(e.ip || '—')}</td>
              <td>${escapeHtml(e.country || '—')}</td>
              <td class="cell-domain" title="${escapeHtml(e.tracked_domain || '')}">${escapeHtml(e.tracked_domain || '—')}</td>
              <td class="cell-time">${formatDate(e.created_at)}</td>
            </tr>`;
        }).join('');
      }

      document.getElementById('pageInfo').textContent =
        `Page ${data.pagination.page} of ${data.pagination.totalPages || 1} · ${data.pagination.total} total`;
      document.getElementById('prevPage').disabled = state.page <= 1;
      document.getElementById('nextPage').disabled = state.page >= state.totalPages;
    } catch (e) {
      console.error('loadEvents:', e);
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Error loading events.</td></tr>';
    }
  }

  function refreshAll() { loadStats(); loadDomains(); loadEvents(); }

  /* ---------- Event Wiring ---------- */
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    refreshAll();
    toast('info', 'Refreshed', 'Dashboard data updated', 2000);
  });

  document.getElementById('healthCheckBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('healthCheckBtn');
    btn.disabled = true; const old = btn.textContent; btn.textContent = '⏳ Checking…';
    try {
      const res = await fetch('/api/health/check', { method: 'POST' });
      const data = await res.json();

      let healthy = 0, spam = 0, down = 0;
      for (const r of data.results || []) {
        if (r.status === 'healthy') healthy++;
        else if (r.status === 'spam') spam++;
        else down++;
      }
      toast('success', 'Health check complete',
        `${healthy} healthy · ${spam} spam · ${down} down`, 5000);

      if (data.rotation?.rotated) {
        toast('warning', 'Domain rotated',
          `${data.rotation.oldDomain} → ${data.rotation.newDomain}`, 7000);
      }
      refreshAll();
    } catch (e) {
      toast('error', 'Health check failed', e.message);
    } finally {
      btn.disabled = false; btn.textContent = old;
    }
  });

  document.getElementById('quickRotateBtn')?.addEventListener('click', async () => {
    const ok = await confirmModal({
      title: 'Force Domain Rotation',
      message: 'Rotate to the next healthy tracking domain? New emails will use the new domain immediately.',
      icon: '🔄',
      confirmText: 'Rotate'
    });
    if (!ok) return;

    try {
      const res = await fetch('/api/domain/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'manual rotation from dashboard' })
      });
      const data = await res.json();
      if (data.rotated) {
        toast('success', 'Rotated', `${data.oldDomain} → ${data.newDomain}`, 6000);
        refreshAll();
      } else {
        toast('error', 'Rotation failed', data.error || 'No healthy fallback available');
      }
    } catch (e) { toast('error', 'Rotation failed', e.message); }
  });

  document.getElementById('addDomainBtn')?.addEventListener('click', () => {
    const form = document.getElementById('addDomainForm');
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  });

  document.getElementById('cancelDomainBtn')?.addEventListener('click', () => {
    document.getElementById('addDomainForm').style.display = 'none';
  });

  document.getElementById('saveDomainBtn')?.addEventListener('click', async () => {
    const domain = document.getElementById('newDomainInput').value.trim();
    const label = document.getElementById('newDomainLabel').value.trim();
    const priority = parseInt(document.getElementById('newDomainPriority').value || '100');

    if (!domain) { toast('warning', 'Domain required', 'Enter a valid tracking URL'); return; }

    try {
      const res = await fetch('/api/domain/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, label, priority })
      });
      const data = await res.json();
      if (data.success) {
        toast('success', 'Domain added', data.domain, 4000);
        document.getElementById('addDomainForm').style.display = 'none';
        document.getElementById('newDomainInput').value = '';
        document.getElementById('newDomainLabel').value = '';
        loadDomains();
      } else {
        toast('error', 'Failed to add', data.error || 'Unknown error');
      }
    } catch (e) { toast('error', 'Failed', e.message); }
  });

  document.getElementById('domainTableBody')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = parseInt(btn.dataset.id);

    if (action === 'delete') {
      const ok = await confirmModal({
        title: 'Delete domain',
        message: 'Remove this domain from the rotation pool? This cannot be undone.',
        icon: '🗑️',
        confirmText: 'Delete'
      });
      if (!ok) return;
    }

    try {
      const endpoint = action === 'delete' ? '/api/domain/delete' : '/api/domain/toggle';
      const payload = action === 'delete' ? { id } : { id, action };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast('error', 'Action failed', data.error || 'Unknown error');
      } else {
        toast('success', 'Done', `Domain ${action}d`, 2500);
      }
      refreshAll();
    } catch (err) { toast('error', 'Failed', err.message); }
  });

  document.getElementById('eventTypeFilter')?.addEventListener('change', (e) => {
    state.eventType = e.target.value; state.page = 1; loadEvents();
  });

  let searchTO;
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTO);
    searchTO = setTimeout(() => {
      state.search = e.target.value.trim(); state.page = 1; loadEvents();
    }, 400);
  });

  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (state.page > 1) { state.page--; loadEvents(); }
  });
  document.getElementById('nextPage')?.addEventListener('click', () => {
    if (state.page < state.totalPages) { state.page++; loadEvents(); }
  });

  /* ---------- Init ---------- */
  loadSession();
  refreshAll();
})();