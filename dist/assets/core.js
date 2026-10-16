(function (root) {
  'use strict';
  const DAY = 86400000;
  const id = () => root.crypto?.randomUUID?.() || 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const fromDate = key => new Date(key + 'T12:00:00');
  const shiftDate = (key, amount) => { const d = fromDate(key); d.setDate(d.getDate() + amount); return dateKey(d); };
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(+fromDate(value)) && dateKey(fromDate(value)) === value;
  const sameDay = (timestamp, key) => timestamp && dateKey(new Date(timestamp)) === key;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));
  const str = (s, max = 300) => typeof s === 'string' ? s.trim().slice(0, max) : '';
  const pick = (s, options, fallback) => options.includes(s) ? s : fallback;
  const defaults = () => ({ name: 'Amir', theme: 'light', reducedMotion: false, focusMinutes: 25, shortBreak: 5, longBreak: 15, weekStart: 1, dailyTarget: 5 });
  const blank = () => ({ version: 1, hasSample: false, settings: defaults(), tasks: [], habits: [], events: [], goals: [], journal: {}, sessions: [], history: [], timer: { mode: 'focus', duration: 1500, remaining: 1500, running: false, endsAt: null, taskId: '' } });
  function seed(now = dateKey()) {
    const s = blank(); s.hasSample = true;
    const task = (title, category, priority, status, dueDate, extra = {}) => ({ id: id(), title, description: '', category, priority, status, dueDate, time: '', estimate: 30, subtasks: [], createdAt: new Date().toISOString(), completedAt: status === 'done' ? fromDate(now).toISOString() : null, ...extra });
    s.tasks = [
      task('Bring the website redesign to life', 'Work', 'high', 'in-progress', now, { time: '09:00', estimate: 60, description: 'A little less noise. A little more intention. Finish the homepage direction and share a first look.', subtasks: [{ id: id(), title: 'Explore the visual direction', done: true }, { id: id(), title: 'Polish the homepage', done: false }, { id: id(), title: 'Share with the team', done: false }] }),
      task('Read a chapter of Atomic Habits', 'Personal', 'low', 'done', now, { time: '07:30', estimate: 20 }),
      task('A little German, every day', 'Learning', 'medium', 'todo', now, { time: '14:00', estimate: 30, description: 'Review 15 words, listen to a short conversation, and write three sentences.' }),
      task('Plan next week’s content', 'Work', 'medium', 'todo', now, { time: '15:30', estimate: 45 }),
      task('Get outside for a long walk', 'Wellness', 'low', 'todo', now, { time: '17:00', estimate: 30 }),
      task('Clear the inbox', 'Work', 'medium', 'done', now, { estimate: 15 }),
      task('Review the project proposal', 'Work', 'high', 'todo', shiftDate(now, 1), { time: '10:00', estimate: 45 }),
      task('Make a moodboard for the side project', 'Personal', 'low', 'todo', shiftDate(now, 2), { estimate: 60 })
    ];
    s.habits = [
      { id: id(), title: 'Mindful mornings', description: '10 minutes, just for you', icon: 'sun', color: 'sage', schedule: [0,1,2,3,4,5,6], logs: [], createdAt: shiftDate(now, -27) },
      { id: id(), title: 'Move your body', description: 'Make a little room for movement', icon: 'activity', color: 'peach', schedule: [0,1,2,3,4,5,6], logs: [], createdAt: shiftDate(now, -27) },
      { id: id(), title: 'Read 20 pages', description: 'One chapter closer', icon: 'book', color: 'lavender', schedule: [0,1,2,3,4,5,6], logs: [], createdAt: shiftDate(now, -27) },
      { id: id(), title: 'Learn something new', description: 'Stay wonderfully curious', icon: 'sparkles', color: 'butter', schedule: [1,2,3,4,5], logs: [], createdAt: shiftDate(now, -27) }
    ];
    for (let n = 27; n >= 1; n--) {
      const day = shiftDate(now, -n);
      const tasks=2+((n*7)%6),work=Math.ceil(tasks/2),personal=Math.floor(tasks/4);
      s.history.push({ date: day, tasks, focus: 25 * (1 + ((n * 3) % 5)), categories:{Work:work,Personal:personal,Learning:tasks-work-personal-1,Wellness:1} });
      s.habits.forEach((h, i) => { if (h.schedule.includes(fromDate(day).getDay()) && (n + i) % (5 + i) !== 0) h.logs.push(day); });
    }
    s.habits[0].logs.push(now); s.habits[2].logs.push(now);
    s.events = [
      { id: id(), title: 'Morning reset', date: now, start: '08:00', end: '08:30', category: 'Wellness', notes: 'Coffee, stretch, and a fresh perspective.' },
      { id: id(), title: 'Design deep dive', date: now, start: '10:30', end: '11:45', category: 'Work', notes: 'A little uninterrupted space to create.' },
      { id: id(), title: 'Lunch & a little fresh air', date: now, start: '12:30', end: '13:15', category: 'Personal', notes: '' },
      { id: id(), title: 'Project check-in', date: shiftDate(now, 1), start: '11:00', end: '11:45', category: 'Work', notes: '' },
      { id: id(), title: 'Learn & explore', date: shiftDate(now, 2), start: '14:00', end: '15:00', category: 'Learning', notes: '' },
      { id: id(), title: 'A screen-free evening', date: shiftDate(now, 3), start: '18:00', end: '19:00', category: 'Wellness', notes: '' }
    ];
    s.goals = [
      { id: id(), title: 'Read 12 books this year', current: 7, target: 12, unit: 'books', color: 'lavender', dueDate: now.slice(0,4) + '-12-31' },
      { id: id(), title: 'Build something you’re proud of', current: 3, target: 5, unit: 'milestones', color: 'sage', dueDate: shiftDate(now, 45) },
      { id: id(), title: 'Make movement a routine', current: 18, target: 30, unit: 'workouts', color: 'peach', dueDate: shiftDate(now, 30) }
    ];
    s.journal[now] = { mood: 'good', text: '', gratitude: '' };
    return s;
  }
  function scheduled(habit, key) { return validDate(key) && key >= habit.createdAt && habit.schedule.includes(fromDate(key).getDay()); }
  function streak(habit, now = dateKey()) {
    let count = 0, key = now;
    if (scheduled(habit, key) && !habit.logs.includes(key)) key = shiftDate(key, -1);
    for (let i = 0; i < 3660 && key >= habit.createdAt; i++, key = shiftDate(key, -1)) {
      if (!scheduled(habit, key)) continue;
      if (!habit.logs.includes(key)) break;
      count++;
    }
    return count;
  }
  function dayStats(state, key) {
    const baseline = state.history.find(d => d.date === key) || { tasks: 0, focus: 0 };
    return {
      tasks: baseline.tasks + state.tasks.filter(t => t.status === 'done' && sameDay(t.completedAt, key)).length,
      focus: baseline.focus + state.sessions.filter(s => s.date === key && s.mode === 'focus').reduce((n, s) => n + s.minutes, 0),
      habits: state.habits.filter(h => scheduled(h,key) && h.logs.includes(key)).length,
      scheduled: state.habits.filter(h => scheduled(h,key)).length
    };
  }
  function validate(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== 1) throw new Error('Choose a valid Daycraft backup (version 1).');
    for (const name of ['tasks','habits','events','goals','sessions','history']) if (!Array.isArray(raw[name]) || raw[name].length > 5000) throw new Error('The backup has an invalid ' + name + ' collection.');
    const s = blank(), set = raw.settings || {};
    s.hasSample = !!raw.hasSample;
    s.settings = { name: str(set.name, 40) || 'Friend', theme: pick(set.theme,['light','dark','system'],'light'), reducedMotion: !!set.reducedMotion, focusMinutes: clamp(set.focusMinutes,1,120), shortBreak: clamp(set.shortBreak,1,30), longBreak: clamp(set.longBreak,1,60), weekStart: Number(set.weekStart) === 0 ? 0 : 1, dailyTarget: clamp(set.dailyTarget,1,30) };
    const categories = ['Work','Personal','Learning','Wellness'];
    const ids = new Set();
    const cleanId = v => { const cleaned = str(v,80); if (!cleaned || ids.has(cleaned)) return id(); ids.add(cleaned); return cleaned; };
    s.tasks = raw.tasks.map(t => {
      if (!t || !str(t.title)) throw new Error('A task is missing its title.');
      const status = pick(t.status,['todo','in-progress','done'],'todo');
      const completedAt = status === 'done' && t.completedAt && !Number.isNaN(+new Date(t.completedAt)) ? new Date(t.completedAt).toISOString() : null;
      return { id: cleanId(t.id), title: str(t.title,200), description: str(t.description,3000), category: pick(t.category,categories,'Personal'), priority: pick(t.priority,['low','medium','high'],'medium'), status, dueDate: validDate(t.dueDate) ? t.dueDate : dateKey(), time: validTime(t.time) ? t.time : '', estimate: clamp(t.estimate,5,480), subtasks: (Array.isArray(t.subtasks) ? t.subtasks : []).slice(0,50).filter(st => st && str(st.title)).map(st => ({ id: id(), title: str(st.title,200), done: !!st.done })), completedAt, createdAt: !Number.isNaN(+new Date(t.createdAt)) ? new Date(t.createdAt).toISOString() : new Date().toISOString() };
    });
    s.habits = raw.habits.map(h => {
      if (!h || !str(h.title) || !Array.isArray(h.schedule) || !h.schedule.length) throw new Error('A habit has an invalid schedule.');
      const schedule = [...new Set(h.schedule.filter(n => Number.isInteger(n) && n >= 0 && n <= 6))];
      if (!schedule.length) throw new Error('A habit needs at least one scheduled day.');
      return { id: cleanId(h.id), title: str(h.title,200), description: str(h.description,300), icon: pick(h.icon,['sun','activity','book','sparkles','heart','water','moon','leaf'],'sun'), color: pick(h.color,['sage','peach','lavender','butter'],'sage'), schedule, logs: [...new Set((Array.isArray(h.logs) ? h.logs : []).filter(validDate))].slice(-3660), createdAt: validDate(h.createdAt) ? h.createdAt : dateKey() };
    });
    s.events = raw.events.map(e => {
      if (!e || !str(e.title) || !validDate(e.date) || !validTime(e.start) || !validTime(e.end) || e.end <= e.start) throw new Error('A time block has invalid dates or times.');
      return { id: cleanId(e.id), title: str(e.title,200), date:e.date, start:e.start, end:e.end, category:pick(e.category,categories,'Personal'), notes:str(e.notes,2000) };
    });
    s.goals = raw.goals.map(g => { if (!g || !str(g.title) || !Number.isFinite(Number(g.target)) || Number(g.target) <= 0) throw new Error('A goal has an invalid target.'); return { id: cleanId(g.id), title: str(g.title,200), current:clamp(g.current,0,1000000), target:clamp(g.target,1,1000000), unit:str(g.unit,30) || 'steps', color:pick(g.color,['sage','peach','lavender','butter'],'sage'), dueDate:validDate(g.dueDate) ? g.dueDate : dateKey() }; });
    s.sessions = raw.sessions.filter(x => x && validDate(x.date) && Number.isFinite(Number(x.minutes))).map(x => ({ id: cleanId(x.id), date:x.date, minutes:clamp(x.minutes,0,240), mode:pick(x.mode,['focus','short','long'],'focus'), taskId:str(x.taskId,80) }));
    s.history = raw.history.filter(x => x && validDate(x.date)).map(x => {
      const tasks=clamp(x.tasks,0,10000),categories={};let available=tasks;
      for(const name of ['Work','Personal','Learning','Wellness']){categories[name]=clamp(x.categories?.[name],0,available);available-=categories[name];}
      return { date:x.date, tasks, focus:clamp(x.focus,0,1440),categories };
    });
    const journal = raw.journal && typeof raw.journal === 'object' ? raw.journal : {};
    for (const [key,j] of Object.entries(journal).slice(-3660)) if(validDate(key) && j && typeof j === 'object') s.journal[key] = { mood:pick(j.mood,['great','good','okay','low','rough'],''), text:str(j.text,10000), gratitude:str(j.gratitude,3000) };
    const timer = raw.timer || {};
    const duration = clamp(timer.duration,60,7200);
    s.timer = { mode:pick(timer.mode,['focus','short','long'],'focus'), duration, remaining:clamp(timer.remaining,0,duration), running:!!timer.running && Number.isFinite(Number(timer.endsAt)) && Number(timer.endsAt) > 0, endsAt:Number.isFinite(Number(timer.endsAt)) ? Number(timer.endsAt) : null, taskId:s.tasks.some(t=>t.id===timer.taskId) ? timer.taskId : '' };
    return s;
  }
  function validTime(t) { return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
  function overlaps(a, b) { return a.date === b.date && a.start < b.end && b.start < a.end && a.id !== b.id; }
  const api = { DAY, id, dateKey, fromDate, shiftDate, validDate, validTime, sameDay, clamp, defaults, blank, seed, scheduled, streak, dayStats, validate, overlaps };
  root.DaycraftCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
