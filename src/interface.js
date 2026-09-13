// Presentation-only controls. Simulation and save logic live in app.js and demo.js.
const ICONS = {
  road: '<path d="m7 3-3 18m13-18 3 18M12 3v4m0 3v4m0 3v4"/>',
  residential: '<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/><path d="M17 4v4"/>',
  commercial: '<path d="M4 9h16l-2-5H6L4 9Zm0 0v3a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0V9M5 14v7h14v-7M9 21v-5h6v5"/>',
  industrial: '<path d="M3 21V11l6 3v-4l6 3V4h4l2 17H3Zm3-3h2m4 0h2m4 0h1"/>',
  park: '<path d="M12 3 6 10h3l-5 7h7v4h2v-4h7l-5-7h3L12 3Z"/>',
  school: '<path d="M3 21V9h6V5l3-2 3 2v4h6v12H3Zm7 0v-6h4v6M6 12v2m12-2v2M12 6v3m-2-1h4"/>',
  fire: '<path d="M12 3c1 5-4 5-3 9 1-1 2-2 3-2-1 3 3 3 3 6a3 3 0 0 1-6 0c0-1 0-2 1-3-3 1-4 2-4 4a6 6 0 0 0 12 0c0-5-2-8-6-14Z"/>',
  power: '<path d="m13 2-8 12h6l-1 8 9-13h-6l0-7Z"/>',
  water: '<path d="M12 3c-2 4-7 8-7 12a7 7 0 0 0 14 0c0-4-5-8-7-12Z"/><path d="M8 15c0 2 1 3 3 3"/>',
  plaza: '<path d="M3 20h18M5 20v-6h14v6M7 14v-4h10v4M12 10V4m-4 2 4-3 4 3M8 17h8"/>',
  station: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M9 6h6m-7 9h1m6 0h1M8 18l-3 4m11-4 3 4M7 21h10"/>',
  lantern: '<path d="M8 4h8m-4-2v2M6 7h12l2 5-2 6H6l-2-6 2-5Zm2 14h8m-4-3v3M9 7l-1 5 1 6m6-11 1 5-1 6"/>',
  bulldoze: '<path d="m5 17 9-9 4 4-9 9H5v-4ZM12 6l3-3 6 6-3 3M3 21h18"/>',
};
for (const button of document.querySelectorAll('[data-tool]')) {
  const icon = button.querySelector('span');
  if (icon && ICONS[button.dataset.tool]) {
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">${ICONS[button.dataset.tool]}</svg>`;
  }
}
// Tabs keep their own reading position. Native keyboard activation stays available.
const tabButtons = [...document.querySelectorAll('[data-panel]')];
const tabPages = [...document.querySelectorAll('[data-journal-page]')];
const journalScroller = document.querySelector('.journal-pages');
const panelScroll = new Map();
const tabTitles = new Map(tabButtons.map(button => [button.dataset.panel, button.title]));
let currentPanel = 'letters';
let keyboardFocusMode = false;
let focusedJournalAction = null;
document.querySelector('.journal-tabs')?.setAttribute('role', 'tablist');
for (const button of tabButtons) {
  button.id = `journal-tab-${button.dataset.panel}`;
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-controls', `journal-page-${button.dataset.panel}`);
}
for (const page of tabPages) {
  page.id = `journal-page-${page.dataset.journalPage}`;
  page.setAttribute('role', 'tabpanel');
  page.setAttribute('aria-labelledby', `journal-tab-${page.dataset.journalPage}`);
  page.tabIndex = 0;
}
function activatePanel(name, focus = false) {
  if (!tabPages.some(page => page.dataset.journalPage === name)) return false;
  if (journalScroller && name !== currentPanel) panelScroll.set(currentPanel, journalScroller.scrollTop);
  for (const button of tabButtons) {
    const active = button.dataset.panel === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    if (active && focus) button.focus({ preventScroll: true });
  }
  for (const page of tabPages) page.hidden = page.dataset.journalPage !== name;
  if (journalScroller && name !== currentPanel) journalScroller.scrollTop = panelScroll.get(name) || 0;
  currentPanel = name;
  refreshNextStep();
  return true;
}
for (const button of tabButtons) {
  button.addEventListener('click', () => activatePanel(button.dataset.panel));
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const current = tabButtons.indexOf(button);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabButtons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length;
    activatePanel(tabButtons[index].dataset.panel, true);
  });
}

// This is a disclosure containing buttons and a select, not an ARIA application menu.
const saveMenu = document.querySelector('.save-more');
const saveMenuToggle = document.querySelector('#saveMenuToggle');
function closeSaveMenu(restoreFocus = false) {
  if (!saveMenu?.open) return;
  saveMenu.open = false;
  saveMenuToggle?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) saveMenuToggle?.focus({ preventScroll: true });
}
saveMenu?.addEventListener('toggle', () => saveMenuToggle?.setAttribute('aria-expanded', String(saveMenu.open)));
document.querySelector('#saveMenuCloseButton')?.addEventListener('click', () => closeSaveMenu(true));
saveMenu?.addEventListener('keydown', event => {
  // Do not build, change speed, or pause the town while operating this disclosure.
  event.stopPropagation();
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSaveMenu(true);
  }
});
saveMenu?.addEventListener('focusout', () => {
  queueMicrotask(() => {
    if (document.activeElement !== document.body && !saveMenu.contains(document.activeElement)) closeSaveMenu();
  });
});
saveMenu?.addEventListener('click', event => {
  if (!event.target.closest('#exportSaveButton, #importSaveButton, #newGameButton, #resetButton')) return;
  // Game handlers may have opened a modal by the time this runs; retain its focus.
  queueMicrotask(() => closeSaveMenu(saveMenu.contains(document.activeElement)));
});
document.addEventListener('pointerdown', event => {
  keyboardFocusMode = false;
  if (!journalScroller?.contains(event.target)) focusedJournalAction = null;
  if (saveMenu?.open && !saveMenu.contains(event.target)) closeSaveMenu();
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Tab') keyboardFocusMode = true;
}, true);
document.addEventListener('keydown', event => {
  // After Tab navigation, Space/Enter activate the focused button normally.
  // Mouse-driven town shortcuts retain their existing behavior.
  if (keyboardFocusMode && [' ', 'Enter'].includes(event.key) && event.target.closest?.('button, summary, [role=tabpanel]')) event.stopPropagation();
});

function actionSignature(button) {
  return JSON.stringify(Object.entries(button.dataset).sort()) + '|' + button.textContent.trim();
}
document.addEventListener('focusin', event => {
  const button = event.target.closest?.('button');
  const page = button?.closest('[data-journal-page]');
  focusedJournalAction = page ? { node: button, signature: actionSignature(button), panel: page.dataset.journalPage } : null;
});
function restoreJournalFocus() {
  const previous = focusedJournalAction;
  if (!keyboardFocusMode || !previous || previous.node.isConnected || document.activeElement !== document.body || currentPanel !== previous.panel) return;
  const page = tabPages.find(item => item.dataset.journalPage === previous.panel);
  const replacement = [...page.querySelectorAll('button:not([disabled])')].find(button => actionSignature(button) === previous.signature);
  (replacement || document.querySelector('#nextStepButton'))?.focus({ preventScroll: true });
}

// Read existing rendered actions, without changing any game state or granting rewards.
const nextStepButton = document.querySelector('#nextStepButton');
const nextStepText = document.querySelector('#nextStepText');
function availableActions(container, selector = 'button') {
  if (!container) return [];
  return [...container.querySelectorAll(selector)].filter(button => {
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    const page = button.closest('[data-journal-page]');
    for (let node = button; node && node !== page; node = node.parentElement) if (node.hidden) return false;
    return true;
  });
}
function findNextStep() {
  const letters = document.querySelector('#requestBoard');
  const decision = document.querySelector('#decisionCard');
  const festival = availableActions(document.querySelector('#demoJournal'), '[data-demo-action="festival"]')[0];
  const claim = availableActions(letters, '[data-claim]')[0];
  const choice = availableActions(decision, '[data-decision]')[0];
  const activity = availableActions(document.querySelector('#seasonActivity'), '[data-life-action=start], [data-life-action=claim]')[0];
  const readyLife = availableActions(document.querySelector('[data-journal-page="life"]'), '.is-ready button, button.is-ready')[0];
  const guide = availableActions(letters, '[data-guide]')[0];
  const project = availableActions(document.querySelector('#communityProjects'))[0];
  const ongoingActivity = document.querySelector('#seasonActivity .life-progress');
  if (festival) return { target: festival, panel: 'letters', text: '祭典准备好了，去看看清单' };
  if (claim) return { target: claim, panel: 'letters', text: '有心愿实现了，给邻居回信' };
  if (choice) return { target: choice, panel: 'letters', text: '建设课的新提案，等你决定' };
  if (readyLife) return { target: readyLife, panel: 'life', text: '街坊活动有新的进展' };
  if (currentPanel === 'life' && activity) return { target: activity, panel: 'life', text: '看看这期街坊活动' };
  if (currentPanel === 'life' && ongoingActivity) return { target: ongoingActivity, panel: 'life', text: '活动筹备中，看看还缺些什么' };
  if (guide) {
    const card = guide.closest('article');
    const unmet = [...(card?.querySelectorAll('.request-needs span:not(.is-met)') || [])];
    const waitingForResidents = unmet.length > 0 && unmet.every(item => item.textContent.trim().startsWith('居民'));
    if (waitingForResidents && activity) return { target: activity, panel: 'life', text: '等邻居搬来时，逛逛街坊活动' };
    return { target: guide, panel: 'letters', text: card?.querySelector('header strong')?.textContent || '读一封来信，看看还能做什么' };
  }
  if (activity) return { target: activity, panel: 'life', text: '小镇有新活动，去看看吧' };
  if (project) return { target: project, panel: 'life', text: '为社区添一份新的心意' };
  if (ongoingActivity) return { target: ongoingActivity, panel: 'life', text: '活动筹备中，看看还缺些什么' };
  return { target: document.querySelector('#seasonActivity'), panel: 'life', text: '翻开活动页，看看街坊的日常' };
}
function refreshNextStep() {
  if (!nextStepButton || !nextStepText) return;
  const step = findNextStep();
  if (nextStepText.textContent !== step.text) nextStepText.textContent = step.text;
  nextStepButton.title = step.text;
  nextStepButton.setAttribute('aria-label', `接下来：${step.text}`);
  const lettersNeedAttention = Boolean(document.querySelector('#requestBoard [data-claim], #decisionCard [data-decision]'));
  const lifeNeedAttention = Boolean(availableActions(document.querySelector('[data-journal-page="life"]'), '.is-ready button, button.is-ready').length);
  for (const button of tabButtons) {
    const needsAttention = button.dataset.panel === 'letters' ? lettersNeedAttention : button.dataset.panel === 'life' && lifeNeedAttention;
    button.classList.toggle('has-attention', needsAttention);
    button.title = `${tabTitles.get(button.dataset.panel) || ''}${needsAttention ? ' · 有待处理事项' : ''}`;
  }
}
nextStepButton?.addEventListener('click', () => {
  const step = findNextStep();
  activatePanel(step.panel);
  step.target?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  if (step.target?.matches('button')) step.target.focus({ preventScroll: true });
  else tabPages.find(page => page.dataset.journalPage === step.panel)?.focus({ preventScroll: true });
});
if (journalScroller) new MutationObserver(() => {
  restoreJournalFocus();
  refreshNextStep();
}).observe(journalScroller, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
activatePanel('letters');
window.sunnyTownUI = Object.freeze({ activatePanel, refreshNextStep, closeSaveMenu });
const scenarioIcons = {
  harbor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M7 10h10M3 13v2a9 6 0 0 0 18 0v-2M1 15l2-2 3 2m12 0 3-2 2 2"/>',
  garden: '<circle cx="12" cy="10" r="3"/><path d="M12 7c-5-8-9-2-5 1-9 2-4 9 1 5-1 9 7 9 7 1 7 5 12-2 4-6 5-5-1-9-7-1M12 16v6M7 19l5 3 5-3"/>',
  commerce: ICONS.commercial,
};
for (const card of document.querySelectorAll('[data-scenario]')) {
  const icon = card.querySelector('strong i');
  if (icon) {
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">${scenarioIcons[card.dataset.scenario]}</svg>`;
  }
}
const mapLegend = document.querySelector('#mapLegend');
function syncMapLegend() {
  if (!mapLegend) return;
  const activeView = document.querySelector('[data-view].active')?.dataset.view || 'normal';
  mapLegend.hidden = activeView === 'normal';
  const text = activeView === 'traffic' ? '<i></i>道路畅通<i></i>道路拥堵' : '<i></i>水电完整<i></i>水电不足';
  if (mapLegend.innerHTML !== text) mapLegend.innerHTML = text;
}
const viewButtons = [...document.querySelectorAll('[data-view]')];
const legendObserver = new MutationObserver(syncMapLegend);
for (const button of viewButtons) legendObserver.observe(button, { attributes: true, attributeFilter: ['class'] });
syncMapLegend();
