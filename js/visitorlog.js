import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
      const SUPABASE_URL = 'https://ruajjuxabwfqpawpjosl.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YWpqdXhhYndmcXBhd3Bqb3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTg0MjksImV4cCI6MjA4OTAzNDQyOX0.O1ZbG4vC6q4DxQKTq664i3e4xwUYcvgVDOsuNMDNK4I';
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      const userId      = localStorage.getItem("userId");
      const userName    = localStorage.getItem("userName")    || "Guest";
      const userEmail   = localStorage.getItem("userEmail")   || "—";
      const userProgram = localStorage.getItem("userProgram") || "—";
      if (!userId) { window.location.href = "index.html"; }

      const reasonOptions = document.querySelectorAll(".reason-option");
      const submitLogBtn  = document.getElementById("submitLogBtn");
      let selectedReason  = null;
      let alreadyLoggedId = null;

      // ── User details ──
      document.getElementById("displayUserName").textContent    = userName;
      document.getElementById("displayUserEmail").textContent   = userEmail;
      document.getElementById("displayUserProgram").textContent = userProgram;
      document.getElementById("userAvatar").textContent = userName.charAt(0).toUpperCase();

      // ── Greeting ──
      const hr = parseInt(new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hour12: false }));
      document.getElementById("userGreeting").textContent = hr < 12 ? "Good morning," : hr < 17 ? "Good afternoon," : "Good evening,";

      // ── Clock ──
      function updateClock() {
        document.getElementById("navClock").textContent = new Date().toLocaleString("en-PH", {
          timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
      }
      updateClock(); setInterval(updateClock, 1000);

      // ── Session timer ──
      function startSessionTimer(fromISO) {
        const start = new Date(fromISO);
        function tick() {
          const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
          const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
          document.getElementById("sessionTimer").textContent =
            h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
        }
        tick(); setInterval(tick, 1000);
      }

      // ── Duration helper ──
      function calcDuration(a, b) {
        if (!b) return "—";
        const m = Math.floor((new Date(b) - new Date(a)) / 60000);
        const h = Math.floor(m / 60);
        return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
      }

      // ── Check if already inside ──
      async function checkAlreadyInside() {
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const { data } = await supabase
          .from("visit_logs").select("id, time_in, reason")
          .eq("user_id", userId).eq("status", "inside")
          .gte("time_in", todayStart.toISOString())
          .order("time_in", { ascending: false }).limit(1).maybeSingle();

        if (data) {
          alreadyLoggedId = data.id;
          localStorage.setItem("currentLogId", data.id);

          document.getElementById("sessionCard").classList.add("show");
          const timeIn = new Date(data.time_in).toLocaleTimeString("en-PH", {
            timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit"
          });
          document.getElementById("sessionSince").textContent = `Checked in at ${timeIn} for "${data.reason}"`;
          startSessionTimer(data.time_in);

          const banner = document.getElementById("alreadyBanner");
          banner.classList.add("show");
          document.getElementById("alreadySince").textContent = `Checked in at ${timeIn} for "${data.reason}"`;

          // Show check-out button, hide log visit
          submitLogBtn.style.display = "none";
          document.getElementById("checkoutBtn").style.display = "block";
          reasonOptions.forEach(o => { o.style.pointerEvents = "none"; o.style.opacity = "0.45"; });
        }
      }

      // ── Visit history ──
      async function loadVisitHistory() {
        const { data } = await supabase
          .from("visit_logs").select("reason, time_in, time_out")
          .eq("user_id", userId).eq("status", "logged_out")
          .order("time_in", { ascending: false }).limit(5);

        const list = document.getElementById("visitHistoryList");
        if (!data?.length) return;
        list.innerHTML = data.map(v => {
          const date = new Date(v.time_in).toLocaleDateString("en-PH", {
            timeZone: "Asia/Manila", month: "short", day: "numeric"
          });
          return `<div class="history-item">
            <div><div class="h-reason">${v.reason}</div><div class="h-date">${date}</div></div>
            <span class="h-dur">${calcDuration(v.time_in, v.time_out)}</span>
          </div>`;
        }).join("");
      }

      // ── Visit analytics chart ──
      async function loadAnalyticsChart() {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString();
        const { data } = await supabase
          .from("visit_logs").select("time_in")
          .eq("user_id", userId).gte("time_in", monthStart);
        if (!data?.length) return;

        const counts = {};
        data.forEach(v => {
          const week = getWeekLabel(new Date(v.time_in));
          counts[week] = (counts[week] || 0) + 1;
        });

        const labels = Object.keys(counts).sort();
        const values = labels.map(l => counts[l]);

        const ctx = document.getElementById("analyticsChart")?.getContext("2d");
        if (!ctx) return;

        // Load Chart.js dynamically
        if (!window.Chart) {
          await new Promise(res => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
            s.onload = res; document.head.appendChild(s);
          });
        }

        new window.Chart(ctx, {
          type: "bar",
          data: {
            labels,
            datasets: [{ data: values, backgroundColor: "#001f54", borderRadius: 6 }]
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } },
              x: { ticks: { font: { size: 10 } } }
            }
          }
        });
      }

      function getWeekLabel(date) {
        const d = new Date(date);
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - d.getDay());
        return d.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
      }

      // ── Streak ──
      async function loadStreak() {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { data } = await supabase
          .from("visit_logs").select("time_in").eq("user_id", userId).gte("time_in", monthStart);
        if (!data?.length) return;
        const days = new Set(data.map(v =>
          new Date(v.time_in).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })
        )).size;
        document.getElementById("streakCard").classList.add("show");
        document.getElementById("streakCount").textContent = `${days} day${days !== 1 ? "s" : ""} visited this month`;
        document.getElementById("streakSub").textContent =
          days >= 10 ? "Amazing dedication! 🎉" : days >= 5 ? "Great consistency!" : days >= 2 ? "Keep coming back!" : "Welcome! See you again soon.";
      }

      // ── Last used reason — auto-select ──
      async function loadLastReason() {
        const { data } = await supabase
          .from("visit_logs").select("reason").eq("user_id", userId)
          .order("time_in", { ascending: false }).limit(1).maybeSingle();
        if (data?.reason) {
          const match = [...reasonOptions].find(o => o.dataset.reason === data.reason);
          if (match) {
            const tag = document.createElement("span");
            tag.className = "last-used-tag"; tag.textContent = "Last used";
            match.appendChild(tag); match.classList.add("last-used");
            // Auto-select it
            if (!alreadyLoggedId) {
              match.classList.add("selected");
              selectedReason = data.reason;
              submitLogBtn.disabled = false;
            }
          }
        }
      }

      // ── QR Code ──
      function generateQR(id, size) {
        const el = document.getElementById(id);
        el.innerHTML = "";
        new QRCode(el, {
          text: JSON.stringify({ uid: userId, name: userName, email: userEmail }),
          width: size, height: size, colorDark: "#001f54", colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }

      document.getElementById("showQrBtn").addEventListener("click", () => {
        generateQR("qrModalCanvas", 190);
        document.getElementById("qrModalName").textContent    = userName;
        document.getElementById("qrModalProgram").textContent = userProgram;
        document.getElementById("qrModal").style.display = "flex";
      });

      document.getElementById("downloadQrBtn").addEventListener("click", () => {
        const qrCanvas = document.querySelector("#qrModalCanvas canvas");
        const qrImg    = document.querySelector("#qrModalCanvas img");
        const qrSrc    = qrCanvas ? qrCanvas.toDataURL("image/png") : qrImg?.src;
        if (!qrSrc) return;
        const W = 400, H = 520;
        const offscreen = document.createElement("canvas");
        offscreen.width = W * 2; offscreen.height = H * 2;
        const ctx = offscreen.getContext("2d");
        ctx.scale(2, 2);
        ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.roundRect(0,0,W,H,20); ctx.fill();
        ctx.fillStyle = "#001f54"; ctx.beginPath(); ctx.roundRect(0,0,W,70,[20,20,0,0]); ctx.fill();
        ctx.fillStyle = "#f59e0b"; ctx.fillRect(0,68,W,4);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 18px 'Segoe UI',sans-serif"; ctx.textAlign = "center";
        ctx.fillText("Your Library QR Code", W/2, 32);
        ctx.font = "13px 'Segoe UI',sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText("NEU Library Visitor Management System", W/2, 54);
        const qrSize=220, qrX=(W-qrSize)/2, qrY=90, pad=14;
        ctx.fillStyle="#f8fafc"; ctx.strokeStyle="#e2e8f0"; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.roundRect(qrX-pad,qrY-pad,qrSize+pad*2,qrSize+pad*2,14); ctx.fill(); ctx.stroke();
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img,qrX,qrY,qrSize,qrSize);
          ctx.strokeStyle="#e2e8f0"; ctx.lineWidth=1; ctx.beginPath();
          ctx.moveTo(40,qrY+qrSize+pad+20); ctx.lineTo(W-40,qrY+qrSize+pad+20); ctx.stroke();
          ctx.fillStyle="#001f54"; ctx.font="bold 20px 'Segoe UI',sans-serif"; ctx.textAlign="center";
          ctx.fillText(userName,W/2,qrY+qrSize+pad+48);
          ctx.fillStyle="#64748b"; ctx.font="14px 'Segoe UI',sans-serif";
          ctx.fillText(userProgram,W/2,qrY+qrSize+pad+70);
          ctx.fillStyle="#001f54"; ctx.beginPath(); ctx.roundRect(30,H-66,W-60,42,10); ctx.fill();
          ctx.fillStyle="#ffffff"; ctx.font="bold 14px 'Segoe UI',sans-serif";
          ctx.fillText("New Era University Library",W/2,H-40);
          const a=document.createElement("a");
          a.href=offscreen.toDataURL("image/png");
          a.download=`NEU_QR_${userName.replace(/\s+/g,"_")}.png`; a.click();
        };
        img.src = qrSrc;
      });

      // ── Reason selection ──
      reasonOptions.forEach(option => {
        option.addEventListener("click", () => {
          if (alreadyLoggedId) return;
          reasonOptions.forEach(o => o.classList.remove("selected"));
          option.classList.add("selected");
          selectedReason = option.dataset.reason;
          submitLogBtn.disabled = false;
        });
      });

      function showMessage(msg) {
        const box = document.getElementById("msgBox");
        box.textContent = msg; box.style.display = "block";
        setTimeout(() => { box.style.display = "none"; }, 3000);
      }

      // ── Submit ──
      submitLogBtn.addEventListener("click", async () => {
        if (!selectedReason || alreadyLoggedId) return;
        submitLogBtn.disabled = true;
        submitLogBtn.textContent = "Logging visit...";
        reasonOptions.forEach(o => { o.style.pointerEvents = "none"; });

        const { data: logData, error } = await supabase
          .from("visit_logs")
          .insert({ user_id: userId, reason: selectedReason, status: "inside" })
          .select("id").single();

        if (error) {
          showMessage("Failed: " + error.message);
          submitLogBtn.disabled = false; submitLogBtn.textContent = "Log Visit";
          reasonOptions.forEach(o => { o.style.pointerEvents = ""; });
          return;
        }
        if (logData?.id) localStorage.setItem("currentLogId", logData.id);
        showWelcomePopup();
      });

      // ── Check-out (already inside) ──
      document.getElementById("checkoutBtn").addEventListener("click", async () => {
        const btn = document.getElementById("checkoutBtn");
        btn.disabled = true; btn.textContent = "Checking out...";
        const logId = alreadyLoggedId || localStorage.getItem("currentLogId");
        const payload = { status: "logged_out", time_out: new Date().toISOString() };
        if (logId) {
          await supabase.from("visit_logs").update(payload).eq("id", logId);
        }
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.href = "index.html";
      });

      // ── Log out (account logout) ──
      document.getElementById("logoutBtn").addEventListener("click", async () => {
        const logId = localStorage.getItem("currentLogId");
        const payload = { status: "logged_out", time_out: new Date().toISOString() };
        if (logId) {
          await supabase.from("visit_logs").update(payload).eq("id", logId);
        } else {
          const { data } = await supabase
            .from("visit_logs").select("id").eq("user_id", userId).eq("status", "inside")
            .order("time_in", { ascending: false }).limit(1).maybeSingle();
          if (data) await supabase.from("visit_logs").update(payload).eq("id", data.id);
        }
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.href = "index.html";
      });

      // ── Library hours ──
      function updateHoursPill() {
        const schedule = {
          0: null,
          1: { open: 7, close: 21 }, 2: { open: 7, close: 21 },
          3: { open: 7, close: 21 }, 4: { open: 7, close: 21 },
          5: { open: 7, close: 21 }, 6: { open: 8, close: 17 },
        };
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        const day = now.getDay(), h = now.getHours();
        const pill = document.getElementById("hoursPill");
        const hrs = schedule[day];
        if (!hrs) { pill.textContent = "Closed today"; pill.className = "hours-pill closed"; }
        else if (h >= hrs.open && h < hrs.close) {
          const c = hrs.close > 12 ? `${hrs.close-12}:00 PM` : `${hrs.close}:00 AM`;
          pill.textContent = `Open · Closes ${c}`; pill.className = "hours-pill open";
        } else if (h < hrs.open) {
          const o = hrs.open >= 12 ? `${hrs.open>12?hrs.open-12:hrs.open}:00 PM` : `${hrs.open}:00 AM`;
          pill.textContent = `Opens at ${o}`; pill.className = "hours-pill soon";
        } else { pill.textContent = "Closed now"; pill.className = "hours-pill closed"; }
      }
      updateHoursPill();

      // ── Profile photo ──
      async function loadProfilePhoto() {
        const { data } = await supabase.storage.from("avatars").download(`${userId}/avatar`);
        if (data) {
          const url = URL.createObjectURL(data);
          const av = document.getElementById("userAvatar");
          av.style.backgroundImage = `url(${url})`;
          av.style.backgroundSize = "cover";
          av.style.backgroundPosition = "center";
          av.textContent = "";
        }
      }

      document.getElementById("avatarUploadBtn")?.addEventListener("click", () => {
        document.getElementById("avatarInput").click();
      });

      document.getElementById("avatarInput")?.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const { error } = await supabase.storage.from("avatars").upload(`${userId}/avatar`, file, { upsert: true });
        if (!error) { await loadProfilePhoto(); showMessage("Photo updated!"); }
        else showMessage("Upload failed: " + error.message);
      });

      // ── Init ──
      checkAlreadyInside();
      loadVisitHistory();
      loadStreak();
      loadLastReason();
      loadProfilePhoto();
      loadAnalyticsChart();

      function showWelcomePopup() {
        const popup = document.getElementById("welcomePopup");
        const bar   = document.getElementById("welcomeBar");
        const count = document.getElementById("welcomeCount");
        popup.style.display = "flex";
        setTimeout(() => { bar.style.width = "0%"; }, 50);
        let t = 3;
        const tick = setInterval(() => {
          t--; count.textContent = t;
          if (t <= 0) {
            clearInterval(tick);
            localStorage.removeItem("currentLogId");
            localStorage.clear();
            window.location.href = "index.html";
          }
        }, 1000);
      }
