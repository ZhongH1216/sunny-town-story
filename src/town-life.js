// Opt-in activities advance with simulation weeks, never with rendering or loading.
export const ACTIVITIES = [
  { id: 'picnic', season: '春', title: '樱花树下的野餐', person: '千代 · 园艺师', keepsake: '樱花书签', text: '把公园连进街区，让忙碌的人也有坐下来吃饭的地方。', choices: [
    { title: '邻里小聚', cost: 600, reward: 1400, reputation: 2, weeks: 2, needs: [{ type: 'park', target: 1, label: '连路公园' }, { key: 'happiness', target: 65, label: '幸福' }, { key: 'water', target: 60, label: '供水' }] },
    { title: '全镇花见会', cost: 1400, reward: 2700, reputation: 3, weeks: 3, needs: [{ type: 'park', target: 2, label: '连路公园' }, { key: 'happiness', target: 78, label: '幸福' }, { key: 'water', target: 80, label: '供水' }] },
  ] },
  { id: 'market', season: '夏', title: '海风晚集', person: '杏 · 面包店主', keepsake: '海蓝风铃', text: '摊主们准备好了。让商店有邻居、街道走得通，晚集才能热闹起来。', choices: [
    { title: '街角小市集', cost: 900, reward: 2000, reputation: 2, weeks: 2, needs: [{ type: 'commercial', target: 2, label: '连路商店' }, { key: 'employmentRate', target: 65, label: '就业' }, { key: 'traffic', target: 50, label: '交通' }] },
    { title: '港湾不夜市', cost: 2000, reward: 3600, reputation: 3, weeks: 3, needs: [{ type: 'commercial', target: 4, label: '连路商店' }, { key: 'traffic', target: 70, label: '交通' }, { key: 'power', target: 80, label: '供电' }] },
  ] },
  { id: 'harvest', season: '秋', title: '丰收与手作', person: '澪 · 街区建设队', keepsake: '枫叶陶杯', text: '给本地小店和工坊一次被大家认识的机会，选择适合这座小镇的方式。', choices: [
    { title: '邻里丰收餐', cost: 800, reward: 1900, reputation: 2, weeks: 2, needs: [{ type: 'commercial', target: 2, label: '连路商店' }, { key: 'water', target: 75, label: '供水' }, { key: 'happiness', target: 65, label: '幸福' }] },
    { title: '工坊开放日', cost: 1800, reward: 3400, reputation: 3, weeks: 3, needs: [{ type: 'industrial', target: 2, label: '连路工坊' }, { key: 'employmentRate', target: 80, label: '就业' }, { key: 'traffic', target: 60, label: '交通' }] },
  ] },
  { id: 'lights', season: '冬', title: '为归人留一盏灯', person: '空 · 小镇邮差', keepsake: '暖光雪屋', text: '冬天的邀请不用太响亮。让窗户亮着，让每个人都能安心回家。', choices: [
    { title: '窗边灯光夜', cost: 900, reward: 2100, reputation: 2, weeks: 2, needs: [{ key: 'power', target: 80, label: '供电' }, { type: 'commercial', target: 2, label: '连路商店' }, { key: 'happiness', target: 65, label: '幸福' }] },
    { title: '小镇灯光巡游', cost: 1800, reward: 3500, reputation: 3, weeks: 3, needs: [{ type: 'lantern', target: 2, label: '连路祭典灯' }, { key: 'culture', target: 35, label: '文化' }, { key: 'power', target: 95, label: '供电' }] },
  ] },
];

export const PROJECTS = [
  { id: 'coast', title: '海岸共建计划', reputation: 2, cost: 4000, text: '活动积攒的口碑，让第一批社区改造有了支持。两种方案只能选一种。', choices: [
    { title: '树荫散步道', detail: '幸福 +3 · 公园服务容量 +15%', happiness: 3, park: 0.15 },
    { title: '港口商店连廊', detail: '商业税收 +10%', commercial: 0.10 },
  ] },
  { id: 'workshop', title: '旧仓库的新工作', reputation: 5, cost: 6500, text: '旧仓库可以成为节约资源的工坊，也可以帮助街坊补足基础设施。', choices: [
    { title: '资源循环工坊', detail: '建筑与道路维护 −6% · 工业污染 −15%', maintenance: -0.06, pollution: -0.15 },
    { title: '水电协作中心', detail: '供水、供电设施产能 +15%', utilities: 0.15 },
  ] },
  { id: 'club', title: '街坊会馆', reputation: 8, cost: 9500, text: '居民愿意一起照顾这座城。把口碑变成能长期留下来的改变。', choices: [
    { title: '安心邻里站', detail: '教育、消防服务容量 +20%', education: 0.20, fire: 0.20 },
    { title: '慢行生活圈', detail: '通勤压力抵扣 +5 · 幸福 +2', traffic: 5, happiness: 2 },
  ] },
];

const integer = (v, min, max, fallback) => Number.isInteger(v) && v >= min && v <= max ? v : fallback;
const escape = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = v => `¥${Math.round(v).toLocaleString()}`;
const activityById = id => ACTIVITIES.find(a => a.id === id);

export function normalizeTownLife(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const projects = [];
  for (const entry of Array.isArray(source.projects) ? source.projects : []) {
    const definition = PROJECTS.find(p => p.id === entry?.id);
    if (definition && Number.isInteger(entry.choice) && definition.choices[entry.choice] && !projects.some(p => p.id === entry.id)) projects.push({ id: entry.id, choice: entry.choice });
  }
  const memories = (Array.isArray(source.memories) ? source.memories : []).filter(m => activityById(m?.id) && ['complete', 'missed', 'cancelled'].includes(m.outcome) && Number.isInteger(m.week) && m.week > 0).slice(-12).map(m => ({ id: m.id, week: Math.min(m.week, 1000000), outcome: m.outcome }));
  let active = null;
  const a = source.active;
  const definition = activityById(a?.id);
  if (definition && Number.isInteger(a.choice) && definition.choices[a.choice] && Number.isInteger(a.startedWeek) && a.startedWeek >= 1 && a.startedWeek <= 1000000) {
    const option = definition.choices[a.choice];
    active = { id: a.id, choice: a.choice, cycle: integer(a.cycle, 0, 1000000, Math.floor((a.startedWeek - 1) / 12)), startedWeek: a.startedWeek, deadlineWeek: a.startedWeek + 6, progress: integer(a.progress, 0, option.weeks, 0), lastEvaluatedWeek: integer(a.lastEvaluatedWeek, a.startedWeek, a.startedWeek + 6, a.startedWeek) };
  }
  return {
    reputation: integer(source.reputation, 0, 1000000, 0),
    lastCycle: Math.max(integer(source.lastCycle, -1, 1000000, -1), active?.cycle ?? -1),
    active, projects, memories,
    souvenirs: [...new Set((Array.isArray(source.souvenirs) ? source.souvenirs : []).filter(id => activityById(id)))],
    completed: integer(source.completed, 0, 1000000, 0),
  };
}

export function townLifeEffects(state) {
  const result = { happiness: 0, traffic: 0, commercial: 1, maintenance: 1, pollution: 1, utilities: 1, park: 1, education: 1, fire: 1 };
  for (const project of state?.projects || []) {
    const option = PROJECTS.find(p => p.id === project.id)?.choices[project.choice];
    if (option) for (const key of Object.keys(result)) result[key] += option[key] || 0;
  }
  return result;
}

export function createTownLife(api) {
  const { city } = api;
  const $ = id => document.getElementById(id);
  let lastKey = '';
  const state = () => city.life;
  const cycle = () => Math.floor((city.week - 1) / 12);
  const offer = () => ACTIVITIES[cycle() % ACTIVITIES.length];
  const value = n => n.type ? city.buildings.filter(b => b.type === n.type && api.isConnected(b)).length : city.stats[n.key] || 0;
  const qualifies = option => option.needs.every(n => value(n) >= n.target);
  function changed(message, save = true) {
    city.undoStack = [];
    lastKey = '';
    if (message) { api.addMessage(message); api.toast(message); }
    api.recompute();
    if (save) api.save();
    api.render();
  }
  function remember(active, outcome) {
    state().memories.push({ id: active.id, week: city.week, outcome });
    state().memories = state().memories.slice(-12);
  }
  function start(choice) {
    const s = state(), definition = offer(), option = definition.choices[choice];
    if (!s || s.active || s.lastCycle >= cycle() || !Number.isInteger(choice) || !option || city.stats.money < option.cost) return false;
    city.stats.money -= option.cost;
    s.lastCycle = cycle();
    s.active = { id: definition.id, choice, cycle: cycle(), startedWeek: city.week, deadlineWeek: city.week + 6, lastEvaluatedWeek: city.week, progress: 0 };
    changed(`${definition.person}：${option.title}开始筹备！未来 6 周内，累计 ${option.weeks} 周满足条件即可。`);
    return true;
  }
  function claim() {
    const s = state(), active = s?.active;
    const definition = activityById(active?.id), option = definition?.choices[active?.choice];
    if (!option || active.progress < option.weeks) return false;
    city.stats.money += option.reward;
    s.reputation += option.reputation;
    s.completed += 1;
    const newSouvenir = !s.souvenirs.includes(active.id);
    if (newSouvenir) s.souvenirs.push(active.id);
    const collectionBonus = newSouvenir && s.souvenirs.length === 4 ? 5000 : 0;
    city.stats.money += collectionBonus;
    remember(active, 'complete');
    s.active = null;
    api.celebrate(definition.title);
    changed(`${definition.title}圆满结束！${yen(option.reward)}、口碑 +${option.reputation}${newSouvenir ? `，收到「${definition.keepsake}」` : ''}${collectionBonus ? '。四季相册集齐，纪念基金 +¥5,000' : ''}。`);
    return true;
  }
  function cancel() {
    const active = state()?.active;
    if (!active || active.progress >= activityById(active.id).choices[active.choice].weeks) return false;
    remember(active, 'cancelled');
    state().active = null;
    changed('这次活动已取消，筹备费用不退。下一季会有新的邀请。');
    return true;
  }
  function chooseProject(id, choice) {
    const project = PROJECTS.find(p => p.id === id), option = project?.choices[choice], s = state();
    if (!project || !Number.isInteger(choice) || !option || !s || s.projects.some(p => p.id === id) || s.reputation < project.reputation || city.stats.money < project.cost) return false;
    city.stats.money -= project.cost;
    s.projects.push({ id, choice });
    api.celebrate(option.title);
    changed(`社区共建完成：${option.title}。${option.detail}。`);
    return true;
  }
  function onWeek() {
    const active = state()?.active;
    if (!active) return;
    const option = activityById(active.id).choices[active.choice];
    if (active.progress >= option.weeks || city.week <= active.lastEvaluatedWeek) return;
    active.lastEvaluatedWeek = city.week;
    if (city.week <= active.deadlineWeek && qualifies(option)) active.progress += 1;
    if (active.progress >= option.weeks) {
      api.addMessage('街坊活动圆满完成，打开「活动」领取纪念与奖励。');
      api.toast('活动完成了！打开「活动」领取奖励与纪念品。');
    } else if (city.week >= active.deadlineWeek) {
      remember(active, 'missed');
      state().active = null;
      api.addMessage('本次活动未能按期准备好，没有额外罚款。先照顾好城镇，下一季再来。');
      api.toast('活动筹备结束了，条件还差一点。没有额外罚款，下一季可以重新尝试。');
    }
    lastKey = '';
  }
  function needsHTML(option) {
    return `<div class="life-requirements">${option.needs.map(n => `<span class="${value(n) >= n.target ? 'is-met' : ''}">${n.label} <b>${Math.floor(value(n))}/${n.target}${n.type ? '' : '%'}</b></span>`).join('')}</div>`;
  }
  function render() {
    if (!$('seasonActivity') || !state()) return;
    const s = state();
    const key = JSON.stringify([s, city.week, Math.floor(city.stats.money), city.stats.happiness, city.stats.water, city.stats.power, city.stats.employmentRate, city.stats.traffic, city.stats.culture, city.roadVersion, city.buildings.map(b => `${b.type}:${b.x},${b.z}`)]);
    if (key === lastKey) return;
    lastKey = key;
    // Preserve focus across live weekly progress updates in this panel.
    const focused = document.activeElement;
    const focusKey = focused?.dataset.lifeAction ? [focused.dataset.lifeAction, focused.dataset.choice, focused.dataset.project] : null;
    const definition = s.active ? activityById(s.active.id) : offer();
    if (s.active) {
      const active = s.active, option = definition.choices[active.choice], ready = active.progress >= option.weeks;
      $('seasonActivity').innerHTML = `<article class="life-card ${ready ? 'is-ready' : ''}"><span class="life-kicker">${definition.season}日邀约 · ${definition.person}</span><h3>${definition.title}</h3><p>${option.title} · 累计达标 ${active.progress}/${option.weeks} 周</p><progress class="life-progress" max="${option.weeks}" value="${active.progress}" aria-label="活动筹备进度"></progress>${needsHTML(option)}<p class="life-deadline">${ready ? '已圆满完成，奖励会一直保留。' : `还剩 ${Math.max(0, active.deadlineWeek - city.week)} 周 · ${qualifies(option) ? '当前条件已达标，下一次周结算计入进度。' : '补齐缺口后才计入达标周数；可暂停规划。'}`}</p><p class="life-reward">${yen(option.reward)} · 口碑 +${option.reputation} · ${definition.keepsake}</p><div class="life-actions">${ready ? '<button data-life-action="claim">领取活动纪念</button>' : '<button data-life-action="cancel">取消筹备</button>'}</div></article>`;
    } else if (s.lastCycle >= cycle()) {
      $('seasonActivity').innerHTML = `<article class="life-card"><span class="life-kicker">街坊活动</span><h3>下一封邀请在路上</h3><p>本季已参与过活动。还有 ${12 - ((city.week - 1) % 12)} 周进入${ACTIVITIES[(cycle() + 1) % 4].season}季，期间可以建设社区项目、回复来信。</p><small>活动完全自愿，不参加不会受罚。每季可参与一次。</small></article>`;
    } else {
      $('seasonActivity').innerHTML = `<article class="life-card"><span class="life-kicker">${definition.season}日邀约 · ${definition.person}</span><h3>${definition.title}</h3><p>${definition.text}</p><p class="life-deadline">接受后有 6 周筹备；累计达标即可。暂停时不倒计时。</p>${definition.choices.map((option, choice) => `<section class="life-choice"><strong>${option.title}</strong>${needsHTML(option)}<p class="life-cost">筹备 ${yen(option.cost)} · 累计 ${option.weeks} 周达标</p><p class="life-reward">奖励 ${yen(option.reward)} · 口碑 +${option.reputation}</p><button data-life-action="start" data-choice="${choice}" ${city.stats.money < option.cost ? 'disabled' : ''}>${city.stats.money < option.cost ? '资金不足' : '接受邀请'}</button></section>`).join('')}</article>`;
    }
    $('communityProjects').innerHTML = `<div class="life-kicker">社区共建 · 口碑 ${s.reputation}</div><p class="life-empty">口碑来自成功活动，不会被消耗。每个项目只选一种方案，效果永久保留。</p>${PROJECTS.map(project => {
      const built = s.projects.find(p => p.id === project.id);
      const allowed = s.reputation >= project.reputation && city.stats.money >= project.cost;
      return `<article class="life-project ${!built && allowed ? 'is-ready' : ''}"><h3>${project.title}</h3>${built ? `<span class="life-badge">已建成 · ${project.choices[built.choice].title}</span><p>${project.choices[built.choice].detail}</p>` : `<p>${project.text}</p><p class="life-cost">口碑 ${s.reputation}/${project.reputation} · 预算 ${yen(project.cost)}</p>${project.choices.map((option, choice) => `<button class="life-choice" data-life-action="project" data-project="${project.id}" data-choice="${choice}" ${allowed ? '' : 'disabled'}><strong>${option.title}</strong><small>${option.detail}</small></button>`).join('')}`}</article>`;
    }).join('')}`;
    $('townMemories').innerHTML = `<div class="life-kicker">四季相册 · ${s.souvenirs.length}/4 · 成功活动 ${s.completed} 次</div><p class="life-empty">每季首次成功获得一件纪念品。集齐四季可获得 ¥5,000 纪念基金。</p>${ACTIVITIES.map(a => `<div class="life-memory ${s.souvenirs.includes(a.id) ? 'is-collected' : ''}"><span aria-hidden="true">${s.souvenirs.includes(a.id) ? '✿' : '○'}</span><span>${a.season} · ${a.keepsake}</span><small>${s.souvenirs.includes(a.id) ? '已收藏' : '等待相遇'}</small></div>`).join('')}<details><summary>街坊记事 · 最近 ${s.memories.length} 次</summary>${[...s.memories].reverse().map(m => `<p>第 ${m.week} 周 · ${escape(activityById(m.id).title)} · ${{ complete: '圆满完成', missed: '准备未齐', cancelled: '取消筹备' }[m.outcome]}</p>`).join('') || '<p>第一段故事，会从你的邀请开始。</p>'}</details>`;
    if (focusKey) {
      const next = [...document.querySelectorAll('[data-life-action]')].find(b => b.dataset.lifeAction === focusKey[0] && b.dataset.choice === focusKey[1] && b.dataset.project === focusKey[2]);
      next?.focus({ preventScroll: true });
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-life-action]');
    if (!button || button.disabled) return;
    if (button.dataset.lifeAction === 'start') start(Number(button.dataset.choice));
    if (button.dataset.lifeAction === 'claim') claim();
    if (button.dataset.lifeAction === 'cancel') api.confirm('取消街坊活动', '已经用于筹备的费用不会退回，本季不能再次报名。下季仍会收到邀请。', '确认取消', cancel);
    if (button.dataset.lifeAction === 'project') {
      const p = PROJECTS.find(p => p.id === button.dataset.project), choice = Number(button.dataset.choice);
      if (p?.choices[choice]) api.confirm('一起建设社区', `${p.choices[choice].title}：${p.choices[choice].detail}。花费 ${yen(p.cost)}，此项目将永久采用这个方案。`, '建设这个方案', () => chooseProject(p.id, choice));
    }
  });
  return { start, claim, cancel, chooseProject, onWeek, render, getState: () => ({ ...JSON.parse(JSON.stringify(state())), cycle: cycle(), offer: offer().id, effects: townLifeEffects(state()) }) };
}
