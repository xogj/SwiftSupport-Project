'use strict';

// ─── Mock Data (used when window.SWIFTSUPPORT_CONFIG.apiBaseUrl is empty) ──
const MOCK_TICKETS = [
  {
    id: 'TKT-001',
    title: 'Unable to log in to account after password reset',
    category: 'Account Management',
    priority: 'high',
    status: 'in-progress',
    createdAt: '2026-05-28T10:14:00Z',
    description: 'After resetting my password I receive a "Invalid credentials" error even though the password meets all requirements.',
    aiResponse: 'This is likely a cached session issue. Please clear your browser cookies and try again. If the problem persists, disable any VPN and retry — some VPN exit nodes are temporarily blocked.',
  },
  {
    id: 'TKT-002',
    title: 'Billing charge appears twice on May invoice',
    category: 'Billing',
    priority: 'critical',
    status: 'open',
    createdAt: '2026-05-29T08:00:00Z',
    description: 'I was charged twice for the Pro plan on May 15th. Both charges are showing on my credit card statement.',
    aiResponse: 'A duplicate charge has been flagged. Typically caused by a payment retry during a timeout. Escalated to billing — expect a refund within 3–5 business days.',
  },
  {
    id: 'TKT-003',
    title: 'API rate limit hit unexpectedly during low-traffic period',
    category: 'Technical Issue',
    priority: 'medium',
    status: 'open',
    createdAt: '2026-05-27T02:00:00Z',
    description: 'Our integration hit the API rate limit at 2 AM UTC — well below our usual traffic.',
    aiResponse: 'Your plan allows 1,000 requests/min. Logs show a spike to 1,240 rpm at 01:58 UTC. Please verify no background jobs are hitting the API more frequently than expected.',
  },
  {
    id: 'TKT-004',
    title: 'Feature request: dark mode for dashboard',
    category: 'Feature Request',
    priority: 'low',
    status: 'resolved',
    createdAt: '2026-05-10T15:00:00Z',
    description: 'Would love to have a dark mode toggle for the main dashboard.',
    aiResponse: 'Dark mode is already on our Q3 roadmap. You will be notified by email when it is available.',
  }
];

let TICKETS = [];
const useLive = () => window.SwiftApi?.isLive();

// ─── Data layer ───────────────────────────────────────────────
async function loadTickets() {
  if (useLive() && window.SwiftAuth.isAuthenticated() && !window.SwiftAuth.isMock()) {
    try {
      TICKETS = await window.SwiftApi.list();
    } catch (err) {
      console.error('loadTickets', err);
      showToast('Could not load tickets — see console.');
      TICKETS = [];
    }
  } else {
    TICKETS = MOCK_TICKETS.slice();
  }
  renderAll();
}

async function submitTicket(ticket) {
  if (useLive() && window.SwiftAuth.isAuthenticated() && !window.SwiftAuth.isMock()) {
    return window.SwiftApi.create(ticket);
  }
  const user = window.SwiftAuth?.user();
  return {
    id: `TKT-${String(TICKETS.length + 1).padStart(3, '0')}`,
    createdAt: new Date().toISOString(),
    status: 'open',
    aiResponse: 'Your ticket has been received and is being analyzed by our AI. An agent will follow up shortly.',
    email: user?.email,
    userId: user?.sub,
    ...ticket
  };
}

// ─── Router ───────────────────────────────────────────────────
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.add('active');
  const link = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (link) link.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Rendering ────────────────────────────────────────────────
const STATUS_LABELS = { 'open': 'Open', 'in-progress': 'In Progress', 'resolved': 'Resolved' };
const statusBadge = s => `<span class="badge badge-${s}">${STATUS_LABELS[s] ?? s}</span>`;
const priorityBadge = p => `<span class="badge badge-${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</span>`;
const dateOnly = iso => (iso ?? '').slice(0, 10);

function renderTicketCard(ticket) {
  const card = document.createElement('div');
  card.className = 'ticket-card';
  card.dataset.status = ticket.status;
  card.innerHTML = `
    <div class="ticket-info">
      <div class="ticket-title">${escapeHtml(ticket.title)}</div>
      <div class="ticket-meta">${ticket.id} &nbsp;·&nbsp; ${escapeHtml(ticket.category)} &nbsp;·&nbsp; ${dateOnly(ticket.createdAt)}</div>
    </div>
    ${priorityBadge(ticket.priority)}
    ${statusBadge(ticket.status)}
  `;
  card.addEventListener('click', () => openModal(ticket));
  return card;
}

function renderTickets(containerId, tickets) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (tickets.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem 0">No tickets found.</p>';
    return;
  }
  tickets.forEach(t => container.appendChild(renderTicketCard(t)));
}

function openModal(ticket) {
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">${escapeHtml(ticket.title)}</div>
    <div class="modal-meta">${ticket.id} &nbsp;·&nbsp; ${dateOnly(ticket.createdAt)} &nbsp;·&nbsp; ${statusBadge(ticket.status)} ${priorityBadge(ticket.priority)}</div>
    <div class="modal-section">
      <div class="modal-section-label">Category</div>
      <div class="modal-section-value">${escapeHtml(ticket.category)}</div>
    </div>
    <div class="modal-section">
      <div class="modal-section-label">Description</div>
      <div class="modal-section-value">${escapeHtml(ticket.description)}</div>
    </div>
    <div class="modal-section">
      <div class="modal-section-label">🤖 AI Response</div>
      <div class="ai-response-box">${escapeHtml(ticket.aiResponse ?? '')}</div>
    </div>
  `;
  document.getElementById('ticket-modal').classList.remove('hidden');
}

function closeModal() { document.getElementById('ticket-modal').classList.add('hidden'); }

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ─── New Ticket Form ──────────────────────────────────────────
async function handleTicketSubmit(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  const payload = {
    title: document.getElementById('ticket-title').value.trim(),
    category: document.getElementById('ticket-category').value,
    priority: document.getElementById('ticket-priority').value,
    description: document.getElementById('ticket-description').value.trim()
  };

  try {
    const newTicket = await submitTicket(payload);
    TICKETS.unshift(newTicket);
    e.target.reset();
    renderAll();
    navigateTo('tickets');
    showToast(`Ticket ${newTicket.id} submitted.`);
  } catch (err) {
    console.error('submit failed', err);
    showToast(`Submit failed: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Ticket';
  }
}

// ─── Filter ───────────────────────────────────────────────────
let activeFilter = 'all';
function applyFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  const filtered = filter === 'all' ? TICKETS : TICKETS.filter(t => t.status === filter);
  renderTickets('all-tickets', filtered);
}

// ─── Stats ────────────────────────────────────────────────────
function renderStats() {
  const counts = {
    open: TICKETS.filter(t => t.status === 'open').length,
    'in-progress': TICKETS.filter(t => t.status === 'in-progress').length,
    resolved: TICKETS.filter(t => t.status === 'resolved').length
  };
  const el = id => document.getElementById(id);
  if (el('stat-open')) el('stat-open').textContent = counts.open;
  if (el('stat-progress')) el('stat-progress').textContent = counts['in-progress'];
  if (el('stat-resolved')) el('stat-resolved').textContent = counts.resolved;
}

function renderAll() {
  renderStats();
  renderTickets('recent-tickets', TICKETS.slice(0, 3));
  applyFilter(activeFilter);
}

// ─── Auth UI ──────────────────────────────────────────────────
function renderUserChrome() {
  const live = useLive();
  const interactive = window.SwiftAuth?.isInteractive();
  const authed = window.SwiftAuth?.isAuthenticated();
  const mock = window.SwiftAuth?.isMock();
  const modeBadge = document.getElementById('mode-badge');
  const signInBtn = document.getElementById('sign-in-btn');
  const signOutBtn = document.getElementById('sign-out-btn');
  const userName = document.getElementById('user-name');
  const avatar = document.getElementById('user-avatar');

  // Mode badge: nothing in real-live mode, "Mock mode" when mock-data only,
  // "Mock auth" when authenticated against the local mock user.
  if (live && !mock) {
    modeBadge.classList.add('hidden');
  } else {
    modeBadge.textContent = mock ? 'Mock auth' : 'Mock mode';
    modeBadge.classList.remove('hidden');
  }

  if (!interactive) {
    // Pure preview — no auth surface at all
    signInBtn.classList.add('hidden');
    signOutBtn.classList.add('hidden');
    userName.textContent = 'Jane Doe';
    avatar.textContent = 'JD';
    return;
  }

  if (authed) {
    const u = window.SwiftAuth.user();
    signInBtn.classList.add('hidden');
    signOutBtn.classList.remove('hidden');
    userName.textContent = u?.name ?? u?.email ?? 'Account';
    avatar.textContent = (u?.email ?? 'U').slice(0, 2).toUpperCase();
  } else {
    signInBtn.classList.remove('hidden');
    signOutBtn.classList.add('hidden');
    userName.textContent = 'Guest';
    avatar.textContent = '?';
  }
}

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (window.SwiftAuth?.isConfigured()) {
    await window.SwiftAuth.handleCallback();
  }

  renderUserChrome();
  await loadTickets();

  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigateTo(el.dataset.page); });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('ticket-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById('ticket-form').addEventListener('submit', handleTicketSubmit);

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
  });

  document.getElementById('sign-in-btn').addEventListener('click', () => window.SwiftAuth.login());
  document.getElementById('sign-out-btn').addEventListener('click', () => window.SwiftAuth.logout());

  // Nudge unauthenticated users to sign in before filling out the form
  document.getElementById('ticket-form').addEventListener('focusin', () => {
    if (window.SwiftAuth?.isInteractive() && !window.SwiftAuth.isAuthenticated()) {
      showToast('Sign in to submit a ticket.');
    }
  });
});
