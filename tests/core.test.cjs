const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../dist/assets/core.js');

test('local calendar dates survive month, year, and leap-day boundaries', () => {
  assert.equal(C.shiftDate('2024-02-28',1),'2024-02-29');
  assert.equal(C.shiftDate('2025-12-31',1),'2026-01-01');
  assert.equal(C.shiftDate('2026-03-01',-1),'2026-02-28');
  assert.equal(C.validDate('2026-02-30'),false);
  assert.equal(C.validDate('2026-10-15'),true);
  assert.equal(C.validTime('24:00'),false);
  assert.equal(C.validTime('23:59'),true);
});

test('streaks skip off-days and allow today’s check-in to remain pending', () => {
  const h={createdAt:'2026-10-05',schedule:[1,2,3,4,5],logs:['2026-10-08','2026-10-09','2026-10-12','2026-10-13','2026-10-14']};
  assert.equal(C.streak(h,'2026-10-15'),5);
  h.logs.push('2026-10-15');
  assert.equal(C.streak(h,'2026-10-15'),6);
  h.logs=h.logs.filter(d=>d!=='2026-10-13');
  assert.equal(C.streak(h,'2026-10-15'),2);
  assert.equal(C.scheduled(h,'2026-10-11'),false);
  assert.equal(C.scheduled(h,'2026-10-01'),false);
});

test('actual completion dates determine task analytics and focus totals', () => {
  const s=C.blank(),date=C.dateKey();
  s.tasks=[{status:'done',dueDate:C.shiftDate(date,-1),completedAt:new Date().toISOString()},{status:'todo',dueDate:date}];
  s.sessions=[{date,minutes:25,mode:'focus'},{date,minutes:5,mode:'short'},{date:C.shiftDate(date,-1),minutes:10,mode:'focus'}];
  s.history=[{date:C.shiftDate(date,-1),tasks:2,focus:50}];
  assert.equal(C.dayStats(s,date).tasks,1);
  assert.equal(C.dayStats(s,date).focus,25);
  assert.equal(C.dayStats(s,C.shiftDate(date,-1)).tasks,2);
  assert.equal(C.dayStats(s,C.shiftDate(date,-1)).focus,60);
});

test('sample workspace survives a validated export/import round trip', () => {
  const s=C.seed('2026-10-15'),restored=C.validate(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.tasks.length,8);
  assert.equal(restored.habits.length,4);
  assert.equal(restored.history.length,27);
  assert.equal(C.dayStats(restored,'2026-10-15').tasks,2);
  assert.equal(restored.tasks[0].subtasks.length,3);
  assert.equal(restored.settings.focusMinutes,25);
});

test('backup validation rejects corrupt collections, schedules, and blocks', () => {
  assert.throws(()=>C.validate({version:2}),/valid Daycraft/);
  const s=C.seed();s.habits[0].schedule=[];
  assert.throws(()=>C.validate(s),/schedule/);
  const b=C.seed();b.events[0].end='07:00';
  assert.throws(()=>C.validate(b),/invalid dates/);
  const t=C.seed();t.tasks[0].title='';
  assert.throws(()=>C.validate(t),/title/);
});

test('backup validation reconstructs trusted fields without prototype pollution', () => {
  const raw=JSON.parse(JSON.stringify(C.seed()));
  raw.settings.__proto__={polluted:true};
  raw.journal.__proto__={polluted:true};
  raw.tasks[0].extra='<script>untrusted</script>';
  raw.timer.taskId='missing';
  const clean=C.validate(raw);
  assert.equal(clean.settings.polluted,undefined);
  assert.equal(clean.journal.polluted,undefined);
  assert.equal(clean.tasks[0].extra,undefined);
  assert.equal(clean.timer.taskId,'');
  assert.equal({}.polluted,undefined);
});

test('adjacent time blocks do not conflict; overlapping blocks do', () => {
  const a={id:'a',date:'2026-10-15',start:'09:00',end:'10:00'};
  assert.equal(C.overlaps(a,{id:'b',date:a.date,start:'10:00',end:'11:00'}),false);
  assert.equal(C.overlaps(a,{id:'b',date:a.date,start:'09:30',end:'10:30'}),true);
  assert.equal(C.overlaps(a,{...a}),false);
  assert.equal(C.overlaps(a,{id:'b',date:'2026-10-16',start:'09:30',end:'10:30'}),false);
});
