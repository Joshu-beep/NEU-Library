import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
      const SUPABASE_URL = 'https://ruajjuxabwfqpawpjosl.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YWpqdXhhYndmcXBhd3Bqb3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTg0MjksImV4cCI6MjA4OTAzNDQyOX0.O1ZbG4vC6q4DxQKTq664i3e4xwUYcvgVDOsuNMDNK4I';
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      const PH = 'Asia/Manila';
      const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
      let allLogs = [], allUsers = [], visitChart = null;

      // ── Set welcome message ──
      const adminName = localStorage.getItem('adminName') || 'Admin';
      const adminRole = (localStorage.getItem('adminRole') || 'admin').toLowerCase();
      const roleLabel = adminRole === 'owner' ? 'Owner' : 'Admin';
      document.getElementById('adminWelcome').textContent = `Welcome, ${adminName} — ${roleLabel}`;

      function phDate(iso) { return new Date(iso).toLocaleDateString('en-PH', { timeZone: PH, year: 'numeric', month: 'short', day: 'numeric' }); }
      function phTime(iso) { return new Date(iso).toLocaleTimeString('en-PH', { timeZone: PH, hour: '2-digit', minute: '2-digit' }); }

      function calcDuration(timeIn, timeOut) {
        if (!timeOut) return '—';
        const diff = new Date(timeOut) - new Date(timeIn);
        if (diff < 0) return '—';
        const m = Math.floor(diff / 60000);
        const h = Math.floor(m / 60);
        return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
      }

      function todayPHStartISO() {
        const n = new Date(Date.now() + PH_OFFSET_MS);
        return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - PH_OFFSET_MS).toISOString();
      }

      function showToast(msg) {
        const x = document.getElementById('toast');
        x.textContent = msg; x.className = 'show';
        setTimeout(() => { x.className = x.className.replace('show', ''); }, 3000);
      }

      // ── Auto-logout stale inside records from previous days ──
      async function autoLogoutMidnight() {
        const todayStart = todayPHStartISO();
        await supabase
          .from('visit_logs')
          .update({ status: 'logged_out', time_out: todayStart })
          .eq('status', 'inside')
          .lt('time_in', todayStart);
      }

      // ── Stats ──
      async function loadStats() {
        const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

        // PH midnight today in UTC
        const nowUTC = new Date();
        const nowPH  = new Date(nowUTC.getTime() + PH_OFFSET_MS);
        const midnightPH = new Date(Date.UTC(
          nowPH.getUTCFullYear(), nowPH.getUTCMonth(), nowPH.getUTCDate(), 0, 0, 0
        ));
        const todayISO = new Date(midnightPH.getTime() - PH_OFFSET_MS).toISOString();
        const weekISO  = new Date(midnightPH.getTime() - PH_OFFSET_MS - 7 * 86400000).toISOString();

        try {
          // Live occupancy — count distinct users whose latest log is "inside"
          const { data: insideLogs } = await supabase
            .from('visit_logs')
            .select('user_id, status')
            .eq('status', 'inside');

          const uniqueInside = insideLogs
            ? new Set(insideLogs.map(r => r.user_id)).size
            : 0;

          // Visits today
          const { count: todayCount } = await supabase
            .from('visit_logs')
            .select('*', { count: 'exact', head: true })
            .gte('time_in', todayISO);

          // Visits this week
          const { count: weekCount } = await supabase
            .from('visit_logs')
            .select('*', { count: 'exact', head: true })
            .gte('time_in', weekISO);

          // Total registered users
          const { count: totalCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

          document.getElementById('live-stat').textContent  = uniqueInside ?? 0;
          document.getElementById('today-stat').textContent = todayCount   ?? 0;
          document.getElementById('week-stat').textContent  = weekCount    ?? 0;
          document.getElementById('total-stat').textContent = totalCount   ?? 0;

          // Avg visit duration (last 30 days, completed visits only)
          const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
          const { data: completedLogs } = await supabase
            .from('visit_logs').select('time_in, time_out')
            .eq('status', 'logged_out').gte('time_in', monthAgo).not('time_out', 'is', null);
          if (completedLogs?.length) {
            const avgMs = completedLogs.reduce((s, v) =>
              s + (new Date(v.time_out) - new Date(v.time_in)), 0) / completedLogs.length;
            const avgMin = Math.round(avgMs / 60000);
            const avgEl = document.getElementById('avg-stat');
            if (avgEl) avgEl.textContent = avgMin >= 60
              ? `${Math.floor(avgMin/60)}h ${avgMin%60}m`
              : `${avgMin}m`;
          } else {
            const avgEl = document.getElementById('avg-stat');
            if (avgEl) avgEl.textContent = '—';
          }

        } catch (err) {
          console.error('Stats error:', err);
          ['live-stat','today-stat','week-stat','total-stat'].forEach(id => {
            document.getElementById(id).textContent = '—';
          });
        }
      }

      // ── Currently Inside ──
      async function loadInsideNow() {
        const { data } = await supabase
          .from('visit_logs')
          .select('*, users(name, program)')
          .eq('status', 'inside')
          .order('time_in', { ascending: false });

        const tbody = document.getElementById('insideTableBody');
        if (!data?.length) {
          document.getElementById('inside-count').textContent = '0 people';
          tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-muted)">No one inside yet.</td></tr>`;
          return;
        }
        const seen = new Set();
        const unique = data.filter(r => { if (seen.has(r.user_id)) return false; seen.add(r.user_id); return true; });
        document.getElementById('inside-count').textContent = `${unique.length} ${unique.length === 1 ? 'person' : 'people'}`;
        tbody.innerHTML = unique.map(r => `
          <tr>
            <td><span class="pulse"></span>${r.users?.name || '—'}</td>
            <td><span class="badge badge-program" style="font-size:10px">${(r.users?.program || '—').substring(0,30)}</span></td>
            <td>${phTime(r.time_in)}</td>
          </tr>`).join('');
      }

      // ── Chart ──
      async function loadChart() {
        const days = [], labels = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() + PH_OFFSET_MS - i * 86400000);
          const y = d.getUTCFullYear(), m = String(d.getUTCMonth()+1).padStart(2,'0'), day = String(d.getUTCDate()).padStart(2,'0');
          days.push(`${y}-${m}-${day}`);
          labels.push(d.toLocaleDateString('en-PH', { timeZone: PH, weekday: 'short', month: 'short', day: 'numeric' }));
        }
        const counts = await Promise.all(days.map(async d => {
          const start = new Date(d + 'T00:00:00+08:00').toISOString();
          const end   = new Date(d + 'T23:59:59+08:00').toISOString();
          const { count } = await supabase.from('visit_logs').select('*', { count: 'exact', head: true }).gte('time_in', start).lte('time_in', end);
          return count ?? 0;
        }));
        const total = counts.reduce((a,b) => a+b, 0);
        document.getElementById('chart-subtitle').textContent = `${total} total visits`;
        const ctx = document.getElementById('visitChart').getContext('2d');
        if (visitChart) visitChart.destroy();
        visitChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{ label: 'Visits', data: counts, backgroundColor: 'rgba(0,31,84,0.75)', borderColor: '#001f54', borderWidth: 1, borderRadius: 6 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.parsed.y} visit${c.parsed.y !== 1 ? 's' : ''}` } } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
          }
        });
      }

      // ── Logs ──
      async function loadLogs() {
        const { data, error } = await supabase
          .from('visit_logs')
          .select('*, users(name, program, email)')
          .order('time_in', { ascending: false });
        if (error) { document.getElementById('logTableBody').innerHTML = `<tr class="loading-row"><td colspan="6">Error: ${error.message}</td></tr>`; return; }
        allLogs = data || [];
        renderLogs(allLogs);
      }

      function renderLogs(logs) {
        const tbody = document.getElementById('logTableBody');
        if (!logs.length) { tbody.innerHTML = `<tr class="loading-row"><td colspan="6">No visit records found.</td></tr>`; return; }
        tbody.innerHTML = logs.map(log => {
          const sc = log.status === 'inside' ? 'badge-inside' : log.status === 'logged_out' ? 'badge-logged-out' : 'badge-checkout';
          const sl = log.status === 'inside' ? 'Inside' : log.status === 'logged_out' ? 'Logged Out' : 'Checked Out';
          return `
            <tr data-log-id="${log.id}">
              <td><div class="name-stack"><span class="name">${phDate(log.time_in)}</span><span class="sub-text">${phTime(log.time_in)}</span></div></td>
              <td><div class="name-stack"><span class="name">${log.users?.name || 'Unknown'}</span><span class="sub-text">${log.users?.email || '—'}</span></div></td>
              <td><span class="badge badge-program">${log.users?.program || '—'}</span></td>
              <td>${log.reason}</td>
              <td><span class="duration-chip">${calcDuration(log.time_in, log.time_out)}</span></td>
              <td><span class="badge ${sc}">${sl}</span></td>
            </tr>`;
        }).join('');
      }

      // ── Users ──
      async function loadUsers() {
        const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
        if (error) { document.getElementById('usersTableBody').innerHTML = `<tr class="loading-row"><td colspan="6">Error: ${error.message}</td></tr>`; return; }
        allUsers = data || [];
        renderUsers(allUsers);
      }

      function renderUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!users.length) { tbody.innerHTML = `<tr class="loading-row"><td colspan="6">No user records found.</td></tr>`; return; }
        tbody.innerHTML = users.map(u => {
          const rc = u.role === 'faculty' ? 'badge-faculty' : 'badge-student';
          const rl = u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'Student';
          return `
            <tr data-user-id="${u.id}">
              <td><div class="name-stack"><span class="name">${u.name || '—'}</span></div></td>
              <td>${u.email}</td>
              <td><span class="badge badge-program">${u.program || '—'}</span></td>
              <td><span class="badge ${rc}">${rl}</span></td>
              <td id="status-${u.id}" style="color:${u.is_blocked ? 'var(--danger-red)' : '#16a34a'};font-weight:600;font-size:13px;">${u.is_blocked ? 'Blocked' : 'Active'}</td>
              <td>
                <div class="action-flex">
                  <button class="action-text-btn" id="block-btn-${u.id}" style="color:${u.is_blocked ? '#16a34a' : 'var(--danger-red)'}" onclick="toggleBlock('${u.id}', this)">${u.is_blocked ? 'Unblock' : 'Block'}</button>
                  <button class="action-icon-btn" onclick="removeUser('${u.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                      <path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>`;
        }).join('');
      }

      async function toggleBlock(userId, btn) {
        const blocking = btn.textContent.trim() === 'Block';
        const { error } = await supabase.from('users').update({ is_blocked: blocking }).eq('id', userId);
        if (error) { showToast('Error: ' + error.message); return; }
        const el = document.getElementById(`status-${userId}`);
        if (blocking) { el.textContent = 'Blocked'; el.style.color = 'var(--danger-red)'; btn.textContent = 'Unblock'; btn.style.color = '#16a34a'; showToast('User blocked.'); }
        else { el.textContent = 'Active'; el.style.color = '#16a34a'; btn.textContent = 'Block'; btn.style.color = 'var(--danger-red)'; showToast('User unblocked.'); }
      }

      async function removeUser(userId) {
        if (!confirm('Delete this user and all their visit logs?')) return;
        const { error } = await supabase.from('users').delete().eq('id', userId);
        if (error) { showToast('Error: ' + error.message); return; }
        document.querySelector(`tr[data-user-id="${userId}"]`)?.remove();
        const el = document.getElementById('total-stat');
        el.textContent = Math.max(0, parseInt(el.textContent) - 1);
        showToast('User removed.');
      }

      async function triggerResetAll() {
        if (!confirm('DANGER: Erase ALL visit logs and users? Cannot be undone.')) return;
        const [l, u] = await Promise.all([
          supabase.from('visit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
          supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        ]);
        if (l.error || u.error) { showToast('Reset failed.'); return; }
        document.getElementById('logTableBody').innerHTML = `<tr class="loading-row"><td colspan="6">No records.</td></tr>`;
        document.getElementById('usersTableBody').innerHTML = `<tr class="loading-row"><td colspan="6">No records.</td></tr>`;
        ['live-stat','today-stat','week-stat','total-stat'].forEach(id => document.getElementById(id).textContent = '0');
        showToast('Reset complete. Logging out...');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
      }

      function changeView(view, btn) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('log-view').classList.toggle('hidden', view !== 'log');
        document.getElementById('users-view').classList.toggle('hidden', view !== 'users');
        document.getElementById('notices-view').classList.toggle('hidden', view !== 'notices');
        document.getElementById('admins-view').classList.toggle('hidden', view !== 'admins');
        document.getElementById('dateFilterSection').classList.toggle('hidden', view !== 'log');
        document.querySelector('.search-box').classList.toggle('hidden', view === 'notices' || view === 'admins');
        document.getElementById('filterInput').value = '';
        if (view !== 'notices' && view !== 'admins') runFilter();
        if (view === 'users') loadUsers();
        if (view === 'notices') loadNoticesAdmin();
        if (view === 'admins') loadAdminsList();
      }

      // ── Admin Management (owner only) ──
      // Check role both from localStorage AND from Supabase to be reliable
      async function checkOwnerAccess() {
        const storedRole = (localStorage.getItem('adminRole') || '').toLowerCase();
        if (storedRole === 'owner') {
          const tab = document.getElementById('adminsTabBtn');
          if (tab) tab.style.display = '';
          return;
        }
        const adminEmail = localStorage.getItem('adminEmail');
        if (!adminEmail) return;
        const { data } = await supabase
          .from('users').select('role').eq('email', adminEmail).maybeSingle();
        if (data?.role?.toLowerCase() === 'owner') {
          localStorage.setItem('adminRole', 'owner');
          const tab = document.getElementById('adminsTabBtn');
          if (tab) tab.style.display = '';
        }
      }
      checkOwnerAccess();

      async function loadAdminsList() {
        const list = document.getElementById('adminsList');
        list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">Loading...</div>`;
        const { data, error } = await supabase
          .from('users').select('id, name, email, role')
          .in('role', ['admin', 'owner', 'Admin', 'Owner'])
          .order('role');
        if (error || !data?.length) {
          list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No admins assigned yet.</div>`;
          return;
        }
        list.innerHTML = data.map(u => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:white;border:1px solid var(--border-color);border-radius:10px;margin-bottom:8px;">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text-dark);">${u.name || '—'}</div>
              <div style="font-size:12px;color:var(--text-muted);">${u.email}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;${u.role?.toLowerCase() === 'owner' ? 'background:#fef3c7;color:#92400e;' : 'background:#eff6ff;color:#1d4ed8;'}">
                ${u.role?.toLowerCase() === 'owner' ? '👑 Owner' : 'Admin'}
              </span>
              ${u.role?.toLowerCase() !== 'owner' ? `<button onclick="removeAdmin('${u.id}','${u.email}')"
                style="padding:4px 12px;background:#fef2f2;color:#ef4444;border:1px solid #fecaca;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
                Remove
              </button>` : ''}
            </div>
          </div>`).join('');
      }

      async function assignAdmin() {
        const email = document.getElementById('assignAdminEmail').value.trim().toLowerCase();
        const msg = document.getElementById('assignMsg');
        msg.style.display = 'block';
        if (!email.endsWith('@neu.edu.ph')) {
          msg.textContent = 'Only @neu.edu.ph emails allowed.'; msg.style.color = '#ef4444'; return;
        }
        const { data, error } = await supabase.from('users').select('id, role').eq('email', email).maybeSingle();
        if (error || !data) { msg.textContent = 'Account not found. They must register first.'; msg.style.color = '#ef4444'; return; }
        if (data.role?.toLowerCase() === 'owner') { msg.textContent = 'Cannot change the owner role.'; msg.style.color = '#ef4444'; return; }
        if (data.role?.toLowerCase() === 'admin') { msg.textContent = 'This user is already an admin.'; msg.style.color = '#f59e0b'; return; }
        const { error: upErr } = await supabase.from('users').update({ role: 'admin' }).eq('id', data.id);
        if (upErr) { msg.textContent = 'Error: ' + upErr.message; msg.style.color = '#ef4444'; return; }
        msg.textContent = '✓ Admin assigned successfully!'; msg.style.color = '#16a34a';
        document.getElementById('assignAdminEmail').value = '';
        loadAdminsList();
        setTimeout(() => { msg.style.display = 'none'; }, 3000);
      }
      window.assignAdmin = assignAdmin;

      async function removeAdmin(userId, email) {
        if (!confirm(`Remove admin access from ${email}?`)) return;
        const { error } = await supabase.from('users').update({ role: 'student' }).eq('id', userId);
        if (error) { showToast('Error: ' + error.message); return; }
        showToast(`Admin access removed from ${email}.`);
        loadAdminsList();
      }
      window.removeAdmin = removeAdmin;

      // ── Load notices for admin ──
      async function loadNoticesAdmin() {
        const { data } = await supabase
          .from('notices').select('*').order('created_at', { ascending: false });

        const events    = (data || []).filter(n => n.type === 'event' || n.event_date);
        const reminders = (data || []).filter(n => n.type === 'reminder' && !n.event_date);

        renderNoticeList('eventsAdminList', events, true);
        renderNoticeList('remindersAdminList', reminders, false);
      }

      function renderNoticeList(containerId, items, showDate) {
        const el = document.getElementById(containerId);
        if (!items.length) {
          el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;">None yet.</div>`;
          return;
        }
        el.innerHTML = items.map(n => {
          const dateStr = n.event_date
            ? new Date(n.event_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
            : '';
          const startStr = n.start_date
            ? new Date(n.start_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
            : '';
          const isScheduled = n.start_date && new Date(n.start_date) > new Date();
          return `<div style="background:${n.active ? 'white' : '#f8fafc'};border:1px solid ${n.active ? 'var(--border-color)' : '#e2e8f0'};border-radius:8px;padding:10px 12px;margin-bottom:8px;opacity:${n.active ? 1 : 0.6};">
            <div style="font-size:13px;color:var(--text-dark);margin-bottom:${dateStr ? '3px' : '6px'};line-height:1.4;">${n.message}</div>
            ${dateStr ? `<div style="font-size:11px;color:#3b82f6;font-weight:600;margin-bottom:4px;">📅 ${dateStr}</div>` : ''}
            ${isScheduled ? `<div style="font-size:11px;color:#f59e0b;font-weight:600;margin-bottom:4px;">⏰ Scheduled: shows from ${startStr}</div>` : ''}
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button onclick="toggleNotice('${n.id}',${n.active})"
                style="padding:4px 10px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid;${n.active ? 'background:#f1f5f9;color:#64748b;border-color:#e2e8f0' : 'background:#f0fdf4;color:#16a34a;border-color:#bbf7d0'}">
                ${n.active ? 'Hide' : 'Show'}
              </button>
              <button onclick="deleteNotice('${n.id}')"
                style="padding:4px 10px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;background:#fef2f2;color:#ef4444;border:1px solid #fecaca;">
                Delete
              </button>
            </div>
          </div>`;
        }).join('');
      }

      // ── Add announcement (event with date) ──
      async function addAnnouncement() {
        const msg       = document.getElementById('eventInput').value.trim();
        const date      = document.getElementById('eventDateInput').value;
        const startDate = document.getElementById('eventStartInput').value;
        if (!msg) { showToast('Please enter an announcement message.'); return; }
        // If start date is set and in future, post as inactive
        const isActive = !startDate || new Date(startDate) <= new Date();
        const { error } = await supabase.from('notices').insert({
          message: msg, active: isActive, type: 'event',
          event_date: date || null, start_date: startDate || null
        });
        if (error) { showToast('Error: ' + error.message); return; }
        document.getElementById('eventInput').value = '';
        document.getElementById('eventDateInput').value = '';
        document.getElementById('eventStartInput').value = '';
        showToast(isActive ? 'Announcement posted!' : 'Announcement scheduled — will show from ' + startDate);
        loadNoticesAdmin();
      }

      // ── Add reminder ──
      async function addReminder() {
        const msg       = document.getElementById('reminderInput').value.trim();
        const startDate = document.getElementById('reminderStartInput').value;
        if (!msg) { showToast('Please enter a reminder message.'); return; }
        const isActive = !startDate || new Date(startDate) <= new Date();
        const { error } = await supabase.from('notices').insert({
          message: msg, active: isActive, type: 'reminder',
          event_date: null, start_date: startDate || null
        });
        if (error) { showToast('Error: ' + error.message); return; }
        document.getElementById('reminderInput').value = '';
        document.getElementById('reminderStartInput').value = '';
        showToast(isActive ? 'Reminder posted!' : 'Reminder scheduled — will show from ' + startDate);
        loadNoticesAdmin();
      }

      // ── Toggle notice visibility ──
      async function toggleNotice(id, currentActive) {
        await supabase.from('notices').update({ active: !currentActive }).eq('id', id);
        loadNoticesAdmin();
      }

      // ── Delete notice ──
      async function deleteNotice(id) {
        if (!confirm('Delete this notice?')) return;
        await supabase.from('notices').delete().eq('id', id);
        showToast('Deleted.');
        loadNoticesAdmin();
      }

      function runFilter() {
        const f = document.getElementById('filterInput').value.toUpperCase();
        const isUsers = !document.getElementById('users-view').classList.contains('hidden');
        if (isUsers) {
          // Live user search — filter allUsers
          const filtered = allUsers.filter(u =>
            (u.name || '').toUpperCase().includes(f) ||
            (u.email || '').toUpperCase().includes(f) ||
            (u.program || '').toUpperCase().includes(f)
          );
          renderUsers(filtered);
        } else {
          const tbl = 'logTable';
          Array.from(document.getElementById(tbl).getElementsByTagName('tr')).slice(1).forEach(r => {
            r.style.display = r.textContent.toUpperCase().includes(f) ? '' : 'none';
          });
        }
      }

      function filterByDate() {
        const from = document.getElementById('dateFrom').value;
        const to   = document.getElementById('dateTo').value;
        if (!from && !to) { renderLogs(allLogs); return; }
        renderLogs(allLogs.filter(l => { const d = l.time_in.split('T')[0]; return (!from || d >= from) && (!to || d <= to); }));
      }

      function getFilteredLogs() {
        const from = document.getElementById('dateFrom').value;
        const to   = document.getElementById('dateTo').value;
        if (!from && !to) return allLogs;
        return allLogs.filter(l => { const d = l.time_in.split('T')[0]; return (!from || d >= from) && (!to || d <= to); });
      }

      function exportCSV() {
        const logs = getFilteredLogs();
        const rows = [['Date & Time In','Time Out','Duration','Name','Email','Program','Reason','Status']];
        logs.forEach(l => rows.push([
          `${phDate(l.time_in)} ${phTime(l.time_in)}`,
          l.time_out ? `${phDate(l.time_out)} ${phTime(l.time_out)}` : '—',
          calcDuration(l.time_in, l.time_out),
          l.users?.name || '—', l.users?.email || '—', l.users?.program || '—', l.reason, l.status
        ]));
        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        const from = document.getElementById('dateFrom').value;
        const to   = document.getElementById('dateTo').value;
        const suffix = from && to ? `_${from}_to_${to}` : '';
        a.download = `NEU_Visits${suffix}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
      }
      function exportPDF() { window.print(); }
      function logout() { if (confirm('End administrator session?')) window.location.href = 'index.html'; }

      window.changeView = changeView; window.runFilter = runFilter; window.filterByDate = filterByDate;
      window.triggerResetAll = triggerResetAll; window.toggleBlock = toggleBlock; window.removeUser = removeUser;
      window.exportCSV = exportCSV; window.exportPDF = exportPDF; window.logout = logout;
      window.addAnnouncement = addAnnouncement; window.addReminder = addReminder;
      window.toggleNotice = toggleNotice; window.deleteNotice = deleteNotice;

      // ── Init ──
      autoLogoutMidnight().catch(e => console.warn('autoLogout:', e));
      loadStats().catch(e => console.error('loadStats:', e));
      loadInsideNow().catch(e => console.error('loadInsideNow:', e));
      loadChart().catch(e => console.error('loadChart:', e));
      loadLogs().catch(e => console.error('loadLogs:', e));

      // ── Real-time auto-update ──
      // Subscribe to visit_logs changes — fires instantly when anyone checks in or out
      supabase
        .channel('visit_logs_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'visit_logs' }, () => {
          loadStats().catch(() => {});
          loadInsideNow().catch(() => {});
          loadLogs().catch(() => {});
          loadChart().catch(() => {});
        })
        .subscribe();

      // Subscribe to users table changes — fires when a new user registers or is blocked/deleted
      supabase
        .channel('users_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          loadStats().catch(() => {});
          // If Manage Users tab is active, reload it too
          if (document.getElementById('users-view') && !document.getElementById('users-view').classList.contains('hidden')) {
            loadUsers().catch(() => {});
          }
        })
        .subscribe();

      // ── Fallback polling every 30 seconds ──
      // Catches any changes that Realtime might miss (e.g. if websocket drops)
      setInterval(() => {
        loadStats().catch(() => {});
        loadInsideNow().catch(() => {});
      }, 30000);

      // Poll logs and chart every 2 minutes
      setInterval(() => {
        loadLogs().catch(() => {});
        loadChart().catch(() => {});
      }, 120000);
