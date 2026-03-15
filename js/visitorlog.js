// ── State ──
let allLogs = [];
let allUsers = [];

// ── Toast ──
function showToast(msg) {
  const x = document.getElementById("toast");
  x.textContent = msg;
  x.className = "show";
  setTimeout(() => {
    x.className = x.className.replace("show", "");
  }, 3000);
}

// ── Load Stats ──
async function loadStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);
  const weekISO = weekAgo.toISOString();

  const [liveRes, todayRes, weekRes, totalRes] = await Promise.all([
    supabase
      .from("visit_logs")
      .select("*", { count: "exact", head: true })
      .eq("status", "inside"),
    supabase
      .from("visit_logs")
      .select("*", { count: "exact", head: true })
      .gte("time_in", todayISO),
    supabase
      .from("visit_logs")
      .select("*", { count: "exact", head: true })
      .gte("time_in", weekISO),
    supabase.from("users").select("*", { count: "exact", head: true }),
  ]);

  document.getElementById("live-stat").textContent = liveRes.count ?? 0;
  document.getElementById("today-stat").textContent = todayRes.count ?? 0;
  document.getElementById("week-stat").textContent = weekRes.count ?? 0;
  document.getElementById("total-stat").textContent = totalRes.count ?? 0;
}

// ── Load Visit Logs ──
async function loadLogs() {
  const { data, error } = await supabase
    .from("visit_logs")
    .select("*, users(name, program, email)")
    .order("time_in", { ascending: false });

  if (error) {
    document.getElementById("logTableBody").innerHTML =
      `<tr class="loading-row"><td colspan="5">Error loading logs: ${error.message}</td></tr>`;
    return;
  }

  allLogs = data || [];
  renderLogs(allLogs);
}

function renderLogs(logs) {
  const tbody = document.getElementById("logTableBody");
  if (!logs.length) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="5">No visit records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs
    .map((log) => {
      const dt = new Date(log.time_in);
      const dateStr = dt.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const timeStr = dt.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const statusClass =
        log.status === "inside" ? "badge-inside" : "badge-checkout";
      const statusLabel = log.status === "inside" ? "Inside" : "Checked Out";

      return `
            <tr data-log-id="${log.id}">
              <td>
                <div class="name-stack">
                  <span class="name">${dateStr}</span>
                  <span class="sub-text">${timeStr}</span>
                </div>
              </td>
              <td>
                <div class="name-stack">
                  <span class="name">${log.users?.name || "Unknown"}</span>
                  <span class="sub-text">${log.users?.email || "—"}</span>
                </div>
              </td>
              <td><span class="badge badge-program">${log.users?.program || "—"}</span></td>
              <td>${log.reason}</td>
              <td><span class="badge ${statusClass}">${statusLabel}</span></td>
            </tr>`;
    })
    .join("");
}

// ── Load Users ──
async function loadUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    document.getElementById("usersTableBody").innerHTML =
      `<tr class="loading-row"><td colspan="6">Error loading users: ${error.message}</td></tr>`;
    return;
  }

  allUsers = data || [];
  renderUsers(allUsers);
}

function renderUsers(users) {
  const tbody = document.getElementById("usersTableBody");
  if (!users.length) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="6">No user records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = users
    .map((user) => {
      const roleClass =
        user.role === "faculty" ? "badge-faculty" : "badge-student";
      const roleLabel = user.role
        ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
        : "Student";
      const isBlocked = user.is_blocked;

      return `
            <tr data-user-id="${user.id}">
              <td>
                <div class="name-stack">
                  <span class="name">${user.name || "—"}</span>
                </div>
              </td>
              <td>${user.email}</td>
              <td><span class="badge badge-program">${user.program || "—"}</span></td>
              <td><span class="badge ${roleClass}">${roleLabel}</span></td>
              <td id="status-${user.id}" style="color: ${isBlocked ? "var(--danger-red)" : "#16a34a"}; font-weight: 600; font-size: 13px;">
                ${isBlocked ? "Blocked" : "Active"}
              </td>
              <td>
                <div class="action-flex">
                  <button class="action-text-btn" id="block-btn-${user.id}"
                    style="color: ${isBlocked ? "#16a34a" : "var(--danger-red)"}"
                    onclick="toggleBlock('${user.id}', this)">
                    ${isBlocked ? "Unblock" : "Block"}
                  </button>
                  <button class="action-icon-btn" onclick="removeUser('${user.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                      <path d="M10 11v6"></path><path d="M14 11v6"></path>
                      <path d="M9 6V4h6v2"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>`;
    })
    .join("");
}

// ── Toggle Block/Unblock ──
async function toggleBlock(userId, btn) {
  const isCurrentlyBlocking = btn.textContent.trim() === "Block";
  const { error } = await supabase
    .from("users")
    .update({ is_blocked: isCurrentlyBlocking })
    .eq("id", userId);

  if (error) {
    showToast("Error: " + error.message);
    return;
  }

  const statusEl = document.getElementById(`status-${userId}`);
  if (isCurrentlyBlocking) {
    statusEl.textContent = "Blocked";
    statusEl.style.color = "var(--danger-red)";
    btn.textContent = "Unblock";
    btn.style.color = "#16a34a";
    showToast("User has been blocked.");
  } else {
    statusEl.textContent = "Active";
    statusEl.style.color = "#16a34a";
    btn.textContent = "Block";
    btn.style.color = "var(--danger-red)";
    showToast("User access restored.");
  }
}

// ── Remove User ──
async function removeUser(userId) {
  if (
    !confirm(
      "Are you sure you want to delete this user? This will also delete their visit logs.",
    )
  )
    return;

  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) {
    showToast("Error: " + error.message);
    return;
  }

  const row = document.querySelector(`tr[data-user-id="${userId}"]`);
  if (row) row.remove();

  const totalStat = document.getElementById("total-stat");
  totalStat.textContent = Math.max(0, parseInt(totalStat.textContent) - 1);
  showToast("User removed from database.");
}

// ── Reset DB ──
async function triggerResetAll() {
  if (
    !confirm(
      "DANGER: This will erase ALL visit logs and users from the database. This cannot be undone. Proceed?",
    )
  )
    return;

  const [logsRes, usersRes] = await Promise.all([
    supabase
      .from("visit_logs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"),
    supabase
      .from("users")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"),
  ]);

  if (logsRes.error || usersRes.error) {
    showToast("Reset failed. Check console.");
    console.error(logsRes.error, usersRes.error);
    return;
  }

  document.getElementById("logTableBody").innerHTML =
    `<tr class="loading-row"><td colspan="5">No visit records found.</td></tr>`;
  document.getElementById("usersTableBody").innerHTML =
    `<tr class="loading-row"><td colspan="6">No user records found.</td></tr>`;
  ["live-stat", "today-stat", "week-stat", "total-stat"].forEach((id) => {
    document.getElementById(id).textContent = "0";
  });

  showToast("Database reset. Logging out...");
  setTimeout(() => {
    window.location.href = "index.html";
  }, 1500);
}

// ── View Toggle ──
function changeView(view, btn) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  document
    .getElementById("log-view")
    .classList.toggle("hidden", view !== "log");
  document
    .getElementById("users-view")
    .classList.toggle("hidden", view !== "users");
  document
    .getElementById("dateFilterSection")
    .classList.toggle("hidden", view === "users");
  document.getElementById("filterInput").value = "";
  runFilter();

  if (view === "users") loadUsers();
}

// ── Filter ──
function runFilter() {
  const filter = document.getElementById("filterInput").value.toUpperCase();
  const activeTable = document
    .getElementById("log-view")
    .classList.contains("hidden")
    ? "usersTable"
    : "logTable";
  const tr = document.getElementById(activeTable).getElementsByTagName("tr");
  for (let i = 1; i < tr.length; i++) {
    const text = tr[i].textContent || tr[i].innerText;
    tr[i].style.display = text.toUpperCase().includes(filter) ? "" : "none";
  }
}

// ── Date Filter ──
function filterByDate() {
  const from = document.getElementById("dateFrom").value;
  const to = document.getElementById("dateTo").value;
  if (!from && !to) {
    renderLogs(allLogs);
    return;
  }

  const filtered = allLogs.filter((log) => {
    const logDate = log.time_in.split("T")[0];
    if (from && logDate < from) return false;
    if (to && logDate > to) return false;
    return true;
  });
  renderLogs(filtered);
}

// ── Export CSV ──
function exportCSV() {
  const rows = [
    ["Date & Time", "Name", "Email", "Program", "Reason", "Status"],
  ];
  allLogs.forEach((log) => {
    rows.push([
      new Date(log.time_in).toLocaleString("en-PH"),
      log.users?.name || "—",
      log.users?.email || "—",
      log.users?.program || "—",
      log.reason,
      log.status,
    ]);
  });
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `NEU_Visit_Logs_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

// ── Export PDF (print) ──
function exportPDF() {
  window.print();
}

// ── Logout ──
function logout() {
  if (confirm("End administrator session?")) {
    window.location.href = "index.html";
  }
}

// ── Init ──
loadStats();
loadLogs();
