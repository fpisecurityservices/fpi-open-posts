import { useState, useEffect, useMemo } from "react";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const POST_TYPES = ["Unarmed Guard","Armed Guard","Virtual SOC","Gate Attendant","Rover","Supervisor"];
const PRIORITIES = ["Critical","High","Normal"];
const DEFAULT_SCHEDULE = DAYS.map(d => ({ day:d, active:false, start:"06:00", end:"18:00" }));
const BLANK = { client:"", location:"", type:POST_TYPES[0], priority:"Normal", openedDate:new Date().toISOString().slice(0,10), notes:"", schedule:DEFAULT_SCHEDULE.map(s=>({...s})) };

// ─── API ────────────────────────────────────────
async function api(path, method="GET", body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type":"application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── UTILS ──────────────────────────────────────
function daysSince(d) { return d ? Math.floor((new Date()-new Date(d))/86400000) : 0; }
function urgencyColor(days,pri) {
  if(pri==="Critical"||days>45) return "#ef4444";
  if(pri==="High"||days>21) return "#f59e0b";
  return "#22c55e";
}
function calcHours(sched) {
  return (sched||[]).filter(s=>s.active).reduce((sum,s)=>{
    const [sh,sm]=s.start.split(":").map(Number);
    const [eh,em]=s.end.split(":").map(Number);
    let mins=(eh*60+em)-(sh*60+sm);
    if(mins<=0) mins+=1440;
    return sum+mins/60;
  },0);
}
function fmt12(t) {
  if(!t) return "";
  const [h,m]=t.split(":").map(Number);
  return `${h%12||12}:${String(m).padStart(2,"0")}${h>=12?"PM":"AM"}`;
}
function parsePost(row) {
  return {
    ...row,
    schedule: typeof row.schedule === "string" ? JSON.parse(row.schedule) : (row.schedule || DEFAULT_SCHEDULE),
    openedDate: row.opened_date || row.openedDate || "",
    filledDate: row.filled_date || row.filledDate || "",
    filledBy:   row.filled_by  || row.filledBy  || "",
  };
}

// ─── UI COMPONENTS ──────────────────────────────
function Badge({label,color}) {
  return <span style={{display:"inline-block",padding:"2px 10px",borderRadius:4,fontSize:11,fontWeight:700,letterSpacing:"0.06em",background:color+"22",color,border:`1px solid ${color}55`,fontFamily:"'Courier New',monospace",textTransform:"uppercase"}}>{label}</span>;
}
function StatCard({label,value,sub,accent}) {
  return (
    <div style={{background:"#0f1923",border:"1px solid #1e3a5f",borderRadius:8,padding:"20px 24px",display:"flex",flexDirection:"column",gap:4,borderTop:`3px solid ${accent||"#1e6fb8"}`}}>
      <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Courier New',monospace"}}>{label}</div>
      <div style={{fontSize:36,fontWeight:800,color:accent||"#e2e8f0",lineHeight:1,fontFamily:"'Bebas Neue','Arial Narrow',sans-serif",letterSpacing:"0.02em"}}>{value}</div>
      {sub&&<div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{sub}</div>}
    </div>
  );
}
function Modal({open,onClose,children,wide}) {
  if(!open) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#0d1821",border:"1px solid #1e3a5f",borderRadius:12,padding:32,width:"100%",maxWidth:wide?720:520,maxHeight:"92vh",overflowY:"auto"}}>
        {children}
      </div>
    </div>
  );
}
function Inp({label,...props}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {label&&<label style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Courier New',monospace"}}>{label}</label>}
      <input {...props} style={{background:"#0f1923",border:"1px solid #1e3a5f",borderRadius:6,padding:"9px 12px",color:"#e2e8f0",fontSize:14,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box",...(props.style||{})}}/>
    </div>
  );
}
function Sel({label,children,...props}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {label&&<label style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Courier New',monospace"}}>{label}</label>}
      <select {...props} style={{background:"#0f1923",border:"1px solid #1e3a5f",borderRadius:6,padding:"9px 12px",color:"#e2e8f0",fontSize:14,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"}}>{children}</select>
    </div>
  );
}
function Spinner() {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 0",gap:16}}>
      <div style={{width:32,height:32,border:"3px solid #1e3a5f",borderTopColor:"#1e6fb8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <div style={{fontSize:13,color:"#475569",fontFamily:"'Courier New',monospace",letterSpacing:"0.08em"}}>LOADING POSTS...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
function ErrorBanner({msg,onRetry}) {
  return (
    <div style={{background:"#1f0a0a",border:"1px solid #7f1d1d",borderRadius:8,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
      <div>
        <div style={{fontSize:13,color:"#ef4444",fontWeight:600}}>Connection Error</div>
        <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{msg}</div>
      </div>
      <button onClick={onRetry} style={{background:"transparent",border:"1px solid #7f1d1d",color:"#ef4444",borderRadius:5,padding:"6px 14px",cursor:"pointer",fontSize:12,fontFamily:"'Courier New',monospace"}}>RETRY</button>
    </div>
  );
}
function ScheduleBuilder({schedule,onChange}) {
  const toggle=i=>{const s=[...schedule];s[i]={...s[i],active:!s[i].active};onChange(s);};
  const setTime=(i,field,val)=>{const s=[...schedule];s[i]={...s[i],[field]:val};onChange(s);};
  return (
    <div>
      <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Courier New',monospace",marginBottom:10}}>Weekly Schedule</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {schedule.map((s,i)=>(
          <div key={s.day} style={{display:"grid",gridTemplateColumns:"58px 1fr",gap:10,alignItems:"center",opacity:s.active?1:0.45}}>
            <button onClick={()=>toggle(i)} style={{background:s.active?"#1e3a5f":"#0a1520",border:`1px solid ${s.active?"#1e6fb8":"#1e3a5f"}`,color:s.active?"#60a5fa":"#475569",borderRadius:5,padding:"5px 0",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Courier New',monospace",textTransform:"uppercase"}}>{s.day}</button>
            {s.active?(
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input type="time" value={s.start} onChange={e=>setTime(i,"start",e.target.value)} style={{background:"#0f1923",border:"1px solid #1e3a5f",borderRadius:5,padding:"5px 8px",color:"#e2e8f0",fontSize:13,outline:"none",flex:1}}/>
                <span style={{color:"#475569",fontSize:11}}>→</span>
                <input type="time" value={s.end} onChange={e=>setTime(i,"end",e.target.value)} style={{background:"#0f1923",border:"1px solid #1e3a5f",borderRadius:5,padding:"5px 8px",color:"#e2e8f0",fontSize:13,outline:"none",flex:1}}/>
                <span style={{color:"#475569",fontSize:11,fontFamily:"'Courier New',monospace",minWidth:36,textAlign:"right"}}>{calcHours([s]).toFixed(1)}h</span>
              </div>
            ):(
              <div style={{fontSize:12,color:"#334155",fontFamily:"'Courier New',monospace",paddingLeft:4}}>— Off</div>
            )}
          </div>
        ))}
      </div>
      <div style={{marginTop:10,fontSize:13,color:"#a855f7",fontFamily:"'Courier New',monospace",textAlign:"right",fontWeight:700}}>{calcHours(schedule).toFixed(1)} hrs / week</div>
    </div>
  );
}
function ShiftCell({s}) {
  if(!s||!s.active) return <div style={{background:"#080f18",height:"100%",minHeight:52,borderRadius:4}}/>;
  const isNight=parseInt(s.start)>=18||parseInt(s.end)<=8;
  const bg=isNight?"#160f40":"#0a1e40";
  const accent=isNight?"#818cf8":"#38bdf8";
  return (
    <div style={{background:bg,border:`1px solid ${accent}33`,borderRadius:4,padding:"6px 8px",minHeight:52,display:"flex",flexDirection:"column",justifyContent:"center",gap:2}}>
      <div style={{fontSize:11,fontWeight:700,color:accent,fontFamily:"'Courier New',monospace",lineHeight:1}}>{fmt12(s.start)}</div>
      <div style={{fontSize:10,color:accent+"99",fontFamily:"'Courier New',monospace"}}>–{fmt12(s.end)}</div>
      <div style={{fontSize:10,color:"#475569",fontFamily:"'Courier New',monospace"}}>{calcHours([s]).toFixed(0)}h</div>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────
export default function App() {
  const [posts,setPosts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);
  const [view,setView]=useState("open");
  const [showAdd,setShowAdd]=useState(false);
  const [editTarget,setEditTarget]=useState(null);
  const [fillTarget,setFillTarget]=useState(null);
  const [schedTarget,setSchedTarget]=useState(null);
  const [ft,setFt]=useState("All"); const [fl,setFl]=useState("All"); const [fp,setFp]=useState("All");
  const [sortBy,setSortBy]=useState("days");
  const [form,setForm]=useState(BLANK);
  const [fillForm,setFillForm]=useState({filledBy:"",filledDate:new Date().toISOString().slice(0,10)});

  const loadPosts = async () => {
    setLoading(true); setError(null);
    try { setPosts((await api("/api/posts")).map(parsePost)); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ loadPosts(); },[]);

  const open=posts.filter(p=>!p.filledDate&&!p.archived);
  const filled=posts.filter(p=>!!p.filledDate&&!p.archived);
  const avgDays=open.length?Math.round(open.reduce((s,p)=>s+daysSince(p.openedDate),0)/open.length):0;
  const critical=open.filter(p=>p.priority==="Critical"||daysSince(p.openedDate)>45).length;
  const totalHrs=open.reduce((s,p)=>s+calcHours(p.schedule),0);

  const filtered=useMemo(()=>{
    let list=view==="filled"?filled:open;
    if(ft!=="All") list=list.filter(p=>p.type===ft);
    if(fl!=="All") list=list.filter(p=>p.location===fl);
    if(fp!=="All") list=list.filter(p=>p.priority===fp);
    return [...list].sort((a,b)=>{
      if(sortBy==="days") return daysSince(a.openedDate)<daysSince(b.openedDate)?1:-1;
      if(sortBy==="client") return a.client.localeCompare(b.client);
      if(sortBy==="priority") return ["Critical","High","Normal"].indexOf(a.priority)-["Critical","High","Normal"].indexOf(b.priority);
      if(sortBy==="hours") return calcHours(b.schedule)-calcHours(a.schedule);
      return 0;
    });
  },[posts,view,ft,fl,fp,sortBy]);

  const savePost = async () => {
    if(!form.client.trim()) return;
    setSaving(true);
    try {
      if(editTarget) {
        await api(`/api/posts/${editTarget.id}`, "PUT", { ...form, schedule: JSON.stringify(form.schedule) });
      } else {
        await api("/api/posts", "POST", { ...form, id: Date.now().toString(), schedule: JSON.stringify(form.schedule) });
      }
      await loadPosts(); setShowAdd(false); setEditTarget(null); setForm(BLANK);
    } catch(e) { setError("Save failed: "+e.message); }
    finally { setSaving(false); }
  };
  const doFill = async () => {
    setSaving(true);
    try {
      const updated = { ...fillTarget, filledDate: fillForm.filledDate, filledBy: fillForm.filledBy, schedule: JSON.stringify(fillTarget.schedule) };
      await api(`/api/posts/${fillTarget.id}`, "PUT", updated);
      await loadPosts(); setFillTarget(null);
    } catch(e) { setError("Fill failed: "+e.message); }
    finally { setSaving(false); }
  };
  const doDelete = async id => {
    if(!confirm("Archive this post?")) return;
    setSaving(true);
    try { await api(`/api/posts/${id}`, "DELETE"); await loadPosts(); }
    catch(e) { setError("Archive failed: "+e.message); }
    finally { setSaving(false); }
  };
  const doReopen = async post => {
    setSaving(true);
    try {
      await api(`/api/posts/${post.id}`, "PUT", { ...post, filledDate:"", filledBy:"", schedule: JSON.stringify(post.schedule) });
      await loadPosts();
    } catch(e) { setError("Reopen failed: "+e.message); }
    finally { setSaving(false); }
  };
  const startEdit = post => { setForm({...post, schedule:post.schedule||DEFAULT_SCHEDULE.map(s=>({...s}))}); setEditTarget(post); setShowAdd(true); };

  const nav=(id,label)=>(
    <button onClick={()=>setView(id)} style={{background:view===id?"#1e3a5f":"transparent",border:view===id?"1px solid #1e6fb8":"1px solid transparent",color:view===id?"#60a5fa":"#64748b",borderRadius:6,padding:"7px 18px",cursor:"pointer",fontSize:13,fontWeight:600,letterSpacing:"0.04em",fontFamily:"'Courier New',monospace",textTransform:"uppercase"}}>{label}</button>
  );
  const byType=POST_TYPES.map(t=>({t,n:open.filter(p=>p.type===t).length})).filter(x=>x.n>0);
  const byLoc=[...new Set(open.map(p=>p.location))].map(l=>({l,n:open.filter(p=>p.location===l).length}));

  return (
    <div style={{minHeight:"100vh",background:"#080f18",color:"#e2e8f0",fontFamily:"'DM Sans','Segoe UI',sans-serif",paddingBottom:60}}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{borderBottom:"1px solid #1e3a5f",padding:"0 32px",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:error?"#ef4444":"#22c55e",boxShadow:`0 0 8px ${error?"#ef4444":"#22c55e"}`}}/>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"0.12em"}}>FPI SECURITY</span>
          <span style={{color:"#1e3a5f",fontSize:18}}>|</span>
          <span style={{fontSize:13,color:"#64748b",letterSpacing:"0.08em",fontFamily:"'Courier New',monospace",textTransform:"uppercase"}}>Open Posts Command</span>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {saving&&<span style={{fontSize:11,color:"#64748b",fontFamily:"'Courier New',monospace"}}>SAVING...</span>}
          <button onClick={loadPosts} style={{background:"transparent",border:"1px solid #1e3a5f",borderRadius:6,color:"#475569",padding:"7px 14px",cursor:"pointer",fontSize:12,fontFamily:"'Courier New',monospace"}}>↻ REFRESH</button>
          <button onClick={()=>{setForm(BLANK);setEditTarget(null);setShowAdd(true);}} style={{background:"#1e3a5f",border:"1px solid #1e6fb8",borderRadius:6,color:"#60a5fa",padding:"8px 20px",cursor:"pointer",fontSize:13,fontWeight:700,letterSpacing:"0.06em",fontFamily:"'Courier New',monospace",textTransform:"uppercase"}}>+ Add Post</button>
        </div>
      </div>

      <div style={{padding:"28px 32px 0"}}>
        {error&&<ErrorBanner msg={error} onRetry={loadPosts}/>}

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:28}}>
          <StatCard label="Open Posts" value={loading?"…":open.length} sub="Requires staffing" accent="#1e6fb8"/>
          <StatCard label="Critical / Urgent" value={loading?"…":critical} sub="Action needed" accent="#ef4444"/>
          <StatCard label="Avg Days Open" value={loading?"…":avgDays} sub="Across open posts" accent="#f59e0b"/>
          <StatCard label="Hrs/Wk Needed" value={loading?"…":Math.round(totalHrs)} sub="Total open post hours" accent="#a855f7"/>
        </div>

        {/* Nav */}
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {nav("open",`Open Posts (${open.length})`)}
          {nav("schedule","Weekly Schedule")}
          {nav("filled",`Filled (${filled.length})`)}
          {nav("dashboard","Breakdown")}
        </div>

        {/* Filters */}
        {(view==="open"||view==="filled")&&(
          <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
            {[{l:"Type",v:ft,s:setFt,o:POST_TYPES},{l:"Priority",v:fp,s:setFp,o:PRIORITIES}].map(f=>(
              <select key={f.l} value={f.v} onChange={e=>f.s(e.target.value)} style={{background:"#0f1923",border:"1px solid #1e3a5f",borderRadius:6,padding:"7px 12px",color:"#94a3b8",fontSize:12,outline:"none",fontFamily:"'Courier New',monospace"}}>
                <option value="All">{f.l}: All</option>
                {f.o.map(o=><option key={o}>{o}</option>)}
              </select>
            ))}
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{background:"#0f1923",border:"1px solid #1e3a5f",borderRadius:6,padding:"7px 12px",color:"#94a3b8",fontSize:12,outline:"none",fontFamily:"'Courier New',monospace",marginLeft:"auto"}}>
              <option value="days">Sort: Days Open</option>
              <option value="client">Sort: Client</option>
              <option value="priority">Sort: Priority</option>
              <option value="hours">Sort: Hrs/Wk</option>
            </select>
          </div>
        )}

        {loading&&<Spinner/>}

        {/* Posts Table */}
        {!loading&&(view==="open"||view==="filled")&&(
          <div style={{background:"#0a1520",border:"1px solid #1e3a5f",borderRadius:10,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1.3fr 1.1fr 70px 100px 90px 130px",padding:"10px 20px",borderBottom:"1px solid #1e3a5f",gap:12}}>
              {["Client / Site","Location","Post Type","Days","Schedule","Priority",""].map(h=>(
                <div key={h} style={{fontSize:10,color:"#475569",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Courier New',monospace",fontWeight:700}}>{h}</div>
              ))}
            </div>
            {filtered.length===0&&<div style={{padding:"40px",textAlign:"center",color:"#475569",fontSize:14}}>No posts match this filter.</div>}
            {filtered.map((post,i)=>{
              const days=daysSince(post.openedDate);
              const uc=urgencyColor(days,post.priority);
              const hrs=calcHours(post.schedule);
              const activeDays=(post.schedule||[]).filter(s=>s.active).map(s=>s.day);
              return (
                <div key={post.id} style={{display:"grid",gridTemplateColumns:"2fr 1.3fr 1.1fr 70px 100px 90px 130px",padding:"13px 20px",gap:12,alignItems:"center",borderBottom:i<filtered.length-1?"1px solid #0f1f30":"none",background:i%2===0?"transparent":"#0d1b29",borderLeft:`3px solid ${uc}`}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:14,color:"#e2e8f0"}}>{post.client}</div>
                    {post.notes&&<div style={{fontSize:11,color:"#475569",marginTop:2,fontStyle:"italic"}}>{post.notes}</div>}
                  </div>
                  <div style={{fontSize:13,color:"#94a3b8"}}>{post.location}</div>
                  <div style={{fontSize:13,color:"#94a3b8"}}>{post.type}</div>
                  <div style={{fontSize:20,fontWeight:800,color:uc,fontFamily:"'Bebas Neue',sans-serif"}}>{days}d</div>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:"#a855f7",fontFamily:"'Bebas Neue',sans-serif"}}>{hrs.toFixed(0)}h/wk</div>
                    <div style={{fontSize:10,color:"#475569",fontFamily:"'Courier New',monospace",marginTop:1}}>{activeDays.join(" · ")}</div>
                  </div>
                  <div><Badge label={post.priority} color={post.priority==="Critical"?"#ef4444":post.priority==="High"?"#f59e0b":"#22c55e"}/></div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {view==="open"?(
                      <>
                        <button onClick={()=>setSchedTarget(post)} style={{background:"#1a0a40",border:"1px solid #6d28d9",color:"#a78bfa",borderRadius:5,padding:"4px 7px",cursor:"pointer",fontSize:10,fontWeight:700}}>SCHED</button>
                        <button onClick={()=>startEdit(post)} style={{background:"#0a1e40",border:"1px solid #1e3a5f",color:"#60a5fa",borderRadius:5,padding:"4px 7px",cursor:"pointer",fontSize:10,fontWeight:700}}>EDIT</button>
                        <button onClick={()=>{setFillTarget(post);setFillForm({filledBy:"",filledDate:new Date().toISOString().slice(0,10)});}} style={{background:"#052e16",border:"1px solid #166534",color:"#22c55e",borderRadius:5,padding:"4px 7px",cursor:"pointer",fontSize:10,fontWeight:700}}>FILL</button>
                        <button onClick={()=>doDelete(post.id)} style={{background:"#1f0a0a",border:"1px solid #7f1d1d",color:"#ef4444",borderRadius:5,padding:"4px 7px",cursor:"pointer",fontSize:10}}>✕</button>
                      </>
                    ):(
                      <div>
                        <div style={{fontSize:11,color:"#22c55e",fontWeight:600}}>✓ {post.filledBy}</div>
                        <button onClick={()=>doReopen(post)} style={{background:"transparent",border:"1px solid #1e3a5f",color:"#64748b",borderRadius:4,padding:"2px 7px",cursor:"pointer",fontSize:10,marginTop:4}}>Reopen</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Weekly Schedule */}
        {!loading&&view==="schedule"&&(
          <div>
            <div style={{fontSize:12,color:"#475569",marginBottom:16,fontFamily:"'Courier New',monospace"}}>
              {open.length} open post{open.length!==1?"s":""} — {Math.round(totalHrs)} total hrs/wk
            </div>
            <div style={{overflowX:"auto"}}>
              <div style={{minWidth:860}}>
                <div style={{display:"grid",gridTemplateColumns:"210px repeat(7,1fr)",gap:5,marginBottom:5}}>
                  <div/>
                  {DAYS.map(d=>(
                    <div key={d} style={{textAlign:"center",padding:"8px 4px",background:"#0f1923",border:"1px solid #1e3a5f",borderRadius:6}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#60a5fa",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"0.08em"}}>{d}</div>
                    </div>
                  ))}
                </div>
                {open.map(post=>{
                  const uc=urgencyColor(daysSince(post.openedDate),post.priority);
                  const sched=post.schedule||DEFAULT_SCHEDULE;
                  return (
                    <div key={post.id} style={{display:"grid",gridTemplateColumns:"210px repeat(7,1fr)",gap:5,marginBottom:5}}>
                      <div style={{background:"#0a1520",border:"1px solid #1e3a5f",borderLeft:`3px solid ${uc}`,borderRadius:6,padding:"8px 12px",display:"flex",flexDirection:"column",justifyContent:"center",gap:3,cursor:"pointer"}} onClick={()=>setSchedTarget(post)}>
                        <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",lineHeight:1.2}}>{post.client}</div>
                        <div style={{fontSize:11,color:"#475569"}}>{post.type}</div>
                        <div style={{fontSize:11,color:"#a855f7",fontFamily:"'Courier New',monospace",marginTop:2}}>{calcHours(sched).toFixed(0)}h/wk</div>
                      </div>
                      {DAYS.map(d=><div key={d}><ShiftCell s={sched.find(x=>x.day===d)}/></div>)}
                    </div>
                  );
                })}
                <div style={{display:"grid",gridTemplateColumns:"210px repeat(7,1fr)",gap:5,marginTop:10}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:10}}>
                    <span style={{fontSize:10,color:"#475569",fontFamily:"'Courier New',monospace",textTransform:"uppercase",letterSpacing:"0.08em"}}>Day Total</span>
                  </div>
                  {DAYS.map(d=>{
                    const h=open.reduce((sum,p)=>{const s=(p.schedule||[]).find(x=>x.day===d);return sum+(s&&s.active?calcHours([s]):0);},0);
                    return (
                      <div key={d} style={{textAlign:"center",padding:"8px 4px",background:"#0a1520",border:"1px solid #1e3a5f",borderRadius:6}}>
                        <div style={{fontSize:17,fontWeight:800,color:h>0?"#a855f7":"#1e3a5f",fontFamily:"'Bebas Neue',sans-serif"}}>{h>0?h.toFixed(0)+"h":"—"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:20,marginTop:18,alignItems:"center"}}>
              <span style={{fontSize:11,color:"#475569",fontFamily:"'Courier New',monospace",textTransform:"uppercase",letterSpacing:"0.08em"}}>Legend:</span>
              {[{bg:"#0a1e40",ac:"#38bdf8",label:"Day shift"},{bg:"#160f40",ac:"#818cf8",label:"Night shift"},{bg:"#080f18",ac:"",label:"Off"}].map(({bg,ac,label})=>(
                <div key={label} style={{display:"flex",gap:6,alignItems:"center"}}>
                  <div style={{width:14,height:14,background:bg,border:`1px solid ${ac||"#1e3a5f"}33`,borderRadius:3}}/>
                  <span style={{fontSize:11,color:"#64748b"}}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Breakdown */}
        {!loading&&view==="dashboard"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <div style={{background:"#0a1520",border:"1px solid #1e3a5f",borderRadius:10,padding:24}}>
              <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Courier New',monospace",marginBottom:16}}>Open by Post Type</div>
              {byType.length===0?<div style={{color:"#475569",fontSize:13}}>No open posts.</div>:byType.map(({t,n})=>(
                <div key={t} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:13,color:"#94a3b8"}}>{t}</span><span style={{fontSize:13,fontWeight:700,color:"#60a5fa",fontFamily:"'Courier New',monospace"}}>{n}</span></div>
                  <div style={{height:6,background:"#1e3a5f",borderRadius:3}}><div style={{height:"100%",borderRadius:3,background:"#1e6fb8",width:`${(n/open.length)*100}%`}}/></div>
                </div>
              ))}
            </div>
            <div style={{background:"#0a1520",border:"1px solid #1e3a5f",borderRadius:10,padding:24}}>
              <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Courier New',monospace",marginBottom:16}}>Open by Location</div>
              {byLoc.map(({l,n})=>(
                <div key={l} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:13,color:"#94a3b8"}}>{l}</span><span style={{fontSize:13,fontWeight:700,color:"#f59e0b",fontFamily:"'Courier New',monospace"}}>{n}</span></div>
                  <div style={{height:6,background:"#1e3a5f",borderRadius:3}}><div style={{height:"100%",borderRadius:3,background:"#f59e0b",width:`${(n/open.length)*100}%`}}/></div>
                </div>
              ))}
            </div>
            <div style={{background:"#0a1520",border:"1px solid #1e3a5f",borderRadius:10,padding:24,gridColumn:"1/-1"}}>
              <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Courier New',monospace",marginBottom:16}}>Aging Breakdown</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
                {[{label:"0–7 days",color:"#22c55e",count:open.filter(p=>daysSince(p.openedDate)<=7).length},{label:"8–21 days",color:"#84cc16",count:open.filter(p=>daysSince(p.openedDate)>7&&daysSince(p.openedDate)<=21).length},{label:"22–45 days",color:"#f59e0b",count:open.filter(p=>daysSince(p.openedDate)>21&&daysSince(p.openedDate)<=45).length},{label:"45+ days",color:"#ef4444",count:open.filter(p=>daysSince(p.openedDate)>45).length}].map(({label,color,count})=>(
                  <div key={label} style={{textAlign:"center",padding:"20px 0",borderRadius:8,background:color+"11",border:`1px solid ${color}33`}}>
                    <div style={{fontSize:40,fontWeight:800,color,fontFamily:"'Bebas Neue',sans-serif"}}>{count}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:4,fontFamily:"'Courier New',monospace",textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showAdd} onClose={()=>{setShowAdd(false);setEditTarget(null);}} wide>
        <div style={{marginBottom:24}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"0.1em",color:"#e2e8f0"}}>{editTarget?"Edit Post":"New Open Post"}</div>
          <div style={{fontSize:12,color:"#475569",marginTop:2}}>{editTarget?"Update details and schedule":"Add a position that needs to be filled"}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <Inp label="Client / Site Name *" value={form.client} onChange={e=>setForm({...form,client:e.target.value})} placeholder="e.g. AutoNation Fort Lauderdale"/>
            <Inp label="Location" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="e.g. Pembroke Pines, FL"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Sel label="Post Type" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{POST_TYPES.map(t=><option key={t}>{t}</option>)}</Sel>
              <Sel label="Priority" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</Sel>
            </div>
            <Inp label="Date Opened" type="date" value={form.openedDate} onChange={e=>setForm({...form,openedDate:e.target.value})}/>
            <Inp label="Notes (optional)" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Language needs, special requirements…"/>
          </div>
          <ScheduleBuilder schedule={form.schedule} onChange={s=>setForm({...form,schedule:s})}/>
        </div>
        <div style={{display:"flex",gap:12,marginTop:24}}>
          <button onClick={savePost} disabled={saving} style={{flex:1,background:"#1e3a5f",border:"1px solid #1e6fb8",color:"#60a5fa",borderRadius:6,padding:"10px",cursor:"pointer",fontWeight:700,fontSize:13,letterSpacing:"0.06em",fontFamily:"'Courier New',monospace",textTransform:"uppercase",opacity:saving?0.6:1}}>{saving?"SAVING…":editTarget?"Save Changes":"Add Post"}</button>
          <button onClick={()=>{setShowAdd(false);setEditTarget(null);}} style={{flex:1,background:"transparent",border:"1px solid #1e3a5f",color:"#64748b",borderRadius:6,padding:"10px",cursor:"pointer",fontSize:13,fontFamily:"'Courier New',monospace",textTransform:"uppercase"}}>Cancel</button>
        </div>
      </Modal>

      {/* Schedule Detail Modal */}
      <Modal open={!!schedTarget} onClose={()=>setSchedTarget(null)}>
        {schedTarget&&(
          <>
            <div style={{marginBottom:20}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"0.1em",color:"#a78bfa"}}>Weekly Schedule</div>
              <div style={{fontSize:13,color:"#94a3b8",marginTop:4}}>{schedTarget.client} · {schedTarget.type} · {schedTarget.location}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {(schedTarget.schedule||[]).map(s=>(
                <div key={s.day} style={{display:"grid",gridTemplateColumns:"64px 1fr 60px",gap:12,alignItems:"center",padding:"9px 14px",background:s.active?"#0a1835":"#080f18",border:`1px solid ${s.active?"#1e3a5f":"#0f1923"}`,borderRadius:7,opacity:s.active?1:0.4}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:19,color:s.active?"#60a5fa":"#475569"}}>{s.day}</div>
                  {s.active?<div style={{fontFamily:"'Courier New',monospace",fontSize:13,color:"#e2e8f0"}}>{fmt12(s.start)} – {fmt12(s.end)}</div>:<div style={{fontFamily:"'Courier New',monospace",fontSize:12,color:"#334155"}}>— Off</div>}
                  <div style={{fontFamily:"'Courier New',monospace",fontSize:13,color:"#a855f7",textAlign:"right"}}>{s.active?calcHours([s]).toFixed(1)+"h":""}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",background:"#0f1923",border:"1px solid #1e3a5f",borderRadius:8,marginBottom:14}}>
              <span style={{fontSize:12,color:"#64748b",fontFamily:"'Courier New',monospace",textTransform:"uppercase",letterSpacing:"0.08em"}}>Total Hours / Week</span>
              <span style={{fontSize:28,fontWeight:800,color:"#a855f7",fontFamily:"'Bebas Neue',sans-serif"}}>{calcHours(schedTarget.schedule||[]).toFixed(1)} hrs</span>
            </div>
            <div style={{padding:"14px 16px",background:"#0a1520",border:"1px solid #1e3a5f",borderRadius:8,marginBottom:20}}>
              <div style={{fontSize:10,color:"#64748b",fontFamily:"'Courier New',monospace",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>HR Offer Summary</div>
              <div style={{fontSize:14,color:"#e2e8f0",lineHeight:1.75}}>
                This post requires a <strong>{schedTarget.type}</strong> working <strong>{(schedTarget.schedule||[]).filter(s=>s.active).map(s=>s.day).join(", ")}</strong>. Approximately <strong>{calcHours(schedTarget.schedule||[]).toFixed(0)} hours per week</strong>.{schedTarget.notes&&<> Note: <em>{schedTarget.notes}</em>.</>}
              </div>
            </div>
            <button onClick={()=>setSchedTarget(null)} style={{width:"100%",background:"transparent",border:"1px solid #1e3a5f",color:"#64748b",borderRadius:6,padding:"10px",cursor:"pointer",fontSize:13,fontFamily:"'Courier New',monospace",textTransform:"uppercase"}}>Close</button>
          </>
        )}
      </Modal>

      {/* Fill Modal */}
      <Modal open={!!fillTarget} onClose={()=>setFillTarget(null)}>
        <div style={{marginBottom:24}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"0.1em",color:"#22c55e"}}>Mark Post Filled</div>
          <div style={{fontSize:12,color:"#475569",marginTop:2}}>{fillTarget?.client} — {fillTarget?.type}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Inp label="Filled By (Officer Name)" value={fillForm.filledBy} onChange={e=>setFillForm({...fillForm,filledBy:e.target.value})} placeholder="e.g. Maria Garcia"/>
          <Inp label="Date Filled" type="date" value={fillForm.filledDate} onChange={e=>setFillForm({...fillForm,filledDate:e.target.value})}/>
          <div style={{display:"flex",gap:12,marginTop:8}}>
            <button onClick={doFill} disabled={saving} style={{flex:1,background:"#052e16",border:"1px solid #166534",color:"#22c55e",borderRadius:6,padding:"10px",cursor:"pointer",fontWeight:700,fontSize:13,letterSpacing:"0.06em",fontFamily:"'Courier New',monospace",textTransform:"uppercase",opacity:saving?0.6:1}}>{saving?"SAVING…":"Confirm Filled"}</button>
            <button onClick={()=>setFillTarget(null)} style={{flex:1,background:"transparent",border:"1px solid #1e3a5f",color:"#64748b",borderRadius:6,padding:"10px",cursor:"pointer",fontSize:13,fontFamily:"'Courier New',monospace",textTransform:"uppercase"}}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
