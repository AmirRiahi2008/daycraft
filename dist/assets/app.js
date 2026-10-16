(function () {
  'use strict';
  const C = window.DaycraftCore;
  const STORAGE_KEY = 'daycraft.v1';
  const charts = new Map();
  const toastTimers = new Map();
  let ticker, themeMedia;
  function loadWorkspace() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { state: C.validate(JSON.parse(raw)), error: '' };
    } catch (error) {
      try { const old = localStorage.getItem(STORAGE_KEY); if (old) localStorage.setItem('daycraft.recovery', old); } catch {}
      return { state: C.seed(), error: 'We couldn’t restore this workspace. A fresh example is ready; a recovery copy was kept when possible.' };
    }
    return { state: C.seed(), error: '' };
  }
  const copy = value => JSON.parse(JSON.stringify(value));
  const fmt = (key, options) => C.validDate(key) ? C.fromDate(key).toLocaleDateString('en-US', options) : '';
  const today = () => C.dateKey();
  function factory() {
    const loaded = loadWorkspace();
    return {
      state: loaded.state, storageError: false, today: today(), page: 'overview', sidebarOpen: false,
      notificationsOpen: false, isDark: false, modal: '', editorType: 'task', draft: {title:'',subtasks:[],schedule:[]}, formError: '',
      toasts: [], taskFilter: 'all', taskView: 'list', taskSearch: '', categoryFilter: 'all',
      statusFilter: 'all', priorityFilter: 'all', taskSort: 'due', dragOver: '', draggingId: '',
      habitWeekOffset: 0, plannerView: 'week', plannerDate: today(), analyticsRange: 7,
      journalDate: today(), activeJournalDate: '', journalDraft: { mood: '', text: '', gratitude: '' }, promptIndex: 0,
      commandQuery: '', commandIndex: 0, seconds: loaded.state.timer.remaining, immersive: false,
      confirmType: '', pendingImport: null,
      nav: [
        { id: 'overview', name: 'Overview', icon: 'grid' },
        { id: 'tasks', name: 'My tasks', icon: 'check-square' },
        { id: 'habits', name: 'Habits', icon: 'leaf' },
        { id: 'planner', name: 'Planner', icon: 'calendar' },
        { id: 'analytics', name: 'Insights', icon: 'chart' },
        { id: 'focus', name: 'Focus room', icon: 'timer' },
        { id: 'journal', name: 'Journal', icon: 'book' },
        { id: 'goals', name: 'Goals', icon: 'target' }
      ],
      columns: [{ id: 'todo', name: 'To do' }, { id: 'in-progress', name: 'In progress' }, { id: 'done', name: 'Completed' }],
      categories: ['Work', 'Personal', 'Learning', 'Wellness'], colors: ['sage', 'peach', 'lavender', 'butter'],
      moods: [{ id: 'great', label: 'Wonderful', face: '😊' }, { id: 'good', label: 'Pretty good', face: '🙂' }, { id: 'okay', label: 'Just okay', face: '😐' }, { id: 'low', label: 'A little low', face: '😔' }, { id: 'rough', label: 'It’s a lot', face: '😣' }],
      journalPrompts: ['What felt like a little win today?', 'What’s one thing you’d like to let go of?', 'When did you feel most like yourself?', 'What’s something small you’re looking forward to?', 'What would make tomorrow feel a little lighter?', 'What are you learning to be patient with?'],

      init() {
        const initialPage = location.hash.slice(1);
        if (this.nav.some(n => n.id === initialPage) || initialPage === 'settings') this.page = initialPage;
        this.applyTheme();
        this.loadJournal();
        this.tick();
        ticker = setInterval(() => this.tick(), 500);
        this.$watch('commandQuery', () => { this.commandIndex = 0; });
        this.$watch('modal', v => { if (v) this.notificationsOpen = false; });
        themeMedia = matchMedia('(prefers-color-scheme: dark)');
        themeMedia.addEventListener?.('change', () => { if (this.state.settings.theme === 'system') this.applyTheme(); });
        window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (p && p !== this.page && [...this.nav.map(n => n.id), 'settings'].includes(p)) this.navigate(p, false); });
        window.addEventListener('beforeunload', () => { this.saveJournal(false); this.persist(false); });
        window.addEventListener('storage', e => {
          if (e.key === STORAGE_KEY && e.newValue) {
            try {
              const newState = C.validate(JSON.parse(e.newValue));
              if (this.modal) { this.notify('Workspace changed in another tab. Finish editing, then reload to see it.'); return; }
              this.state = newState; this.activeJournalDate=''; this.applyTheme(); this.loadJournal(); this.tick(); this.renderCharts();
            } catch { this.notify('A change from another tab could not be loaded.', true); }
          }
        });
        this.persist(false);
        this.$nextTick(() => { this.animatePage(); this.renderCharts(); });
        if (loaded.error) this.notify(loaded.error, true);
      },
      destroy() { clearInterval(ticker); for (const chart of charts.values()) chart.destroy(); charts.clear(); },
      uid: C.id,
      get initials() { return (this.state.settings.name || 'You').trim().split(/\s+/).slice(0,2).map(n => n[0]).join('').toUpperCase(); },
      get pageLabel() { return this.nav.find(n => n.id === this.page)?.name || 'Settings'; },
      get greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; },
      get openTasks() { return this.state.tasks.filter(t => t.status !== 'done'); },
      get todayTasks() { return this.state.tasks.filter(t => t.dueDate === this.today).sort((a,b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.time || '99').localeCompare(b.time || '99')); },
      get todaysHabits() { return this.state.habits.filter(h => C.scheduled(h, this.today)); },
      get todayStats() { return C.dayStats(this.state, this.today); },
      get taskPercent() { return this.todayTasks.length ? Math.round(this.todayTasks.filter(t => t.status === 'done').length / this.todayTasks.length * 100) : 0; },
      get habitPercent() { return this.todayStats.scheduled ? Math.round(this.todayStats.habits / this.todayStats.scheduled * 100) : 0; },
      get bestStreak() { return Math.max(0,...this.state.habits.map(h => C.streak(h, this.today))); },
      get todaySessions() { return this.focusSessions.length; },
      get focusSessions() { return this.state.sessions.filter(s => s.date === this.today && s.mode === 'focus'); },
      get lastSeven() { return Array.from({ length: 7 }, (_,i) => this.day(C.shiftDate(this.today,i-6))); },
      get weekTasks() { return this.lastSeven.reduce((n,d) => n + this.statsFor(d.key).tasks,0); },
      get chartSummary() { return this.lastSeven.map(d => d.name+': '+this.statsFor(d.key).tasks).join('; '); },
      get reminders() {
        const overdue = this.openTasks.filter(t => t.dueDate < this.today).map(t => ({ id:t.id, type:'task', title:t.title, subtitle:'A gentle reminder · overdue', item:t }));
        const due = this.todayTasks.filter(t => t.status !== 'done' && t.priority === 'high').map(t => ({ id:t.id, type:'task', title:t.title, subtitle:'Make a little room · today', item:t }));
        const habits = this.todaysHabits.filter(h => !h.logs.includes(this.today)).slice(0,2).map(h => ({ id:h.id, type:'habit', title:h.title, subtitle:'Your little ritual is waiting', item:h }));
        return [...overdue,...due,...habits].slice(0,6);
      },
      get hasTaskFilters() { return this.taskSearch || this.categoryFilter !== 'all' || this.statusFilter !== 'all' || this.priorityFilter !== 'all' || this.taskFilter !== 'all'; },
      get filteredTasks() {
        const q = this.taskSearch.trim().toLowerCase();
        const rank = { high:0, medium:1, low:2 };
        return this.state.tasks.filter(t => {
          if (q && ![t.title,t.description,t.category].join(' ').toLowerCase().includes(q)) return false;
          if (this.categoryFilter !== 'all' && t.category !== this.categoryFilter) return false;
          if (this.statusFilter !== 'all' && t.status !== this.statusFilter) return false;
          if (this.priorityFilter !== 'all' && t.priority !== this.priorityFilter) return false;
          if (this.taskFilter === 'today' && t.dueDate !== this.today) return false;
          if (this.taskFilter === 'upcoming' && (t.dueDate <= this.today || t.status === 'done')) return false;
          if (this.taskFilter === 'overdue' && (t.dueDate >= this.today || t.status === 'done')) return false;
          return true;
        }).sort((a,b) => {
          if (this.taskSort === 'title') return a.title.localeCompare(b.title);
          if (this.taskSort === 'newest') return b.createdAt.localeCompare(a.createdAt);
          if (this.taskSort === 'priority') return rank[a.priority] - rank[b.priority] || a.dueDate.localeCompare(b.dueDate);
          return Number(a.status === 'done') - Number(b.status === 'done') || a.dueDate.localeCompare(b.dueDate) || (a.time||'99').localeCompare(b.time||'99');
        });
      },
      get habitWeekDays() { return this.weekDays(C.shiftDate(this.today,this.habitWeekOffset*7)); },
      get plannerDays() { return this.weekDays(this.plannerDate); },
      get weekNames() { return this.weekDays(this.today).map(d => d.name); },
      get plannerLabel() { return this.plannerView === 'day' ? fmt(this.plannerDate,{month:'long',day:'numeric'}) : fmt(this.plannerDate,{month:'long',year:'numeric'}); },
      get monthDays() {
        const d = C.fromDate(this.plannerDate); d.setDate(1);
        const first = C.dateKey(d), start = this.weekDays(first)[0].key;
        return Array.from({length:42},(_,i) => { const key = C.shiftDate(start,i); return {...this.day(key),inMonth:key.slice(0,7)===first.slice(0,7)}; });
      },
      get heatmapDays() {
        return Array.from({length:84},(_,i) => { const key=C.shiftDate(this.today,i-83), s=this.statsFor(key); return {key,completed:s.habits,level:s.scheduled?Math.ceil(s.habits/s.scheduled*4):0}; });
      },
      get rangeDays() { return Array.from({length:this.analyticsRange},(_,i) => this.day(C.shiftDate(this.today,i-this.analyticsRange+1))); },
      get rangeTotals() { return this.rangeDays.reduce((n,d) => { const s=this.statsFor(d.key); return {tasks:n.tasks+s.tasks,focus:n.focus+s.focus,habits:n.habits+s.habits,scheduled:n.scheduled+s.scheduled}; },{tasks:0,focus:0,habits:0,scheduled:0}); },
      get completedInRange() { const start=C.shiftDate(this.today,1-this.analyticsRange); return this.state.tasks.filter(t=>t.status==='done'&&t.completedAt&&C.dateKey(new Date(t.completedAt))>=start&&C.dateKey(new Date(t.completedAt))<=this.today); },
      get categoryTotals() {
        const start=C.shiftDate(this.today,1-this.analyticsRange),totals={Work:0,Personal:0,Learning:0,Wellness:0};
        for(const task of this.completedInRange)totals[task.category]++;
        for(const day of this.state.history)if(day.date>=start&&day.date<=this.today)for(const category of this.categories)totals[category]+=day.categories?.[category]||0;
        return totals;
      },
      get balanceTotal() { return Object.values(this.categoryTotals).reduce((n,v)=>n+v,0); },
      get analyticsStats() {
        const s=this.rangeTotals, f=this.focusDisplay(s.focus);
        return [
          {label:'Intentions completed',value:s.tasks,unit:'tasks',hint:'One good thing after another',icon:'check-square',color:'sage'},
          {label:'Time well spent',value:f.number,unit:f.unit,hint:'A little less distraction',icon:'timer',color:'lavender'},
          {label:'Ritual consistency',value:s.scheduled?Math.round(s.habits/s.scheduled*100):0,unit:'%',hint:s.habits+' of '+s.scheduled+' scheduled check-ins',icon:'leaf',color:'peach'},
          {label:'Longest current streak',value:this.bestStreak,unit:'days',hint:'A quiet kind of commitment',icon:'fire',color:'butter'}
        ];
      },
      get analyticsText() { return this.rangeDays.map(d=>{const s=this.statsFor(d.key);return d.key+': '+s.tasks+' tasks, '+s.focus+' focused minutes';}).join('; '); },
      get balanceText() { return this.categories.map(c=>c+': '+this.categoryTotals[c]).join('; '); },
      get insightTitle() { return this.bestStreak >= 7 ? 'You’re building something that lasts.' : this.rangeTotals.tasks ? 'Look at all those little steps.' : 'Every story starts somewhere.'; },
      get insightCopy() { return this.bestStreak >= 7 ? 'Your longest current ritual streak is '+this.bestStreak+' days. It’s the small, repeated choices that quietly change everything.' : this.rangeTotals.tasks ? 'You completed '+this.rangeTotals.tasks+' tasks in the last '+this.analyticsRange+' days. Progress doesn’t have to be loud to be real.' : 'There’s no perfect day to begin. Complete a task or check in to a habit, and let your progress grow from there.'; },
      get timerText() { const n=Math.max(0,Math.ceil(this.seconds)); return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'); },
      get timerProgress() { return this.state.timer.duration ? Math.max(0,Math.min(1,this.seconds/this.state.timer.duration)) : 1; },
      get editorLabel() { return (this.draft.id?'Edit your ':'A new ')+({task:'task',habit:'ritual',event:'time block',goal:'goal'}[this.editorType]||'intention'); },
      get eventConflicts() { return this.editorType==='event' && C.validTime(this.draft.start) && C.validTime(this.draft.end) ? this.state.events.filter(e=>C.overlaps(this.draft,e)) : []; },
      get journalEntries() { return Object.entries(this.state.journal).filter(([,v])=>v.mood||v.text||v.gratitude).map(([date,v])=>({date,...v})).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8); },
      get commandResults() {
        const q=this.commandQuery.toLowerCase().trim();
        const actions=[
          {key:'new-task',title:'Create a task',subtitle:'Give an idea a little intention',icon:'plus',action:'task'},
          {key:'new-habit',title:'Start a new habit',subtitle:'Make a little room to grow',icon:'leaf',action:'habit'},
          {key:'new-block',title:'Add a time block',subtitle:'Make room for what matters',icon:'calendar',action:'event'},
          ...this.nav.map(n=>({key:'page-'+n.id,title:n.name,subtitle:'Your personal workspace',icon:n.icon,page:n.id})),
          {key:'page-settings',title:'Settings',subtitle:'Make yourself at home',icon:'settings',page:'settings'}
        ];
        if(!q) return actions.slice(0,12);
        return [...actions.filter(a=>(a.title+' '+a.subtitle).toLowerCase().includes(q)),...this.state.tasks.filter(t=>(t.title+' '+t.description).toLowerCase().includes(q)).slice(0,8).map(t=>({key:'task-'+t.id,title:t.title,subtitle:t.category+' · '+this.relativeDate(t.dueDate),icon:'check-square',task:t})),...this.state.habits.filter(h=>h.title.toLowerCase().includes(q)).slice(0,5).map(h=>({key:'habit-'+h.id,title:h.title,subtitle:'Habit · '+C.streak(h,this.today)+' day streak',icon:h.icon,habit:h}))].slice(0,15);
      },

      day(key) { const date=C.fromDate(key); return {key,number:date.getDate(),letter:date.toLocaleDateString('en-US',{weekday:'short'})[0],name:date.toLocaleDateString('en-US',{weekday:'short'})}; },
      weekDays(key) { const date=C.fromDate(key), offset=(date.getDay()-Number(this.state.settings.weekStart)+7)%7; return Array.from({length:7},(_,i)=>this.day(C.shiftDate(key,i-offset))); },
      weekLabel(days) { return fmt(days[0].key,{month:'short',day:'numeric'})+' – '+fmt(days[6].key,{month:'short',day:'numeric'}); },
      shortDate(key) { return fmt(key,{month:'short',day:'numeric'}); },
      longDate(key) { return fmt(key,{weekday:'long',month:'long',day:'numeric',year:'numeric'}); },
      relativeDate(key) { return key===this.today?'Today':key===C.shiftDate(this.today,1)?'Tomorrow':key===C.shiftDate(this.today,-1)?'Yesterday':this.shortDate(key); },
      formatTime(time) { if(!C.validTime(time)) return '';const [h,m]=time.split(':').map(Number);return (h%12||12)+':'+String(m).padStart(2,'0')+(h<12?' am':' pm'); },
      categoryClass(cat) { return {Work:'sage',Personal:'peach',Learning:'lavender',Wellness:'butter'}[cat]||'sage'; },
      statusName(status) { return this.columns.find(c=>c.id===status)?.name||'To do'; },
      focusDisplay(n) { return n>=60?{number:Number((n/60).toFixed(1)),unit:'hrs'}:{number:n,unit:'min'}; },
      statsFor(key) { return C.dayStats(this.state,key); },
      dayActive(key) { const s=this.statsFor(key);return !!(s.tasks||s.habits||s.focus); },
      isScheduled(h,key) { return C.scheduled(h,key); },
      habitStreak(h) { return C.streak(h,this.today); },
      habitRate(h) { const keys=Array.from({length:30},(_,i)=>C.shiftDate(this.today,i-29)).filter(key=>C.scheduled(h,key));return keys.length?Math.round(keys.filter(k=>h.logs.includes(k)).length/keys.length*100):0; },
      moodFace(id) { return this.moods.find(m=>m.id===id)?.face||'✧'; },
      navigate(page, updateHash=true) {
        if(![...this.nav.map(n=>n.id),'settings'].includes(page)) return;
        if(this.page==='journal') this.saveJournal(false);
        this.page=page; this.sidebarOpen=false; this.notificationsOpen=false; this.immersive=false;
        if(updateHash) history.replaceState(null,'','#'+page);
        document.title='Daycraft — '+this.pageLabel;
        window.scrollTo({top:0,behavior:'instant'});
        this.$nextTick(()=>{this.animatePage();this.renderCharts();});
      },
      reduced() { return this.state.settings.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches; },
      animatePage() {
        if(this.reduced()||!window.Motion) return;
        const page=document.querySelector('[data-page="'+this.page+'"]');
        if(!page) return;
        const els=page.querySelectorAll('.reveal');
        if(els.length) Motion.animate(els,{opacity:[0,1],y:[14,0]},{duration:.45,delay:Motion.stagger(.045),ease:[.2,.7,.2,1]});
        else Motion.animate(page,{opacity:[.35,1],y:[8,0]},{duration:.3,ease:'easeOut'});
      },
      applyTheme() {
        this.isDark=this.state.settings.theme==='dark'||(this.state.settings.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.dataset.theme=this.isDark?'dark':'light';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content',this.isDark?'#121c18':'#f7f8f4');
        this.$nextTick(()=>this.renderCharts());
      },
      toggleTheme() { this.state.settings.theme=this.isDark?'light':'dark';this.applyTheme();this.persist(false); },
      persist(chartsToo=true) {
        try { localStorage.setItem(STORAGE_KEY,JSON.stringify(this.state));this.storageError=false; }
        catch { this.storageError=true; }
        if(chartsToo) this.$nextTick(()=>this.renderCharts());
      },
      notify(message,error=false,undo=null) {
        const toast={id:C.id(),message,error,undo};this.toasts.push(toast);
        if(this.toasts.length>3) this.dismissToast(this.toasts[0].id);
        toastTimers.set(toast.id,setTimeout(()=>this.dismissToast(toast.id),undo?10000:6500));
      },
      dismissToast(id) { clearTimeout(toastTimers.get(id));toastTimers.delete(id);this.toasts=this.toasts.filter(t=>t.id!==id); },
      undoAction(toast) {
        if(toast.undo){const {collection,item,index}=toast.undo;if(!this.state[collection].some(i=>i.id===item.id)){this.state[collection].splice(Math.min(index,this.state[collection].length),0,item);this.persist();}}
        this.dismissToast(toast.id);this.notify('Right back where it belongs.');
      },
      celebrate(big=false) {
        if(this.reduced()||!window.Motion||!this.$refs.confetti) return;
        const container=this.$refs.confetti;
        for(let i=0;i<(big?38:17);i++){
          const el=document.createElement('i');el.className='confetti-piece';el.style.background=['#aac28a','#dfb097','#beb0d8','#ddca89'][i%4];container.appendChild(el);
          const animation=Motion.animate(el,{x:[0,(Math.random()-.5)*(big?750:420)],y:[0,-80-Math.random()*100,300+Math.random()*250],rotate:[0,(Math.random()-.5)*750],opacity:[1,1,0],scale:[.5,1,.5]},{duration:1.3+Math.random()*.5,ease:'easeOut'});
          Promise.resolve(animation).finally(()=>el.remove());
        }
      },
      clearTaskFilters() { this.taskSearch='';this.taskFilter='all';this.categoryFilter='all';this.statusFilter='all';this.priorityFilter='all'; },
      toggleTask(task) { this.setTaskStatus(task,task.status==='done'?'todo':'done'); },
      setTaskStatus(task,status) {
        if(!['todo','in-progress','done'].includes(status)||task.status===status)return;
        task.status=status;task.completedAt=status==='done'?new Date().toISOString():null;
        if(status==='done'){this.celebrate();this.notify(this.todayStats.tasks>=this.state.settings.dailyTarget?'Daily intention reached. Look at you go.':'One less thing. A little more breathing room.');}
        this.persist();
      },
      startDrag(task,event) { this.draggingId=task.id;event.dataTransfer.setData('text/plain',task.id);event.dataTransfer.effectAllowed='move'; },
      dropTask(status,event) { const id=event.dataTransfer?.getData('text/plain')||this.draggingId;const t=this.state.tasks.find(t=>t.id===id);if(t)this.setTaskStatus(t,status);this.dragOver='';this.draggingId=''; },
      openTask(task=null,status='todo',date=this.today) {
        this.editorType='task';this.draft=task?copy(task):{id:'',title:'',description:'',category:'Work',priority:'medium',status,dueDate:date,time:'',estimate:30,subtasks:[]};this.openEditor();
      },
      openHabit(habit=null) {
        this.editorType='habit';this.draft=habit?copy(habit):{id:'',title:'',description:'',icon:'sun',color:'sage',schedule:[0,1,2,3,4,5,6],logs:[],createdAt:this.today};this.openEditor();
      },
      openEvent(event=null,date=this.plannerDate) {
        this.editorType='event';this.draft=event?copy(event):{id:'',title:'',date,start:'09:00',end:'10:00',category:'Work',notes:''};this.openEditor();
      },
      openGoal(goal=null) {
        this.editorType='goal';this.draft=goal?copy(goal):{id:'',title:'',current:0,target:10,unit:'steps',color:'sage',dueDate:C.shiftDate(this.today,30)};this.openEditor();
      },
      openEditor() { this.formError='';this.modal='editor';this.$nextTick(()=>this.$refs.editorTitle?.focus()); },
      closeModal() { this.modal='';this.formError='';this.pendingImport=null; },
      toggleSchedule(day) { if(this.draft.schedule.includes(day))this.draft.schedule=this.draft.schedule.filter(d=>d!==day);else this.draft.schedule.push(day); },
      saveEditor() {
        const d=copy(this.draft), edited=!!d.id;
        d.title=d.title.trim();
        if(!d.title){this.formError='Give your intention a little name.';return;}
        if(d.title.length>200){this.formError='Keep the title within 200 characters.';return;}
        const collection={task:'tasks',habit:'habits',event:'events',goal:'goals'}[this.editorType];
        if(this.editorType==='task'){
          if(!C.validDate(d.dueDate)){this.formError='Choose a valid due date.';return;}
          if(d.time&&!C.validTime(d.time)){this.formError='Choose a valid time.';return;}
          if(!Number.isFinite(Number(d.estimate))||d.estimate<5||d.estimate>480){this.formError='Choose an estimate between 5 and 480 minutes.';return;}
          d.subtasks=d.subtasks.filter(s=>s.title.trim()).map(s=>({...s,title:s.title.trim()}));
          d.createdAt=d.createdAt||new Date().toISOString();
          const previous=this.state.tasks.find(t=>t.id===d.id);
          d.completedAt=d.status==='done'?(previous?.completedAt||new Date().toISOString()):null;
          if(d.status==='done'&&previous?.status!=='done')this.celebrate();
        }
        if(this.editorType==='habit'&&!d.schedule.length){this.formError='Choose at least one day for your ritual.';return;}
        if(this.editorType==='event'){
          if(!C.validDate(d.date)||!C.validTime(d.start)||!C.validTime(d.end)){this.formError='Choose a valid date, start time, and end time.';return;}
          if(d.end<=d.start){this.formError='End time should be after start time. Split overnight plans into two blocks.';return;}
        }
        if(this.editorType==='goal'){
          if(!Number.isInteger(Number(d.target))||d.target<1||d.target>1000000||!Number.isInteger(Number(d.current))||d.current<0||d.current>1000000){this.formError='Use whole numbers from 0 to 1,000,000, with a target of at least 1.';return;}
          if(!C.validDate(d.dueDate)||!d.unit.trim()){this.formError='Choose a date and a way to measure your progress.';return;}
          d.unit=d.unit.trim();
        }
        const index=this.state[collection].findIndex(x=>x.id===d.id);d.id=d.id||C.id();
        if(index>=0)this.state[collection].splice(index,1,d);else this.state[collection].push(d);
        this.persist();this.closeModal();this.notify(edited?'A little refinement, all saved.':this.editorType==='habit'?'Your new ritual is ready to grow.':'A little intention, made real.');
      },
      deleteEditor() {
        const collection={task:'tasks',habit:'habits',event:'events',goal:'goals'}[this.editorType];
        const index=this.state[collection].findIndex(x=>x.id===this.draft.id);
        if(index<0)return;
        const item=copy(this.state[collection][index]);this.state[collection].splice(index,1);
        this.closeModal();this.persist();this.notify('A little more room.',false,{collection,item,index});
      },
      toggleHabit(habit,key) {
        if(key>this.today||!C.scheduled(habit,key))return;
        const i=habit.logs.indexOf(key);if(i>=0)habit.logs.splice(i,1);else{habit.logs.push(key);if(key===this.today){this.celebrate(this.habitPercent===100);this.notify(this.habitPercent===100?'Every ritual, nurtured. A lovely little victory.':'Another little vote for your future self.');}}
        this.persist();
      },
      itemsForDay(key) {
        return [
          ...this.state.events.filter(e=>e.date===key).map(e=>({key:'e-'+e.id,type:'event',title:e.title,time:e.start,category:e.category,raw:e})),
          ...this.state.tasks.filter(t=>t.dueDate===key).map(t=>({key:'t-'+t.id,type:'task',title:t.title,time:t.time,category:t.category,raw:t}))
        ].sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
      },
      movePlanner(direction) {
        if(this.plannerView==='month'){const date=C.fromDate(this.plannerDate);date.setDate(1);date.setMonth(date.getMonth()+direction);this.plannerDate=C.dateKey(date);}
        else this.plannerDate=C.shiftDate(this.plannerDate,direction*(this.plannerView==='week'?7:1));
      },
      advanceGoal(goal) { if(goal.current>=goal.target)return;goal.current++;if(goal.current>=goal.target){this.celebrate(true);this.notify('You made it happen. Take a moment to celebrate.');}else this.notify('One little step closer.');this.persist(false); },
      loadJournal() {
        if(this.activeJournalDate && this.activeJournalDate!==this.journalDate){this.state.journal[this.activeJournalDate]=copy(this.journalDraft);this.persist(false);}
        if(!C.validDate(this.journalDate)||this.journalDate>this.today)this.journalDate=this.today;
        this.journalDraft=copy(this.state.journal[this.journalDate]||{mood:'',text:'',gratitude:''});
        this.activeJournalDate=this.journalDate;
      },
      saveJournal(save=true) {
        if(!C.validDate(this.journalDate)||this.journalDate>this.today)return;
        this.state.journal[this.journalDate]={mood:this.journalDraft.mood,text:this.journalDraft.text,gratitude:this.journalDraft.gratitude};
        if(save)this.persist(false);
      },
      timerDuration(mode) { return Number(mode==='focus'?this.state.settings.focusMinutes:mode==='short'?this.state.settings.shortBreak:this.state.settings.longBreak)*60; },
      updateTimerSettings() {
        for(const [key,max] of [['focusMinutes',120],['shortBreak',30],['longBreak',60]])this.state.settings[key]=Math.round(C.clamp(this.state.settings[key],1,max));
        if(!this.state.timer.running&&this.seconds===this.state.timer.duration){this.state.timer.duration=this.timerDuration(this.state.timer.mode);this.state.timer.remaining=this.state.timer.duration;this.seconds=this.state.timer.duration;}
        this.persist(false);
      },
      tick() {
        const day=today();if(day!==this.today){this.saveJournal(false);this.today=day;this.journalDate=day;this.loadJournal();this.renderCharts();}
        const timer=this.state.timer;
        if(timer.running){this.seconds=Math.max(0,Math.ceil((timer.endsAt-Date.now())/1000));if(this.seconds===0)this.completeTimer();}
        else this.seconds=timer.remaining;
      },
      toggleTimer() {
        const timer=this.state.timer;
        if(timer.running&&timer.endsAt<=Date.now()){this.completeTimer();return;}
        if(timer.running){timer.remaining=Math.max(0,Math.ceil((timer.endsAt-Date.now())/1000));timer.running=false;timer.endsAt=null;this.seconds=timer.remaining;}
        else {if(timer.remaining<=0){timer.duration=this.timerDuration(timer.mode);timer.remaining=timer.duration;}timer.endsAt=Date.now()+timer.remaining*1000;timer.running=true;}
        this.persist(false);
      },
      resetTimer() { const t=this.state.timer;t.running=false;t.endsAt=null;t.duration=this.timerDuration(t.mode);t.remaining=t.duration;this.seconds=t.remaining;this.persist(false); },
      setTimerMode(mode) {
        if(this.state.timer.mode===mode)return;
        this.state.timer.mode=mode;this.resetTimer();
        this.notify(mode==='focus'?'A fresh space for your attention.':'A little room to recharge.');
      },
      completeTimer() {
        const t=this.state.timer;if(!t.running)return;
        const minutes=Math.round(t.duration/60), date=C.dateKey(new Date(t.endsAt));
        t.running=false;t.endsAt=null;t.remaining=0;this.seconds=0;
        if(t.mode==='focus'){this.state.sessions.push({id:C.id(),date,minutes,mode:'focus',taskId:t.taskId});this.celebrate(true);this.notify('A focused little victory. Take a well-earned break.');}
        else this.notify('A little recharged. Ready for your next good thing?');
        this.persist();
      },
      finishTimerEarly() {
        const t=this.state.timer;
        const remaining=t.running?Math.max(0,Math.ceil((t.endsAt-Date.now())/1000)):t.remaining;
        const minutes=Math.floor((t.duration-remaining)/60);
        if(minutes<1){this.notify('Give yourself at least one focused minute before logging a session.');return;}
        if(t.mode==='focus'){this.state.sessions.push({id:C.id(),date:this.today,minutes,mode:'focus',taskId:t.taskId});this.celebrate();}
        this.resetTimer();this.persist();this.notify(minutes+' minutes, intentionally spent. Nicely done.');
      },
      sessionTaskName(session) { return this.state.tasks.find(t=>t.id===session.taskId)?.title||'A little undivided attention'; },

      renderCharts() {
        if(!window.Chart)return;
        requestAnimationFrame(()=>{
          const color=getComputedStyle(document.documentElement), muted=color.getPropertyValue('--muted').trim(), border=color.getPropertyValue('--border').trim(), line=color.getPropertyValue('--chart').trim();
          const common={responsive:true,maintainAspectRatio:false,animation:this.reduced()?false:{duration:650},plugins:{legend:{display:false},tooltip:{backgroundColor:this.isDark?'#d6e3c6':'#2b4734',titleColor:this.isDark?'#243728':'#fff',bodyColor:this.isDark?'#243728':'#fff',padding:11,cornerRadius:7,titleFont:{family:'DM Sans',size:10},bodyFont:{family:'DM Sans',size:10},displayColors:false}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:muted,font:{family:'DM Sans',size:9},maxRotation:0,maxTicksLimit:8}},y:{beginAtZero:true,border:{display:false},grid:{color:border,drawTicks:false},ticks:{color:muted,font:{family:'DM Sans',size:8},padding:9,precision:0,maxTicksLimit:5}}}};
          const make=(id,config)=>{const canvas=document.getElementById(id);if(!canvas)return;if(charts.has(id)){charts.get(id).destroy();charts.delete(id);}charts.set(id,new Chart(canvas,config));};
          if(this.page==='overview')make('overviewChart',{type:'line',data:{labels:this.lastSeven.map(d=>d.name),datasets:[{data:this.lastSeven.map(d=>this.statsFor(d.key).tasks),borderColor:line,backgroundColor:color.getPropertyValue('--chart-fill').trim(),fill:true,tension:.4,borderWidth:2,pointRadius:3,pointBackgroundColor:color.getPropertyValue('--surface').trim(),pointBorderColor:line,pointBorderWidth:2,pointHoverRadius:5}]},options:common});
          if(this.page==='analytics'){
            make('analyticsChart',{type:'bar',data:{labels:this.rangeDays.map(d=>fmt(d.key,{month:'short',day:'numeric'})),datasets:[{label:'Tasks completed',data:this.rangeDays.map(d=>this.statsFor(d.key).tasks),backgroundColor:this.isDark?'#9fbd7e':'#a7be8e',borderRadius:4,maxBarThickness:22,yAxisID:'y'},{type:'line',label:'Focused minutes',data:this.rangeDays.map(d=>this.statsFor(d.key).focus),borderColor:'#b5a3d0',backgroundColor:'#b5a3d0',borderWidth:2,pointRadius:2,tension:.35,yAxisID:'focus'}]},options:{...common,interaction:{mode:'index',intersect:false},plugins:{...common.plugins,tooltip:{...common.plugins.tooltip,displayColors:true}},scales:{...common.scales,focus:{position:'right',beginAtZero:true,border:{display:false},grid:{display:false},ticks:{color:'#a69bb8',font:{family:'DM Sans',size:8},maxTicksLimit:5,callback:v=>v+'m'}}}}});
            const counts=this.categories.map(c=>this.categoryTotals[c]), hasData=counts.some(Boolean);
            make('balanceChart',{type:'doughnut',data:{labels:hasData?this.categories:['Your progress begins here'],datasets:[{data:hasData?counts:[1],backgroundColor:hasData?['#a6bd8b','#d7ae97','#b9acd4','#dbcd91']:[border],borderWidth:0,hoverOffset:3,spacing:hasData?4:0,borderRadius:hasData?5:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'81%',animation:this.reduced()?false:{duration:600},plugins:{legend:{display:false},tooltip:{...common.plugins.tooltip,enabled:hasData}}}});
          }
        });
      },
      openCommand() { this.commandQuery='';this.commandIndex=0;this.modal='command';this.$nextTick(()=>this.$refs.commandInput?.focus()); },
      openHelp() { this.sidebarOpen=false;this.modal='help'; },
      runCommand(result) { if(!result)return;this.closeModal();if(result.page)this.navigate(result.page);else if(result.task)this.openTask(result.task);else if(result.habit)this.openHabit(result.habit);else if(result.action==='task')this.openTask();else if(result.action==='habit')this.openHabit();else this.openEvent(); },
      onKey(event) {
        if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();this.modal==='command'?this.closeModal():this.openCommand();return;}
        if(event.key==='Escape'){this.closeModal();this.sidebarOpen=false;this.notificationsOpen=false;if(this.immersive)this.immersive=false;return;}
        if(event.metaKey||event.ctrlKey||event.altKey||this.modal||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.target.isContentEditable)return;
        if(event.key.toLowerCase()==='n'){event.preventDefault();this.openTask();}
        if(event.key.toLowerCase()==='h'){event.preventDefault();this.openHabit();}
        if(event.key.toLowerCase()==='f'){event.preventDefault();this.navigate('focus');}
        if(event.key.toLowerCase()==='d'){event.preventDefault();this.toggleTheme();}
        if(event.key==='?'){event.preventDefault();this.openHelp();}
      },
      download(filename,contents,type) { const blob=new Blob([contents],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); },
      exportBackup() { this.saveJournal(false);this.download('daycraft-backup-'+this.today+'.json',JSON.stringify(this.state,null,2),'application/json');this.notify('Your little world, safely backed up.'); },
      async prepareImport(event) {
        const file=event.target.files[0];event.target.value='';if(!file)return;
        if(file.size>5*1024*1024){this.notify('Choose a Daycraft backup smaller than 5 MB.',true);return;}
        try{const validated=C.validate(JSON.parse(await file.text()));this.pendingImport=validated;this.confirmType='import';this.modal='confirm';}
        catch(error){this.notify(error.message==='Unexpected end of JSON input'?'This file is incomplete. Try another Daycraft backup.':error.message.startsWith('Choose')||error.message.startsWith('A ')||error.message.startsWith('The ')?error.message:'This isn’t a valid Daycraft backup. Choose an exported JSON file.',true);}
      },
      confirmAction(type) { this.confirmType=type;this.modal='confirm'; },
      executeConfirm() {
        if(this.confirmType==='import'&&this.pendingImport){this.state=this.pendingImport;this.pendingImport=null;this.seconds=this.state.timer.remaining;this.notify('Welcome back to your little world.');}
        else if(this.confirmType==='fresh'){const preferences=copy(this.state.settings);this.state=C.blank();this.state.settings=preferences;this.resetTimer();this.notify('A clean slate. A world of possibility.');}
        else return;
        this.modal='';this.today=today();this.activeJournalDate='';this.journalDate=this.today;this.loadJournal();this.applyTheme();this.tick();this.persist();this.navigate('overview');
      },
      exportCsv() {
        const rows=[['Date','Tasks completed','Habits completed','Habits scheduled','Focus minutes'],...this.rangeDays.map(d=>{const s=this.statsFor(d.key);return[d.key,s.tasks,s.habits,s.scheduled,s.focus];})];
        this.download('daycraft-progress-'+this.today+'.csv',rows.map(row=>row.join(',')).join('\r\n'),'text/csv;charset=utf-8');this.notify('A little perspective, ready to take with you.');
      }
    };
  }
  window.DaycraftFactory=factory;
  document.addEventListener('alpine:init',()=>Alpine.data('daycraft',factory));
})();
