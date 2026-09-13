// The playable demo has its own short story, alongside the original five chapters.
// State is part of the city save; rendering never grants rewards or advances time.
export const SCENARIOS = {
  harbor: { name: "春日来信", town: "晴日港", tagline: "替归乡的人，留一盏灯。", money: 24000, population: 320, happiness: 78, special: "建成小广场", type: "plaza", count: 1 },
  garden: { name: "花园小镇", town: "花见町", tagline: "把每一条回家的路，种成春天。", money: 22000, population: 260, happiness: 86, special: "建成 4 座公园", type: "park", count: 4 },
  commerce: { name: "商店街物语", town: "日和街", tagline: "让小店的灯光，重新亮起来。", money: 28000, population: 400, happiness: 76, special: "建成 5 间商店", type: "commercial", count: 5 },
};

const REQUESTS = [
  { id: "water", person: "澪 · 水务工程师", avatar: "澪", title: "先让水龙头唱歌", letter: "行李已经搬进来了，大家还在等第一壶热茶。把水塔接到主街旁，好吗？", tool: "water", reward: 1800, needs: [{ key: "water", target: 75, label: "供水覆盖", unit: "%" }, { key: "power", target: 75, label: "供电覆盖", unit: "%" }] },
  { id: "neighbors", person: "空 · 小镇邮差", avatar: "空", title: "六扇亮着灯的窗", letter: "我准备了新的信箱。多添几户邻居，这条街就会热闹起来。", tool: "residential", reward: 2200, needs: [{ type: "residential", target: 6, label: "住宅" }, { key: "population", target: 140, label: "居民" }] },
  { id: "bakery", person: "杏 · 面包店主", avatar: "杏", title: "面包香里的商店街", letter: "一家店有点孤单。再招来几位店主，让居民在家附近就能工作。", tool: "commercial", reward: 2600, needs: [{ type: "commercial", target: 3, label: "商店" }, { key: "employmentRate", target: 75, label: "就业率", unit: "%" }] },
  { id: "garden", person: "千代 · 园艺师", avatar: "千", title: "给春天留两个位置", letter: "花不需要很大的地方。把公园放在住宅附近，老人和孩子都能走过去。", tool: "park", reward: 2400, needs: [{ type: "park", target: 2, label: "公园" }, { key: "happiness", target: 78, label: "幸福度", unit: "%" }] },
  { id: "school", person: "小葵 · 新来的学生", avatar: "葵", title: "步行上学的愿望", letter: "妈妈说，学校建好就不用坐很久的车啦。记得把它和我家连在同一条路上。", tool: "school", reward: 3200, needs: [{ type: "school", target: 1, label: "学校" }, { key: "education", target: 35, label: "教育覆盖", unit: "%" }] },
  { id: "avenue", person: "陆 · 巴士司机", avatar: "陆", title: "不迟到的早晨", letter: "普通小路开始拥挤了。把常走的路升级成樱花大道，乘客就有时间吃早饭。", tool: "road", reward: 3000, needs: [{ key: "avenues", target: 12, label: "樱花大道" }, { key: "traffic", target: 60, label: "交通评分", unit: "%" }] },
  { id: "safety", person: "凛 · 消防队员", avatar: "凛", title: "守护亮灯的夜晚", letter: "城镇长大了，我们也该有一个正式的值班站。靠近居民，才能及时赶到。", tool: "fire", reward: 3400, needs: [{ type: "fire", target: 1, label: "消防站" }, { key: "fire", target: 35, label: "消防覆盖", unit: "%" }] },
  { id: "plaza", person: "杏 · 祭典筹备人", avatar: "杏", title: "一处相遇的广场", letter: "大家想办一次春日祭典。先建起广场，再用祭典灯把周边的街道点亮。", tool: "plaza", reward: 4000, needs: [{ type: "plaza", target: 1, label: "小广场" }, { key: "culture", target: 30, label: "文化覆盖", unit: "%" }] },
  { id: "renewal", person: "澪 · 街区建设队", avatar: "澪", title: "让老街慢慢长大", letter: "扩建不是唯一的办法。为三座已有建筑升级，也能为大家腾出更好的生活。", tool: "residential", reward: 3600, needs: [{ key: "upgrades", target: 3, label: "建筑升级次数" }] },
];

const DECISIONS = [
  { id: "welcome", week: 2, title: "第一笔社区预算", text: "新居民想要便利的生活，店主希望减轻经营负担。建设课该先支持谁？", choices: [
    { title: "减免小店税费", detail: "支出 ¥1,500 · 商业活力让总税收 +10% · 幸福 −2", cost: 1500, income: 0.1, happiness: -2 },
    { title: "居民生活补贴", detail: "支出 ¥2,000 · 幸福 +5 · 总税收 −5%", cost: 2000, income: -0.05, happiness: 5 },
    { title: "保留应急储备", detail: "获得 ¥1,200 · 幸福 −1", cost: -1200, happiness: -1 },
  ] },
  { id: "waterfront", week: 6, title: "海岸边的新计划", text: "港湾留着一笔专项资金。大家递来了两份不同的提案。", choices: [
    { title: "修缮散步步道", detail: "支出 ¥3,500 · 幸福 +4 · 每周维护 +80", cost: 3500, happiness: 4, maintenance: 80 },
    { title: "改善货运接驳", detail: "支出 ¥2,800 · 总税收 +12% · 幸福 −2", cost: 2800, income: 0.12, happiness: -2 },
    { title: "组织居民志愿队", detail: "支出 ¥800 · 幸福 +1", cost: 800, happiness: 1 },
  ] },
  { id: "weekend", week: 11, title: "周末属于谁", text: "商店街想延长营业时间，居民也想安静地度过周末。你的决定会留下长期影响。", choices: [
    { title: "周末夜市", detail: "支出 ¥2,500 · 总税收 +15% · 幸福 −3", cost: 2500, income: 0.15, happiness: -3 },
    { title: "安静的花园日", detail: "支出 ¥2,000 · 幸福 +4 · 每周维护 +60", cost: 2000, happiness: 4, maintenance: 60 },
    { title: "轮流安排", detail: "支出 ¥3,200 · 总税收 +5% · 幸福 +2", cost: 3200, income: 0.05, happiness: 2 },
  ] },
  { id: "festival", week: 18, title: "祭典的主角", text: "孩子想在广场表演，手艺人准备摆摊，大家都想为小镇出一份力。", choices: [
    { title: "社区舞台", detail: "支出 ¥3,000 · 幸福 +5", cost: 3000, happiness: 5 },
    { title: "手作集市", detail: "支出 ¥2,000 · 总税收 +10% · 幸福 +1", cost: 2000, income: 0.1, happiness: 1 },
    { title: "一起布置街道", detail: "支出 ¥1,000 · 幸福 +2", cost: 1000, happiness: 2 },
  ] },
];

const unique = (items) => [...new Set(items)];
const safeNumber = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const html = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const yen = (amount) => `¥${Math.round(amount).toLocaleString()}`;

export function normalizeDemoState(raw) {
  if (!raw || !Object.hasOwn(SCENARIOS, raw.scenario)) return null;
  const claims = unique((Array.isArray(raw.claims) ? raw.claims : []).filter((id) => REQUESTS.some((r) => r.id === id)));
  const decisions = [];
  for (const item of Array.isArray(raw.decisions) ? raw.decisions : []) {
    const definition = DECISIONS.find((d) => d.id === item?.id);
    if (!definition || !Number.isInteger(item.option) || !definition.choices[item.option] || decisions.some((d) => d.id === item.id)) continue;
    decisions.push({ id: item.id, option: item.option });
  }
  return { scenario: raw.scenario, claims, decisions, startedWeek: Math.max(1, Math.round(safeNumber(raw.startedWeek, 1))), festival: Boolean(raw.festival), continued: Boolean(raw.continued), festivalWeek: Math.max(0, Math.round(safeNumber(raw.festivalWeek))), view: ["normal", "traffic", "services"].includes(raw.view) ? raw.view : "normal" };
}

export function demoEconomy(state) {
  if (!state) return { income: 1, maintenance: 1, upkeep: 0, happiness: 0 };
  let income = state.scenario === "commerce" ? 0.38 : 0.34;
  let happiness = state.scenario === "garden" ? 3 : 0;
  let upkeep = 0;
  for (const choice of state.decisions) {
    const option = DECISIONS.find((d) => d.id === choice.id)?.choices[choice.option];
    if (!option) continue;
    income += (option.income || 0) * 0.34;
    happiness += option.happiness || 0;
    upkeep += option.maintenance || 0;
  }
  return { income, maintenance: 2.2, upkeep, happiness };
}

export function demoUnlock(type, state) {
  if (!state) return false;
  const stamps = state.claims.length;
  return ["park", "school", "plaza"].includes(type) || (type === "fire" && stamps >= 3) || (type === "lantern" && stamps >= 4) || (type === "station" && stamps >= 5);
}

export function createDemoController(api) {
  const { city } = api;
  const $ = (id) => document.getElementById(id);
  let selectedScenario = "harbor";
  let welcomeOpen = false;
  let wasPaused = false;
  let toastTimer;
  let lastRenderKey = "";
  let previousFocus;
  let initialized = false;
  const count = (type) => city.buildings.filter((b) => b.type === type).length;
  const value = (need) => need.type ? count(need.type) : need.key === "avenues" ? city.tiles.filter((t) => t.roadTier === "avenue").length : need.key === "upgrades" ? city.upgradeCount : city.stats[need.key] || 0;
  const complete = (request) => request.needs.every((need) => value(need) >= need.target);
  const state = () => city.demo;
  const progress = () => {
    if (!state()) return [];
    const scenario = SCENARIOS[state().scenario];
    return [
      { label: "居民来信", value: state().claims.length, target: 6, unit: "封" },
      { label: "居民", value: city.stats.population, target: scenario.population, unit: "人" },
      { label: "幸福度", value: city.stats.happiness, target: scenario.happiness, unit: "%" },
      { label: scenario.special, value: count(scenario.type), target: scenario.count, unit: "座" },
      { label: "市政抉择", value: state().decisions.length, target: 2, unit: "次" },
    ];
  };
  const currentDecision = () => state() && DECISIONS.find((d) => city.week - state().startedWeek >= d.week && !state().decisions.some((c) => c.id === d.id));
  function toast(message) {
    if (!$('demoToast')) return;
    $('demoToast').textContent = message;
    $('demoToast').classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('demoToast')?.classList.remove("visible"), 4500);
  }
  function persist() { api.saveGame(false); }
  function refresh() { lastRenderKey = ""; api.renderUI(); }
  function setWelcome(open) {
    if (!$('welcomeOverlay')) return;
    if (open && !welcomeOpen) { wasPaused = city.paused; previousFocus = document.activeElement; }
    welcomeOpen = open;
    city.paused = open || Boolean(state()?.festival && !state()?.continued) ? true : wasPaused;
    $('welcomeOverlay').hidden = !open;
    $('welcomeOverlay').setAttribute("aria-hidden", String(!open));
    document.querySelector('.game-shell')?.toggleAttribute('inert', open || Boolean(api.isPhotoMode?.()));
    // The welcome lives outside game-shell so its controls remain usable.
    $('welcomeCloseButton').hidden = !state() && !api.hasSave();
    $('continueDemoButton').hidden = !api.hasSave() && !state();
    if (open) $('startDemoButton')?.focus();
    else previousFocus?.focus?.();
    api.renderUI();
  }
  function confirm(title, text, actionLabel, action) {
    const modal = $('demoModal');
    if (!modal || modal.open) return;
    const paused = city.paused;
    city.paused = true;
    $('demoModalTitle').textContent = title;
    $('demoModalText').textContent = text;
    $('demoModalActions').replaceChildren();
    const cancel = document.createElement('button');
    cancel.textContent = '暂时不';
    const accept = document.createElement('button');
    accept.textContent = actionLabel;
    accept.className = 'primary-button';
    const restore = () => { city.paused = welcomeOpen ? true : paused; modal.removeEventListener('close', restore); api.renderUI(); };
    modal.addEventListener('close', restore);
    cancel.onclick = () => modal.close();
    accept.onclick = () => { modal.close(); restore(); action(); };
    $('demoModalActions').append(cancel, accept);
    modal.showModal();
    cancel.focus();
  }
  function startScenario(id) {
    if (!Object.hasOwn(SCENARIOS, id)) return false;
    api.seedScenario(id, SCENARIOS[id]);
    city.demo = normalizeDemoState({ scenario: id });
    city.paused = false;
    city.speed = 1;
    wasPaused = false;
    setWelcome(false);
    api.setViewMode('normal');
    api.recompute();
    city.selectedTile = null;
    api.setTool('water');
    toast("澪寄来了第一封信。选择水塔，放在主街旁，让街区开始运转。");
    persist();
    refresh();
    return true;
  }
  function claim(id) {
    const request = REQUESTS.find((r) => r.id === id);
    if (!state() || !request || state().claims.includes(id) || !complete(request)) return false;
    state().claims.push(id);
    city.stats.money += request.reward;
    city.undoStack = []; // An older construction snapshot must never refund a claimed reward.
    api.celebrate(request.title);
    toast(`${request.person}：谢谢你！社区基金 +${yen(request.reward)}，收集到一枚春日邮票。`);
    api.addMessage(`居民来信完成：${request.title}。获得 ${yen(request.reward)}。`);
    persist();
    refresh();
    return true;
  }
  function choose(id, optionIndex) {
    const decision = currentDecision();
    const option = decision?.choices[optionIndex];
    if (!decision || decision.id !== id || !option || !Number.isInteger(optionIndex) || city.stats.money < Math.max(0, option.cost)) return false;
    state().decisions.push({ id, option: optionIndex });
    city.stats.money -= option.cost;
    city.undoStack = [];
    api.recompute();
    api.addMessage(`市政决定：${option.title}。${option.detail}`);
    toast(`已决定「${option.title}」。效果已计入城镇经营。`);
    persist();
    refresh();
    return true;
  }
  function hostFestival() {
    if (!state() || state().festival || progress().some((p) => p.value < p.target) || city.stats.money < 6500) return false;
    city.stats.money -= 6500;
    state().festival = true;
    state().festivalWeek = city.week;
    city.undoStack = [];
    city.paused = true;
    api.celebrate('春日祭典');
    persist();
    refresh();
    return true;
  }
  function render() {
    if (!initialized || !$('requestBoard')) return;
    const s = state();
    const finaleVisible = Boolean(s?.festival && !s.continued && !welcomeOpen);
    const openedFinale = finaleVisible && $('demoFinale').hidden;
    $('demoFinale').hidden = !finaleVisible;
    document.querySelector('.game-shell')?.toggleAttribute('inert', welcomeOpen || finaleVisible || Boolean(api.isPhotoMode?.()));
    if (finaleVisible) city.paused = true;
    if (openedFinale) $('keepPlayingButton')?.focus();
    const key = JSON.stringify([s, Math.round(city.stats.money), city.stats.population, city.stats.happiness, city.stats.water, city.stats.power, city.stats.traffic, city.stats.education, city.stats.employmentRate, city.stats.fire, city.stats.culture, city.week, city.buildings.map((b) => b.type), city.upgradeCount, city.tiles.filter((t) => t.roadTier === 'avenue').length]);
    if (key === lastRenderKey) return;
    lastRenderKey = key;
    if (!s) {
      $('demoScenarioName').textContent = '自由建设 · 原有城镇';
      $('demoGoalText').textContent = '继续五章建设，或从小镇菜单开启一段新的春日故事。';
      $('demoGoalCount').textContent = '你的城镇，你来决定';
      $('demoGoalProgress').value = 0;
      $('demoJournal').replaceChildren();
      $('requestBoard').innerHTML = '<article class="request-card"><strong>一封新的邀请</strong><p>三种开局、居民来信和春日祭典，正在新旅程里等你。</p><button data-demo-action="menu">选择试玩故事</button></article>';
      $('decisionCard').replaceChildren();
      $('demoFinale').hidden = true;
      return;
    }
    const scenario = SCENARIOS[s.scenario];
    const goals = progress();
    const fulfilled = goals.filter((p) => p.value >= p.target).length;
    const percentage = Math.round(goals.reduce((sum, p) => sum + Math.min(1, p.value / p.target), 0) / goals.length * 100);
    $('demoScenarioName').textContent = `${scenario.town} · ${scenario.name}`;
    $('demoGoalText').textContent = s.festival ? '祭典之后，四季邀约与社区共建还在继续。打开「活动」，写下小镇的新故事。' : '收集 6 枚居民邮票，准备一场属于大家的春日祭典。';
    $('demoGoalCount').textContent = s.festival ? '祭典达成 · 自由建设' : `筹备 ${percentage}% · ${s.claims.length} / 6 枚邮票`;
    $('demoGoalProgress').value = s.festival ? 100 : percentage;
    $('demoGoalProgress').max = 100;
    const available = REQUESTS.filter((r) => !s.claims.includes(r.id)).sort((a, b) => Number(complete(b)) - Number(complete(a))).slice(0, 3);
    $('requestBoard').innerHTML = available.map((r) => `<article class="request-card ${complete(r) ? 'is-ready' : ''}"><header><span class="resident-avatar" aria-hidden="true">${r.avatar}</span><div><small>${r.person}</small><strong>${r.title}</strong></div></header><p>${r.letter}</p><div class="request-needs">${r.needs.map((n) => `<span class="${value(n) >= n.target ? 'is-met' : ''}">${n.label} <b>${Math.floor(value(n))}/${n.target}${n.unit || ''}</b></span>`).join('')}</div><footer><small>邮票 +1 · ${yen(r.reward)}</small>${complete(r) ? `<button data-claim="${r.id}">回信并领取</button>` : `<button data-guide="${r.tool}">${r.tool === 'road' ? '升级大道' : r.id === 'renewal' ? '查看升级方法' : '去建造'}</button>`}</footer></article>`).join('') || '<article class="request-card"><strong>所有来信都已回复</strong><p>谢谢你，让每个小小的愿望都有了着落。</p></article>';
    const decision = currentDecision();
    $('decisionCard').innerHTML = decision ? `<span class="eyebrow">建设课 · 需要你决定</span><h3>${decision.title}</h3><p>${decision.text}</p><div class="decision-options">${decision.choices.map((o, i) => `<button data-decision="${decision.id}" data-option="${i}" ${city.stats.money < Math.max(0, o.cost) ? 'disabled' : ''}><strong>${o.title}</strong><small>${o.detail}</small></button>`).join('')}</div><small>可以稍后决定，城镇不会因此停摆。</small>` : `<span class="eyebrow">建设课 · 小镇政策</span><p>${s.decisions.length ? s.decisions.map((c) => DECISIONS.find((d) => d.id === c.id).choices[c.option].title).join(' / ') : '第 3 周将收到第一份市政提案。'}</p>`;
    const entries = [...s.claims.map((id) => `已回信 · ${REQUESTS.find((r) => r.id === id).title}`), ...s.decisions.map((c) => `已决定 · ${DECISIONS.find((d) => d.id === c.id).choices[c.option].title}`)];
    $('demoJournal').innerHTML = `<div class="festival-checklist"><strong>春日祭典清单</strong>${goals.map((g) => `<p class="${g.value >= g.target ? 'is-met' : ''}"><span>${g.value >= g.target ? '✓' : '○'} ${g.label}</span><b>${Math.floor(g.value)} / ${g.target}</b></p>`).join('')}<button data-demo-action="festival" ${s.festival || fulfilled < goals.length || city.stats.money < 6500 ? 'disabled' : ''}>${s.festival ? '祭典已举办' : '举办春日祭典 · ¥6,500'}</button></div><details><summary>小镇记事 · ${entries.length}</summary>${entries.map((e) => `<p>${html(e)}</p>`).join('') || '<p>每一次回信和决定，都会留在这里。</p>'}</details>`;
    $('demoFinale').hidden = !finaleVisible;
    if (s.festival) $('demoFinaleSummary').textContent = `第 ${s.festivalWeek} 周，${scenario.town}的春日祭典开幕。${Math.round(city.stats.population)} 位居民、${s.claims.length} 封回信、${s.decisions.length} 次共同的决定——这座小镇已经有了你的模样。`;
    document.querySelectorAll('[data-view]').forEach((b) => { b.classList.toggle('active', b.dataset.view === s.view); b.setAttribute('aria-pressed', String(b.dataset.view === s.view)); });
  }
  function boot({ testMode }) {
    initialized = true;
    // Keep the modal outside any inert application container.
    for (const id of ['welcomeOverlay', 'demoModal', 'demoFinale', 'demoToast']) if ($(id)) document.body.append($(id));
    document.querySelectorAll('[data-scenario]').forEach((button) => button.addEventListener('click', () => {
      selectedScenario = button.dataset.scenario;
      document.querySelectorAll('[data-scenario]').forEach((b) => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    }));
    $('startDemoButton')?.addEventListener('click', () => {
      if (api.hasSave() || state()) confirm('启程之前', '新旅程会替换当前浏览器存档。想保留现在的城镇，可以先返回并导出存档。', '开启新旅程', () => startScenario(selectedScenario));
      else startScenario(selectedScenario);
    });
    $('continueDemoButton')?.addEventListener('click', () => { wasPaused = false; setWelcome(false); });
    $('welcomeCloseButton')?.addEventListener('click', () => setWelcome(false));
    $('townMenuButton')?.addEventListener('click', () => setWelcome(true));
    $('keepPlayingButton')?.addEventListener('click', () => { if (!state()) return; state().continued = true; city.paused = false; persist(); refresh(); });
    $('replayDemoButton')?.addEventListener('click', () => { if (state()) state().continued = true; $('demoFinale').hidden = true; setWelcome(true); });
    document.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.claim) claim(button.dataset.claim);
      if (button.dataset.decision) choose(button.dataset.decision, Number(button.dataset.option));
      if (button.dataset.guide) {
        if (button.textContent.includes('升级方法')) { toast('鼠标移到已有建筑上，在「当前格子」查看升级条件并点击升级。'); return; }
        if (button.dataset.guide === 'road') api.setRoadTier('avenue'); else api.setTool(button.dataset.guide);
        toast(button.dataset.guide === 'road' ? '点击已有普通道路，将它升级为樱花大道。按住 Shift 拖动可以连续铺路。' : '把建筑放在道路旁。地图上的半透明模型会预览位置，红色表示当前不可建造。');
      }
      if (button.dataset.demoAction === 'menu') setWelcome(true);
      if (button.dataset.demoAction === 'festival') hostFestival();
      if (button.dataset.view) { if (state()) state().view = button.dataset.view; api.setViewMode(button.dataset.view); refresh(); }
    });
    $('exportSaveButton')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(api.serializeGame(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `sunny-town-week-${city.week}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('存档已导出。把 JSON 文件保留好，就能在另一台电脑继续。');
    });
    $('importSaveButton')?.addEventListener('click', () => $('importSaveInput').click());
    $('importSaveInput')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      try {
        if (file.size > 2_000_000) throw new Error('文件过大');
        const snapshot = JSON.parse(await file.text());
        if (!api.validateSave(snapshot)) throw new Error('存档格式不正确');
        confirm('导入城镇', `将读取第 ${snapshot.city.week || 1} 周的城镇并替换当前进度。`, '导入并继续', () => {
          if (!api.loadSave(snapshot)) { toast('存档无法读取，当前城镇已保留。'); return; }
          api.setViewMode(city.demo?.view || 'normal'); api.renderUI(); persist(); toast('欢迎回来。城镇已经恢复。');
        });
      } catch { toast('这不是有效的小镇存档。当前城镇和已有存档没有改变。'); }
    });
    document.addEventListener('keydown', (event) => {
      if (api.isGraphicsLost?.()) return;
      if ($('demoModal')?.open) return; // Native dialog owns Escape and focus while it is open.
      if (event.key === 'Escape' && welcomeOpen && (state() || api.hasSave())) { setWelcome(false); event.stopImmediatePropagation(); }
      if (event.key === 'Tab' && state()?.festival && !state()?.continued && !welcomeOpen) {
        const buttons = [$('keepPlayingButton'), $('replayDemoButton')];
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); }
        else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); }
      }
      if (event.key === 'Tab' && welcomeOpen) {
        const buttons = [...$('welcomeOverlay').querySelectorAll('button:not([disabled])')].filter((n) => !n.hidden && n.getClientRects().length);
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }, true);
    api.setViewMode(city.demo?.view || 'normal');
    if (testMode) { $('welcomeOverlay').hidden = true; welcomeOpen = false; }
    else setWelcome(true);
    render();
  }
  return { boot, render, toast, confirm, startScenario, claim, choose, hostFestival, progress, setWelcome, isBlocking: () => welcomeOpen || Boolean($('demoModal')?.open) || Boolean(state()?.festival && !state()?.continued), onWeek: () => render(), getState: () => ({ ...state(), requests: REQUESTS.map((r) => ({ id: r.id, complete: complete(r) })), decision: currentDecision()?.id || null, progress: progress() }) };
}
