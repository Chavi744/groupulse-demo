// GroupPulse engine — יצירת טיוטות קליניות.
// מצב חי: Anthropic API (מפתח מקומי בדפדפן בלבד). מצב סימולציה: פלט מובנה. נפילה אוטומטית לסימולציה בכל שגיאה.
window.GP_ENGINE = (() => {
  const D = window.GP_DATA;

  function detectCrisis(text) {
    const hits = D.crisisKeywords.filter(k => text.includes(k));
    return { flagged: hits.length > 0, hits };
  }

  // --- סימולציה ---
  function simulate(transcript) {
    const crisis = detectCrisis(transcript);
    const canned = window.GP_CANNED;
    const personal = {};
    for (const p of D.participants) {
      const base = canned.personal[p.id];
      const override = crisis.flagged && canned.crisisOverride[p.id];
      personal[p.id] = override || base;
    }
    // אם הוקלט טקסט חופשי שלא מזכיר משתתף — מציינים זאת ברשומה
    const firstNames = { p1: 'דנה', p2: 'מיכאל', p3: 'שרה', p4: 'אבי', p5: 'נועה' };
    for (const p of D.participants) {
      if (!transcript.includes(firstNames[p.id])) {
        personal[p.id] = {
          note: `${p.name} לא הוזכר/ה בדיקטציה של מפגש זה. נדרשת השלמת דיווח על ידי המטפל: נוכחות, השתתפות והתייחסות ליעדי התוכנית.`,
          links: p.goals.map(g => ({ goal: g.text, evidence: 'לא נאסף דיווח במפגש זה', trend: 'same', label: 'ללא עדכון' })),
        };
      }
    }
    return { engine: 'sim', crisis, groupNote: { ...canned.groupNote }, personal };
  }

  // --- Anthropic API (מצב חי) ---
  async function callClaude(transcript, apiKey) {
    const participantsDesc = D.participants.map(p =>
      `- ${p.name} (id: ${p.id}) | אבחנה: ${p.dx} | יעדי תוכנית טיפול: ${p.goals.map(g => g.text).join('; ')} | היסטוריה: ${p.history.map(h => h.date + ': ' + h.text).join(' | ')}`
    ).join('\n');

    const prompt = `אתה מסייע תיעוד קליני לטיפול קבוצתי (GroupPulse). קיבלת דיקטציה של מטפל לאחר מפגש קבוצתי.
קבוצה: ${D.group.name}, פרוטוקול ${D.group.protocol}, מפגש ${D.group.sessionNo}/${D.group.totalSessions}.
משתתפים ותוכניות טיפול (חוט הזהב — חובה לקשר כל רשומה ליעדים אלה):
${participantsDesc}

דיקטציית המטפל:
"""${transcript}"""

צור JSON בלבד (ללא טקסט נוסף, ללא markdown) במבנה:
{"groupNote":{"S":"...","O":"...","A":"...","P":"..."},"personal":{"p1":{"note":"...","links":[{"goal":"שם היעד מהתוכנית","evidence":"ציטוט/פרפרזה מהדיקטציה","trend":"up|same|down","label":"תווית קצרה"}]}, ...לכל משתתף...},"crisisNote":"אם זוהו סימני אובדנות/מצוקה חריפה — משפט אזהרה, אחרת null"}
כללים: עברית קלינית מקצועית (מוסכמות DSM-5/CBT), טיוטה בלבד לאישור המטפל, אל תמציא עובדות שאינן בדיקטציה — משתתף שלא הוזכר יסומן "לא נאסף דיווח". שדה links חייב להתייחס ליעדים המדויקים מהתוכנית.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    let text = (data.content || []).map(b => b.text || '').join('').trim();
    text = text.replace(/^```(json)?/m, '').replace(/```$/m, '').trim();
    const parsed = JSON.parse(text);
    const crisis = detectCrisis(transcript);
    if (parsed.crisisNote) crisis.flagged = true;
    return {
      engine: 'live',
      crisis,
      crisisNote: parsed.crisisNote || null,
      groupNote: { title: 'סיכום קבוצתי — SOAP', ...parsed.groupNote },
      personal: parsed.personal,
    };
  }

  async function generate(transcript) {
    const apiKey = localStorage.getItem('gp_api_key');
    if (apiKey && navigator.onLine) {
      try {
        return await callClaude(transcript, apiKey);
      } catch (e) {
        console.warn('Live AI failed, falling back to simulation:', e);
        const r = simulate(transcript);
        r.fellBack = true;
        return r;
      }
    }
    // סימולציה — השהיה קלה לתחושת עיבוד
    await new Promise(r => setTimeout(r, 400));
    return simulate(transcript);
  }

  return { generate, detectCrisis };
})();
