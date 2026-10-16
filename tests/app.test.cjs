const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const pause=ms=>new Promise(r=>setTimeout(r,ms));

async function mount(stored) {
  const errors=[],vc=new VirtualConsole();
  vc.on('jsdomError',e=>errors.push(e.message));
  vc.on('warn',(...args)=>{if(String(args[0]).includes('Alpine'))errors.push(args.join(' '));});
  const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'https://daycraft.test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window;
  // jsdom has no layout or CSS transitions; exercise Alpine state and events directly.
  for(const el of w.document.querySelectorAll('*'))for(const attr of [...el.attributes])if(attr.name.startsWith('x-transition'))el.removeAttribute(attr.name);
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{};
  w.Chart=class{constructor(canvas,config){this.canvas=canvas;this.config=config;}destroy(){}};
  w.Motion={animate:()=>Promise.resolve(),stagger:()=>0};
  if(stored)w.localStorage.setItem('daycraft.v1',JSON.stringify(stored));
  for(const file of ['assets/core.js','assets/app.js','assets/vendor/focus.js','assets/vendor/alpine.js'])w.eval(fs.readFileSync(root+'/'+file,'utf8'));
  await pause(120);
  const app=w.Alpine.$data(w.document.body);
  return{dom,w,app,errors,close:async()=>{app.modal='';await pause(50);w.Alpine.destroyTree(w.document.body);w.Alpine.stopObservingMutations();await pause(60);w.close();}};
}

test('all screens render through real Alpine without expression errors',async()=>{
  const env=await mount();
  try{
    assert.equal(env.app.state.tasks.length,8);
    for(const page of [...env.app.nav.map(n=>n.id),'settings']){
      env.app.navigate(page);await pause(45);
      const node=env.w.document.querySelector('[data-page="'+page+'"]');
      assert.notEqual(node.style.display,'none',page+' should be visible');
    }
    assert.deepEqual(env.errors,[]);
  }finally{await env.close();}
});

test('task CRUD persists, filters, completes, deletes, and restores through undo',async()=>{
  const e=await mount();
  try{
    const a=e.app;
    a.openTask();await pause(30);
    a.draft.title='Ship an intentional product';a.draft.category='Learning';
    a.draft.subtasks.push({id:a.uid(),title:'Validate the flow',done:false});
    a.saveEditor();await pause(45);
    const t=a.state.tasks.find(t=>t.title==='Ship an intentional product');assert.ok(t);
    assert.ok(JSON.parse(e.w.localStorage.getItem('daycraft.v1')).tasks.find(x=>x.id===t.id));
    a.taskSearch='intentional';a.categoryFilter='Learning';assert.equal(a.filteredTasks.length,1);
    a.toggleTask(t);assert.equal(t.status,'done');assert.ok(t.completedAt);
    a.openTask(t);await pause(25);a.draft.title='An even better product';a.saveEditor();
    assert.equal(a.state.tasks.find(x=>x.id===t.id).title,'An even better product');
    a.openTask(a.state.tasks.find(x=>x.id===t.id));await pause(25);a.deleteEditor();
    assert.equal(a.state.tasks.some(x=>x.id===t.id),false);
    const toast=a.toasts.find(x=>x.undo);a.undoAction(toast);
    assert.equal(a.state.tasks.some(x=>x.id===t.id),true);
    assert.deepEqual(e.errors,[]);
  }finally{await e.close();}
});

test('habit check-ins respect schedules and reject future dates',async()=>{
  const e=await mount();
  try{
    const a=e.app,C=e.w.DaycraftCore;
    a.openHabit();await pause(20);a.draft.title='A glass of water';a.saveEditor();
    const h=a.state.habits.find(x=>x.title==='A glass of water');
    a.toggleHabit(h,a.today);assert.equal(h.logs.includes(a.today),true);
    a.toggleHabit(h,a.today);assert.equal(h.logs.includes(a.today),false);
    const tomorrow=C.shiftDate(a.today,1);a.toggleHabit(h,tomorrow);assert.equal(h.logs.includes(tomorrow),false);
    a.openHabit(h);await pause(20);a.draft.schedule=[];a.saveEditor();assert.match(a.formError,/at least one day/);
    a.closeModal();assert.deepEqual(e.errors,[]);
  }finally{await e.close();}
});

test('time-block errors remain editable, month navigation handles boundaries',async()=>{
  const e=await mount();
  try{
    const a=e.app;
    a.openEvent();await pause(20);a.draft.title='Quiet work';a.draft.start='15:00';a.draft.end='14:00';a.saveEditor();
    assert.match(a.formError,/after start/);assert.equal(a.modal,'editor');
    a.draft.end='16:00';a.saveEditor();assert.ok(a.state.events.find(x=>x.title==='Quiet work'));
    a.plannerView='month';a.plannerDate='2026-01-31';a.movePlanner(1);assert.equal(a.plannerDate,'2026-02-01');
    assert.equal(a.monthDays.length,42);assert.equal(a.plannerDays.length,7);
    assert.deepEqual(e.errors,[]);
  }finally{await e.close();}
});

test('focus resumes using a deadline and logs a completed session exactly once',async()=>{
  const e=await mount();
  try{
    const a=e.app;
    a.toggleTimer();assert.equal(a.state.timer.running,true);assert.ok(a.state.timer.endsAt>Date.now());
    a.state.timer.endsAt=Date.now()-1000;
    const before=a.state.sessions.length;
    a.tick();a.tick();assert.equal(a.state.sessions.length,before+1);assert.equal(a.state.timer.running,false);
    assert.equal(a.state.sessions.at(-1).minutes,25);
    assert.equal(a.seconds,0);
    a.resetTimer();a.toggleTimer();a.state.timer.endsAt=Date.now()+60*1000;a.toggleTimer();
    assert.ok(a.state.timer.remaining<=61&&a.state.timer.remaining>=59);
    assert.equal(a.state.timer.running,false);
    a.setTimerMode('short');assert.equal(a.state.timer.duration,300);
    assert.deepEqual(e.errors,[]);
  }finally{await e.close();}
});

test('reload restores user data and an active timer without resetting its clock',async()=>{
  const first=await mount();let data;
  try{first.app.state.settings.name='A fresh workspace';first.app.toggleTimer();first.app.persist(false);data=JSON.parse(first.w.localStorage.getItem('daycraft.v1'));}finally{await first.close();}
  const next=await mount(data);
  try{assert.equal(next.app.state.settings.name,'A fresh workspace');assert.equal(next.app.state.timer.running,true);assert.equal(next.app.state.timer.endsAt,data.timer.endsAt);assert.ok(next.app.seconds<=1500&&next.app.seconds>1490);assert.deepEqual(next.errors,[]);}finally{await next.close();}
});

test('journal switches save the previous page, goals log progress, fresh start clears sample data',async()=>{
  const e=await mount();
  try{
    const a=e.app,C=e.w.DaycraftCore;
    const day=a.journalDate;
    a.journalDraft.text='A very good little day.';a.journalDate=C.shiftDate(day,-1);a.loadJournal();
    assert.equal(a.state.journal[day].text,'A very good little day.');
    a.journalDraft.text='Yesterday was good, too.';a.saveJournal();
    const g=a.state.goals[0],count=g.current;a.advanceGoal(g);assert.equal(g.current,count+1);
    a.confirmAction('fresh');a.executeConfirm();assert.equal(a.state.tasks.length,0);assert.equal(a.state.habits.length,0);assert.equal(a.state.hasSample,false);assert.equal(a.state.settings.name,'Amir');
    await pause(40);assert.deepEqual(e.errors,[]);
  }finally{await e.close();}
});

test('keyboard and command search open real editors; user text renders as text',async()=>{
  const e=await mount();
  try{
    const a=e.app,w=e.w;
    w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));await pause(35);assert.equal(a.modal,'command');
    a.commandQuery='German';await pause(25);assert.ok(a.commandResults.some(x=>x.task));
    a.runCommand(a.commandResults.find(x=>x.task));assert.equal(a.editorType,'task');assert.equal(a.modal,'editor');
    a.closeModal();a.openTask();await pause(20);a.draft.title='<img src=x onerror="window.compromised=true">';a.saveEditor();
    a.navigate('tasks');await pause(35);assert.equal(w.compromised,undefined);assert.equal(w.document.querySelector('img[src="x"]'),null);
    assert.ok(w.document.body.textContent.includes('<img src=x'));
    assert.deepEqual(e.errors,[]);
  }finally{await e.close();}
});
