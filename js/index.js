import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
      const SUPABASE_URL = 'https://ruajjuxabwfqpawpjosl.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YWpqdXhhYndmcXBhd3Bqb3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTg0MjksImV4cCI6MjA4OTAzNDQyOX0.O1ZbG4vC6q4DxQKTq664i3e4xwUYcvgVDOsuNMDNK4I';
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      const loginView = document.getElementById("loginView");
      const registerView = document.getElementById("registerView");
      const adminView = document.getElementById("adminView");
      const mainHeader = document.getElementById("mainHeader");
      const headerSubtitle = document.getElementById("headerSubtitle");

      function showMessage(msg, color = "#001f54") {
        const msgBox = document.getElementById("msgBox");
        msgBox.textContent = msg;
        msgBox.style.backgroundColor = color;
        msgBox.style.display = "block";
        setTimeout(() => { msgBox.style.display = "none"; }, 4000);
      }

      // ── Navigation ──
      document.getElementById("showRegisterBtn").onclick = () => {
        loginView.style.display = "none";
        registerView.style.display = "flex";
      };
      document.getElementById("showLoginLink").onclick = (e) => {
        e.preventDefault();
        registerView.style.display = "none";
        loginView.style.display = "flex";
      };
      document.getElementById("adminBtn").onclick = (e) => {
        e.preventDefault();
        loginView.style.display = "none";
        registerView.style.display = "none";
        adminView.style.display = "flex";
        mainHeader.classList.add("admin-mode");
        headerSubtitle.textContent = "Admin Control Panel";
        showMessage("Switching to Administrator Mode");
      };
      document.getElementById("backFromAdmin").onclick = (e) => {
        e.preventDefault();
        adminView.style.display = "none";
        loginView.style.display = "flex";
        mainHeader.classList.remove("admin-mode");
        headerSubtitle.textContent = "Visitor Management System";
      };

      // ── LOGIN ──
      document.getElementById("loginForm").onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById("loginBtn");
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;

        const resetBtn = () => { btn.disabled = false; btn.textContent = "Sign In"; };
        btn.disabled = true;
        btn.textContent = "Signing in...";

        // 1. Domain restriction
        if (!email.endsWith("@neu.edu.ph")) {
          showMessage("Only @neu.edu.ph email addresses are allowed.", "#991b1b");
          resetBtn();
          return;
        }

        const safetyTimer = setTimeout(() => {
          resetBtn();
          showMessage("Request timed out. Please try again.", "#991b1b");
        }, 12000);

        try {
          // 2. Check if user exists in our users table first
          const { data: profile, error: profileCheckError } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .maybeSingle();

          if (profileCheckError) {
            clearTimeout(safetyTimer);
            showMessage("Database error: " + profileCheckError.message, "#991b1b");
            resetBtn();
            return;
          }

          // 3. No profile = not registered
          if (!profile) {
            clearTimeout(safetyTimer);
            showMessage("No account found. Please register first.", "#991b1b");
            resetBtn();
            return;
          }

          // 4. Check if blocked
          if (profile.is_blocked) {
            clearTimeout(safetyTimer);
            showMessage("Your account has been blocked. Please visit the library and contact the librarian for assistance.", "#991b1b");
            resetBtn();
            return;
          }

          // 5. Attempt Supabase Auth sign in
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          clearTimeout(safetyTimer);

          if (error) {
            clearTimeout(safetyTimer);
            const msg = error.message.toLowerCase();
            if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
              await supabase.auth.resend({ type: "signup", email });
              showMessage("Please confirm your email first. A new link has been sent.", "#b45309");
            } else if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
              // Could be wrong password OR unconfirmed email - try resending confirmation
              showMessage("Invalid email or password. If you just registered, check your email for a confirmation link.", "#991b1b");
            } else {
              showMessage("Login failed: " + error.message, "#991b1b");
            }
            resetBtn();
            return;
          }

          // 6. Success — save to localStorage and redirect
          localStorage.setItem("userName", profile.name);
          localStorage.setItem("userEmail", profile.email);
          localStorage.setItem("userProgram", profile.program);
          localStorage.setItem("userId", profile.id);

          showMessage("Login successful!", "#16a34a");
          setTimeout(() => { window.location.href = "visitorlog.html"; }, 1000);

        } catch (err) {
          clearTimeout(safetyTimer);
          showMessage("Something went wrong: " + err.message, "#991b1b");
          resetBtn();
        }
      };

      // ── REGISTER ──
      document.getElementById("registerForm").onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById("registerBtn");
        const email = document.getElementById("regEmail").value.trim().toLowerCase();
        const password = document.getElementById("regPassword").value;
        const name = document.getElementById("regName").value.trim();
        const role = document.querySelector(".role-card.active").dataset.role;
        const program = role === "faculty"
          ? document.getElementById("regProgramFaculty").value
          : document.getElementById("regProgram").value;

        const resetBtn = () => { btn.disabled = false; btn.textContent = "Complete Registration"; };
        btn.disabled = true;
        btn.textContent = "Creating account...";

        // 1. Domain restriction
        if (!email.endsWith("@neu.edu.ph")) {
          showMessage("Only @neu.edu.ph email addresses are allowed.", "#991b1b");
          resetBtn();
          return;
        }

        // 2. Password length
        if (password.length < 6) {
          showMessage("Password must be at least 6 characters.", "#991b1b");
          resetBtn();
          return;
        }

        // 3. Program selected
        if (!program) {
          showMessage("Please select your program / college.", "#991b1b");
          resetBtn();
          return;
        }

        const safetyTimer = setTimeout(() => {
          resetBtn();
          showMessage("Request timed out. Please try again.", "#991b1b");
        }, 15000);

        try {
          // 4. Check if already registered in users table
          const { data: existing } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (existing) {
            clearTimeout(safetyTimer);
            showMessage("This email is already registered. Please sign in.", "#991b1b");
            resetBtn();
            return;
          }

          btn.textContent = "Step 1/2: Creating auth...";

          // 5. Create Supabase Auth user
          const { data, error } = await supabase.auth.signUp({ email, password });

          if (error) {
            clearTimeout(safetyTimer);
            const msg = error.message.toLowerCase();
            if (msg.includes("already") || msg.includes("registered")) {
              showMessage("This email is already registered. Please sign in.", "#991b1b");
            } else {
              showMessage("Sign up failed: " + error.message, "#991b1b");
            }
            resetBtn();
            return;
          }

          if (!data.user) {
            clearTimeout(safetyTimer);
            showMessage("Registration failed — please disable email confirmation in Supabase.", "#991b1b");
            resetBtn();
            return;
          }

          btn.textContent = "Step 2/2: Saving profile...";

          // 6. Insert profile
          const { error: insertError } = await supabase.from("users").insert({
            id: data.user.id,
            email,
            name,
            program,
            role,
            is_blocked: false
          });

          clearTimeout(safetyTimer);

          if (insertError) {
            showMessage("Profile save failed: " + insertError.message, "#991b1b");
            resetBtn();
            return;
          }

          // 7. Sign in properly to establish a clean session before redirecting
          btn.textContent = "Signing in...";
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

          if (signInError) {
            // Still registered successfully — just send them to login page
            showMessage("Registered! Please sign in with your new account.", "#16a34a");
            setTimeout(() => {
              registerView.style.display = "none";
              loginView.style.display = "flex";
            }, 1500);
            return;
          }

          // 8. Save to localStorage and redirect
          localStorage.setItem("userName", name);
          localStorage.setItem("userEmail", email);
          localStorage.setItem("userProgram", program);
          localStorage.setItem("userId", signInData.user.id);

          showMessage("Registration successful!", "#16a34a");
          setTimeout(() => { window.location.href = "visitorlog.html"; }, 1000);

        } catch (err) {
          clearTimeout(safetyTimer);
          showMessage("Unexpected error: " + err.message, "#991b1b");
          resetBtn();
        }
      };

      // ── ADMIN LOGIN ──
      document.getElementById("adminLoginForm").onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById("adminLoginBtn");
        const email = document.getElementById("adminEmail").value.trim().toLowerCase();
        const pass  = document.getElementById("adminPass").value;

        const resetBtn = () => { btn.disabled = false; btn.textContent = "Access Dashboard"; };
        btn.disabled = true; btn.textContent = "Verifying...";

        if (!email.endsWith("@neu.edu.ph")) {
          showMessage("Only @neu.edu.ph accounts can access the admin panel.", "#991b1b");
          resetBtn(); return;
        }

        try {
          // Check role in users table first
          const { data: profile, error: profileErr } = await supabase
            .from("users").select("role, is_blocked, name")
            .eq("email", email).maybeSingle();

          if (profileErr || !profile) {
            showMessage("Account not found. Register as a visitor first.", "#991b1b");
            resetBtn(); return;
          }
          if (profile.is_blocked) {
            showMessage("This account is blocked.", "#991b1b");
            resetBtn(); return;
          }
          if (profile.role?.toLowerCase() !== 'admin' && profile.role?.toLowerCase() !== 'owner') {
            showMessage("Access denied. You are not assigned as an admin.", "#991b1b");
            resetBtn(); return;
          }

          // Authenticate with Supabase Auth
          const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password: pass });
          if (authErr) {
            const m = authErr.message.toLowerCase();
            if (m.includes("not confirmed") || m.includes("invalid login")) {
              showMessage("Login failed — if email confirmation is on in Supabase, disable it under Authentication → Providers → Email.", "#991b1b");
            } else {
              showMessage("Incorrect password. Please try again.", "#991b1b");
            }
            resetBtn(); return;
          }

          // Store admin info (always lowercase role) and redirect
          localStorage.setItem("adminEmail", email);
          localStorage.setItem("adminName", profile.name);
          localStorage.setItem("adminRole", profile.role.toLowerCase());
          showMessage("Access Granted. Redirecting...", "#16a34a");
          setTimeout(() => { window.location.href = "admindashboard.html"; }, 1200);

        } catch (err) {
          showMessage("Error: " + err.message, "#991b1b");
          resetBtn();
        }
      };

      // ── Role Selection — swap program dropdowns ──
      document.querySelectorAll(".role-card").forEach((card) => {
        card.onclick = () => {
          document.querySelectorAll(".role-card").forEach((c) => c.classList.remove("active"));
          card.classList.add("active");

          const isFaculty = card.dataset.role === "faculty";
          const studentGroup = document.getElementById("studentProgramGroup");
          const facultyGroup = document.getElementById("facultyProgramGroup");
          const studentSelect = document.getElementById("regProgram");
          const facultySelect = document.getElementById("regProgramFaculty");

          if (isFaculty) {
            studentGroup.style.display = "none";
            facultyGroup.style.display = "block";
            studentSelect.removeAttribute("required");
            facultySelect.setAttribute("required", "");
          } else {
            studentGroup.style.display = "block";
            facultyGroup.style.display = "none";
            studentSelect.setAttribute("required", "");
            facultySelect.removeAttribute("required");
          }
        };
      });

      // ── Load announcements into top-right overlay ──
      (async () => {
        try {
          // Fetch active notices - order by created_at (safe fallback if event_date column doesn't exist yet)
          const { data, error } = await supabase
            .from("notices")
            .select("*")
            .eq("active", true)
            .order("created_at", { ascending: false });

          const panel = document.getElementById("announcePanel");
          const body  = document.getElementById("announceBody");

          if (error || !data || !data.length) {
            body.innerHTML = `<div class="announce-empty">No announcements at this time.</div>`;
            return;
          }

          // Sort client-side: events with dates first (sorted by date), then reminders
          const events    = data.filter(n => n.type === "event" || n.event_date)
                                .sort((a, b) => new Date(a.event_date || 0) - new Date(b.event_date || 0));
          const reminders = data.filter(n => n.type !== "event" && !n.event_date);

          let html = "";

          if (events.length) {
            html += `<div class="announce-section-label">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              Upcoming Events
            </div>`;
            html += events.map(n => {
              const dateStr = n.event_date
                ? new Date(n.event_date + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })
                : "";
              return `<div class="announce-item">
                <div class="announce-dot-event"></div>
                <div>
                  <div class="announce-msg">${n.message}</div>
                  ${dateStr ? `<div class="announce-date">${dateStr}</div>` : ""}
                </div>
              </div>`;
            }).join("");
          }

          if (reminders.length) {
            html += `<div class="announce-section-label">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              Reminders
            </div>`;
            html += reminders.map(n => `
              <div class="announce-item">
                <div class="announce-dot-reminder"></div>
                <div><div class="announce-msg">${n.message}</div></div>
              </div>`).join("");
          }

          if (!html) {
            body.innerHTML = `<div class="announce-empty">No announcements at this time.</div>`;
            return;
          }

          body.innerHTML = html;
          // Panel already starts open (class set in HTML)

        } catch(e) {
          console.warn("Announcements unavailable:", e);
        }
      })();
