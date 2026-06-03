/* =====================================================
   補習班學習管理系統 — app.js
   Pure Vanilla JS, localStorage persistence
   ===================================================== */

'use strict';

// ─────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────

const genId = () => `${Date.now()}${Math.random().toString(36).slice(2, 9)}`;

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${y}/${m}/${d}`;
}

function stars(n, max = 5) {
  const filled = Math.round(n);
  return '<span class="star-rating">' +
    '★'.repeat(filled) + '☆'.repeat(max - filled) +
    '</span>';
}

function scoreColor(pct) {
  if (pct >= 90) return 'excellent';
  if (pct >= 75) return 'good';
  if (pct >= 60) return 'fair';
  return 'poor';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ─────────────────────────────────────────────────────────
// LocalStorage helpers
// ─────────────────────────────────────────────────────────

const KEYS = {
  students: 'tutoring_students',
  sessions: 'tutoring_sessions',
  homework: 'tutoring_homework',
  grades:   'tutoring_grades',
};

function load(key)        { return JSON.parse(localStorage.getItem(KEYS[key]) || '[]'); }
function save(key, data)  { localStorage.setItem(KEYS[key], JSON.stringify(data)); }

// In-memory state (synced to localStorage on every mutation)
const DB = {
  students: load('students'),
  sessions: load('sessions'),
  homework: load('homework'),
  grades:   load('grades'),
};

function persist(key) { save(key, DB[key]); }

// ─────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, 2800);
}

// ─────────────────────────────────────────────────────────
// Modal helpers
// ─────────────────────────────────────────────────────────

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Close buttons (data-close attribute)
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

// ─────────────────────────────────────────────────────────
// Header date
// ─────────────────────────────────────────────────────────

(function initHeader() {
  const el = document.getElementById('headerDate');
  const now = new Date();
  const weekDays = ['日','一','二','三','四','五','六'];
  el.textContent = `${now.getFullYear()} 年 ${now.getMonth()+1} 月 ${now.getDate()} 日　週${weekDays[now.getDay()]}`;
})();

// ─────────────────────────────────────────────────────────
// Tab navigation
// ─────────────────────────────────────────────────────────

const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.toggle('active', b === btn));
    tabPanels.forEach(p => p.classList.toggle('active', p.id === `tab-${target}`));
    // Refresh current tab
    if (target === 'students')  renderStudents();
    if (target === 'sessions')  renderSessions();
    if (target === 'homework')  renderHomework();
    if (target === 'grades')    renderGrades();
  });
});

// ─────────────────────────────────────────────────────────
// Student helpers
// ─────────────────────────────────────────────────────────

function getStudent(id) { return DB.students.find(s => s.id === id); }

function studentName(id) {
  const s = getStudent(id);
  return s ? s.name : '未知學生';
}

function studentInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

// Compute effective homework status (auto-overdue)
function effectiveStatus(hw) {
  if (hw.status === '已完成') return '已完成';
  if (hw.dueDate && hw.dueDate < today()) return '逾期';
  return hw.status;
}

// ─────────────────────────────────────────────────────────
// Populate student dropdowns everywhere
// ─────────────────────────────────────────────────────────

function populateStudentDropdowns() {
  const ids = [
    'sessionStudentFilter',
    'hwStudentFilter',
    'gradeStudentFilter',
    'sessionStudentId',
    'hwStudentId',
    'gradeStudentId',
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isFilter = el.id.endsWith('Filter');
    const current  = el.value;
    el.innerHTML = `<option value="">${isFilter ? '全部學生' : '請選擇學生'}</option>`;
    DB.students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      el.appendChild(opt);
    });
    // Restore previous selection if still valid
    if (current && DB.students.find(s => s.id === current)) {
      el.value = current;
    }
  });
}

// ─────────────────────────────────────────────────────────
// ======================================================
//  TAB 1: 學生管理
// ======================================================
// ─────────────────────────────────────────────────────────

function renderStudents() {
  const grid = document.getElementById('studentGrid');
  grid.innerHTML = '';

  if (DB.students.length === 0) {
    grid.innerHTML = `
      <div class="empty-state show" style="grid-column:1/-1;">
        <div class="empty-icon">👤</div>
        <p>還沒有學生資料</p>
        <p class="empty-hint">點擊「新增學生」開始建立學生資料</p>
      </div>`;
    return;
  }

  DB.students.forEach(s => {
    const card = document.createElement('div');
    card.className = 'student-card';
    card.dataset.id = s.id;
    card.innerHTML = `
      <div class="student-card-header">
        <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
          <div class="student-avatar">${escapeHtml(studentInitial(s.name))}</div>
          <div style="min-width:0;">
            <div class="student-name">${escapeHtml(s.name)}</div>
          </div>
        </div>
        <div class="student-card-actions">
          <button class="action-btn action-btn-edit" data-action="edit" data-id="${s.id}">編輯</button>
          <button class="action-btn action-btn-delete" data-action="delete" data-id="${s.id}">刪除</button>
        </div>
      </div>
      <div class="student-meta">
        ${s.subject   ? `<span class="tag tag-subject">📚 ${escapeHtml(s.subject)}</span>` : ''}
        ${s.gradeLevel? `<span class="tag tag-grade">🎓 ${escapeHtml(s.gradeLevel)}</span>` : ''}
        ${s.contact   ? `<span class="tag tag-contact">📞 ${escapeHtml(s.contact)}</span>` : ''}
      </div>
      ${s.notes ? `<div class="student-notes-preview">${escapeHtml(s.notes)}</div>` : ''}
    `;

    // Click card body → detail (but not on action buttons)
    card.addEventListener('click', e => {
      if (e.target.closest('[data-action]')) return;
      openStudentDetail(s.id);
    });

    card.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.dataset.action === 'edit')   openStudentModal(s.id);
        if (btn.dataset.action === 'delete') deleteStudent(s.id);
      });
    });

    grid.appendChild(card);
  });
}

// ── Student modal ──

document.getElementById('btnAddStudent').addEventListener('click', () => openStudentModal());

function openStudentModal(id) {
  const editing = id ? getStudent(id) : null;
  document.getElementById('modalStudentTitle').textContent = editing ? '編輯學生資料' : '新增學生';
  document.getElementById('studentId').value      = editing ? editing.id : '';
  document.getElementById('studentName').value    = editing ? editing.name : '';
  document.getElementById('studentSubject').value = editing ? editing.subject : '';
  document.getElementById('studentGrade').value   = editing ? editing.gradeLevel : '';
  document.getElementById('studentContact').value = editing ? editing.contact : '';
  document.getElementById('studentNotes').value   = editing ? editing.notes : '';
  // Clear errors
  document.querySelectorAll('#formStudent .form-input').forEach(el => el.classList.remove('error'));
  openModal('modalStudent');
  document.getElementById('studentName').focus();
}

document.getElementById('btnSaveStudent').addEventListener('click', () => {
  const name      = document.getElementById('studentName').value.trim();
  const subject   = document.getElementById('studentSubject').value.trim();
  const gradeLevel= document.getElementById('studentGrade').value;
  const contact   = document.getElementById('studentContact').value.trim();
  const notes     = document.getElementById('studentNotes').value.trim();
  const id        = document.getElementById('studentId').value;

  // Validation
  let valid = true;
  const nameEl = document.getElementById('studentName');
  nameEl.classList.toggle('error', !name);
  if (!name) { valid = false; nameEl.focus(); }

  if (!valid) { showToast('請填寫必填欄位', 'error'); return; }

  if (id) {
    // Edit
    const idx = DB.students.findIndex(s => s.id === id);
    DB.students[idx] = { ...DB.students[idx], name, subject, gradeLevel, contact, notes };
    showToast(`已更新 ${name} 的資料`);
  } else {
    // Add
    DB.students.push({ id: genId(), name, subject, gradeLevel, contact, notes, createdAt: new Date().toISOString() });
    showToast(`已新增學生：${name}`);
  }
  persist('students');
  populateStudentDropdowns();
  renderStudents();
  closeModal('modalStudent');
});

function deleteStudent(id) {
  const s = getStudent(id);
  if (!s) return;
  if (!confirm(`確定要刪除「${s.name}」嗎？\n相關的上課紀錄、作業、成績也會一併刪除。`)) return;
  DB.students = DB.students.filter(x => x.id !== id);
  DB.sessions = DB.sessions.filter(x => x.studentId !== id);
  DB.homework = DB.homework.filter(x => x.studentId !== id);
  DB.grades   = DB.grades.filter(x => x.studentId !== id);
  persist('students'); persist('sessions'); persist('homework'); persist('grades');
  populateStudentDropdowns();
  renderStudents();
  showToast(`已刪除學生：${s.name}`, 'warning');
}

// ── Student Detail Panel ──

document.getElementById('closeStudentDetail').addEventListener('click', closeStudentDetail);

document.getElementById('studentDetailOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('studentDetailOverlay')) closeStudentDetail();
});

function closeStudentDetail() {
  document.getElementById('studentDetailOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function openStudentDetail(id) {
  const s = getStudent(id);
  if (!s) return;

  const studentSessions = DB.sessions.filter(x => x.studentId === id).sort((a,b)=>b.date.localeCompare(a.date));
  const studentHomework = DB.homework.filter(x => x.studentId === id);
  const studentGrades   = DB.grades.filter(x => x.studentId === id).sort((a,b)=>b.date.localeCompare(a.date));

  const totalSessions   = studentSessions.length;
  const doneHw          = studentHomework.filter(h => h.status === '已完成').length;
  const hwRate          = studentHomework.length > 0 ? Math.round(doneHw / studentHomework.length * 100) : 0;
  const avgScore        = studentGrades.length > 0
    ? Math.round(studentGrades.reduce((sum, g) => sum + (g.score / g.maxScore * 100), 0) / studentGrades.length)
    : null;

  const recentSessions = studentSessions.slice(0, 3);
  const pendingHw      = studentHomework.filter(h => effectiveStatus(h) !== '已完成').slice(0, 4);
  const recentGrades   = studentGrades.slice(0, 4);

  document.getElementById('studentDetailContent').innerHTML = `
    <div class="detail-name-row">
      <div class="detail-avatar-lg">${escapeHtml(studentInitial(s.name))}</div>
      <div>
        <div class="detail-student-name">${escapeHtml(s.name)}</div>
        <div class="detail-tags">
          ${s.subject    ? `<span class="tag tag-subject">📚 ${escapeHtml(s.subject)}</span>` : ''}
          ${s.gradeLevel ? `<span class="tag tag-grade">🎓 ${escapeHtml(s.gradeLevel)}</span>` : ''}
          ${s.contact    ? `<span class="tag tag-contact">📞 ${escapeHtml(s.contact)}</span>` : ''}
        </div>
      </div>
    </div>
    ${s.notes ? `<p style="font-size:.85rem;color:var(--text-muted);margin-top:8px;line-height:1.6;">${escapeHtml(s.notes)}</p>` : ''}

    <div class="detail-stat-row" style="margin-top:20px;">
      <div class="detail-stat">
        <div class="detail-stat-value">${totalSessions}</div>
        <div class="detail-stat-label">累計上課</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat-value">${avgScore !== null ? avgScore + '%' : '—'}</div>
        <div class="detail-stat-label">平均成績</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat-value">${hwRate}%</div>
        <div class="detail-stat-label">作業完成率</div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">近期上課</div>
      ${recentSessions.length === 0
        ? `<p style="font-size:.85rem;color:var(--text-light);">尚無上課紀錄</p>`
        : recentSessions.map(ses => `
          <div class="recent-item">
            <div>
              <span style="font-weight:600;">${escapeHtml(ses.topics || '—')}</span>
              <span style="margin-left:8px;color:var(--text-muted);">${ses.duration ? ses.duration + ' 分鐘' : ''}</span>
            </div>
            <div class="recent-date">${formatDate(ses.date)}</div>
          </div>`).join('')}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">待完成作業</div>
      ${pendingHw.length === 0
        ? `<p style="font-size:.85rem;color:var(--text-light);">目前沒有待完成作業 🎉</p>`
        : pendingHw.map(hw => {
            const st = effectiveStatus(hw);
            return `
            <div class="recent-item">
              <span>${escapeHtml(hw.title)}</span>
              <span class="status-badge badge-${st}">${st}</span>
            </div>`;
          }).join('')}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">近期成績</div>
      ${recentGrades.length === 0
        ? `<p style="font-size:.85rem;color:var(--text-light);">尚無成績紀錄</p>`
        : recentGrades.map(g => {
            const pct = Math.round(g.score / g.maxScore * 100);
            return `
            <div class="recent-item" style="flex-direction:column;gap:4px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;">${escapeHtml(g.subject)} <span style="font-weight:400;color:var(--text-muted);">${escapeHtml(g.type)}</span></span>
                <span class="recent-date">${formatDate(g.date)}</span>
              </div>
              <div class="score-bar-wrap">
                <div class="score-bar">
                  <div class="score-bar-fill ${scoreColor(pct)}" style="width:${pct}%;"></div>
                </div>
                <span class="score-pct">${g.score}/${g.maxScore}</span>
              </div>
            </div>`;
          }).join('')}
    </div>
  `;

  document.getElementById('studentDetailOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ─────────────────────────────────────────────────────────
// ======================================================
//  TAB 2: 上課紀錄
// ======================================================
// ─────────────────────────────────────────────────────────

function renderSessions() {
  const filter  = document.getElementById('sessionStudentFilter').value;
  const search  = document.getElementById('sessionSearch').value.trim().toLowerCase();
  let   records = [...DB.sessions].sort((a,b) => b.date.localeCompare(a.date));
  if (filter) records = records.filter(r => r.studentId === filter);
  if (search) records = records.filter(r => {
    const name = studentName(r.studentId).toLowerCase();
    return name.includes(search) ||
      (r.topics || '').toLowerCase().includes(search) ||
      (r.notes  || '').toLowerCase().includes(search);
  });

  const tbody = document.getElementById('sessionsTableBody');
  const empty = document.getElementById('sessionsEmpty');
  tbody.innerHTML = '';

  if (records.length === 0) {
    empty.classList.add('show');
    document.querySelector('#sessionsTable thead').style.display = 'none';
    return;
  }
  empty.classList.remove('show');
  document.querySelector('#sessionsTable thead').style.display = '';

  records.forEach(r => {
    const s = getStudent(r.studentId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(r.date)}</td>
      <td>${escapeHtml(s ? s.name : '已刪除')}</td>
      <td>${escapeHtml(s ? s.subject : '—')}</td>
      <td title="${escapeHtml(r.topics)}">${escapeHtml(r.topics || '—')}</td>
      <td style="white-space:nowrap;">
        <div class="table-actions">
          <button class="action-btn action-btn-edit" data-action="edit" data-id="${r.id}">編輯</button>
          <button class="action-btn action-btn-delete" data-action="delete" data-id="${r.id}">刪除</button>
        </div>
      </td>
    `;
    tr.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'edit')   openSessionModal(r.id);
        if (btn.dataset.action === 'delete') deleteSession(r.id);
      });
    });
    tbody.appendChild(tr);
  });
}

document.getElementById('sessionStudentFilter').addEventListener('change', renderSessions);
document.getElementById('sessionSearch').addEventListener('input', renderSessions);

// ── Session modal ──

document.getElementById('btnAddSession').addEventListener('click', () => openSessionModal());

function openSessionModal(id) {
  const editing = id ? DB.sessions.find(r => r.id === id) : null;
  populateStudentDropdowns();
  document.getElementById('modalSessionTitle').textContent = editing ? '編輯上課紀錄' : '新增上課紀錄';
  document.getElementById('sessionId').value          = editing ? editing.id : '';
  document.getElementById('sessionStudentId').value   = editing ? editing.studentId : '';
  document.getElementById('sessionDate').value        = editing ? editing.date : today();
  document.getElementById('sessionDuration').value    = editing ? editing.duration : '';
  document.getElementById('sessionPerformance').value = editing ? String(editing.performance) : '';
  document.getElementById('sessionTopics').value      = editing ? editing.topics : '';
  document.getElementById('sessionNotes').value       = editing ? (editing.notes || '') : '';
  document.querySelectorAll('#formSession .form-input').forEach(el => el.classList.remove('error'));
  openModal('modalSession');
}

document.getElementById('btnSaveSession').addEventListener('click', () => {
  const studentId   = document.getElementById('sessionStudentId').value;
  const date        = document.getElementById('sessionDate').value;
  const duration    = document.getElementById('sessionDuration').value;
  const performance = document.getElementById('sessionPerformance').value;
  const topics      = document.getElementById('sessionTopics').value.trim();
  const notes       = document.getElementById('sessionNotes').value.trim();
  const id          = document.getElementById('sessionId').value;

  let valid = true;
  const fields = [
    [document.getElementById('sessionStudentId'),   !studentId],
    [document.getElementById('sessionDate'),         !date],
    [document.getElementById('sessionDuration'),     !duration],
    [document.getElementById('sessionPerformance'),  !performance],
    [document.getElementById('sessionTopics'),       !topics],
  ];
  fields.forEach(([el, err]) => {
    el.classList.toggle('error', err);
    if (err) valid = false;
  });
  if (!valid) { showToast('請填寫必填欄位', 'error'); return; }

  const record = { studentId, date, duration: Number(duration), performance: Number(performance), topics, notes };

  if (id) {
    const idx = DB.sessions.findIndex(r => r.id === id);
    DB.sessions[idx] = { ...DB.sessions[idx], ...record };
    showToast('已更新上課紀錄');
  } else {
    DB.sessions.push({ id: genId(), ...record, createdAt: new Date().toISOString() });
    showToast('已新增上課紀錄');
  }
  persist('sessions');
  renderSessions();
  closeModal('modalSession');
});

function deleteSession(id) {
  if (!confirm('確定要刪除這筆上課紀錄嗎？')) return;
  DB.sessions = DB.sessions.filter(r => r.id !== id);
  persist('sessions');
  renderSessions();
  showToast('已刪除上課紀錄', 'warning');
}

// ─────────────────────────────────────────────────────────
// ======================================================
//  TAB 3: 作業追蹤
// ======================================================
// ─────────────────────────────────────────────────────────

function renderHomework() {
  const stuFilter    = document.getElementById('hwStudentFilter').value;
  const statusFilter = document.getElementById('hwStatusFilter').value;

  let records = [...DB.homework].sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  if (stuFilter)    records = records.filter(r => r.studentId === stuFilter);
  if (statusFilter) {
    records = records.filter(r => {
      const eff = effectiveStatus(r);
      return eff === statusFilter;
    });
  }

  const grid  = document.getElementById('homeworkGrid');
  const empty = document.getElementById('homeworkEmpty');
  grid.innerHTML = '';

  if (records.length === 0) {
    empty.classList.add('show');
    grid.style.display = 'none';
    return;
  }
  empty.classList.remove('show');
  grid.style.display = '';

  records.forEach(hw => {
    const eff = effectiveStatus(hw);
    const s   = getStudent(hw.studentId);
    const card = document.createElement('div');
    card.className = `hw-card status-${eff}`;
    card.innerHTML = `
      <div class="hw-card-top">
        <div class="hw-title">${escapeHtml(hw.title)}</div>
        <span class="status-badge badge-${eff}">${eff}</span>
      </div>
      <div class="hw-meta">
        <span>👤 ${escapeHtml(s ? s.name : '已刪除')}</span>
        <span>📅 指派：${formatDate(hw.assignedDate)}</span>
        <span>⏰ 截止：${formatDate(hw.dueDate)}</span>
        ${hw.notes ? `<span style="margin-top:4px;color:var(--text);">${escapeHtml(hw.notes)}</span>` : ''}
      </div>
      <div class="hw-card-footer">
        ${eff !== '已完成' ? `<button class="action-btn action-btn-edit" data-action="complete" data-id="${hw.id}">✓ 標記完成</button>` : ''}
        <button class="action-btn action-btn-edit" data-action="edit" data-id="${hw.id}">編輯</button>
        <button class="action-btn action-btn-delete" data-action="delete" data-id="${hw.id}">刪除</button>
      </div>
    `;
    card.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'edit')     openHomeworkModal(hw.id);
        if (btn.dataset.action === 'delete')   deleteHomework(hw.id);
        if (btn.dataset.action === 'complete') markHomeworkDone(hw.id);
      });
    });
    grid.appendChild(card);
  });
}

document.getElementById('hwStudentFilter').addEventListener('change', renderHomework);
document.getElementById('hwStatusFilter').addEventListener('change', renderHomework);

// ── Homework modal ──

document.getElementById('btnAddHomework').addEventListener('click', () => openHomeworkModal());

function openHomeworkModal(id) {
  const editing = id ? DB.homework.find(r => r.id === id) : null;
  document.getElementById('modalHomeworkTitle').textContent = editing ? '編輯作業' : '指派作業';
  document.getElementById('homeworkId').value      = editing ? editing.id : '';
  document.getElementById('hwStudentId').value     = editing ? editing.studentId : '';
  document.getElementById('hwTitle').value         = editing ? editing.title : '';
  document.getElementById('hwAssignedDate').value  = editing ? editing.assignedDate : today();
  document.getElementById('hwDueDate').value       = editing ? editing.dueDate : '';
  document.getElementById('hwStatus').value        = editing ? editing.status : '未完成';
  document.getElementById('hwNotes').value         = editing ? editing.notes : '';
  document.querySelectorAll('#formHomework .form-input').forEach(el => el.classList.remove('error'));
  openModal('modalHomework');
}

document.getElementById('btnSaveHomework').addEventListener('click', () => {
  const studentId    = document.getElementById('hwStudentId').value;
  const title        = document.getElementById('hwTitle').value.trim();
  const assignedDate = document.getElementById('hwAssignedDate').value;
  const dueDate      = document.getElementById('hwDueDate').value;
  const status       = document.getElementById('hwStatus').value;
  const notes        = document.getElementById('hwNotes').value.trim();
  const id           = document.getElementById('homeworkId').value;

  let valid = true;
  const fields = [
    [document.getElementById('hwStudentId'),    !studentId],
    [document.getElementById('hwTitle'),         !title],
    [document.getElementById('hwAssignedDate'),  !assignedDate],
    [document.getElementById('hwDueDate'),       !dueDate],
  ];
  fields.forEach(([el, err]) => {
    el.classList.toggle('error', err);
    if (err) valid = false;
  });
  if (!valid) { showToast('請填寫必填欄位', 'error'); return; }

  const record = { studentId, title, assignedDate, dueDate, status, notes };

  if (id) {
    const idx = DB.homework.findIndex(r => r.id === id);
    DB.homework[idx] = { ...DB.homework[idx], ...record };
    showToast('已更新作業資料');
  } else {
    DB.homework.push({ id: genId(), ...record, createdAt: new Date().toISOString() });
    showToast('已指派作業');
  }
  persist('homework');
  renderHomework();
  closeModal('modalHomework');
});

function markHomeworkDone(id) {
  const idx = DB.homework.findIndex(r => r.id === id);
  if (idx === -1) return;
  DB.homework[idx].status = '已完成';
  persist('homework');
  renderHomework();
  showToast('已標記作業完成 🎉');
}

function deleteHomework(id) {
  if (!confirm('確定要刪除這筆作業紀錄嗎？')) return;
  DB.homework = DB.homework.filter(r => r.id !== id);
  persist('homework');
  renderHomework();
  showToast('已刪除作業紀錄', 'warning');
}

// ─────────────────────────────────────────────────────────
// ======================================================
//  TAB 4: 學習進度
// ======================================================
// ─────────────────────────────────────────────────────────

function renderGrades() {
  const filter = document.getElementById('gradeStudentFilter').value;

  let records = [...DB.grades].sort((a,b) => b.date.localeCompare(a.date));
  const recordsAll = records;
  if (filter) records = records.filter(r => r.studentId === filter);

  // ── Stats cards ──
  renderStatsCards(filter, recordsAll);

  // ── Table ──
  const tbody = document.getElementById('gradesTableBody');
  const empty = document.getElementById('gradesEmpty');
  tbody.innerHTML = '';

  if (records.length === 0) {
    empty.classList.add('show');
    document.querySelector('#gradesTable thead').style.display = 'none';
    return;
  }
  empty.classList.remove('show');
  document.querySelector('#gradesTable thead').style.display = '';

  records.forEach(g => {
    const s   = getStudent(g.studentId);
    const pct = g.maxScore > 0 ? Math.round(g.score / g.maxScore * 100) : 0;
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(g.date)}</td>
      <td>${escapeHtml(s ? s.name : '已刪除')}</td>
      <td>${escapeHtml(g.subject || '—')}</td>
      <td><span class="tag ${g.type === '小考' ? 'tag-subject' : g.type === '段考' ? 'tag-grade' : 'tag-contact'}">${escapeHtml(g.type)}</span></td>
      <td><strong>${g.score}</strong></td>
      <td>${g.maxScore}</td>
      <td>
        <div class="score-bar-wrap">
          <div class="score-bar">
            <div class="score-bar-fill ${scoreColor(pct)}" style="width:${pct}%;"></div>
          </div>
          <span class="score-pct">${pct}%</span>
        </div>
      </td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);" title="${escapeHtml(g.notes)}">${escapeHtml(g.notes || '—')}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn action-btn-edit" data-action="edit" data-id="${g.id}">編輯</button>
          <button class="action-btn action-btn-delete" data-action="delete" data-id="${g.id}">刪除</button>
        </div>
      </td>
    `;
    tr.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'edit')   openGradeModal(g.id);
        if (btn.dataset.action === 'delete') deleteGrade(g.id);
      });
    });
    tbody.appendChild(tr);
  });
}

function renderStatsCards(filter, allRecords) {
  const grid = document.getElementById('statsGrid');

  // For stats, use filtered data for selected student or all data
  const baseRecords  = filter ? allRecords.filter(r => r.studentId === filter) : allRecords;
  const baseSessions = filter ? DB.sessions.filter(r => r.studentId === filter) : DB.sessions;
  const baseHomework = filter ? DB.homework.filter(r => r.studentId === filter) : DB.homework;

  const totalSessions = baseSessions.length;
  const avgScore = baseRecords.length > 0
    ? (baseRecords.reduce((sum, g) => sum + (g.score / g.maxScore * 100), 0) / baseRecords.length).toFixed(1)
    : null;
  const doneHw    = baseHomework.filter(h => h.status === '已完成').length;
  const hwRate    = baseHomework.length > 0 ? Math.round(doneHw / baseHomework.length * 100) : null;
  const totalGrades = baseRecords.length;

  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon stat-icon-blue">📖</div>
      <div>
        <div class="stat-label">累計上課次數</div>
        <div class="stat-value">${totalSessions}</div>
        <div class="stat-sub">${filter ? getStudent(filter)?.name ?? '' : '全部學生'}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-green">📊</div>
      <div>
        <div class="stat-label">平均成績</div>
        <div class="stat-value">${avgScore !== null ? avgScore + '%' : '—'}</div>
        <div class="stat-sub">共 ${totalGrades} 筆成績</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-yellow">📝</div>
      <div>
        <div class="stat-label">作業完成率</div>
        <div class="stat-value">${hwRate !== null ? hwRate + '%' : '—'}</div>
        <div class="stat-sub">${doneHw} / ${baseHomework.length} 份完成</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-purple">👤</div>
      <div>
        <div class="stat-label">學生人數</div>
        <div class="stat-value">${filter ? 1 : DB.students.length}</div>
        <div class="stat-sub">${filter ? '篩選中' : '全部學生'}</div>
      </div>
    </div>
  `;
}

document.getElementById('gradeStudentFilter').addEventListener('change', renderGrades);

// ── Grade modal ──

document.getElementById('btnAddGrade').addEventListener('click', () => openGradeModal());

function openGradeModal(id) {
  const editing = id ? DB.grades.find(r => r.id === id) : null;
  document.getElementById('modalGradeTitle').textContent = editing ? '編輯成績' : '新增成績';
  document.getElementById('gradeId').value         = editing ? editing.id : '';
  document.getElementById('gradeStudentId').value  = editing ? editing.studentId : '';
  document.getElementById('gradeDate').value       = editing ? editing.date : today();
  document.getElementById('gradeSubject').value    = editing ? editing.subject : '';
  document.getElementById('gradeType').value       = editing ? editing.type : '';
  document.getElementById('gradeScore').value      = editing ? editing.score : '';
  document.getElementById('gradeMaxScore').value   = editing ? editing.maxScore : '100';
  document.getElementById('gradeNotes').value      = editing ? editing.notes : '';
  document.querySelectorAll('#formGrade .form-input').forEach(el => el.classList.remove('error'));
  openModal('modalGrade');
}

document.getElementById('btnSaveGrade').addEventListener('click', () => {
  const studentId = document.getElementById('gradeStudentId').value;
  const date      = document.getElementById('gradeDate').value;
  const subject   = document.getElementById('gradeSubject').value.trim();
  const type      = document.getElementById('gradeType').value;
  const scoreRaw  = document.getElementById('gradeScore').value;
  const maxRaw    = document.getElementById('gradeMaxScore').value;
  const notes     = document.getElementById('gradeNotes').value.trim();
  const id        = document.getElementById('gradeId').value;

  const score    = parseFloat(scoreRaw);
  const maxScore = parseFloat(maxRaw);

  let valid = true;
  const fields = [
    [document.getElementById('gradeStudentId'), !studentId],
    [document.getElementById('gradeDate'),      !date],
    [document.getElementById('gradeSubject'),   !subject],
    [document.getElementById('gradeType'),      !type],
    [document.getElementById('gradeScore'),     scoreRaw === '' || isNaN(score)],
    [document.getElementById('gradeMaxScore'),  maxRaw === '' || isNaN(maxScore) || maxScore <= 0],
  ];
  fields.forEach(([el, err]) => {
    el.classList.toggle('error', err);
    if (err) valid = false;
  });

  if (!valid) { showToast('請填寫必填欄位', 'error'); return; }
  if (score > maxScore) { showToast('得分不能超過滿分', 'error'); return; }

  const record = { studentId, date, subject, type, score, maxScore, notes };

  if (id) {
    const idx = DB.grades.findIndex(r => r.id === id);
    DB.grades[idx] = { ...DB.grades[idx], ...record };
    showToast('已更新成績紀錄');
  } else {
    DB.grades.push({ id: genId(), ...record, createdAt: new Date().toISOString() });
    showToast('已新增成績紀錄');
  }
  persist('grades');
  renderGrades();
  closeModal('modalGrade');
});

function deleteGrade(id) {
  if (!confirm('確定要刪除這筆成績紀錄嗎？')) return;
  DB.grades = DB.grades.filter(r => r.id !== id);
  persist('grades');
  renderGrades();
  showToast('已刪除成績紀錄', 'warning');
}

// ─────────────────────────────────────────────────────────
// Keyboard: Escape closes modals / detail panel
// ─────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  ['modalStudent','modalSession','modalHomework','modalGrade'].forEach(id => {
    if (document.getElementById(id).classList.contains('open')) closeModal(id);
  });
  if (document.getElementById('studentDetailOverlay').classList.contains('open')) {
    closeStudentDetail();
  }
});

// ─────────────────────────────────────────────────────────
// Initial render
// ─────────────────────────────────────────────────────────

(function init() {
  populateStudentDropdowns();
  renderStudents();
  // Sessions, homework, grades rendered lazily when tab is clicked
  // But also render them so they're ready if user switches tabs
  renderSessions();
  renderHomework();
  renderGrades();
})();
