const loginView = document.getElementById("loginView");
const registerView = document.getElementById("registerView");
const adminView = document.getElementById("adminView");
const mainHeader = document.getElementById("mainHeader");
const headerSubtitle = document.getElementById("headerSubtitle");

// Navigation
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

function showMessage(msg, color = "#001f54") {
  const msgBox = document.getElementById("msgBox");
  msgBox.textContent = msg;
  msgBox.style.backgroundColor = color;
  msgBox.style.display = "block";
  setTimeout(() => {
    msgBox.style.display = "none";
  }, 3000);
}

// ── LOGIN with Supabase ──
document.getElementById("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.textContent = "Signing in...";

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("invalid login credentials") ||
      msg.includes("user not found") ||
      msg.includes("no user found")
    ) {
      showMessage(
        "You don't have an account yet. Please register first.",
        "#991b1b",
      );
    } else if (
      msg.includes("invalid password") ||
      msg.includes("wrong password")
    ) {
      showMessage("Incorrect password. Please try again.", "#991b1b");
    } else {
      showMessage(error.message, "#991b1b");
    }
    btn.disabled = false;
    btn.textContent = "Sign In";
    return;
  }

  // Fetch user profile from users table
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    showMessage("Could not load user profile.", "#991b1b");
    btn.disabled = false;
    btn.textContent = "Sign In";
    return;
  }

  // Store in localStorage for visitorlog.html
  localStorage.setItem("userName", profile.name);
  localStorage.setItem("userEmail", profile.email);
  localStorage.setItem("userProgram", profile.program);
  localStorage.setItem("userId", profile.id);

  showMessage("Login successful!");
  setTimeout(() => {
    window.location.href = "visitorlog.html";
  }, 1000);
};

// ── REGISTER with Supabase ──
document.getElementById("registerForm").onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById("registerBtn");
  btn.disabled = true;
  btn.textContent = "Creating account...";

  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;
  const name = document.getElementById("regName").value;
  const program = document.getElementById("regProgram").value;
  const role = document.querySelector(".role-card.active").dataset.role;

  // Create auth user
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    showMessage(error.message, "#991b1b");
    btn.disabled = false;
    btn.textContent = "Complete Registration";
    return;
  }

  // Insert profile into users table
  const { error: insertError } = await supabase.from("users").insert({
    id: data.user.id,
    email,
    name,
    program,
    role,
  });

  if (insertError) {
    showMessage(
      "Account created but profile save failed: " + insertError.message,
      "#991b1b",
    );
    btn.disabled = false;
    btn.textContent = "Complete Registration";
    return;
  }

  localStorage.setItem("userName", name);
  localStorage.setItem("userEmail", email);
  localStorage.setItem("userProgram", program);
  localStorage.setItem("userId", data.user.id);

  showMessage("Registration successful!");
  setTimeout(() => {
    window.location.href = "visitorlog.html";
  }, 1000);
};

// ── ADMIN LOGIN (hardcoded credentials — keep as is or move to env) ──
document.getElementById("adminLoginForm").onsubmit = (e) => {
  e.preventDefault();
  const user = document.getElementById("adminUser").value;
  const pass = document.getElementById("adminPass").value;

  if (user === "admin" && pass === "admin123") {
    showMessage("Access Granted. Redirecting to Database...", "#16a34a");
    setTimeout(() => {
      window.location.href = "admindashboard.html";
    }, 1500);
  } else {
    showMessage("Invalid Admin Credentials!", "#991b1b");
  }
};

// Role Selection
document.querySelectorAll(".role-card").forEach((card) => {
  card.onclick = () => {
    document
      .querySelectorAll(".role-card")
      .forEach((c) => c.classList.remove("active"));
    card.classList.add("active");
    document.getElementById("regProgram").placeholder =
      card.dataset.role === "student" ? "BSIT" : "Faculty Dept";
  };
});
