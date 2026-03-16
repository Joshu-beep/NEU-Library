// Wait for all scripts to load
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

        let scannedUid   = null;
        let reason       = null;
        let scanning     = false;
        let raf          = null;

        // ── Helpers ──
        function setStatus(type, msg) {
          statusMsg.className = 'status ' + type;
          statusMsg.textContent = msg;
        }

        function refreshBtn() {
          if (scannedUid && reason) {
            checkinBtn.disabled = false;
            checkinBtn.textContent = '✓ Check in — ' + reason;
            checkinBtn.className = 'ready';
          } else if (scannedUid) {
            checkinBtn.disabled = true;
            checkinBtn.textContent = 'Now select a reason above';
            checkinBtn.className = '';
          } else {
            checkinBtn.disabled = true;
            checkinBtn.textContent = 'Scan QR code first';
            checkinBtn.className = '';
          }
        }

        // ── Reason buttons ──
        document.querySelectorAll('.rbtn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            document.querySelectorAll('.rbtn').forEach(function(b) { b.classList.remove('sel'); });
            btn.classList.add('sel');
            reason = btn.dataset.r;
            refreshBtn();
          });
        });

        // ── START CAMERA BUTTON ──
        startBtn.addEventListener('click', async function() {
          setStatus('info', 'Requesting camera permission...');

          // Check if browser supports getUserMedia
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('error', '⚠ Your browser does not support camera access. Please use Chrome or Safari.');
            return;
          }

          try {
            // Try rear camera first, fall back to any camera
            let stream;
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 640 } }
              });
            } catch (e) {
              // fallback to any camera
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

          } catch (err) {
            console.error('Camera error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              setStatus('error', '🚫 Camera permission denied. Please tap the camera icon in your browser address bar and allow access, then refresh.');
            } else if (err.name === 'NotFoundError') {
              setStatus('error', '📷 No camera found on this device.');
            } else if (err.name === 'NotReadableError') {
              setStatus('error', '📷 Camera is already in use by another app. Close it and try again.');
            } else {
              setStatus('error', '⚠ Camera error: ' + err.message);
            }
          }
        });

        // ── QR scan loop ──
        function tick() {
          if (!scanning) { raf = requestAnimationFrame(tick); return; }

          if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            try {
              var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              var code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
              if (code && code.data) {
                handleQR(code.data);
                return; // stop loop until handled
              }
            } catch(e) { /* ignore frame errors */ }
          }

          raf = requestAnimationFrame(tick);
        }

        // ── Handle scanned QR ──
        async function handleQR(raw) {
          scanning = false;
          setStatus('info', '🔍 QR detected, verifying...');

          var payload;
          try { payload = JSON.parse(raw); } catch(e) { payload = null; }

          if (!payload || !payload.uid) {
            setStatus('error', '❌ Invalid QR code. Please use your NEU Library QR code.');
            resume(3000); return;
          }

          var result = await db.from('users').select('*').eq('id', payload.uid).single();

          if (result.error || !result.data) {
            setStatus('error', '❌ Account not found. Please sign in manually.');
            resume(3000); return;
          }

          var user = result.data;

          if (user.is_blocked) {
            setStatus('error', '🚫 Access denied — your account has been blocked. Contact the library admin.');
            resume(4000); return;
          }

          // Show user card
          scannedUid = user.id;
          document.getElementById('uInitial').textContent = (user.name || '?')[0].toUpperCase();
          document.getElementById('uName').textContent    = user.name    || '—';
          document.getElementById('uProgram').textContent = user.program || '—';
          document.getElementById('uEmail').textContent   = user.email   || '—';
          document.getElementById('userCard').classList.add('show');

          // ── Check if already inside today ──
          var todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          var logResult = await db
            .from('visit_logs')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('status', 'inside')
            .gte('time_in', todayStart.toISOString())
            .order('time_in', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (logResult.data) {
            // Already inside — auto log out IMMEDIATELY, no confirmation needed
            var logId = logResult.data.id;
            setStatus('info', '👋 ' + user.name + ' is inside — logging out...');

            // Instantly update status — no button press needed
            var logoutResult = await db
              .from('visit_logs')
              .update({ status: 'logged_out', time_out: new Date().toISOString() })
              .eq('id', logId);

            if (logoutResult.error) {
              setStatus('error', '❌ Logout failed: ' + logoutResult.error.message);
              resume(3000); return;
            }

            setStatus('ok', '✅ ' + user.name + ' has been logged out. See you next time!');
            reset(3000);
            return;
          } else {
            // Not inside — show normal check-in flow
            document.getElementById('reasonSection').style.display = 'block';
            checkinBtn.dataset.mode = 'checkin';
            checkinBtn.style.background = '';
            setStatus('ok', '✓ ' + user.name + ' identified — select a reason and check in');
            refreshBtn();
          }
        }

        // ── CHECK-IN MODE only now (logout is automatic) ──
        checkinBtn.addEventListener('click', async function() {
          if (!scannedUid || !reason) return;

          checkinBtn.disabled = true;
          checkinBtn.textContent = 'Logging visit...';
          checkinBtn.className = '';

          var result = await db.from('visit_logs').insert({
            user_id: scannedUid,
            reason: reason,
            status: 'inside'
          });

          if (result.error) {
            setStatus('error', '❌ Failed to log visit: ' + result.error.message);
            refreshBtn();
            return;
          }

          var name = document.getElementById('uName').textContent;
          setStatus('ok', '✅ ' + name + ' checked in for "' + reason + '". Have a productive day!');
          reset(4000);
        });

        // ── Resume scanning after delay ──
        function resume(ms) {
          setTimeout(function() {
            document.getElementById('resultMsg') && (document.getElementById('resultMsg').style.display = 'none');
            setStatus('ok', '📷 Camera active — hold your QR code up to the camera');
            scanning = true;
            raf = requestAnimationFrame(tick);
          }, ms);
        }

        // ── Full reset for next person ──
        function reset(ms) {
          setTimeout(function() {
            scannedUid = null;
            reason = null;
            document.getElementById('userCard').classList.remove('show');
            document.getElementById('reasonSection').style.display = 'block';
            document.querySelectorAll('.rbtn').forEach(function(b) { b.classList.remove('sel'); });
            checkinBtn.dataset.mode  = 'checkin';
            checkinBtn.dataset.logId = '';
            checkinBtn.style.background = '';
            refreshBtn();
            setStatus('ok', '📷 Ready for next person — hold QR code up to camera');
            scanning = true;
            raf = requestAnimationFrame(tick);
          }, ms);
        }

      }); // end window.onload
