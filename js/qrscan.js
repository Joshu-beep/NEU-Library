window.addEventListener('load', function () {
  const SUPABASE_URL = 'https://ruajjuxabwfqpawpjosl.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YWpqdXhhYndmcXBhd3Bqb3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NTg0MjksImV4cCI6MjA4OTAzNDQyOX0.O1ZbG4vC6q4DxQKTq664i3e4xwUYcvgVDOsuNMDNK4I';
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const video      = document.getElementById('video');
  const canvas     = document.getElementById('qrCanvas');
  const ctx        = canvas.getContext('2d');
  const viewfinder = document.getElementById('viewfinder');
  const startBtn   = document.getElementById('startCamBtn');
  const statusMsg  = document.getElementById('statusMsg');
  const checkinBtn = document.getElementById('checkinBtn');

  let scannedUid = null, reason = null, scanning = false;

  function setStatus(type, msg) {
    statusMsg.className = 'status ' + type;
    statusMsg.textContent = msg;
  }

  function refreshBtn() {
    if (scannedUid && reason) {
      checkinBtn.disabled = false;
      checkinBtn.textContent = '✓ Check In — ' + reason;
      checkinBtn.className = 'ready';
    } else if (scannedUid) {
      checkinBtn.disabled = true;
      checkinBtn.textContent = 'Select a reason above (or press 1–4)';
      checkinBtn.className = '';
    } else {
      checkinBtn.disabled = true;
      checkinBtn.textContent = 'Scan QR code first';
      checkinBtn.className = '';
    }
  }

  // ── Reason buttons ──
  const reasons = ['Reading', 'Researching', 'Use of Computer', 'Meeting'];
  document.querySelectorAll('.rbtn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.rbtn').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      reason = btn.dataset.r;
      refreshBtn();
    });
  });

  // ── Keyboard shortcuts: 1–4 select reason, Enter submits ──
  document.addEventListener('keydown', function(e) {
    if (!scannedUid) return;
    const n = parseInt(e.key);
    if (n >= 1 && n <= 4) {
      const btns = document.querySelectorAll('.rbtn');
      btns.forEach(b => b.classList.remove('sel'));
      btns[n - 1].classList.add('sel');
      reason = reasons[n - 1];
      refreshBtn();
    }
    if (e.key === 'Enter' && !checkinBtn.disabled) {
      checkinBtn.click();
    }
  });

  // ── Start camera ──
  startBtn.addEventListener('click', async function() {
    setStatus('info', 'Requesting camera permission...');
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error', '⚠ Camera not supported. Use Chrome or Safari.');
      return;
    }
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 640 } }
        });
      } catch(e) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      video.srcObject = stream;
      viewfinder.classList.add('active');
      startBtn.classList.add('hide');
      video.onloadedmetadata = function() {
        video.play();
        scanning = true;
        setStatus('ok', '📷 Camera active — hold your QR code up to the camera');
        tick();
      };
    } catch(err) {
      if (err.name === 'NotAllowedError') setStatus('error', '🚫 Camera denied. Allow access in your browser then refresh.');
      else if (err.name === 'NotFoundError') setStatus('error', '📷 No camera found.');
      else setStatus('error', '⚠ Camera error: ' + err.message);
    }
  });

  // ── QR scan loop ──
  function tick() {
    if (!scanning) { requestAnimationFrame(tick); return; }
    if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      try {
        const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) { handleQR(code.data); return; }
      } catch(e) {}
    }
    requestAnimationFrame(tick);
  }

  // ── Handle scanned QR ──
  async function handleQR(raw) {
    scanning = false;
    setStatus('info', '🔍 Verifying...');

    let payload;
    try { payload = JSON.parse(raw); } catch(e) { payload = null; }
    if (!payload?.uid) { setStatus('error', '❌ Invalid QR code.'); resume(3000); return; }

    const { data: user, error } = await db.from('users').select('*').eq('id', payload.uid).single();
    if (error || !user) { setStatus('error', '❌ Account not found.'); resume(3000); return; }
    if (user.is_blocked) { setStatus('error', '🚫 Account blocked. Contact the library.'); resume(4000); return; }

    // ── Show welcome card with profile photo ──
    scannedUid = user.id;
    const firstName = (user.name || 'there').split(' ')[0];

    // Set avatar — try to load profile photo from storage
    const avatarEl = document.getElementById('uAvatar');
    const avatarImg = document.getElementById('uAvatarImg');
    const avatarInitial = document.getElementById('uInitial');
    avatarInitial.textContent = (user.name || '?')[0].toUpperCase();
    avatarImg.style.display = 'none';
    avatarInitial.style.display = 'flex';

    const { data: photoData } = db.storage.from('avatars').getPublicUrl(`${user.id}/avatar`);
    if (photoData?.publicUrl) {
      const testImg = new Image();
      testImg.onload = () => {
        avatarImg.src = photoData.publicUrl + '?t=' + Date.now();
        avatarImg.style.display = 'block';
        avatarInitial.style.display = 'none';
      };
      testImg.onerror = () => {};
      testImg.src = photoData.publicUrl + '?t=' + Date.now();
    }

    document.getElementById('uWelcome').textContent = `Hello, ${firstName}!`;
    document.getElementById('uSubtitle').textContent = 'Welcome to NEU Library';
    document.getElementById('uName').textContent    = user.name    || '—';
    document.getElementById('uProgram').textContent = user.program || '—';
    document.getElementById('uEmail').textContent   = user.email   || '—';
    document.getElementById('userCard').classList.add('show');

    // ── Check if already inside ──
    const { data: activeLog } = await db
      .from('visit_logs').select('id')
      .eq('user_id', user.id).eq('status', 'inside')
      .order('time_in', { ascending: false }).limit(1).maybeSingle();

    if (activeLog) {
      // Auto log out
      setStatus('info', `👋 ${user.name} is already inside — checking out...`);
      await db.from('visit_logs').update({ status: 'logged_out', time_out: new Date().toISOString() }).eq('id', activeLog.id);
      setStatus('ok', `✅ ${user.name} checked out. See you next time!`);
      reset(3500);
    } else {
      // Show check-in flow
      document.getElementById('reasonSection').style.display = 'block';
      setStatus('ok', `✓ ${user.name} — select a reason (or press 1–4) and press Enter`);
      refreshBtn();
    }
  }

  // ── Check-in ──
  checkinBtn.addEventListener('click', async function() {
    if (!scannedUid || !reason) return;
    checkinBtn.disabled = true; checkinBtn.textContent = 'Checking in...'; checkinBtn.className = '';
    const { error } = await db.from('visit_logs').insert({ user_id: scannedUid, reason, status: 'inside' });
    const name = document.getElementById('uName').textContent;
    if (error) {
      setStatus('error', '❌ Failed: ' + error.message);
      refreshBtn(); return;
    }
    setStatus('ok', `✅ ${name} checked in for "${reason}". Have a productive visit!`);
    reset(4000);
  });

  function resume(ms) {
    setTimeout(() => {
      setStatus('ok', '📷 Camera active — hold your QR code up to the camera');
      scanning = true; requestAnimationFrame(tick);
    }, ms);
  }

  function reset(ms) {
    setTimeout(() => {
      scannedUid = null; reason = null;
      document.getElementById('userCard').classList.remove('show');
      document.getElementById('uAvatarImg').style.display = 'none';
      document.getElementById('uInitial').style.display = 'flex';
      document.getElementById('reasonSection').style.display = 'block';
      document.querySelectorAll('.rbtn').forEach(b => b.classList.remove('sel'));
      refreshBtn();
      setStatus('ok', '📷 Ready for next person — hold QR code up to camera');
      scanning = true; requestAnimationFrame(tick);
    }, ms);
  }
}); // end window.onload
