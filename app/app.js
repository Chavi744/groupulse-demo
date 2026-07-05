// GroupPulse — live demo app logic
(() => {
  const D = window.GP_DATA;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const state = {
    transcript: '',
    result: null,          // תוצאת המנוע
    approvals: {},         // noteId -> true
    activeTab: 'group',
    recognizing: false,
    seconds: 0,
  };

  // ---------- ניווט ----------
  function show(view) {
    $$('.view').forEach(v => v.classList.remove('active'));
    $('#view-' + view).classList.add('active');
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    const titles = {
      dashboard: ['לוח בקרה', 'שלום, ' + D.therapist.name + ' — סקירת הקבוצות והסיכומים שלך'],
      dictation: ['מפגש חדש — הכתבת סיכום', D.group.name + ' · מפגש ' + D.group.sessionNo + '/' + D.group.totalSessions + ' · המטופלים אינם מוקלטים'],
      processing: ['עיבוד AI', 'יוצר טיוטות — הן יוצגו לאישורך לפני כל תיוק'],
      results: ['טיוטות לאישור המטפל', D.group.name + ' · מפגש ' + D.group.sessionNo + ' · דבר לא מתויק ללא חתימתך'],
      patients: ['קבוצות ומטופלים', 'תוכניות טיפול ויעדים — הבסיס ל״חוט הזהב״'],
      security: ['אבטחה ופרטיות', 'העקרונות המחייבים של GroupPulse'],
    };
    const [h, p] = titles[view] || ['', ''];
    $('#pg-title').textContent = h;
    $('#pg-sub').textContent = p;
    closeDrawer();
    window.scrollTo(0, 0);
  }

  // תפריט מובייל
  function closeDrawer() {
    $('.sidebar').classList.remove('open');
    $('#side-overlay').classList.remove('open');
  }
  $('#hamburger').addEventListener('click', () => {
    $('.sidebar').classList.toggle('open');
    $('#side-overlay').classList.toggle('open', $('.sidebar').classList.contains('open'));
  });
  $('#side-overlay').addEventListener('click', closeDrawer);
  $$('.nav a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    if (a.dataset.view === 'results' && !state.result) { toast('אין עדיין טיוטות — הכתיבו סיכום מפגש תחילה'); show('dictation'); return; }
    if (a.dataset.view === 'processing') { show('dictation'); return; }
    if (a.dataset.view === 'settings') { closeDrawer(); return; } // המודל נפתח במאזין ייעודי
    show(a.dataset.view);
  }));
  $$('.go-dictation').forEach(b => b.addEventListener('click', () => show('dictation')));

  // ---------- toast ----------
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ---------- לוח בקרה ----------
  function renderDashboard() {
    $('#dash-groups').innerHTML = [
      { name: D.group.name, protocol: D.group.protocol, members: D.participants.length, next: D.group.day, main: true },
      ...D.otherGroups,
    ].map(g => `
      <div class="g-row">
        <div class="avs">${(g.main ? D.participants : [{name:'א',color:'#7A5AF8'},{name:'ב',color:'#E0699C'},{name:'ג',color:'#F2A93B'}])
          .slice(0, 4).map(p => `<div class="av-sm" style="background:${p.color || '#1B3E73'}">${p.name[0]}</div>`).join('')}</div>
        <div class="info"><div class="nm">${g.name}</div><div class="sub">${g.protocol} · ${g.members} משתתפים · ${g.next}</div></div>
        ${g.main ? '<button class="btn btn-primary go-dictation-2">סכם מפגש</button>' : '<span class="badge b-soft">פעילה</span>'}
      </div>`).join('');
    $$('.go-dictation-2').forEach(b => b.addEventListener('click', () => show('dictation')));
  }

  // ---------- קבוצות ומטופלים ----------
  function renderPatients() {
    $('#patients-grid').innerHTML = D.participants.map(p => `
      <div class="card pad p-card">
        <div class="top">
          <div class="av-sm" style="background:${p.color};width:48px;height:48px;font-size:17px">${p.name[0]}</div>
          <div><h4>${p.name}</h4><div class="dx">${p.dx}</div></div>
        </div>
        <div class="muted" style="font-size:12.5px;margin-bottom:8px">בטיפול ${p.months} חודשים · ${D.group.protocol}</div>
        <div style="font-weight:800;font-size:13px;margin-bottom:4px">יעדי תוכנית הטיפול</div>
        ${p.goals.map(g => `<div class="goal"><span class="gdot"></span>${g.text} <span class="muted" style="margin-inline-start:auto;font-size:11.5px">${g.since}</span></div>`).join('')}
      </div>`).join('');
  }

  // ---------- הכתבה: זיהוי דיבור ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, timerI = null, finalText = '';

  function fmtTime(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

  function startRec() {
    if (!SR) { toast('הדפדפן לא תומך בזיהוי דיבור — השתמשו ב־Chrome או בכפתור הדוגמה'); return; }
    rec = new SR();
    rec.lang = 'he-IL';
    rec.continuous = true;
    rec.interimResults = true;
    finalText = $('#transcript').value ? $('#transcript').value + ' ' : '';
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      $('#transcript').value = (finalText + interim).trim();
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed') toast('אין הרשאת מיקרופון — אשרו גישה או השתמשו בכפתור הדוגמה');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('שגיאת זיהוי דיבור (' + e.error + ') — אפשר להמשיך עם הדוגמה');
    };
    rec.onend = () => { if (state.recognizing) { try { rec.start(); } catch (_) {} } };
    rec.start();
    state.recognizing = true;
    state.seconds = 0;
    $('#mic-btn').classList.add('rec');
    $('#mic-label').textContent = 'מקליט את הכתבת המטפל... לחצו לעצירה';
    $('#wave').classList.add('on');
    timerI = setInterval(() => { state.seconds++; $('#timer').textContent = fmtTime(state.seconds); }, 1000);
  }

  function stopRec() {
    state.recognizing = false;
    if (rec) { try { rec.stop(); } catch (_) {} rec = null; }
    clearInterval(timerI);
    $('#mic-btn').classList.remove('rec');
    $('#mic-label').textContent = 'לחצו להתחלת הכתבה';
    $('#wave').classList.remove('on');
    toast('ההקלטה נעצרה. האודיו נמחק — נשמר תמלול בלבד');
  }

  $('#mic-btn').addEventListener('click', () => state.recognizing ? stopRec() : startRec());

  // הזרקת טקסט דוגמה עם אפקט הקלדה
  function typeInto(text, done) {
    const ta = $('#transcript');
    ta.value = '';
    let i = 0;
    const step = () => {
      i = Math.min(text.length, i + 7);
      ta.value = text.slice(0, i);
      ta.scrollTop = ta.scrollHeight;
      if (i < text.length) setTimeout(step, 12); else if (done) done();
    };
    step();
  }
  $('#btn-sample').addEventListener('click', () => { if (state.recognizing) stopRec(); typeInto(D.sampleDictation); });
  $('#btn-sample-crisis').addEventListener('click', () => { if (state.recognizing) stopRec(); typeInto(D.sampleDictationCrisis); });
  $('#btn-clear').addEventListener('click', () => { $('#transcript').value = ''; });

  // ---------- עיבוד ----------
  $('#btn-generate').addEventListener('click', async () => {
    const t = $('#transcript').value.trim();
    if (t.length < 20) { toast('הדיקטציה קצרה מדי — הכתיבו סיכום או טענו דוגמה'); return; }
    if (state.recognizing) stopRec();
    state.transcript = t;
    show('processing');
    runProcessing(t);
  });

  async function runProcessing(transcript) {
    const steps = $$('#proc-steps .step');
    steps.forEach(s => { s.classList.remove('on', 'done'); s.querySelector('.st').innerHTML = 'ממתין'; });
    const durations = [900, 1400, 1200, 900];
    const genPromise = window.GP_ENGINE.generate(transcript);
    for (let i = 0; i < steps.length; i++) {
      steps[i].classList.add('on');
      steps[i].querySelector('.st').innerHTML = '<span class="spin"></span>';
      await new Promise(r => setTimeout(r, durations[i]));
      // בשלב האחרון מחכים גם למנוע עצמו
      if (i === steps.length - 1) {
        try { state.result = await genPromise; }
        catch (e) { console.error(e); toast('שגיאה ביצירה — הוצג פלט סימולציה'); state.result = await window.GP_ENGINE.generate(''); }
      }
      steps[i].classList.add('done');
      steps[i].querySelector('.st').textContent = 'הושלם ✓';
    }
    state.approvals = {};
    state.activeTab = 'group';
    if (state.result.fellBack) toast('החיבור ל־AI נכשל — הוצג פלט סימולציה מלא');
    renderResults();
    show('results');
  }

  // ---------- תוצאות ----------
  const trendCls = { up: 'up', same: 'same', down: 'down' };

  function renderResults() {
    const r = state.result;
    // באנר משבר
    $('#crisis-banner').style.display = r.crisis.flagged ? 'flex' : 'none';
    if (r.crisis.flagged) {
      $('#crisis-text').textContent = r.crisisNote ||
        'זוהו בדיקטציה ביטויי מצוקה חריפה / סיכון אובדני. מומלץ: הערכת סיכון מובנית (C-SSRS), עדכון גורם אחראי ותיעוד ההתערבות שבוצעה. הרשומה הרלוונטית סומנה בדגל אדום.';
    }
    $('#engine-badge').textContent = r.engine === 'live' ? 'נוצר על ידי Claude (מצב חי)' : 'מצב הדגמה (סימולציה)';

    // טאבים
    const tabs = [{ id: 'group', label: 'סיכום קבוצתי' }, ...D.participants.map(p => ({ id: p.id, label: p.name }))];
    $('#tabs').innerHTML = tabs.map(t => `
      <button class="tab ${state.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">
        <span class="st-dot ${state.approvals[t.id] ? 'ok' : ''}"></span>${t.label}
      </button>`).join('');
    $$('#tabs .tab').forEach(b => b.addEventListener('click', () => { saveEdits(); state.activeTab = b.dataset.tab; renderResults(); }));

    // גוף
    $('#note-area').innerHTML = state.activeTab === 'group' ? groupNoteHTML(r) : personalNoteHTML(r, state.activeTab);
    bindNoteActions();
    updateApproveAll();
  }

  function groupNoteHTML(r) {
    const n = r.groupNote;
    const approved = state.approvals['group'];
    const text = state._edits?.group ?? `[S] סובייקטיבי:\n${n.S}\n\n[O] אובייקטיבי:\n${n.O}\n\n[A] הערכה:\n${n.A}\n\n[P] תוכנית:\n${n.P}`;
    return `
      <div class="card pad">
        <div class="note-head">
          <h3>סיכום קבוצתי <span class="soap-tag">SOAP</span></h3>
          <span class="badge ${approved ? 'b-approved' : 'b-draft'}">${approved ? 'אושר ונחתם' : 'טיוטת AI — ממתין לאישור'}</span>
        </div>
        <div class="note-body"><textarea class="note-edit" id="edit-current" style="min-height:320px" ${approved ? 'readonly' : ''}>${esc(text)}</textarea></div>
        <div class="note-foot">
          <span class="hint">ניתן לערוך את הטיוטה לפני האישור. דבר לא מתויק ללא חתימת המטפל.</span>
          ${approved
            ? `<span class="signed">✓ נחתם דיגיטלית · ${D.therapist.name}</span>`
            : `<button class="btn btn-success" id="btn-approve">✒️ אשר וחתום</button>`}
        </div>
      </div>`;
  }

  function personalNoteHTML(r, pid) {
    const p = D.participants.find(x => x.id === pid);
    const data = r.personal[pid] || { note: 'לא נוצרה רשומה.', links: [] };
    const approved = state.approvals[pid];
    const text = state._edits?.[pid] ?? data.note;
    const isCrisis = /דגל בטיחות|סיכון|אובדנ/.test(data.note);
    return `
      <div class="card pad">
        <div class="note-head">
          <h3><span class="av-sm" style="background:${p.color};width:34px;height:34px;font-size:13px">${p.name[0]}</span>
            רשומה אישית · ${p.name}
            ${isCrisis ? '<span class="badge b-crisis">דגל בטיחות</span>' : ''}</h3>
          <span class="badge ${approved ? 'b-approved' : 'b-draft'}">${approved ? 'אושר ונחתם' : 'טיוטת AI — ממתין לאישור'}</span>
        </div>
        <div class="muted" style="font-size:12.5px;margin-bottom:10px">${p.dx} · ${D.group.protocol}</div>
        <div class="note-body"><textarea class="note-edit" id="edit-current" ${approved ? 'readonly' : ''}>${esc(text)}</textarea></div>
        <div class="gt-panel">
          <div class="gt-head">🧵 חוט הזהב — קישור אוטומטי לתוכנית הטיפול</div>
          ${(data.links || []).map(l => `
            <div class="gt-item"><span class="gdot"></span>
              <div><b>${esc(l.goal)}</b><div class="muted" style="font-size:12px">${esc(l.evidence)}</div></div>
              <span class="prog ${trendCls[l.trend] || 'same'}">${esc(l.label)}</span>
            </div>`).join('')}
        </div>
        <div class="note-foot">
          <span class="hint">הרשומה מקושרת ליעדי התוכנית — רצף טיפולי מתועד לביקורת ולתביעות ביטוח.</span>
          ${approved
            ? `<span class="signed">✓ נחתם דיגיטלית · ${D.therapist.name}</span>`
            : `<button class="btn btn-success" id="btn-approve">✒️ אשר וחתום</button>`}
        </div>
      </div>`;
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function saveEdits() {
    const ta = $('#edit-current');
    if (!ta) return;
    state._edits = state._edits || {};
    state._edits[state.activeTab] = ta.value;
  }

  function bindNoteActions() {
    const b = $('#btn-approve');
    if (b) b.addEventListener('click', () => {
      saveEdits();
      state.approvals[state.activeTab] = true;
      toast('הרשומה אושרה ונחתמה על ידי ' + D.therapist.name);
      renderResults();
    });
  }

  function updateApproveAll() {
    const total = 1 + D.participants.length;
    const done = Object.values(state.approvals).filter(Boolean).length;
    $('#approve-count').textContent = `${done}/${total} רשומות אושרו`;
    const fileBtn = $('#btn-file');
    fileBtn.disabled = done < total;
    fileBtn.title = done < total ? 'יש לאשר את כל הרשומות תחילה — האישור הוא של המטפל בלבד' : '';
  }

  $('#btn-file').addEventListener('click', () => {
    toast('כל הרשומות תויקו בתיקי המטופלים ונקשרו ל״חוט הזהב״ ✓');
    setTimeout(() => show('dashboard'), 1600);
  });

  // ---------- הגדרות (מפתח API) ----------
  function refreshMode() {
    const key = localStorage.getItem('gp_api_key');
    const pill = $('#mode-pill');
    pill.className = 'mode-pill ' + (key ? 'live' : 'sim');
    pill.innerHTML = key ? '🟢 מצב AI חי — Claude מחובר' : '🟠 מצב הדגמה — סימולציה מובנית';
  }
  $('#mode-pill').addEventListener('click', () => $('#settings-modal').classList.add('open'));
  $$('.nav a[data-view="settings"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); $('#settings-modal').classList.add('open'); }));
  $('#btn-save-key').addEventListener('click', () => {
    const v = $('#api-key-input').value.trim();
    if (v) { localStorage.setItem('gp_api_key', v); toast('מפתח נשמר — המערכת במצב AI חי'); }
    else { localStorage.removeItem('gp_api_key'); toast('המערכת במצב סימולציה'); }
    refreshMode();
    $('#settings-modal').classList.remove('open');
  });
  $('#btn-close-modal').addEventListener('click', () => $('#settings-modal').classList.remove('open'));
  $('#settings-modal').addEventListener('click', e => { if (e.target === $('#settings-modal')) $('#settings-modal').classList.remove('open'); });

  // ---------- אתחול ----------
  $('#api-key-input').value = localStorage.getItem('gp_api_key') || '';
  refreshMode();
  renderDashboard();
  renderPatients();
  show('dashboard');

  // מצב הדגמה אוטומטי: ?demo=1 (רגיל) או ?demo=crisis — טוען דוגמה ומריץ את כל התהליך
  const demo = new URLSearchParams(location.search).get('demo');
  if (demo) {
    const text = demo === 'crisis' ? D.sampleDictationCrisis : D.sampleDictation;
    $('#transcript').value = text;
    show('dictation');
    setTimeout(() => { state.transcript = text; show('processing'); runProcessing(text); }, 800);
  }
})();
