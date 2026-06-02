'use strict';

// ─── Mock Data ────────────────────────────────────────────────
const TICKETS = [
  {
    id: 'TKT-001',
    title: 'Unable to log in to account after password reset',
    category: 'Account Management',
    priority: 'high',
    status: 'in-progress',
    created: '2026-05-28',
    description: 'After resetting my password I receive a "Invalid credentials" error even though the password meets all requirements.',
    aiResponse: 'This is likely a cached session issue. Please clear your browser cookies and try again. If the problem persists, disable any VPN and retry — some VPN exit nodes are temporarily blocked.',
  },
  {
    id: 'TKT-002',
    title: 'Billing charge appears twice on May invoice',
    category: 'Billing',
    priority: 'critical',
    status: 'open',
    created: '2026-05-29',
    description: 'I was charged twice for the Pro plan on May 15th. Both charges are showing on my credit card statement.',
    aiResponse: 'A duplicate charge has been flagged. This is typically caused by a payment retry during a timeout. Your ticket has been escalated to the billing team — expect a refund within 3–5 business days.',
  },
  {
    id: 'TKT-003',
    title: 'API rate limit hit unexpectedly during low-traffic period',
    category: 'Technical Issue',
    priority: 'medium',
    status: 'open',
    created: '2026-05-27',
    description: 'Our integration hit the API rate limit at 2 AM UTC — well below our usual traffic. No changes were made to our codebase.',
    aiResponse: 'Your plan allows 1,000 requests/min. Logs show a spike to 1,240 rpm at 01:58 UTC from IP 203.0.113.44. Please verify no background jobs or monitoring tools are hitting the API more frequently than expected.',
  },
  {
    id: 'TKT-004',
    title: 'Feature request: dark mode for dashboard',
    category: 'Feature Request',
    priority: 'low',
    status: 'resolved',
    created: '2026-05-10',
    description: 'Would love to have a dark mode toggle for the main dashboard.',
    aiResponse: 'Dark mode is already on our Q3 roadmap. You will be notified by email when it is available. Thank you for the feedback!',
  },
  {
    id: 'TKT-005',
    title: 'CSV export contains malformed data in column 7',
    category: 'Technical Issue',
    priority: 'medium',
    status: 'resolved',
    created: '2026-05-14',
    description: 'Exporting ticket history to CSV — column 7 ("Assigned Agent") is always empty even when an agent is assigned.',
    aiResponse: 'This was a known bug in export v2.3. It was patched in v2.4 (released May 19th). Please re-export and the column should now populate correctly.',
  },
  {
    id: 'TKT-006',
    title: 'Webhook not firing for ticket status changes',
    category: 'Technical Issue',
    priority: 'high',
    status: 'in-progress',
    created: '2026-05-29',
    description: 'We have a webhook configured for ticket.status_changed events. It fired correctly until May 25th and has not fired since.',
    aiResponse: 'Webhook delivery logs show 504 timeouts from your endpoint (https://api.yourdomain.com/hooks). Please verify your server is responding within 5 seconds. We will retry delivery once your endpoint is healthy.',
  },
];

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

// ─── Ticket Rendering ─────────────────────────────────────────
function statusBadge(status) {
  const labels = { 'open': 'Open', 'in-progress': 'In Progress', 'resolved': 'Resolved' };
  return `<span class="badge badge-${status}">${labels[status] ?? status}</span>`;
}

function priorityBadge(priority) {
  return `<span class="badge badge-${priority}">${priority.charAt(0).toUpperCase() + priority.slice(1)}</span>`;
}

function renderTicketCard(ticket) {
  const card = document.createElement('div');
  card.className = 'ticket-card';
  card.dataset.status = ticket.status;
  card.innerHTML = `
    <div class="ticket-info">
      <div class="ticket-title">${ticket.title}</div>
      <div class="ticket-meta">${ticket.id} &nbsp;·&nbsp; ${ticket.category} &nbsp;·&nbsp; ${ticket.created}</div>
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

// ─── Modal ────────────────────────────────────────────────────
function openModal(ticket) {
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="modal-title">${ticket.title}</div>
    <div class="modal-meta">${ticket.id} &nbsp;·&nbsp; ${ticket.created} &nbsp;·&nbsp; ${statusBadge(ticket.status)} ${priorityBadge(ticket.priority)}</div>

    <div class="modal-section">
      <div class="modal-section-label">Category</div>
      <div class="modal-section-value">${ticket.category}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-label">Description</div>
      <div class="modal-section-value">${ticket.description}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-label">🤖 AI Response</div>
      <div class="ai-response-box">${ticket.aiResponse}</div>
    </div>
  `;
  document.getElementById('ticket-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('ticket-modal').classList.add('hidden');
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

// ─── New Ticket Form ──────────────────────────────────────────
function handleTicketSubmit(e) {
  e.preventDefault();
  const title    = document.getElementById('ticket-title').value.trim();
  const category = document.getElementById('ticket-category').value;
  const priority = document.getElementById('ticket-priority').value;
  const desc     = document.getElementById('ticket-description').value.trim();

  const newTicket = {
    id: `TKT-${String(TICKETS.length + 1).padStart(3, '0')}`,
    title,
    category: category.charAt(0).toUpperCase() + category.slice(1),
    priority,
    status: 'open',
    created: new Date().toISOString().slice(0, 10),
    description: desc,
    aiResponse: 'Your ticket has been received and is being analyzed by our AI. An agent will follow up shortly.',
  };

  TICKETS.unshift(newTicket);

  e.target.reset();
  renderAll();
  navigateTo('tickets');
  showToast(`Ticket ${newTicket.id} submitted successfully.`);
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

// ─── Init ─────────────────────────────────────────────────────
function renderAll() {
  renderTickets('recent-tickets', TICKETS.slice(0, 3));
  applyFilter(activeFilter);
}

document.addEventListener('DOMContentLoaded', () => {
  renderAll();

  // Nav links
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('ticket-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Form
  document.getElementById('ticket-form').addEventListener('submit', handleTicketSubmit);

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
  });
});
