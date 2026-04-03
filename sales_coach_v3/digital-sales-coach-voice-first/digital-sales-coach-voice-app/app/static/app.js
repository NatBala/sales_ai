const root = document.getElementById('root');
root.innerHTML = '<audio id="remote-audio" autoplay playsinline></audio><div id="app"></div>';

const appRoot = document.getElementById('app');
const remoteAudio = document.getElementById('remote-audio');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMultilineText(value) {
  return escapeHtml(value).replaceAll('\n', '<br>');
}

function badge(label, tone = 'neutral') {
  return `<span class="badge badge--${tone}">${escapeHtml(label)}</span>`;
}

const PERSONA_HEADSHOT_MAP = {
  entry_wirehouse_new: '/static/headshots/entry_wirehouse_new.jpg',
  growth_independent: '/static/headshots/growth_independent.jpg',
  edward_jones_new3: '/static/headshots/edward_jones_new3.jpg',
  ria_fiduciary: '/static/headshots/ria_fiduciary.jpg',
  retirement_plan_consultant: '/static/headshots/retirement_plan_consultant.jpg',
  insurance_channel_advisor: '/static/headshots/insurance_channel_advisor.jpg',
};

function personaHeadshotUrl(persona) {
  if (!persona?.id) return '';
  return PERSONA_HEADSHOT_MAP[persona.id] || '';
}

function sectionHeader({ eyebrow = '', title = '', description = '', actions = '' }) {
  return `
    <div class="section-header">
      <div>
        ${eyebrow ? `<div class="eyebrow">${escapeHtml(eyebrow)}</div>` : ''}
        <h2>${escapeHtml(title)}</h2>
        ${description ? `<p>${escapeHtml(description)}</p>` : ''}
      </div>
      ${actions ? `<div class="section-header__actions">${actions}</div>` : ''}
    </div>
  `;
}

function listItems(items) {
  return (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

async function apiFetch(path, options = {}) {
  const hasBody = Object.prototype.hasOwnProperty.call(options, 'body');
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(hasBody && !(options.headers || {})['Content-Type']
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let detail = response.statusText || 'Request failed';
    try {
      const data = await response.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      try {
        detail = await response.text();
      } catch {
        // ignore
      }
    }
    throw new Error(detail || 'Request failed');
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function extractAssistantText(item) {
  const seen = new Set();
  const parts = [];
  for (const content of item?.content || []) {
    if (content.type === 'output_audio' && content.transcript && !seen.has(content.transcript)) {
      parts.push(content.transcript);
      seen.add(content.transcript);
    }
    if (content.type === 'output_text' && content.text && !seen.has(content.text)) {
      parts.push(content.text);
      seen.add(content.text);
    }
  }
  return parts.join(' ').trim();
}

function extractResponseText(response) {
  const parts = [];
  for (const item of response?.output || []) {
    const text = extractAssistantText(item);
    if (text) {
      parts.push(text);
    }
  }
  return parts.join(' ').trim();
}

function transcriptToPlainText(transcript) {
  return transcript
    .map((turn) => `${turn.role === 'salesperson' ? 'Salesperson' : 'Advisor'}: ${turn.text}`)
    .join('\n');
}

function mergeTranscriptTurn(transcript, { externalId, role, text }) {
  const trimmed = (text || '').trim();
  if (!trimmed) return transcript;

  const next = [...transcript];
  const index = next.findIndex((turn) => turn.external_id === externalId);

  if (index > -1) {
    next[index] = {
      ...next[index],
      role,
      text: trimmed,
      external_id: externalId,
    };
  } else {
    next.push({
      id: crypto.randomUUID(),
      external_id: externalId,
      role,
      text: trimmed,
      created_at: new Date().toISOString(),
    });
  }

  next.sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
  return next;
}

function looksLikePossibleEndSignal(text) {
  return /\b(end|ended|over|wrap|goodbye|bye|let you go|that'?s all|all I needed|conversation|call)\b/i.test(text || '');
}

function scoreTone(value) {
  if (value >= 4) return 'success';
  if (value >= 3) return 'warning';
  return 'danger';
}

function getWeakestStage(report) {
  const stages = report?.stage_feedback || [];
  if (!stages.length) return null;
  return [...stages].sort((left, right) => left.score - right.score)[0] || null;
}

function buildCoachSpeech(report) {
  const overview = (report?.coach_mode_summary || '').trim();
  const sectionLines = (report?.spoken_section_feedback || [])
    .map((item) => {
      const matchingStage = (report?.stage_feedback || []).find((stage) => stage.stage === item.stage);
      const example = matchingStage?.improvement_example
        ? `Better example: ${matchingStage.improvement_example}`
        : '';
      return [`${item.stage}: ${item.spoken_feedback}`, example].filter(Boolean).join(' ');
    })
    .filter(Boolean);
  const exampleIntro = sectionLines.length
    ? 'Here is how to improve each section on the next rep.'
    : '';
  return [overview, exampleIntro, ...sectionLines].filter(Boolean).join('\n\n');
}

function finalScoreTone(score) {
  if (score >= 80) return 'strong';
  if (score >= 65) return 'mixed';
  return 'needs-work';
}

function scoreToneLabel(score) {
  if (score >= 80) return 'Strong';
  if (score >= 65) return 'Developing';
  return 'Needs work';
}

function stageAnchor(stageName) {
  return String(stageName || '')
    .toLowerCase()
    .replaceAll('&', 'and')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

async function urlToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load asset: ${url}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Unable to read asset: ${url}`));
    reader.readAsDataURL(blob);
  });
}

function buildDownloadReportHtml(stateSnapshot, options = {}) {
  const report = stateSnapshot.report || {};
  const scenario = stateSnapshot.scenario || {};
  const transcript = stateSnapshot.transcript || [];
  const persona = scenario.visible_persona || stateSnapshot.selectedPersona || {};
  const score = Number(report.final_score ?? 0);
  const scoreTone = finalScoreTone(score);
  const scoreLabel = scoreToneLabel(score);
  const generatedAt = new Date().toLocaleString();
  const stageFeedback = report.stage_feedback || [];
  const strengths = report.strengths || [];
  const misses = report.misses || [];
  const rewrites = report.rewrite_examples || [];
  const plan = report.next_rep_plan || [];
  const discoveryQuestions = report.missed_discovery_questions || [];
  const spokenFeedback = report.spoken_section_feedback || [];
  const headshotDataUrl = options.headshotDataUrl || '';
  const weakestStages = [...stageFeedback]
    .sort((left, right) => left.score - right.score)
    .slice(0, 3);

  const scoreCards = Object.entries(report.cg_way_scores || {})
    .map(([key, value]) => `
      <div class="mini-score">
        <div class="mini-score__label">${escapeHtml(key.replaceAll('_', ' '))}</div>
        <div class="mini-score__value">${escapeHtml(value)}/5</div>
      </div>
    `)
    .join('');

  const stageCards = stageFeedback
    .map((item) => {
      const width = Math.max(8, (Number(item.score || 0) / 5) * 100);
      const spoken = spokenFeedback.find((entry) => entry.stage === item.stage)?.spoken_feedback || '';
      return `
        <section class="stage-card" id="${stageAnchor(item.stage)}">
          <div class="stage-card__header">
            <div>
              <div class="stage-card__eyebrow">Engagement Framework Section</div>
              <h3>${escapeHtml(item.stage)}</h3>
            </div>
            <div class="stage-card__score">${escapeHtml(item.score)}/5</div>
          </div>
          <div class="stage-card__bar">
            <span style="width:${width}%"></span>
          </div>
          ${spoken ? `<p class="stage-card__spoken">${escapeHtml(spoken)}</p>` : ''}
          <div class="stage-card__grid">
            <div class="report-note">
              <div class="report-note__label">Assessment</div>
              <p>${formatMultilineText(item.assessment || '')}</p>
            </div>
            <div class="report-note">
              <div class="report-note__label">Evidence</div>
              <p>${formatMultilineText(item.evidence || '')}</p>
            </div>
            <div class="report-note">
              <div class="report-note__label">Better Example</div>
              <p>${formatMultilineText(item.improvement_example || '')}</p>
            </div>
          </div>
        </section>
      `;
    })
    .join('');

  const strengthsHtml = strengths.length
    ? strengths.map((item) => `
        <article class="detail-card">
          <h3>${escapeHtml(item.title || 'What worked')}</h3>
          <p>${formatMultilineText(item.why_it_worked || '')}</p>
          <div class="detail-card__meta"><strong>Evidence:</strong> ${formatMultilineText(item.evidence || '')}</div>
        </article>
      `).join('')
    : '<p class="empty-copy">No specific strengths were captured in this report.</p>';

  const missesHtml = misses.length
    ? misses.map((item) => `
        <article class="detail-card">
          <h3>${escapeHtml(item.title || 'Missed opportunity')}</h3>
          <p>${formatMultilineText(item.why_it_mattered || '')}</p>
          <div class="detail-card__meta"><strong>What happened:</strong> ${formatMultilineText(item.evidence || '')}</div>
          <div class="detail-card__meta"><strong>Fix:</strong> ${formatMultilineText(item.fix || '')}</div>
        </article>
      `).join('')
    : '<p class="empty-copy">No major misses were listed.</p>';

  const rewritesHtml = rewrites.length
    ? rewrites.map((item) => `
        <article class="detail-card">
          <h3>${escapeHtml(item.moment || 'Rewrite')}</h3>
          <div class="detail-card__meta"><strong>Issue:</strong> ${formatMultilineText(item.issue || '')}</div>
          <div class="detail-card__meta"><strong>Better example:</strong> ${formatMultilineText(item.better_example || '')}</div>
        </article>
      `).join('')
    : '<p class="empty-copy">No rewrite examples were provided.</p>';

  const focusHtml = weakestStages.length
    ? weakestStages.map((item, index) => `
        <article class="focus-card">
          <div class="focus-card__rank">0${index + 1}</div>
          <div>
            <h3>${escapeHtml(item.stage)}</h3>
            <p>${formatMultilineText(item.assessment || '')}</p>
            <div class="focus-card__example"><strong>Better example:</strong> ${formatMultilineText(item.improvement_example || '')}</div>
          </div>
        </article>
      `).join('')
    : '<p class="empty-copy">No specific improvement priorities were captured.</p>';

  const navHtml = stageFeedback.length
    ? stageFeedback.map((item) => `
        <a class="stage-nav__chip" href="#${stageAnchor(item.stage)}">
          <span>${escapeHtml(item.stage)}</span>
          <strong>${escapeHtml(item.score)}/5</strong>
        </a>
      `).join('')
    : '';

  const transcriptHtml = transcript.length
    ? transcript.map((turn) => `
        <div class="transcript-turn transcript-turn--${escapeHtml(turn.role)}">
          <div class="transcript-turn__role">${turn.role === 'salesperson' ? 'Salesperson' : 'Advisor'}</div>
          <div class="transcript-turn__text">${formatMultilineText(turn.text || '')}</div>
        </div>
      `).join('')
    : '<p class="empty-copy">No transcript available.</p>';

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(scenario.title || 'Digital Sales Coach Report')}</title>
    <style>
      :root {
        --bg: #edf4fb;
        --bg-deep: #dbe7f5;
        --ink: #10233c;
        --muted: #5f7189;
        --line: #d7e1ed;
        --panel: #ffffff;
        --panel-soft: #f6faff;
        --accent: #1b77ff;
        --accent-soft: #e8f2ff;
        --accent-deep: #0f4db8;
        --success: #23896a;
        --warning: #c88f20;
        --danger: #c6536c;
        --shadow: 0 24px 70px rgba(16, 35, 60, 0.12);
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        font-family: "Segoe UI", Aptos, Arial, sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(27, 119, 255, 0.08), transparent 24%),
          radial-gradient(circle at top right, rgba(55, 166, 255, 0.06), transparent 18%),
          linear-gradient(180deg, var(--bg) 0%, var(--bg-deep) 100%);
      }
      .report-shell {
        width: min(1240px, calc(100% - 48px));
        margin: 28px auto 56px;
        display: grid;
        gap: 24px;
      }
      .hero {
        background:
          radial-gradient(circle at top right, rgba(141, 214, 255, 0.22), transparent 22%),
          linear-gradient(135deg, rgba(27, 119, 255, 0.96), rgba(9, 56, 126, 0.96)),
          #103f81;
        color: white;
        border-radius: 34px;
        padding: 34px;
        box-shadow: var(--shadow);
      }
      .hero__top {
        display: flex;
        justify-content: space-between;
        gap: 28px;
        align-items: flex-start;
      }
      .hero__main {
        min-width: 0;
      }
      .brand {
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        opacity: 0.86;
      }
      .hero h1 {
        margin: 12px 0 12px;
        font-size: clamp(2.2rem, 4vw, 3.35rem);
        line-height: 0.98;
      }
      .hero p {
        margin: 0;
        max-width: 70ch;
        line-height: 1.7;
        color: rgba(255, 255, 255, 0.88);
      }
      .hero__side {
        display: grid;
        grid-template-columns: auto minmax(240px, 280px);
        gap: 18px;
        align-items: center;
      }
      .score-ring {
        --score: ${Math.max(0, Math.min(score, 100))};
        width: 170px;
        aspect-ratio: 1;
        border-radius: 50%;
        background:
          radial-gradient(closest-side, rgba(8, 28, 58, 0.98) 72%, transparent 74% 100%),
          conic-gradient(#8ad2ff calc(var(--score) * 1%), rgba(255, 255, 255, 0.16) 0);
        display: grid;
        place-items: center;
        flex: 0 0 auto;
      }
      .score-ring__inner {
        text-align: center;
      }
      .score-ring__value {
        font-size: 2.6rem;
        font-weight: 800;
        line-height: 1;
      }
      .score-ring__label {
        margin-top: 6px;
        font-size: 0.82rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.78);
      }
      .advisor-card {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 26px;
        padding: 18px;
        backdrop-filter: blur(12px);
      }
      .advisor-card__portrait {
        width: 100%;
        aspect-ratio: 4 / 5;
        border-radius: 20px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.1);
        margin-bottom: 14px;
      }
      .advisor-card__portrait img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .advisor-card__name {
        font-size: 1.15rem;
        font-weight: 800;
      }
      .advisor-card__role {
        margin-top: 6px;
        color: rgba(255, 255, 255, 0.78);
        line-height: 1.5;
      }
      .advisor-card__meta {
        display: grid;
        gap: 8px;
        margin-top: 14px;
        font-size: 0.94rem;
        color: rgba(255, 255, 255, 0.9);
      }
      .hero__meta {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-top: 24px;
      }
      .meta-card, .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        box-shadow: var(--shadow);
      }
      .meta-card {
        padding: 18px 20px;
      }
      .meta-card__label {
        color: var(--muted);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .meta-card__value {
        margin-top: 8px;
        font-size: 1.05rem;
        font-weight: 700;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 24px;
      }
      .grid-3 {
        display: grid;
        grid-template-columns: 1.2fr 1fr 1fr;
        gap: 24px;
      }
      .panel {
        padding: 24px;
      }
      .panel__eyebrow {
        color: var(--accent);
        font-size: 0.76rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .panel h2 {
        margin: 10px 0 12px;
        font-size: 1.5rem;
      }
      .panel p, .panel li {
        color: var(--muted);
        line-height: 1.7;
      }
      .score-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 18px;
      }
      .mini-score {
        padding: 16px;
        border-radius: 18px;
        background: var(--panel-soft);
        border: 1px solid var(--line);
      }
      .mini-score__label {
        color: var(--muted);
        font-size: 0.78rem;
        text-transform: capitalize;
      }
      .mini-score__value {
        margin-top: 8px;
        font-size: 1.5rem;
        font-weight: 800;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 14px;
        border-radius: 999px;
        font-weight: 700;
        background: ${scoreTone === 'strong' ? 'rgba(31, 157, 115, 0.12)' : scoreTone === 'mixed' ? 'rgba(201, 138, 18, 0.12)' : 'rgba(200, 77, 103, 0.12)'};
        color: ${scoreTone === 'strong' ? 'var(--success)' : scoreTone === 'mixed' ? 'var(--warning)' : 'var(--danger)'};
      }
      .callout {
        margin-top: 18px;
        padding: 16px 18px;
        border-radius: 18px;
        background: var(--accent-soft);
        border: 1px solid #cfe3ff;
      }
      .callout strong {
        display: block;
        margin-bottom: 8px;
        color: var(--ink);
      }
      .stage-nav {
        position: sticky;
        top: 16px;
        z-index: 3;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.72);
        backdrop-filter: blur(14px);
        box-shadow: var(--shadow);
      }
      .stage-nav__chip {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 999px;
        text-decoration: none;
        color: var(--ink);
        background: var(--panel-soft);
        border: 1px solid var(--line);
        font-size: 0.92rem;
      }
      .stage-nav__chip strong {
        color: var(--accent-deep);
      }
      .section-stack {
        display: grid;
        gap: 20px;
      }
      .stage-card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 24px;
        box-shadow: var(--shadow);
        scroll-margin-top: 100px;
      }
      .stage-card__header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }
      .stage-card__eyebrow {
        color: var(--muted);
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .stage-card h3 {
        margin: 8px 0 0;
        font-size: 1.35rem;
      }
      .stage-card__score {
        padding: 10px 14px;
        border-radius: 999px;
        background: var(--panel-soft);
        border: 1px solid var(--line);
        font-weight: 800;
      }
      .stage-card__bar {
        margin-top: 16px;
        height: 12px;
        border-radius: 999px;
        background: #e8eff8;
        overflow: hidden;
      }
      .stage-card__bar span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #6cc8ff, #1677ff);
      }
      .stage-card__spoken {
        margin: 14px 0 0;
        color: var(--ink);
        font-weight: 600;
      }
      .stage-card__grid, .detail-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 18px;
      }
      .report-note, .detail-card {
        background: var(--panel-soft);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 16px;
      }
      .report-note__label {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--muted);
      }
      .report-note p, .detail-card p, .detail-card__meta {
        margin: 10px 0 0;
        line-height: 1.7;
        color: var(--muted);
      }
      .detail-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .focus-card {
        display: grid;
        grid-template-columns: 58px minmax(0, 1fr);
        gap: 16px;
        padding: 18px;
        border-radius: 20px;
        background: var(--panel-soft);
        border: 1px solid var(--line);
      }
      .focus-card + .focus-card {
        margin-top: 14px;
      }
      .focus-card__rank {
        width: 58px;
        height: 58px;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #d8e8ff, #eef5ff);
        color: var(--accent-deep);
        font-size: 1.15rem;
        font-weight: 800;
      }
      .focus-card h3 {
        margin: 0;
        font-size: 1.08rem;
      }
      .focus-card p, .focus-card__example {
        margin: 8px 0 0;
        color: var(--muted);
        line-height: 1.7;
      }
      .focus-card__example strong {
        color: var(--ink);
      }
      .detail-card h3 {
        margin: 0;
        font-size: 1.1rem;
      }
      .report-actions {
        display: flex;
        gap: 12px;
        margin-top: 20px;
        flex-wrap: wrap;
      }
      .report-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 16px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.12);
        color: white;
        font-weight: 700;
        text-decoration: none;
      }
      .list-panel ul, .list-panel ol {
        margin: 14px 0 0;
        padding-left: 18px;
      }
      .transcript {
        display: grid;
        gap: 12px;
      }
      .transcript-turn {
        padding: 16px 18px;
        border-radius: 18px;
        border: 1px solid var(--line);
      }
      .transcript-turn--salesperson {
        background: #edf6ff;
      }
      .transcript-turn--advisor {
        background: #ffffff;
      }
      .transcript-turn__role {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-weight: 800;
        color: var(--accent);
      }
      .transcript-turn__text {
        margin-top: 10px;
        line-height: 1.7;
        color: var(--ink);
      }
      .empty-copy {
        color: var(--muted);
      }
      @media print {
        body { background: white; }
        .report-shell { width: 100%; margin: 0; }
        .hero, .panel, .stage-card, .meta-card { box-shadow: none; }
        .stage-nav { position: static; box-shadow: none; }
      }
      @media (max-width: 980px) {
        .hero__top, .grid-2, .grid-3, .hero__meta, .score-grid, .stage-card__grid, .detail-grid {
          grid-template-columns: 1fr;
          display: grid;
        }
        .hero__top {
          gap: 18px;
        }
        .hero__side {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="report-shell">
      <section class="hero">
        <div class="brand">Digital Sales Coach Report</div>
        <div class="hero__top">
          <div class="hero__main">
            <h1>${escapeHtml(scenario.title || 'Sales Call Scorecard')}</h1>
            <p>${formatMultilineText(report.coach_verdict || report.overall_assessment || '')}</p>
            <div class="report-actions">
              <a class="report-button" href="javascript:window.print()">Print or Save PDF</a>
              <a class="report-button" href="#section-review">Jump to Section Review</a>
            </div>
          </div>
          <div class="hero__side">
            <div class="score-ring">
              <div class="score-ring__inner">
                <div class="score-ring__value">${escapeHtml(report.final_score ?? '--')}</div>
                <div class="score-ring__label">${escapeHtml(scoreLabel)}</div>
              </div>
            </div>
            <div class="advisor-card">
              ${headshotDataUrl ? `
                <div class="advisor-card__portrait">
                  <img src="${headshotDataUrl}" alt="${escapeHtml(persona.name || 'Advisor')} headshot" />
                </div>
              ` : ''}
              <div class="advisor-card__name">${escapeHtml(persona.name || 'Advisor')}</div>
              <div class="advisor-card__role">${escapeHtml(persona.persona_type || '')}</div>
              <div class="advisor-card__meta">
                <div><strong>Firm:</strong> ${escapeHtml(persona.firm || '')}</div>
                <div><strong>Firm type:</strong> ${escapeHtml(persona.firm_type || '')}</div>
                ${persona.headline ? `<div>${escapeHtml(persona.headline)}</div>` : ''}
              </div>
            </div>
          </div>
        </div>
        <div class="hero__meta">
          <div class="meta-card">
            <div class="meta-card__label">Topic</div>
            <div class="meta-card__value">${escapeHtml(scenario.topic || '')}</div>
          </div>
          <div class="meta-card">
            <div class="meta-card__label">Difficulty</div>
            <div class="meta-card__value">${escapeHtml(scenario.difficulty || '')}</div>
          </div>
          <div class="meta-card">
            <div class="meta-card__label">Transcript Turns</div>
            <div class="meta-card__value">${escapeHtml(transcript.length)}</div>
          </div>
          <div class="meta-card">
            <div class="meta-card__label">Generated</div>
            <div class="meta-card__value">${escapeHtml(generatedAt)}</div>
          </div>
        </div>
      </section>

      <section class="grid-3">
        <article class="panel">
          <div class="panel__eyebrow">Executive Summary</div>
          <h2>Scorecard Overview</h2>
          <div class="status-pill">${escapeHtml(report.coach_verdict || 'Coach review')}</div>
          <p>${formatMultilineText(report.overall_assessment || '')}</p>
          <div class="callout">
            <strong>Top Priority Fix</strong>
            <div>${formatMultilineText(report.top_priority_fix || '')}</div>
          </div>
          <div class="callout">
            <strong>Coach Talk Track</strong>
            <div>${formatMultilineText(report.coach_mode_summary || '')}</div>
          </div>
        </article>

        <article class="panel">
          <div class="panel__eyebrow">Visualization</div>
          <h2>Engagement Framework Section Scores</h2>
          <div class="score-grid">${scoreCards}</div>
        </article>

        <article class="panel">
          <div class="panel__eyebrow">Where To Focus</div>
          <h2>Top Improvement Priorities</h2>
          ${focusHtml}
        </article>
      </section>

      <nav class="stage-nav" id="section-review">
        ${navHtml}
      </nav>

      <section class="section-stack">
        ${stageCards}
      </section>

      <section class="grid-2">
        <article class="panel list-panel">
          <div class="panel__eyebrow">Next Rep Plan</div>
          <h2>Immediate Actions</h2>
          ${plan.length ? `<ol>${plan.map((item) => `<li>${formatMultilineText(item)}</li>`).join('')}</ol>` : '<p class="empty-copy">No next-step plan available.</p>'}
        </article>
        <article class="panel list-panel">
          <div class="panel__eyebrow">Discovery Gaps</div>
          <h2>Questions Left On The Table</h2>
          ${discoveryQuestions.length ? `<ul>${discoveryQuestions.map((item) => `<li>${formatMultilineText(item)}</li>`).join('')}</ul>` : '<p class="empty-copy">No missed discovery questions listed.</p>'}
        </article>
      </section>

      <section class="panel">
        <div class="panel__eyebrow">Examples</div>
        <h2>Strengths, Misses, and Rewrites</h2>
        <div class="detail-grid">
          <div>
            <h3>What Worked</h3>
            ${strengthsHtml}
          </div>
          <div>
            <h3>Where It Missed</h3>
            ${missesHtml}
          </div>
        </div>
        <div style="margin-top: 18px;">
          <h3>Better Examples To Use</h3>
          <div class="detail-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
            ${rewritesHtml}
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel__eyebrow">Transcript</div>
        <h2>Full Conversation</h2>
        <div class="transcript">${transcriptHtml}</div>
      </section>
    </main>
  </body>
</html>
  `.trim();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const STAGE_GUIDANCE = {
  'Agenda': 'Set the 3 Ts clearly: thank them, confirm time, and co-create the plan for the call.',
  'Discovery': 'Earn the right to pitch by understanding workflow, client context, and the real business problem.',
  'Insights': 'Connect one useful idea directly to what the advisor just told you, not a generic product pitch.',
  'Practice Management': 'Show how your idea helps the advisor implement, scale, document, or communicate better.',
  'Summarize & Prioritize': 'Restate the advisor need in their words and agree on the most important problem to solve.',
  'Close': 'Leave with a specific next step, owner, and timing so the conversation advances.',
};

function getProgressSteps(currentState) {
  const phase = currentState.phase;
  return [
    {
      key: 'setup',
      label: 'Setup',
      caption: 'Choose advisor',
      state: phase === 'setup' ? 'active' : 'complete',
    },
    {
      key: 'connecting',
      label: 'Connect',
      caption: 'Build scenario + audio',
      state: phase === 'connecting' ? 'active' : ['live', 'evaluating', 'coaching'].includes(phase) ? 'complete' : 'pending',
    },
    {
      key: 'live',
      label: 'Live Call',
      caption: 'Practice the rep',
      state: phase === 'live' ? 'active' : ['evaluating', 'coaching'].includes(phase) ? 'complete' : 'pending',
    },
    {
      key: 'coach',
      label: 'Coach Review',
      caption: 'Score + next steps',
      state: phase === 'evaluating' ? 'active' : phase === 'coaching' ? 'complete' : 'pending',
    },
  ];
}

function renderProgressTracker(currentState) {
  const steps = getProgressSteps(currentState);
  const filled = Math.max(0, steps.findLastIndex((step) => step.state === 'complete') + 1);
  const activeIndex = steps.findIndex((step) => step.state === 'active');
  const percent = ((activeIndex > -1 ? activeIndex + 0.6 : filled) / steps.length) * 100;

  return `
    <div class="progress-shell">
      <div class="progress-shell__bar">
        <div class="progress-shell__fill" style="width:${percent}%"></div>
      </div>
      <div class="progress-steps">
        ${steps.map((step) => `
          <div class="progress-step progress-step--${step.state}">
            <div class="progress-step__dot">${step.state === 'complete' ? '✓' : ''}</div>
            <div class="progress-step__text">
              <div class="progress-step__label">${escapeHtml(step.label)}</div>
              <div class="progress-step__caption">${escapeHtml(step.caption)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function getSelectedStage(report, selectedStageName) {
  const stages = report?.stage_feedback || [];
  if (!stages.length) return null;
  return stages.find((item) => item.stage === selectedStageName) || stages[0];
}

function getSelectedStageIndex(report, selectedStageName) {
  const stages = report?.stage_feedback || [];
  if (!stages.length) return -1;
  return Math.max(0, stages.findIndex((item) => item.stage === selectedStageName));
}

function renderLoadingChecklist(mode, currentStepKey, status) {
  const steps = mode === 'evaluate'
    ? [
        { key: 'save', label: 'Save transcript', caption: 'Lock in the live call before scoring' },
        { key: 'score', label: 'Score the call', caption: 'Grade against the Engagement framework sections' },
        { key: 'sections', label: 'Build section review', caption: 'Write tile-by-tile feedback and rewrites' },
        { key: 'voice', label: 'Prepare spoken coach', caption: 'Assemble the summary and section talk track' },
      ]
    : [
        { key: 'scenario', label: 'Simulate advisor persona', caption: 'Build the advisor behavior, objections, and call context for this rep' },
        { key: 'audio', label: 'Shape call scenarios', caption: 'Build product, investment, and practice-management angles while checking audio devices' },
        { key: 'realtime', label: 'Open advisor voice link', caption: 'Connect the live realtime advisor session' },
        { key: 'channel', label: 'Finalize live call', caption: 'Finish the handshake and get the advisor ready to respond' },
      ];

  const activeIndex = Math.max(0, steps.findIndex((step) => step.key === currentStepKey));
  const safeIndex = Math.min(activeIndex, steps.length - 1);
  const activeStep = steps[safeIndex] || steps[0];
  const progressPercent = Math.max(18, Math.round(((safeIndex + 1) / Math.max(steps.length, 1)) * 100));
  return `
    <div class="loading-checklist">
      <div class="loading-checklist__header">
        <div>
          <div class="eyebrow">${mode === 'evaluate' ? 'Coach build' : 'Live call setup'}</div>
          <h3>${mode === 'evaluate' ? 'Building your coach review' : 'Getting the live call ready'}</h3>
        </div>
        <div class="loading-checklist__meta">
          <div class="loading-checklist__count">Step ${safeIndex + 1} of ${steps.length}</div>
          <div class="loading-checklist__current">${escapeHtml(activeStep.label)}</div>
        </div>
      </div>
      <div class="loading-checklist__status">${escapeHtml(status)}</div>
      <div class="loading-checklist__bar" aria-hidden="true">
        <span style="width: ${progressPercent}%"></span>
      </div>
      <div class="loading-checklist__steps">
        ${steps.map((step, index) => {
          const stepState = index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'pending';
          return `
            <div class="loading-checklist__step loading-checklist__step--${stepState}">
              <div class="loading-checklist__dot">${stepState === 'complete' ? '✓' : index + 1}</div>
              <div>
                <div class="loading-checklist__label">${escapeHtml(step.label)}</div>
                <div class="loading-checklist__caption">${escapeHtml(step.caption)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

let state = {
  catalog: null,
  health: { openai_configured: false },
  selectedPersonaId: '',
  difficulty: 'adaptive',
  topic: 'Active ETF Models',
  scenario: null,
  phase: 'setup',
  status: 'Select an advisor persona to begin.',
  transcript: [],
  report: null,
  loadingCatalog: true,
  startingCall: false,
  endingCall: false,
  practiceFocus: null,
  selectedStageName: null,
  progressMode: null,
  progressStepKey: null,
  coachPreviewText: '',
  coachPreviewStreaming: false,
  frameworkOpen: false,
  voice: {
    connected: false,
    busy: false,
    coachSpeaking: false,
  },
};

let endingInFlight = false;
let coachPreviewController = null;
let previousPhase = null;
let previousTranscriptCount = 0;

function setState(patch) {
  state = {
    ...state,
    ...(typeof patch === 'function' ? patch(state) : patch),
  };
  render();
}

function selectedPersona() {
  return state.catalog?.personas?.find((persona) => persona.id === state.selectedPersonaId) || null;
}

function renderPersonaCards() {
  return (state.catalog?.personas || [])
    .map((persona) => {
      const selected = persona.id === state.selectedPersonaId;
      const headshotUrl = personaHeadshotUrl(persona);
      return `
        <button
          class="persona-card ${selected ? 'persona-card--selected' : ''}"
          data-persona-id="${escapeHtml(persona.id)}"
          type="button"
        >
          ${headshotUrl ? `
            <div class="persona-card__portrait">
              <img src="${escapeHtml(headshotUrl)}" alt="${escapeHtml(persona.name)} headshot" loading="lazy" />
            </div>
          ` : ''}
          <div class="persona-card__top">
            <div>
              <div class="persona-card__name">${escapeHtml(persona.name)}</div>
              <div class="persona-card__type">${escapeHtml(persona.persona_type)}</div>
            </div>
            ${badge(persona.firm, selected ? 'accent' : 'neutral')}
          </div>
          <div class="persona-card__meta">${escapeHtml(persona.firm_type)}</div>
          ${selected ? '<div class="persona-card__cta">Selected</div>' : ''}
        </button>
      `;
    })
    .join('');
}

function renderTranscriptCards(transcript) {
  if (!transcript.length) {
    return `
      <div class="empty-state empty-state--slim">
        <div class="empty-state__icon">O</div>
        <h3>Waiting for your opening</h3>
        <p>Speak first. When you are finished with the roleplay, say a clear wrap-up line or click the end-call button.</p>
      </div>
    `;
  }

  return transcript
    .map(
      (turn) => `
        <div class="turn-card turn-card--${escapeHtml(turn.role)}">
          <div class="turn-card__role">${turn.role === 'salesperson' ? 'You' : 'Advisor'}</div>
          <div class="turn-card__text">${escapeHtml(turn.text)}</div>
        </div>
      `,
    )
    .join('');
}

function renderCoachPreviewPanel() {
  if (!state.coachPreviewStreaming && !state.coachPreviewText) {
    return '';
  }

  return `
    <div class="panel panel--compact coach-preview-panel">
      <div class="coach-preview-panel__header">
        <div>
          <div class="eyebrow">Live coach preview</div>
          <h3>${state.coachPreviewStreaming ? 'Coach feedback is streaming in' : 'Coach preview captured'}</h3>
        </div>
        ${badge(state.coachPreviewStreaming ? 'Streaming' : 'Ready', state.coachPreviewStreaming ? 'accent' : 'success')}
      </div>
      <p class="coach-preview-panel__intro">
        You can start reviewing the call while the scored report finishes building.
      </p>
      <div class="coach-preview-panel__body">
        ${state.coachPreviewText
          ? formatMultilineText(state.coachPreviewText)
          : 'Waiting for the first coaching notes...'}
      </div>
    </div>
  `;
}

function renderSetupScreen() {
  const catalog = state.catalog || { personas: [], topics: [], default_voice: '' };
  const persona = selectedPersona();
  const hasPersona = Boolean(persona);

  return `
    <div class="setup-shell setup-shell--with-dock">
      <div class="hero-card">
        <div class="hero-card__content">
          <div class="hero-card__eyebrow">Voice-to-voice roleplay</div>
          <h1>Digital Sales Coach</h1>
          <p>
            Pick the financial-advisor persona, start a live call, lead the conversation as the salesperson,
            then let the app switch into coach mode automatically when you end the call.
          </p>
        </div>
      </div>

      <div class="panel">
        ${sectionHeader({
          eyebrow: 'Step 1',
          title: 'Choose the advisor persona',
          description: 'The advisor behavior is generated from the persona catalog and the engagement framework knowledge base, not from a fixed script.',
        })}
        <div class="persona-grid">${renderPersonaCards()}</div>
      </div>

      <div class="launch-dock ${hasPersona ? '' : 'launch-dock--pending'}">
        <div class="launch-dock__top">
          <div class="launch-dock__summary">
            <div class="selected-persona-strip__label">${hasPersona ? 'Selected advisor' : 'Choose an advisor to unlock the live call'}</div>
            <div class="selected-persona-strip__value">
              ${hasPersona
                ? `${escapeHtml(persona.name)} - ${escapeHtml(persona.persona_type)}`
                : 'Select a persona above to configure topic, difficulty, and launch the roleplay.'}
            </div>
            ${hasPersona && state.practiceFocus ? `<div class="selected-persona-strip__focus">Next rep focus: ${escapeHtml(state.practiceFocus.stage)} - ${escapeHtml(state.practiceFocus.spoken_feedback || state.practiceFocus.assessment || '')}</div>` : ''}
          </div>

          <label class="field launch-dock__field">
            <span class="field__label">Topic</span>
            <select class="field__input" data-role="topic-select" ${hasPersona ? '' : 'disabled'}>
              ${(catalog.topics || [])
                .map(
                  (entry) => `
                    <option value="${escapeHtml(entry)}" ${entry === state.topic ? 'selected' : ''}>
                      ${escapeHtml(entry)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </label>

          <div class="launch-dock__difficulty">
            <div class="field__label">Difficulty</div>
            <div class="difficulty-row">
              ${['easy', 'adaptive', 'challenging']
                .map(
                  (entry) => `
                    <button
                      class="difficulty-chip ${state.difficulty === entry ? 'difficulty-chip--active' : ''}"
                      data-difficulty="${entry}"
                      type="button"
                      ${hasPersona ? '' : 'disabled'}
                    >
                      ${escapeHtml(entry)}
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>

          <button
            class="button button--primary button--large launch-dock__button"
            data-action="start-call"
            type="button"
            ${state.startingCall || !state.health?.openai_configured || !hasPersona ? 'disabled' : ''}
          >
            ${state.startingCall ? 'Starting live call...' : 'Start live call'}
          </button>
        </div>

        ${state.startingCall
          ? `<div class="launch-dock__progress">${renderLoadingChecklist(state.progressMode || 'start', state.progressStepKey || 'scenario', state.status)}</div>`
          : ''}

        ${!state.startingCall && state.status
          ? `<div class="status-banner status-banner--compact">${escapeHtml(state.status)}</div>`
          : ''}
      </div>
    </div>
  `;
}

function renderLiveScreen() {
  const scenario = state.scenario || {};
  const connectionState = state.voice.busy || state.phase === 'connecting'
    ? 'connecting'
    : state.voice.connected
      ? 'connected'
      : 'offline';

  return `
    <div class="workspace-shell workspace-shell--live workspace-shell--wide">
      <div class="workspace-main">
        <div class="panel live-call-panel live-call-panel--active">
          ${sectionHeader({
            eyebrow: 'Live call',
            title: scenario.title || 'Advisor call',
            description: '',
            actions: `
              <div class="status-stack">
                ${badge(connectionState === 'connected' ? 'Live' : connectionState === 'connecting' ? 'Connecting' : 'Offline', connectionState === 'connected' ? 'success' : connectionState === 'connecting' ? 'warning' : 'neutral')}
                ${badge(`${state.transcript.length} turns`)}
              </div>
            `,
          })}

          <div class="call-stage-bar">
            <div class="call-stage-bar__label">You are the salesperson.</div>
            <div class="call-stage-bar__text">
              ${escapeHtml(scenario.start_instruction || 'Open the call with your agenda. The advisor will wait for you to start.')}
            </div>
            ${state.practiceFocus ? `<div class="call-stage-bar__focus">Practice focus for this rep: <strong>${escapeHtml(state.practiceFocus.stage)}</strong></div>` : ''}
          </div>

          <div class="status-banner">${escapeHtml(state.status)}</div>

          ${state.phase === 'evaluating'
            ? renderLoadingChecklist(state.progressMode || 'evaluate', state.progressStepKey || 'save', state.status)
            : ''}

          ${state.phase === 'evaluating' ? renderCoachPreviewPanel() : ''}

          <div class="transcript-list transcript-list--primary" data-transcript-role="primary">${renderTranscriptCards(state.transcript)}</div>

          <div class="call-actions call-actions--live">
            <div class="call-actions__hint">
              Wrap up when you are ready, then switch straight into section-by-section coaching.
            </div>
            <div class="call-actions__buttons">
              <button class="button button--secondary button--action" data-action="copy-transcript" type="button" ${state.transcript.length === 0 ? 'disabled' : ''}>
                Copy transcript
              </button>
              <button class="button button--danger button--action button--action-primary" data-action="end-call" type="button" ${state.endingCall ? 'disabled' : ''}>
                ${state.endingCall ? 'Switching to coach mode...' : 'End call and coach me'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderReportList(title, items, renderItem) {
  if (!items || !items.length) return '';
  return `
    <div class="panel">
      <h3 class="panel-heading">${escapeHtml(title)}</h3>
      <div class="detail-list">
        ${items.map((item) => `<div class="detail-list__item">${renderItem(item)}</div>`).join('')}
      </div>
    </div>
  `;
}

function renderCoachingScreen() {
  const report = state.report || {};
  const scenario = state.scenario || {};
  const weakestStage = getWeakestStage(report);
  const selectedStage = getSelectedStage(report, state.selectedStageName);
  const selectedStageIndex = getSelectedStageIndex(report, selectedStage?.stage);
  const previousStage = selectedStageIndex > 0 ? report.stage_feedback?.[selectedStageIndex - 1] : null;
  const nextStage = selectedStageIndex > -1 && selectedStageIndex < (report.stage_feedback?.length || 0) - 1
    ? report.stage_feedback?.[selectedStageIndex + 1]
    : null;
  const selectedSpokenStage = (report.spoken_section_feedback || []).find((item) => item.stage === selectedStage?.stage);

  return `
    <div class="workspace-shell workspace-shell--wide">
      <div class="workspace-main">
        <div class="panel coaching-hero">
          ${sectionHeader({
            eyebrow: 'Coach mode',
            title: 'Your live call feedback',
            description: state.status,
            actions: `
              <div class="status-stack">
                ${badge(state.voice.coachSpeaking ? 'Coach speaking' : 'Coach ready', state.voice.coachSpeaking ? 'accent' : 'success')}
                ${badge(`Score ${report.final_score ?? '--'}`, (report.final_score ?? 0) >= 80 ? 'success' : (report.final_score ?? 0) >= 65 ? 'warning' : 'danger')}
              </div>
            `,
          })}

          <div class="coach-summary">
            <div class="coach-summary__headline">${escapeHtml(report.coach_verdict || 'Coach feedback')}</div>
            <p>${escapeHtml(report.overall_assessment || '')}</p>
            <div class="coach-summary__callout">
              <div class="coach-summary__label">Coach talk track</div>
              <p>${escapeHtml(report.coach_mode_summary || '')}</p>
            </div>
            <div class="coach-summary__priority">
              <strong>Top priority fix:</strong> ${escapeHtml(report.top_priority_fix || '')}
            </div>
          </div>

          <div class="coaching-actions">
            <button class="button button--primary" data-action="replay-feedback" type="button" ${report.coach_mode_summary ? '' : 'disabled'}>
              Replay coach feedback
            </button>
            <button class="button button--secondary" data-action="download-report" type="button" ${state.report ? '' : 'disabled'}>
              Download HTML report
            </button>
            <button class="button button--secondary" data-action="copy-transcript" type="button">
              Copy transcript
            </button>
            <button class="button button--ghost" data-action="disconnect-audio" type="button">
              Disconnect audio
            </button>
            <button class="button button--ghost" data-action="new-call" type="button">
              Start new call
            </button>
          </div>
        </div>

        <div class="panel">
          ${sectionHeader({
            eyebrow: 'Improve next',
            title: 'What to do right away',
            description: 'Turn the coach feedback into the next rep, not just a score.',
          })}
          <div class="improvement-grid">
            <div class="detail-list__item">
              <div class="detail-title">Practice the weakest section again</div>
              <p>${escapeHtml(weakestStage ? `${weakestStage.stage} was your lowest-scoring area. Run another call with that section in mind.` : 'Run another call and focus on the top-priority fix.')}</p>
              <button class="button button--primary" data-action="practice-weakest" type="button">
                Practice this area
              </button>
            </div>
            <div class="detail-list__item">
              <div class="detail-title">Use the coach talking points</div>
              <p>${escapeHtml(report.top_priority_fix || 'Replay the coach feedback and listen for the section-by-section guidance.')}</p>
              <button class="button button--secondary" data-action="replay-feedback" type="button" ${report.coach_mode_summary ? '' : 'disabled'}>
                Replay section coaching
              </button>
            </div>
            <div class="detail-list__item">
              <div class="detail-title">Share the report</div>
              <p>Download a polished HTML report with the scorecard, visuals, section feedback, examples, and transcript so anyone can open it in a browser.</p>
              <button class="button button--ghost" data-action="download-report" type="button" ${state.report ? '' : 'disabled'}>
                Download HTML to share
              </button>
            </div>
          </div>
        </div>

        <div class="score-grid">
          ${Object.entries(report.cg_way_scores || {})
            .map(
              ([key, value]) => `
                <div class="score-card">
                  <div class="score-card__label">${escapeHtml(key.replaceAll('_', ' '))}</div>
                  <div class="score-card__value">${escapeHtml(value)}/5</div>
                </div>
              `,
            )
            .join('')}
        </div>

        <div class="panel">
          ${sectionHeader({
            eyebrow: 'Engagement framework sections',
            title: 'Review one section at a time',
            description: 'Click a tile to focus on that stage and understand what good looks like.',
          })}
          <div class="section-tile-grid">
            ${(report.stage_feedback || [])
              .map(
                (item) => `
                  <button
                    class="section-tile ${state.selectedStageName === item.stage || (!state.selectedStageName && selectedStage?.stage === item.stage) ? 'section-tile--active' : ''}"
                    data-stage-select="${escapeHtml(item.stage)}"
                    type="button"
                  >
                    <div class="section-tile__top">
                      <div class="section-tile__title">${escapeHtml(item.stage)}</div>
                      ${badge(`${item.score}/5`, scoreTone(item.score))}
                    </div>
                    <div class="section-tile__hint">${escapeHtml(STAGE_GUIDANCE[item.stage] || 'Review this stage in detail.')}</div>
                  </button>
                `,
              )
              .join('')}
          </div>

          ${selectedStage ? `
            <div class="section-review-panel">
              <div class="section-review-panel__header">
                <div>
                  <div class="eyebrow">Focused Review</div>
                  <h3>${escapeHtml(selectedStage.stage)}</h3>
                </div>
                <div class="section-review-panel__actions">
                  ${previousStage ? `
                    <button class="button button--ghost button--sm" data-stage-select="${escapeHtml(previousStage.stage)}" type="button">
                      Previous
                    </button>
                  ` : ''}
                  ${nextStage ? `
                    <button class="button button--ghost button--sm" data-stage-select="${escapeHtml(nextStage.stage)}" type="button">
                      Next
                    </button>
                  ` : ''}
                  ${badge(`${selectedStage.score}/5`, scoreTone(selectedStage.score))}
                </div>
              </div>
              <div class="section-review-panel__nav">
                ${(report.stage_feedback || [])
                  .map((item) => `
                    <button
                      class="section-nav-chip ${selectedStage.stage === item.stage ? 'section-nav-chip--active' : ''}"
                      data-stage-select="${escapeHtml(item.stage)}"
                      type="button"
                    >
                      ${escapeHtml(item.stage)}
                    </button>
                  `)
                  .join('')}
              </div>
              <p class="section-review-panel__guidance">${escapeHtml(STAGE_GUIDANCE[selectedStage.stage] || '')}</p>
              ${selectedSpokenStage ? `
                <div class="coach-summary__callout">
                  <div class="coach-summary__label">What the coach would say</div>
                  <p>${escapeHtml(selectedSpokenStage.spoken_feedback)}</p>
                </div>
              ` : ''}
              <div class="section-review-panel__grid">
                <div class="detail-list__item">
                  <div class="detail-title">Review</div>
                  <p>${escapeHtml(selectedStage.assessment)}</p>
                </div>
                <div class="detail-list__item">
                  <div class="detail-title">Evidence from your call</div>
                  <p>${escapeHtml(selectedStage.evidence)}</p>
                </div>
                <div class="detail-list__item">
                  <div class="detail-title">How to improve</div>
                  <p>${escapeHtml(selectedStage.improvement_example)}</p>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        ${renderReportList('What worked', report.strengths || [], (item) => `
          <div>
            <div class="detail-title">${escapeHtml(item.title)}</div>
            <p>${escapeHtml(item.why_it_worked)}</p>
            <div class="detail-evidence">Example: ${escapeHtml(item.evidence)}</div>
          </div>
        `)}

        ${renderReportList('Where you missed', report.misses || [], (item) => `
          <div>
            <div class="detail-title">${escapeHtml(item.title)}</div>
            <p>${escapeHtml(item.why_it_mattered)}</p>
            <div class="detail-evidence">What happened: ${escapeHtml(item.evidence)}</div>
            <div class="detail-fix">Improve by: ${escapeHtml(item.fix)}</div>
          </div>
        `)}

        ${renderReportList('Rewrite examples', report.rewrite_examples || [], (item) => `
          <div>
            <div class="detail-title">${escapeHtml(item.moment)}</div>
            <div class="detail-evidence">Issue: ${escapeHtml(item.issue)}</div>
            <div class="detail-fix">Better example: ${escapeHtml(item.better_example)}</div>
          </div>
        `)}

        ${renderReportList('Questions you left on the table', report.missed_discovery_questions || [], (item) => `
          <div>
            <p>${escapeHtml(item)}</p>
          </div>
        `)}

        ${renderReportList('Next rep plan', report.next_rep_plan || [], (item) => `
          <div>
            <p>${escapeHtml(item)}</p>
          </div>
        `)}
      </div>
    </div>
  `;
}

function render() {
  const currentPersona = selectedPersona();
  const body = state.loadingCatalog
    ? `
        <div class="loading-screen">
          <div class="spinner"></div>
          <div>Loading personas and coaching setup...</div>
        </div>
      `
    : state.phase === 'setup' || state.phase === 'connecting'
      ? renderSetupScreen()
      : state.phase === 'live' || state.phase === 'evaluating'
        ? renderLiveScreen()
        : renderCoachingScreen();

  appRoot.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div>
          <div class="topbar__brand">Digital Sales Coach</div>
          <div class="topbar__subtitle">Voice-to-voice mock advisor calls with automatic coach mode</div>
        </div>
        <div class="topbar__actions">
          <button class="button button--secondary button--sm" data-action="open-framework" type="button">
            Framework
          </button>
        </div>
      </header>

      ${renderProgressTracker(state)}

      ${body}

      ${renderFrameworkModal()}

      ${state.phase !== 'setup' && currentPersona
        ? `
            <footer class="footer-note">
              Current advisor: <strong>${escapeHtml(currentPersona.name)}</strong> - ${escapeHtml(currentPersona.persona_type)}
            </footer>
          `
        : ''}
    </div>
  `;

  syncTranscriptViewport();
  previousPhase = state.phase;
  previousTranscriptCount = state.transcript.length;
}

function renderFrameworkModal() {
  if (!state.frameworkOpen) return '';

  return `
    <div class="framework-modal" data-role="framework-overlay">
      <div class="framework-modal__dialog" role="dialog" aria-modal="true" aria-label="Engagement framework">
        <div class="framework-modal__header">
          <div>
            <div class="eyebrow">Engagement Framework</div>
            <h2>Client Engagement Framework</h2>
          </div>
          <button class="button button--ghost button--sm" data-action="close-framework" type="button">
            Close
          </button>
        </div>
        <div class="framework-modal__body">
          <img src="/static/vg_way.png" alt="Client engagement framework infographic" />
        </div>
      </div>
    </div>
  `;
}

function syncTranscriptViewport() {
  const transcriptList = appRoot.querySelector('[data-transcript-role="primary"]');
  if (!transcriptList) return;

  const transcriptChanged = state.transcript.length !== previousTranscriptCount;
  const enteredLiveFlow =
    previousPhase !== state.phase && ['live', 'evaluating'].includes(state.phase);

  if (!transcriptChanged && !enteredLiveFlow) {
    return;
  }

  requestAnimationFrame(() => {
    transcriptList.scrollTop = transcriptList.scrollHeight;

    const rect = transcriptList.getBoundingClientRect();
    const topLimit = 150;
    const bottomLimit = window.innerHeight - 140;

    if (rect.top < topLimit || rect.bottom > bottomLimit) {
      transcriptList.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  });
}

function waitForIceGatheringComplete(pc) {
  if (!pc || pc.iceGatheringState === 'complete') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', handleStateChange);
      reject(new Error('Realtime audio setup timed out while gathering network candidates.'));
    }, 5000);

    function handleStateChange() {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeoutId);
        pc.removeEventListener('icegatheringstatechange', handleStateChange);
        resolve();
      }
    }

    pc.addEventListener('icegatheringstatechange', handleStateChange);
  });
}

function createVoiceSession({ getPhase, setStatus, onUserTranscript, onAdvisorTranscript, onCoachResponseDone }) {
  let pc = null;
  let dc = null;
  let stream = null;
  let connected = false;
  let busy = false;
  let coachSpeaking = false;
  let activeVoice = '';
  let lastCoachSpeech = {
    text: '',
    startedAt: 0,
  };

  function sync() {
    setState({
      voice: {
        connected,
        busy,
        coachSpeaking,
      },
    });
  }

  function setMicEnabled(enabled) {
    if (!stream) return;
    for (const track of stream.getAudioTracks()) {
      track.enabled = enabled;
    }
  }

  async function prepareMicrophone() {
    if (stream) return stream;
    setState({ progressMode: 'start', progressStepKey: 'audio' });
    setStatus('Shaping product, investment, and practice-management scenarios while checking microphone and audio devices...');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    return stream;
  }

  function sendEvent(payload) {
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  function getAdvisorVoice() {
    return state.catalog?.default_voice || 'marin';
  }

  function getCoachVoice() {
    return state.catalog?.default_coach_voice || 'cedar';
  }

  function setSessionVoice(nextVoice) {
    if (!nextVoice || nextVoice === activeVoice) return true;
    const ok = sendEvent({
      type: 'session.update',
      session: {
        audio: {
          output: {
            voice: nextVoice,
          },
        },
      },
    });
    if (ok) {
      activeVoice = nextVoice;
    }
    return ok;
  }

  function speakCoachFeedback(spokenSummary, options = {}) {
    const normalizedSummary = (spokenSummary || '').trim();
    const force = Boolean(options.force);
    if (!normalizedSummary) return false;
    if (coachSpeaking && !force) return false;
    if (
      !force &&
      normalizedSummary === lastCoachSpeech.text &&
      Date.now() - lastCoachSpeech.startedAt < 20000
    ) {
      return false;
    }

    lastCoachSpeech = {
      text: normalizedSummary,
      startedAt: Date.now(),
    };
    setSessionVoice(getCoachVoice());
    coachSpeaking = true;
    sync();
    const ok = sendEvent({
      type: 'response.create',
      response: {
        conversation: 'none',
        metadata: { response_purpose: 'coach_feedback' },
        output_modalities: ['audio'],
        instructions: `You are a direct but supportive digital sales coach. Say exactly the following and do not add anything before or after:\n${normalizedSummary}`,
      },
    });
    if (!ok) {
      coachSpeaking = false;
      setSessionVoice(getAdvisorVoice());
      sync();
    }
    return ok;
  }

  function stop(message = 'Audio disconnected.') {
    coachSpeaking = false;
    activeVoice = '';
    if (dc) {
      try {
        dc.close();
      } catch {
        // ignore cleanup failure
      }
    }
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore cleanup failure
      }
    }
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    dc = null;
    pc = null;
    stream = null;
    connected = false;
    busy = false;
    sync();
    setStatus(message);
  }

  function handleRealtimeEvent(event) {
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        setStatus(getPhase() === 'live'
          ? 'Audio connected. You are the salesperson. Start the conversation.'
          : 'Audio session ready.');
        break;
      case 'input_audio_buffer.speech_started':
        if (getPhase() === 'live') {
          setStatus('Listening...');
        }
        break;
      case 'input_audio_buffer.speech_stopped':
        if (getPhase() === 'live') {
          setStatus('Thinking...');
        }
        break;
      case 'conversation.item.input_audio_transcription.completed':
        Promise.resolve(
          onUserTranscript({
            itemId: event.item_id,
            text: event.transcript,
          }),
        ).catch((error) => {
          console.error('User transcript handler failed', error);
        });
        break;
      case 'conversation.item.done':
        break;
      case 'response.done':
        if (event.response?.metadata?.response_purpose === 'coach_feedback') {
          coachSpeaking = false;
          setSessionVoice(getAdvisorVoice());
          sync();
          onCoachResponseDone();
          break;
        }
        if (getPhase() === 'live') {
          const text = extractResponseText(event.response);
          if (text) {
            onAdvisorTranscript({
              itemId: event.response?.id || crypto.randomUUID(),
              text,
            });
            setStatus('Advisor responded. Keep the conversation moving.');
          }
        }
        break;
      case 'error':
        coachSpeaking = false;
        setSessionVoice(getAdvisorVoice());
        sync();
        setStatus(`Realtime error: ${event.error?.message || 'Unknown realtime error.'}`);
        break;
      default:
        break;
    }
  }

  async function start(scenarioId) {
    if (!scenarioId || busy || connected) return;

    busy = true;
    activeVoice = getAdvisorVoice();
    sync();
    setStatus('Connecting audio...');

    try {
      pc = new RTCPeerConnection();
      stream = await prepareMicrophone();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          connected = true;
          sync();
          setStatus('Audio connected. You are the salesperson. Start the conversation.');
        }
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          connected = false;
          sync();
        }
      };

      dc = pc.createDataChannel('oai-events');
      const connectedPromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Realtime audio connection timed out before the data channel opened.'));
        }, 15000);

        dc.onopen = () => {
          clearTimeout(timeoutId);
          connected = true;
          sync();
          setStatus('Audio connected. You are the salesperson. Start the conversation.');
          resolve();
        };

        dc.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error('Realtime audio channel failed to open.'));
        };
      });
      dc.onclose = () => {
        connected = false;
        sync();
      };
      dc.onmessage = (event) => {
        try {
          handleRealtimeEvent(JSON.parse(event.data));
        } catch (error) {
          console.error('Failed to parse realtime event', error, event.data);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setStatus('Finalizing audio network setup...');
      await waitForIceGatheringComplete(pc);

      setState({ progressMode: 'start', progressStepKey: 'realtime' });
      setStatus('Connecting realtime advisor...');
      const answerSdp = await apiFetch(`/api/scenarios/${scenarioId}/realtime/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp || offer.sdp,
      });

      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      setState({ progressMode: 'start', progressStepKey: 'channel' });
      await connectedPromise;
    } catch (error) {
      stop(error.message || 'Failed to connect realtime advisor.');
      throw error;
    } finally {
      busy = false;
      sync();
    }
  }

  return {
    prepareMicrophone,
    start,
    stop,
    setMicEnabled,
    speakCoachFeedback,
    get connected() {
      return connected;
    },
  };
}

async function loadCatalog() {
  try {
    setState({ loadingCatalog: true });
    const [catalog, health] = await Promise.all([
      apiFetch('/api/catalog'),
      apiFetch('/api/health'),
    ]);

    setState({
      catalog,
      health,
      topic: catalog.topics?.[0] || 'Active ETF Models',
      selectedPersonaId: '',
      status: 'Select the advisor persona and start the live call.',
      loadingCatalog: false,
    });
  } catch (error) {
    setState({
      status: error.message || 'Failed to load the app catalog.',
      loadingCatalog: false,
    });
  }
}

function updateTranscript(updater) {
  const next = typeof updater === 'function' ? updater(state.transcript) : updater;
  setState({ transcript: next });
  return next;
}

function stopCoachPreviewStream() {
  if (coachPreviewController) {
    coachPreviewController.abort();
    coachPreviewController = null;
  }
}

function handleCoachPreviewEvent(eventName, rawData) {
  if (eventName === 'preview_delta') {
    try {
      const payload = JSON.parse(rawData || '{}');
      if (payload.delta) {
        setState((current) => ({
          coachPreviewText: `${current.coachPreviewText || ''}${payload.delta}`,
          coachPreviewStreaming: true,
        }));
      }
    } catch {
      // ignore malformed chunk
    }
    return;
  }

  if (eventName === 'preview_done') {
    setState({ coachPreviewStreaming: false });
    return;
  }

  if (eventName === 'error') {
    try {
      const payload = JSON.parse(rawData || '{}');
      setState({
        coachPreviewStreaming: false,
        coachPreviewText: state.coachPreviewText || `Coach preview unavailable: ${payload.detail || 'Unknown error.'}`,
      });
    } catch {
      setState({
        coachPreviewStreaming: false,
        coachPreviewText: state.coachPreviewText || 'Coach preview unavailable.',
      });
    }
  }
}

async function streamCoachPreview(scenarioId) {
  if (!scenarioId) return;

  stopCoachPreviewStream();
  const controller = new AbortController();
  coachPreviewController = controller;
  setState({
    coachPreviewText: '',
    coachPreviewStreaming: true,
  });

  try {
    const response = await fetch(`/api/scenarios/${scenarioId}/evaluate/stream`, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = 'Unable to stream coach preview.';
      try {
        const data = await response.json();
        detail = data.detail || detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Streaming response was not available in this browser.');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const flushBuffer = () => {
      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex > -1) {
        const block = buffer.slice(0, separatorIndex).trim();
        buffer = buffer.slice(separatorIndex + 2);
        separatorIndex = buffer.indexOf('\n\n');

        if (!block) continue;

        let eventName = 'message';
        const dataParts = [];
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataParts.push(line.slice(5).trim());
          }
        }

        handleCoachPreviewEvent(eventName, dataParts.join('\n'));
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        flushBuffer();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      flushBuffer();
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      setState({
        coachPreviewStreaming: false,
        coachPreviewText: state.coachPreviewText || `Coach preview unavailable: ${error.message || 'Unknown error.'}`,
      });
    }
  } finally {
    if (coachPreviewController === controller) {
      coachPreviewController = null;
      setState({ coachPreviewStreaming: false });
    }
  }
}

async function finalizeCall(explicitTranscript = null, trigger = 'button') {
  if (!state.scenario || endingInFlight) return;

  endingInFlight = true;
  setState({
    endingCall: true,
    phase: 'evaluating',
    progressMode: 'evaluate',
    progressStepKey: 'save',
    status: trigger === 'button'
      ? 'Call ended. Building coach feedback...'
      : 'Detected your wrap-up. Switching to coach mode...',
  });

  try {
    voice.setMicEnabled(false);
    const transcriptToSave = explicitTranscript || state.transcript;

    setState({ progressMode: 'evaluate', progressStepKey: 'save', status: 'Saving the transcript from your live call...' });
    await apiFetch(`/api/scenarios/${state.scenario.id}/transcript`, {
      method: 'POST',
      body: JSON.stringify({ transcript: transcriptToSave }),
    });

    streamCoachPreview(state.scenario.id);

    setState({ progressMode: 'evaluate', progressStepKey: 'score', status: 'Scoring the call against the engagement framework...' });
    const evaluation = await apiFetch(`/api/scenarios/${state.scenario.id}/evaluate`, {
      method: 'POST',
    });
    const weakestStage = getWeakestStage(evaluation.report);

    setState({
      progressMode: 'evaluate',
      progressStepKey: 'sections',
      status: 'Writing section-by-section coaching notes...',
    });

    setState({
      progressMode: 'evaluate',
      progressStepKey: 'voice',
      status: 'Preparing the spoken coach summary...',
    });

    setState({
      transcript: evaluation.transcript?.length ? evaluation.transcript : state.transcript,
      report: evaluation.report,
      phase: 'coaching',
      selectedStageName: weakestStage?.stage || evaluation.report?.stage_feedback?.[0]?.stage || null,
      progressMode: null,
      progressStepKey: null,
      status: 'Coach mode ready. Playing your feedback now...',
    });

    stopCoachPreviewStream();
    voice.speakCoachFeedback(buildCoachSpeech(evaluation.report));
  } catch (error) {
    stopCoachPreviewStream();
    setState({
      phase: 'coaching',
      progressMode: null,
      progressStepKey: null,
      status: error.message || 'Failed to generate coach feedback.',
    });
  } finally {
    endingInFlight = false;
    setState({ endingCall: false });
  }
}

const voice = createVoiceSession({
  getPhase: () => state.phase,
  setStatus: (status) => setState({ status }),
  onUserTranscript: async ({ itemId, text }) => {
    if (state.phase !== 'live') return;

    let nextTranscript = state.transcript;
    updateTranscript((current) => {
      nextTranscript = mergeTranscriptTurn(current, {
        externalId: itemId,
        role: 'salesperson',
        text,
      });
      return nextTranscript;
    });

    try {
      const utterance = (text || '').trim();
      if (!utterance) return;

      if (looksLikePossibleEndSignal(utterance)) {
        const decision = await apiFetch(`/api/scenarios/${state.scenario.id}/should-end`, {
          method: 'POST',
          body: JSON.stringify({
            latest_utterance: utterance,
            transcript: nextTranscript,
          }),
        });

        if (decision.should_end && decision.confidence >= 60) {
          await finalizeCall(nextTranscript, 'voice_end_signal');
          return;
        }
      }
    } catch (error) {
      console.error('End-signal detection failed', error);
    }
  },
  onAdvisorTranscript: ({ itemId, text }) => {
    if (state.phase !== 'live') return;
    updateTranscript((current) =>
      mergeTranscriptTurn(current, {
        externalId: itemId,
        role: 'advisor',
        text,
      }),
    );
  },
  onCoachResponseDone: () => {
    setState({ status: 'Coach feedback finished. Review the report or replay the summary.' });
  },
});

async function startLiveCall() {
  try {
    if (!state.selectedPersonaId) {
      setState({ status: 'Choose an advisor persona first.' });
      return;
    }

    if (voice.connected) {
      voice.stop('Resetting audio for a new call...');
    }

    setState({
      startingCall: true,
      phase: 'connecting',
      report: null,
      transcript: [],
      coachPreviewText: '',
      coachPreviewStreaming: false,
      selectedStageName: null,
      progressMode: 'start',
      progressStepKey: 'scenario',
      status: 'Simulating the advisor persona and building product, investment, and practice-management scenarios...',
    });

    const scenarioPromise = apiFetch('/api/scenarios', {
      method: 'POST',
      body: JSON.stringify({
        persona_id: state.selectedPersonaId,
        topic: state.topic,
        difficulty: state.difficulty,
        mode: 'voice',
        coach_visible_persona: true,
      }),
    });
    const microphonePromise = voice.prepareMicrophone();

    const scenario = await scenarioPromise;
    setState({
      scenario,
      progressMode: 'start',
      progressStepKey: 'realtime',
      status: 'Advisor persona ready. Opening the live advisor voice channel...',
    });
    await microphonePromise;
    await voice.start(scenario.id);
    setState({
      phase: 'live',
      progressMode: null,
      progressStepKey: null,
      status: 'Audio connected. You are the salesperson. Start the conversation.',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    setState({
      phase: 'setup',
      selectedStageName: null,
      progressMode: null,
      progressStepKey: null,
      status: error.message || 'Failed to start the live call.',
    });
  } finally {
    setState({ startingCall: false });
  }
}

function resetForNewCall() {
  stopCoachPreviewStream();
  voice.stop('Audio disconnected. Ready for a new call.');
  endingInFlight = false;
  setState({
    transcript: [],
    report: null,
    scenario: null,
    coachPreviewText: '',
    coachPreviewStreaming: false,
    phase: 'setup',
    endingCall: false,
    practiceFocus: null,
    selectedStageName: null,
    progressMode: null,
    progressStepKey: null,
    status: 'Select the advisor persona and start the live call.',
  });
}

async function copyTranscript() {
  if (!state.transcript.length) return;
  try {
    await navigator.clipboard.writeText(transcriptToPlainText(state.transcript));
    setState({ status: 'Transcript copied to the clipboard.' });
  } catch {
    setState({ status: 'Unable to copy transcript in this browser.' });
  }
}

function replayCoachFeedback() {
  const spokenSummary = buildCoachSpeech(state.report);
  if (!spokenSummary) return;
  setState({ status: 'Replaying coach feedback...' });
  voice.speakCoachFeedback(spokenSummary, { force: true });
}

async function downloadReport() {
  if (!state.report) return;
  const selected = selectedPersona();
  const headshotUrl = personaHeadshotUrl(selected);
  let headshotDataUrl = '';

  setState({ status: 'Preparing HTML scorecard...' });
  if (headshotUrl) {
    try {
      headshotDataUrl = await urlToDataUrl(headshotUrl);
    } catch (error) {
      console.warn('Unable to embed headshot in report', error);
    }
  }

  const safeTitle = (state.scenario?.title || 'sales-coach-report')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 80);
  downloadFile(
    `${safeTitle || 'sales-coach-report'}.html`,
    buildDownloadReportHtml(
      {
        ...state,
        selectedPersona: selected,
      },
      {
        headshotDataUrl,
      },
    ),
    'text/html;charset=utf-8',
  );
  setState({ status: 'HTML scorecard downloaded and ready to share.' });
}

function practiceWeakestArea() {
  stopCoachPreviewStream();
  const weakestStage = getWeakestStage(state.report);
  voice.stop('Audio disconnected. Ready for a focused practice call.');
  endingInFlight = false;
  setState({
    transcript: [],
    report: null,
    scenario: null,
    coachPreviewText: '',
    coachPreviewStreaming: false,
    phase: 'setup',
    endingCall: false,
    selectedStageName: null,
    progressMode: null,
    progressStepKey: null,
    practiceFocus: weakestStage
      ? {
          stage: weakestStage.stage,
          assessment: weakestStage.assessment,
          spoken_feedback: (state.report?.spoken_section_feedback || []).find((item) => item.stage === weakestStage.stage)?.spoken_feedback || '',
        }
      : null,
    status: weakestStage
      ? `Recommended next rep focus: ${weakestStage.stage}.`
      : 'Start another call and focus on the top-priority fix.',
  });
}

appRoot.addEventListener('click', (event) => {
  if (event.target.matches('[data-role="framework-overlay"]')) {
    setState({ frameworkOpen: false });
    return;
  }

  const personaButton = event.target.closest('[data-persona-id]');
  if (personaButton) {
    const personaId = personaButton.dataset.personaId;
    const persona = state.catalog?.personas?.find((item) => item.id === personaId);
    setState({
      selectedPersonaId: personaId,
      status: persona
        ? `${persona.name} selected. Configure the call and start when ready.`
        : 'Advisor selected. Configure the call and start when ready.',
    });
    return;
  }

  const difficultyButton = event.target.closest('[data-difficulty]');
  if (difficultyButton) {
    setState({ difficulty: difficultyButton.dataset.difficulty });
    return;
  }

  const stageButton = event.target.closest('[data-stage-select]');
  if (stageButton) {
    setState({ selectedStageName: stageButton.dataset.stageSelect });
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  switch (action) {
    case 'open-framework':
      setState({ frameworkOpen: true });
      break;
    case 'close-framework':
      setState({ frameworkOpen: false });
      break;
    case 'start-call':
      startLiveCall();
      break;
    case 'copy-transcript':
      copyTranscript();
      break;
    case 'end-call':
      finalizeCall(null, 'button');
      break;
    case 'replay-feedback':
      replayCoachFeedback();
      break;
    case 'download-report':
      downloadReport();
      break;
    case 'practice-weakest':
      practiceWeakestArea();
      break;
    case 'disconnect-audio':
      voice.stop('Audio disconnected. You can still review the report.');
      break;
    case 'new-call':
      resetForNewCall();
      break;
    default:
      break;
  }
});

appRoot.addEventListener('change', (event) => {
  const target = event.target;
  if (target.matches('[data-role="topic-select"]')) {
    setState({ topic: target.value });
  }
});

window.addEventListener('beforeunload', () => {
  stopCoachPreviewStream();
  voice.stop('Audio disconnected.');
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.frameworkOpen) {
    setState({ frameworkOpen: false });
  }
});

render();
loadCatalog();
