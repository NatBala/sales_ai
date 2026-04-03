param(
  [string]$ReportPath = "C:\Users\nbalasubramanian1\Desktop\experiments\sales_coach_v3\voice-scenario-new-wirehouse-advisor-evaluates-capital-group-active-etf-models.html",
  [string]$HeadshotPath = "C:\Users\nbalasubramanian1\Desktop\experiments\sales_coach_v3\digital-sales-coach-voice-first\digital-sales-coach-voice-app\app\static\headshots\entry_wirehouse_new.jpg"
)

$startMarker = "<!-- enhanced-scorecard:start -->"
$endMarker = "<!-- enhanced-scorecard:end -->"

if (!(Test-Path $ReportPath)) {
  throw "Report file not found: $ReportPath"
}

if (!(Test-Path $HeadshotPath)) {
  throw "Headshot file not found: $HeadshotPath"
}

function Normalize-Mojibake {
  param([string]$Text)

  $normalized = $Text
  $replacements = @(
    @(([string]([char]0x00E2) + [char]0x20AC + [char]0x2122), [string][char]0x2019),
    @(([string]([char]0x00E2) + [char]0x20AC + [char]0x02DC), [string][char]0x2018),
    @(([string]([char]0x00E2) + [char]0x20AC + [char]0x0153), [string][char]0x201C),
    @(([string]([char]0x00E2) + [char]0x20AC + [char]0x009D), [string][char]0x201D),
    @(([string]([char]0x00E2) + [char]0x20AC + [char]0x201D), [string][char]0x2014),
    @(([string]([char]0x00E2) + [char]0x20AC + [char]0x201C), [string][char]0x2013),
    @(([string]([char]0x00E2) + [char]0x20AC + [char]0x00A6), [string][char]0x2026),
    @(([string]([char]0x00C2) + ' '), ' '),
    @([string][char]0x00C2, '')
  )

  foreach ($pair in $replacements) {
    $normalized = $normalized.Replace($pair[0], $pair[1])
  }

  return $normalized
}

$content = Get-Content -Path $ReportPath -Raw
$content = Normalize-Mojibake $content
$escapedStart = [regex]::Escape($startMarker)
$escapedEnd = [regex]::Escape($endMarker)
$content = [regex]::Replace(
  $content,
  "(?s)$escapedStart.*?$escapedEnd",
  ""
)

$content = $content.Replace("Capital Group Active ETF Models", "Vanguard Active ETF Models")
$content = $content.Replace("Capital Group", "Vanguard")
$content = $content.Replace("CG Way", "VG Way")

$headshotBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($HeadshotPath))

$enhancementBlock = @'
$startMarker
<style id="enhanced-scorecard-style">
  body {
    background:
      radial-gradient(circle at top left, rgba(44, 149, 255, 0.13), transparent 22%),
      radial-gradient(circle at 86% 0%, rgba(24, 212, 199, 0.14), transparent 18%),
      linear-gradient(180deg, #edf5ff 0%, #d7e6f8 100%);
  }
  .report-shell {
    width: min(1320px, calc(100% - 40px));
    margin: 24px auto 64px;
    gap: 22px;
  }
  .hero {
    position: relative;
    overflow: hidden;
    border-radius: 38px;
    padding: 38px;
    background:
      radial-gradient(circle at 15% 18%, rgba(122, 205, 255, 0.2), transparent 22%),
      radial-gradient(circle at 88% 14%, rgba(83, 241, 221, 0.18), transparent 18%),
      linear-gradient(135deg, rgba(17, 87, 198, 0.98), rgba(8, 37, 89, 0.98));
    box-shadow: 0 34px 94px rgba(17, 39, 71, 0.18);
  }
  .hero::before,
  .hero::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }
  .hero::before {
    inset: auto auto -22% -8%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.11), transparent 68%);
  }
  .hero::after {
    inset: -10% -4% auto auto;
    width: 260px;
    height: 260px;
    background: radial-gradient(circle, rgba(119, 225, 255, 0.18), transparent 66%);
  }
  .hero__top {
    align-items: start;
    gap: 30px;
  }
  .hero__top--enhanced {
    display: grid;
    grid-template-columns: minmax(0, 1.16fr) minmax(360px, 430px);
  }
  .hero h1 {
    font-size: clamp(2.4rem, 4vw, 3.3rem);
    line-height: 1;
    max-width: 10ch;
    letter-spacing: -0.05em;
  }
  .brand {
    opacity: 0.94;
    color: rgba(255, 255, 255, 0.9);
  }
  .hero__main-copy {
    min-width: 0;
  }
  .hero__summary {
    max-width: 66ch;
  }
  .hero__summary p {
    font-size: 1rem;
    line-height: 1.72;
  }
  .enhanced-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 24px;
  }
  .enhanced-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 999px;
    text-decoration: none;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.11);
    backdrop-filter: blur(10px);
    font-weight: 700;
    transition: transform 160ms ease, background 160ms ease;
  }
  .enhanced-action:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.16);
  }
  .enhanced-side {
    display: grid;
    grid-template-columns: auto minmax(210px, 1fr);
    gap: 18px;
    align-items: center;
  }
  .score-ring {
    width: 186px;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  }
  .enhanced-advisor-card {
    padding: 18px;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(12px);
  }
  .enhanced-advisor-card__portrait {
    width: 100%;
    aspect-ratio: 4 / 5;
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    margin-bottom: 14px;
    background: rgba(255, 255, 255, 0.08);
  }
  .enhanced-advisor-card__portrait img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .enhanced-advisor-card__name {
    font-size: 1.18rem;
    font-weight: 800;
  }
  .enhanced-advisor-card__role {
    margin-top: 6px;
    color: rgba(255, 255, 255, 0.82);
    line-height: 1.5;
  }
  .enhanced-advisor-card__meta {
    display: grid;
    gap: 8px;
    margin-top: 14px;
    color: rgba(255, 255, 255, 0.94);
    font-size: 0.94rem;
    line-height: 1.55;
  }
  .hero__meta {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .meta-card,
  .panel,
  .stage-card {
    box-shadow: 0 18px 56px rgba(16, 35, 60, 0.1);
  }
  .meta-card {
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.94);
  }
  .meta-card__label {
    color: #6d84a2;
    font-weight: 800;
  }
  .meta-card__value {
    font-size: 1.08rem;
    color: #143258;
    font-weight: 800;
  }
  .grid-2 {
    gap: 22px;
  }
  .grid-2.grid-3-enhanced {
    grid-template-columns: 1.16fr 0.9fr 0.94fr;
  }
  .panel {
    position: relative;
    overflow: hidden;
    border-radius: 28px;
    padding: 26px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.98));
  }
  .panel::before,
  .stage-card::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0));
    opacity: 0.7;
  }
  .panel > *,
  .stage-card > * {
    position: relative;
    z-index: 1;
  }
  .status-pill {
    margin-bottom: 14px;
  }
  .callout {
    border-radius: 20px;
    background: linear-gradient(135deg, #eef7ff, #f9fbff);
  }
  .enhanced-glance {
    display: grid;
    grid-template-columns: 1.16fr 0.96fr 0.88fr;
    gap: 18px;
  }
  .enhanced-glance-card {
    position: relative;
    overflow: hidden;
    border-radius: 28px;
    padding: 24px;
    border: 1px solid var(--line);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 250, 255, 0.98));
    box-shadow: 0 18px 56px rgba(16, 35, 60, 0.1);
  }
  .enhanced-glance-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0));
    pointer-events: none;
  }
  .enhanced-glance-card > * {
    position: relative;
    z-index: 1;
  }
  .enhanced-glance-card h2 {
    margin: 10px 0 10px;
    font-size: 1.45rem;
  }
  .enhanced-glance-card p {
    color: var(--muted);
    line-height: 1.68;
  }
  .enhanced-glance-card--lead {
    background:
      radial-gradient(circle at top right, rgba(108, 204, 255, 0.18), transparent 26%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(246, 250, 255, 0.99));
  }
  .enhanced-priority {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px solid #d8e7f8;
    background: #f4f9ff;
  }
  .enhanced-priority strong {
    display: block;
    margin-bottom: 6px;
    color: #114d9a;
  }
  .enhanced-kpi-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 18px;
  }
  .enhanced-kpi {
    padding: 14px;
    border-radius: 18px;
    border: 1px solid #dbe7f5;
    background: #f8fbff;
  }
  .enhanced-kpi__label {
    color: var(--muted);
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .enhanced-kpi__value {
    margin-top: 8px;
    font-size: 1.24rem;
    font-weight: 800;
    line-height: 1.1;
  }
  .enhanced-kpi__sub {
    margin-top: 6px;
    color: var(--muted);
    font-size: 0.88rem;
  }
  .enhanced-stage-strip {
    display: grid;
    gap: 12px;
    margin-top: 16px;
  }
  .enhanced-stage-strip__item {
    display: grid;
    grid-template-columns: minmax(118px, 1fr) minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
  }
  .enhanced-stage-strip__label {
    font-weight: 700;
  }
  .enhanced-stage-strip__score {
    font-weight: 800;
    color: #114d9a;
  }
  .enhanced-mini-bar {
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: #e5eef9;
  }
  .enhanced-mini-bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #60d7ee, #3d8cff);
  }
  .enhanced-checklist {
    display: grid;
    gap: 10px;
    margin-top: 16px;
  }
  .enhanced-checklist__item {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
    padding: 12px 0;
    border-top: 1px solid #e4edf8;
  }
  .enhanced-checklist__item:first-child {
    border-top: none;
    padding-top: 0;
  }
  .enhanced-checklist__bullet {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    color: #0f5fcb;
    font-weight: 800;
    background: linear-gradient(135deg, #dff0ff, #eff6ff);
  }
  .enhanced-focus-panel .panel__eyebrow {
    color: #0f5fcb;
  }
  .enhanced-focus-card {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    gap: 14px;
    padding: 16px;
    border-radius: 20px;
    border: 1px solid var(--line);
    background: var(--panel-soft);
  }
  .enhanced-focus-card + .enhanced-focus-card {
    margin-top: 14px;
  }
  .enhanced-focus-card__rank {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    font-weight: 800;
    color: #0f5fcb;
    background: linear-gradient(135deg, #dceaff, #f3f8ff);
  }
  .enhanced-focus-card h3 {
    margin: 0;
    font-size: 1.06rem;
  }
  .enhanced-focus-card p,
  .enhanced-focus-card__example {
    margin: 8px 0 0;
    color: var(--muted);
    line-height: 1.65;
  }
  .enhanced-stage-nav {
    position: sticky;
    top: 14px;
    z-index: 4;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(14px);
    box-shadow: 0 18px 50px rgba(16, 35, 60, 0.1);
  }
  .enhanced-stage-nav__chip {
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
  .enhanced-stage-nav__chip strong {
    color: #0f5fcb;
  }
  .mini-score {
    border-radius: 20px;
    padding: 18px;
  }
  .mini-score__label {
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .mini-score__value {
    margin-top: 8px;
  }
  .mini-score__state {
    display: inline-flex;
    align-items: center;
    margin-top: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 0.74rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .mini-score__meter {
    margin-top: 14px;
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: #e7eef9;
  }
  .mini-score__meter span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #60d7ee, #3d8cff);
  }
  .mini-score--weak {
    border-color: rgba(200, 77, 103, 0.2);
    background: linear-gradient(180deg, #fff8fa, #fffdfd);
  }
  .mini-score--weak .mini-score__state {
    color: #b63d5c;
    background: rgba(200, 77, 103, 0.12);
  }
  .mini-score--medium {
    border-color: rgba(201, 138, 18, 0.22);
    background: linear-gradient(180deg, #fffaf1, #fffefe);
  }
  .mini-score--medium .mini-score__state {
    color: #9a6b0c;
    background: rgba(201, 138, 18, 0.12);
  }
  .mini-score--strong {
    border-color: rgba(31, 157, 115, 0.22);
    background: linear-gradient(180deg, #f4fff9, #fdfefe);
  }
  .mini-score--strong .mini-score__state {
    color: #157353;
    background: rgba(31, 157, 115, 0.12);
  }
  .section-stack {
    gap: 18px;
  }
  .stage-card {
    position: relative;
    border-radius: 28px;
    padding: 26px;
    overflow: hidden;
    scroll-margin-top: 92px;
  }
  .stage-card__header h3 {
    font-size: 1.42rem;
  }
  .stage-card__score {
    background: #f3f8ff;
  }
  .stage-card__bar {
    height: 14px;
    background: #e7eef8;
  }
  .stage-card__spoken {
    padding: 14px 16px;
    border-radius: 18px;
    background: #edf5ff;
  }
  .stage-card.stage-card--weak {
    border-color: rgba(198, 83, 108, 0.24);
  }
  .stage-card.stage-card--medium {
    border-color: rgba(200, 143, 32, 0.26);
  }
  .stage-card.stage-card--strong {
    border-color: rgba(35, 137, 106, 0.22);
  }
  .detail-grid {
    gap: 18px;
  }
  .detail-card {
    border-radius: 20px;
    padding: 18px;
  }
  .transcript-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    margin-top: 18px;
    margin-bottom: 14px;
    padding: 14px;
    border-radius: 20px;
    background: #f7fbff;
    border: 1px solid #dbe8f7;
  }
  .transcript-toolbar__label {
    font-weight: 700;
    color: var(--muted);
  }
  .transcript-toolbar__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .transcript-filter {
    border: 1px solid #d8e6f7;
    background: white;
    color: var(--ink);
    border-radius: 999px;
    padding: 10px 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .transcript-filter.is-active {
    color: white;
    border-color: transparent;
    background: linear-gradient(135deg, #197fff, #0b57cd);
    box-shadow: 0 10px 24px rgba(25, 127, 255, 0.22);
  }
  .transcript {
    gap: 14px;
    max-height: 860px;
    overflow: auto;
    padding-right: 6px;
  }
  .transcript-turn {
    border-radius: 20px;
    padding: 18px 20px;
    border: 1px solid #d9e6f6;
  }
  .transcript-turn--advisor {
    background: linear-gradient(180deg, #f8fbff, #fdfefe);
  }
  .transcript-turn--salesperson {
    background: linear-gradient(180deg, #eef7ff, #f8fbff);
  }
  .transcript-turn__role {
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .transcript-turn__text {
    font-size: 0.98rem;
  }
  @media print {
    .enhanced-stage-nav {
      position: static;
      box-shadow: none;
    }
    .enhanced-actions,
    .transcript-toolbar {
      display: none !important;
    }
    .hero,
    .panel,
    .stage-card,
    .meta-card,
    .enhanced-glance-card {
      box-shadow: none;
    }
    .transcript {
      max-height: none;
      overflow: visible;
    }
  }
  @media (max-width: 1080px) {
    .hero__top--enhanced,
    .grid-2.grid-3-enhanced,
    .enhanced-side,
    .enhanced-glance,
    .enhanced-kpi-row {
      grid-template-columns: 1fr;
    }
    .enhanced-side {
      gap: 16px;
    }
    .score-ring {
      margin: 0 auto;
    }
  }
  @media (max-width: 820px) {
    .enhanced-stage-strip__item {
      grid-template-columns: 1fr;
    }
    .transcript-toolbar {
      align-items: flex-start;
    }
  }
</style>
<script>
(() => {
  const headshotDataUrl = 'data:image/jpeg;base64,__HEADSHOT_BASE64__';
  const advisor = {
    name: 'Ashley Taylor',
    role: 'Entry-Level Financial Conglomerate Advisor',
    firm: 'Merrill Lynch',
    firmType: 'Wirehouse / Financial Conglomerate',
    headline: 'New wirehouse advisor who wants clear, defensible ETF-model ideas she can explain with confidence.'
  };

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function scoreBucket(score) {
    if (score >= 4) return 'strong';
    if (score >= 3) return 'medium';
    return 'weak';
  }

  function bucketLabel(score) {
    if (score >= 4) return 'Strong';
    if (score >= 3) return 'Mixed';
    return 'Needs Work';
  }

  function titleCase(value) {
    return String(value || '')
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getPanelByHeading(text) {
    return Array.from(document.querySelectorAll('.panel')).find((panel) =>
      panel.querySelector('h2')?.textContent?.trim() === text
    );
  }

  document.addEventListener('DOMContentLoaded', () => {
    const hero = document.querySelector('.hero');
    const heroTop = hero?.querySelector('.hero__top');
    const scoreRing = heroTop?.querySelector('.score-ring');
    const scoreValue = parseInt(scoreRing?.querySelector('.score-ring__value')?.textContent || '0', 10) || 0;
    const scorePercent = Math.max(4, Math.min(100, Math.round((scoreValue / 30) * 100)));

    if (scoreRing) {
      scoreRing.style.setProperty('--score', String(scorePercent));
      const label = scoreRing.querySelector('.score-ring__label');
      if (label) label.textContent = 'Coach Score';
    }

    if (heroTop && !heroTop.classList.contains('hero__top--enhanced')) {
      heroTop.classList.add('hero__top--enhanced');
      const existingChildren = Array.from(heroTop.children);
      const mainCopy = existingChildren[0];

      if (mainCopy) {
        mainCopy.classList.add('hero__main-copy');
        const heroTitle = mainCopy.querySelector('h1');
        if (heroTitle) {
          heroTitle.textContent = 'Scorecard';
        }
        const summary = mainCopy.querySelector('p');
        if (summary) summary.parentElement?.classList.add('hero__summary');
        if (!hero.querySelector('.enhanced-actions')) {
          const actions = document.createElement('div');
          actions.className = 'enhanced-actions';
          actions.innerHTML = `
            <a class="enhanced-action" href="javascript:window.print()">Print or Save PDF</a>
            <a class="enhanced-action" href="#section-review">Jump to Section Review</a>
            <a class="enhanced-action" href="#transcript-review">Review Transcript</a>
          `;
          mainCopy.appendChild(actions);
        }
      }

      if (scoreRing && !hero.querySelector('.enhanced-side')) {
        const side = document.createElement('div');
        side.className = 'enhanced-side';
        const advisorCard = document.createElement('aside');
        advisorCard.className = 'enhanced-advisor-card';
        advisorCard.innerHTML = `
          <div class="enhanced-advisor-card__portrait">
            <img src="${headshotDataUrl}" alt="${advisor.name} headshot" />
          </div>
          <div class="enhanced-advisor-card__name">${advisor.name}</div>
          <div class="enhanced-advisor-card__role">${advisor.role}</div>
          <div class="enhanced-advisor-card__meta">
            <div><strong>Firm:</strong> ${advisor.firm}</div>
            <div><strong>Firm type:</strong> ${advisor.firmType}</div>
            <div>${advisor.headline}</div>
          </div>
        `;
        side.appendChild(scoreRing);
        side.appendChild(advisorCard);
        heroTop.appendChild(side);
      }
    }

    const stageCards = Array.from(document.querySelectorAll('.stage-card'));
    const stageStack = document.querySelector('.section-stack');
    const summaryGrid = document.querySelector('.grid-2');
    const listPanels = Array.from(document.querySelectorAll('.list-panel'));

    if (summaryGrid) {
      summaryGrid.classList.add('grid-3-enhanced');
    }

    const stageData = stageCards.map((card) => {
      const title = card.querySelector('h3')?.textContent?.trim() || 'Stage';
      const scoreText = card.querySelector('.stage-card__score')?.textContent || '0/5';
      const score = parseInt(scoreText, 10) || 0;
      const notes = Array.from(card.querySelectorAll('.report-note p'));
      const assessment = notes[0]?.innerHTML || '';
      const example = notes[2]?.innerHTML || '';
      const id = slugify(title);
      card.id = id;
      card.classList.add(`stage-card--${scoreBucket(score)}`);
      return { title, score, assessment, example, id };
    });

    if (stageData.length && stageStack && !document.querySelector('.enhanced-stage-nav')) {
      const nav = document.createElement('nav');
      nav.className = 'enhanced-stage-nav';
      nav.id = 'section-review';
      nav.innerHTML = stageData.map((stage) => `
        <a class="enhanced-stage-nav__chip" href="#${stage.id}">
          <span>${stage.title}</span>
          <strong>${stage.score}/5</strong>
        </a>
      `).join('');
      stageStack.parentNode.insertBefore(nav, stageStack);
    }

    const visualizationPanel = getPanelByHeading('VG Way Section Scores') || getPanelByHeading('CG Way Section Scores');
    const miniScores = Array.from(document.querySelectorAll('.mini-score'));
    miniScores.forEach((card) => {
      const labelEl = card.querySelector('.mini-score__label');
      const valueEl = card.querySelector('.mini-score__value');
      const score = parseInt(valueEl?.textContent || '0', 10) || 0;
      const bucket = scoreBucket(score);
      if (labelEl) {
        labelEl.textContent = titleCase(labelEl.textContent.replace(/[_-]+/g, ' '));
      }
      card.classList.add(`mini-score--${bucket}`);
      if (!card.querySelector('.mini-score__state')) {
        const badge = document.createElement('div');
        badge.className = 'mini-score__state';
        badge.textContent = bucketLabel(score);
        card.appendChild(badge);
      }
      if (!card.querySelector('.mini-score__meter')) {
        const meter = document.createElement('div');
        meter.className = 'mini-score__meter';
        meter.innerHTML = `<span style="width:${Math.max(12, score * 20)}%"></span>`;
        card.appendChild(meter);
      }
    });

    const strengthsGrid = Array.from(document.querySelectorAll('.detail-grid')).find((grid) =>
      grid.querySelector(':scope > div > h3')?.textContent?.trim() === 'What Worked'
    );
    const strengthsCount = strengthsGrid?.querySelectorAll('.detail-card').length || 0;
    const missesCount = Array.from(document.querySelectorAll('.detail-grid')).find((grid) =>
      grid.querySelector(':scope > div > h3')?.textContent?.trim() === 'Where It Missed'
    )?.querySelectorAll('.detail-card').length || 0;
    const rewriteCount = Array.from(document.querySelectorAll('.detail-card')).filter((card) =>
      card.closest('.panel')?.querySelector('h2')?.textContent?.includes('Strengths, Misses, and Rewrites') &&
      card.parentElement?.parentElement?.previousElementSibling?.textContent?.includes('Better Examples To Use') === false
    ).length;
    const nextRepCount = listPanels[0]?.querySelectorAll('ol li').length || 0;
    const discoveryGapCount = listPanels[1]?.querySelectorAll('ul li').length || 0;
    const strongestStage = [...stageData].sort((a, b) => b.score - a.score)[0];
    const weakestStages = [...stageData].sort((a, b) => a.score - b.score).slice(0, 3);
    const statusText = document.querySelector('.status-pill')?.textContent?.trim() || hero?.querySelector('p')?.textContent?.trim() || '';
    const topPriority = Array.from(document.querySelectorAll('.callout')).find((callout) =>
      callout.querySelector('strong')?.textContent?.trim() === 'Top Priority Fix'
    )?.textContent?.replace('Top Priority Fix', '').trim() || '';

    if (hero && !document.querySelector('.enhanced-glance')) {
      const glance = document.createElement('section');
      glance.className = 'enhanced-glance';
      glance.innerHTML = `
        <article class="enhanced-glance-card enhanced-glance-card--lead">
          <div class="panel__eyebrow">At A Glance</div>
          <h2>What To Fix First</h2>
          <p>${statusText}</p>
          <div class="enhanced-priority">
            <strong>Top priority for the next rep</strong>
            <div>${topPriority}</div>
          </div>
          <div class="enhanced-kpi-row">
            <div class="enhanced-kpi">
              <div class="enhanced-kpi__label">Coach Score</div>
              <div class="enhanced-kpi__value">${scoreValue}<span style="font-size:0.9rem;font-weight:700;"> / 30</span></div>
              <div class="enhanced-kpi__sub">${scorePercent}% of full score</div>
            </div>
            <div class="enhanced-kpi">
              <div class="enhanced-kpi__label">Strongest Stage</div>
              <div class="enhanced-kpi__value">${escapeHtml(strongestStage?.title || 'None')}</div>
              <div class="enhanced-kpi__sub">${strongestStage?.score || 0}/5</div>
            </div>
            <div class="enhanced-kpi">
              <div class="enhanced-kpi__label">Need Work</div>
              <div class="enhanced-kpi__value">${stageData.filter((stage) => stage.score < 3).length}</div>
              <div class="enhanced-kpi__sub">sections below 3/5</div>
            </div>
            <div class="enhanced-kpi">
              <div class="enhanced-kpi__label">Action Depth</div>
              <div class="enhanced-kpi__value">${nextRepCount}</div>
              <div class="enhanced-kpi__sub">next-step actions listed</div>
            </div>
          </div>
        </article>
        <article class="enhanced-glance-card">
          <div class="panel__eyebrow">Section Scan</div>
          <h2>See The Weak Spots Fast</h2>
          <div class="enhanced-stage-strip">
            ${stageData.map((stage) => `
              <div class="enhanced-stage-strip__item">
                <div class="enhanced-stage-strip__label">${escapeHtml(stage.title)}</div>
                <div class="enhanced-mini-bar"><span style="width:${Math.max(12, stage.score * 20)}%"></span></div>
                <div class="enhanced-stage-strip__score">${stage.score}/5</div>
              </div>
            `).join('')}
          </div>
        </article>
        <article class="enhanced-glance-card">
          <div class="panel__eyebrow">Next Rep</div>
          <h2>Practice With Intent</h2>
          <p>Use the next call to repair the weakest stages instead of replaying the same opening and hoping later sections improve on their own.</p>
          <div class="enhanced-checklist">
            ${weakestStages.map((stage, index) => `
              <div class="enhanced-checklist__item">
                <div class="enhanced-checklist__bullet">0${index + 1}</div>
                <div>
                  <strong>${escapeHtml(stage.title)}</strong>
                  <div>${stage.example}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </article>
      `;
      hero.insertAdjacentElement('afterend', glance);
    }

    if (summaryGrid && !document.querySelector('.enhanced-focus-panel')) {
      const focusPanel = document.createElement('article');
      focusPanel.className = 'panel enhanced-focus-panel';
      focusPanel.innerHTML = `
        <div class="panel__eyebrow">Where To Focus</div>
        <h2>Top Improvement Priorities</h2>
        ${weakestStages.map((stage, index) => `
          <div class="enhanced-focus-card">
            <div class="enhanced-focus-card__rank">0${index + 1}</div>
            <div>
              <h3>${escapeHtml(stage.title)}</h3>
              <p>${stage.assessment}</p>
              <div class="enhanced-focus-card__example"><strong>Better example:</strong> ${stage.example}</div>
            </div>
          </div>
        `).join('')}
      `;
      summaryGrid.appendChild(focusPanel);
    }

    if (visualizationPanel) {
      const eyebrow = visualizationPanel.querySelector('.panel__eyebrow');
      const heading = visualizationPanel.querySelector('h2');
      if (eyebrow) eyebrow.textContent = 'Performance View';
      if (heading) heading.textContent = 'VG Way Section Score Scan';
    }

    const transcriptPanel = getPanelByHeading('Full Conversation');
    const transcript = transcriptPanel?.querySelector('.transcript');
    if (transcriptPanel && transcript && !document.querySelector('.transcript-toolbar')) {
      transcriptPanel.id = 'transcript-review';
      const toolbar = document.createElement('div');
      toolbar.className = 'transcript-toolbar';
      toolbar.innerHTML = `
        <div class="transcript-toolbar__label">Filter the transcript to review only your turns or only the advisor's turns.</div>
        <div class="transcript-toolbar__filters">
          <button class="transcript-filter is-active" type="button" data-role="all">All turns</button>
          <button class="transcript-filter" type="button" data-role="salesperson">Salesperson only</button>
          <button class="transcript-filter" type="button" data-role="advisor">Advisor only</button>
        </div>
      `;
      transcript.before(toolbar);
      const turns = Array.from(transcript.querySelectorAll('.transcript-turn'));
      const filters = Array.from(toolbar.querySelectorAll('.transcript-filter'));
      filters.forEach((button) => {
        button.addEventListener('click', () => {
          const role = button.dataset.role || 'all';
          filters.forEach((item) => item.classList.toggle('is-active', item === button));
          turns.forEach((turn) => {
            const matches = role === 'all' || turn.classList.contains(`transcript-turn--${role}`);
            turn.hidden = !matches;
          });
        });
      });
    }
  });
})();
</script>
$endMarker
'@

$enhancementBlock = $enhancementBlock.Replace('__HEADSHOT_BASE64__', $headshotBase64)
$enhancementBlock = $enhancementBlock.Replace('$startMarker', $startMarker).Replace('$endMarker', $endMarker)
$enhancementBlock = Normalize-Mojibake $enhancementBlock

$content = $content -replace "</body>", "$enhancementBlock`r`n  </body>"
Set-Content -Path $ReportPath -Value $content -Encoding UTF8

