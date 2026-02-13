import { useState, useEffect, useCallback, useMemo } from "react";

const DEFAULT_CLIENTS = [
  { id: "externa", name: "Externa Events", short: "Externa", color: "#2563EB", icon: "🏢" },
  { id: "somos", name: "SOMOS Experience", short: "SOMOS", color: "#D97706", icon: "🌟" },
  { id: "externia", name: "Externia (Propio)", short: "Externia", color: "#059669", icon: "🧠" },
];

const PRESET_COLORS = ["#2563EB","#D97706","#059669","#DC2626","#7C3AED","#DB2777","#0891B2","#4F46E5","#EA580C","#65A30D"];
const PRESET_ICONS = ["🏢","🌟","🧠","🎯","💼","🚀","📊","🎨","⚡","🔧","🏛️","📱"];

const DAYS = [
  { key: "lun", label: "lunes", cap: "Lunes", short: "L", idx: 0 },
  { key: "mar", label: "martes", cap: "Martes", short: "M", idx: 1 },
  { key: "mie", label: "miércoles", cap: "Miércoles", short: "X", idx: 2 },
  { key: "jue", label: "jueves", cap: "Jueves", short: "J", idx: 3 },
  { key: "vie", label: "viernes", cap: "Viernes", short: "V", idx: 4 },
];

const SLOTS = [
  { key: "am", label: "mañana", capLabel: "Mañana", time: "9:00 – 14:00", startH: 9, startM: 0, endH: 14, endM: 0 },
  { key: "pm", label: "tarde", capLabel: "Tarde", time: "15:00 – 19:00", startH: 15, startM: 0, endH: 19, endM: 0 },
];

const FREE = "__free__";

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function fmtWeekKey(m) { return m.toISOString().split("T")[0]; }
function fmtRange(m) {
  const f = new Date(m); f.setDate(f.getDate() + 4);
  const o = { day: "numeric", month: "short" };
  return `${m.toLocaleDateString("es-ES", o)} — ${f.toLocaleDateString("es-ES", o)}, ${m.getFullYear()}`;
}
function dayDate(m, i) { const d = new Date(m); d.setDate(d.getDate() + i); return d; }
function pad(n) { return String(n).padStart(2, "0"); }
function fmtOutlookDate(date, h, m) {
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(h)}:${pad(m)}:00`;
}
function defaultBlocks() {
  const b = {};
  DAYS.forEach(d => SLOTS.forEach(s => b[`${d.key}_${s.key}`] = FREE));
  return b;
}

function joinNatural(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(", ") + " y " + items[items.length - 1];
}

function generateNaturalAvailability(blocks, clientId, clientName, weekRange) {
  const assigned = { am: [], pm: [] };
  const available = { am: [], pm: [] };
  const busy = { am: [], pm: [] };

  DAYS.forEach(d => {
    SLOTS.forEach(s => {
      const v = blocks[`${d.key}_${s.key}`];
      if (v === clientId) assigned[s.key].push(d.label);
      else if (v === FREE) available[s.key].push(d.label);
      else busy[s.key].push(d.label);
    });
  });

  let dedicationParts = [];
  if (assigned.am.length > 0 && assigned.pm.length > 0) {
    const sameDays = assigned.am.filter(d => assigned.pm.includes(d));
    const onlyAm = assigned.am.filter(d => !assigned.pm.includes(d));
    const onlyPm = assigned.pm.filter(d => !assigned.am.includes(d));
    if (sameDays.length > 0) dedicationParts.push(`${joinNatural(sameDays)} a jornada completa`);
    if (onlyAm.length > 0) dedicationParts.push(`${joinNatural(onlyAm)} por la mañana`);
    if (onlyPm.length > 0) dedicationParts.push(`${joinNatural(onlyPm)} por la tarde`);
  } else {
    if (assigned.am.length > 0) dedicationParts.push(`${joinNatural(assigned.am)} por la mañana`);
    if (assigned.pm.length > 0) dedicationParts.push(`${joinNatural(assigned.pm)} por la tarde`);
  }

  let availParts = [];
  if (available.am.length > 0 && available.pm.length > 0) {
    const sameDays = available.am.filter(d => available.pm.includes(d));
    const onlyAm = available.am.filter(d => !available.pm.includes(d));
    const onlyPm = available.pm.filter(d => !available.am.includes(d));
    if (sameDays.length > 0) availParts.push(`${joinNatural(sameDays)} a jornada completa`);
    if (onlyAm.length > 0) availParts.push(`${joinNatural(onlyAm)} por la mañana`);
    if (onlyPm.length > 0) availParts.push(`${joinNatural(onlyPm)} por la tarde`);
  } else {
    if (available.am.length > 0) availParts.push(`${joinNatural(available.am)} por la mañana`);
    if (available.pm.length > 0) availParts.push(`${joinNatural(available.pm)} por la tarde`);
  }

  let msg = `¡Buenas!\n\nOs paso mi disponibilidad para esta semana (${weekRange}).`;

  if (dedicationParts.length > 0) {
    msg += `\n\nEn principio, la dedicación al proyecto de ${clientName} será la siguiente: ${joinNatural(dedicationParts)}.`;
  }

  if (availParts.length > 0) {
    msg += `\n\nAparte de eso, tengo hueco libre ${joinNatural(availParts)}, por si necesitáis cuadrar alguna reunión o llamada extra.`;
  } else if (dedicationParts.length > 0) {
    msg += `\n\nEl resto de la semana lo tengo comprometido con otros proyectos, así que si necesitáis algo fuera de esos bloques avisadme con tiempo e intentamos cuadrarlo.`;
  }

  if (dedicationParts.length === 0 && availParts.length > 0) {
    msg += `\n\nEsta semana no tengo bloques fijos asignados al proyecto, pero estoy disponible ${joinNatural(availParts)}. Si necesitáis algo, mandadme una convocatoria por Outlook o Teams y lo cuadramos.`;
  }

  if (dedicationParts.length === 0 && availParts.length === 0) {
    msg += `\n\nEsta semana la tengo bastante comprometida con otros proyectos. Si surge algo urgente escribidme e intentamos buscar un hueco.`;
  }

  msg += `\n\nPara cualquier reunión, enviadme la convocatoria por Outlook/Teams y la acepto directamente.`;
  msg += `\n\nUn saludo,\nGuillermo`;

  return msg;
}

function generateAdminSummary(blocks, clientMap, weekRange) {
  let msg = `📅 Disponibilidad semana ${weekRange}\n\n`;
  DAYS.forEach(d => {
    let parts = [];
    SLOTS.forEach(s => {
      const v = blocks[`${d.key}_${s.key}`];
      const label = v === FREE ? "Libre" : (clientMap[v]?.short || v);
      parts.push(`${s.capLabel}: ${label}`);
    });
    msg += `${d.cap}: ${parts.join(" | ")}\n`;
  });
  return msg;
}

function generateBlockingICS(blocks, clientId, monday, clientMap) {
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Externia//Bloqueo//ES\nMETHOD:PUBLISH\n";

  DAYS.forEach((d, di) => {
    SLOTS.forEach(s => {
      const v = blocks[`${d.key}_${s.key}`];
      if (v !== clientId && v !== FREE) {
        const dd = dayDate(monday, di);
        const ds = dd.toISOString().split("T")[0].replace(/-/g, "");
        const uid = `block-${ds}-${s.key}@externia.es`;
        ics += `BEGIN:VEVENT\n`;
        ics += `UID:${uid}\n`;
        ics += `DTSTART:${ds}T${pad(s.startH)}${pad(s.startM)}00\n`;
        ics += `DTEND:${ds}T${pad(s.endH)}${pad(s.endM)}00\n`;
        ics += `SUMMARY:🔒 No disponible - Guillermo\n`;
        ics += `DESCRIPTION:Bloque no disponible. Guillermo está en otro proyecto.\n`;
        ics += `TRANSP:OPAQUE\n`;
        ics += `X-MICROSOFT-CDO-BUSYSTATUS:BUSY\n`;
        ics += `STATUS:CONFIRMED\n`;
        ics += `END:VEVENT\n`;
      }
    });
  });

  ics += "END:VCALENDAR";
  return ics;
}

function generateFullBlockingICS(blocks, monday, clientMap) {
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Externia//Disponibilidad//ES\nMETHOD:PUBLISH\n";

  DAYS.forEach((d, di) => {
    SLOTS.forEach(s => {
      const v = blocks[`${d.key}_${s.key}`];
      if (v !== FREE) {
        const dd = dayDate(monday, di);
        const ds = dd.toISOString().split("T")[0].replace(/-/g, "");
        const cl = clientMap[v];
        const uid = `dispo-${ds}-${s.key}@externia.es`;
        ics += `BEGIN:VEVENT\n`;
        ics += `UID:${uid}\n`;
        ics += `DTSTART:${ds}T${pad(s.startH)}${pad(s.startM)}00\n`;
        ics += `DTEND:${ds}T${pad(s.endH)}${pad(s.endM)}00\n`;
        ics += `SUMMARY:${cl ? cl.icon + " " + cl.short : "Ocupado"}\n`;
        ics += `DESCRIPTION:Bloque asignado a ${cl ? cl.name : "proyecto"}\n`;
        ics += `TRANSP:OPAQUE\n`;
        ics += `X-MICROSOFT-CDO-BUSYSTATUS:BUSY\n`;
        ics += `STATUS:CONFIRMED\n`;
        ics += `END:VEVENT\n`;
      }
    });
  });

  ics += "END:VCALENDAR";
  return ics;
}

function downloadFile(content, filename, type) {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Download error:", e);
  }
}

const store = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function Modal({ children, onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div style={{ background:"white",borderRadius:20,padding:28,width:520,maxWidth:"92vw",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position:"fixed",top:24,left:"50%",transform:"translateX(-50%)",background:"#0F172A",color:"#E2E8F0",padding:"12px 24px",borderRadius:12,fontSize:14,fontWeight:500,zIndex:1000,boxShadow:"0 8px 32px rgba(0,0,0,0.2)",animation:"fadeIn 0.3s ease" }}>{msg}</div>
  );
}

function ClientManager({ clients, onSave, onClose }) {
  const [list, setList] = useState([...clients]);
  const [editing, setEditing] = useState(null);
  const add = () => {
    const nc = { id: `client_${Date.now()}`, name: "", short: "", color: PRESET_COLORS[list.length % PRESET_COLORS.length], icon: PRESET_ICONS[list.length % PRESET_ICONS.length] };
    setList([...list, nc]); setEditing(nc.id);
  };
  const upd = (id, f, v) => setList(list.map(c => c.id === id ? { ...c, [f]: v } : c));
  const rm = (id) => { if (list.length <= 1) return; setList(list.filter(c => c.id !== id)); };

  return (
    <Modal onClose={onClose}>
      <div style={{ fontSize:18,fontWeight:700,color:"#1E293B",marginBottom:20 }}>Gestión de Clientes / Proyectos</div>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        {list.map(c => (
          <div key={c.id} style={{ background:"#F8FAFC",borderRadius:14,padding:16,borderLeft:`4px solid ${c.color}` }}>
            {editing === c.id ? (
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                <div style={{ display:"flex",gap:8 }}>
                  <input value={c.name} onChange={e => upd(c.id,"name",e.target.value)} placeholder="Nombre completo" style={{ flex:2,border:"2px solid #E2E8F0",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",outline:"none" }} />
                  <input value={c.short} onChange={e => upd(c.id,"short",e.target.value)} placeholder="Alias" style={{ flex:1,border:"2px solid #E2E8F0",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",outline:"none" }} />
                </div>
                <div>
                  <div style={{ fontSize:11,fontWeight:600,color:"#94A3B8",marginBottom:6 }}>Color</div>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {PRESET_COLORS.map(col => (
                      <div key={col} onClick={() => upd(c.id,"color",col)} style={{ width:28,height:28,borderRadius:8,background:col,cursor:"pointer",border:c.color===col?"3px solid #1E293B":"3px solid transparent" }} />
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:11,fontWeight:600,color:"#94A3B8",marginBottom:6 }}>Icono</div>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {PRESET_ICONS.map(ic => (
                      <div key={ic} onClick={() => upd(c.id,"icon",ic)} style={{ width:32,height:32,borderRadius:8,background:c.icon===ic?"#E2E8F0":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>{ic}</div>
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex",justifyContent:"flex-end",gap:6,marginTop:4 }}>
                  <button onClick={() => rm(c.id)} style={{ background:"#FEE2E2",color:"#DC2626",border:"none",padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer" }}>Eliminar</button>
                  <button onClick={() => setEditing(null)} style={{ background:"#0F172A",color:"white",border:"none",padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer" }}>Listo</button>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer" }} onClick={() => setEditing(c.id)}>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <span style={{ fontSize:20 }}>{c.icon}</span>
                  <div>
                    <div style={{ fontSize:14,fontWeight:600,color:"#1E293B" }}>{c.name || "Sin nombre"}</div>
                    <div style={{ fontSize:11,color:"#94A3B8" }}>{c.short || "Sin alias"}</div>
                  </div>
                </div>
                <span style={{ fontSize:12,color:"#94A3B8" }}>Editar →</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display:"flex",justifyContent:"space-between",marginTop:20 }}>
        <button onClick={add} style={{ background:"#F1F5F9",color:"#475569",border:"none",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer" }}>+ Añadir cliente</button>
        <button onClick={() => { onSave(list.filter(c => c.name.trim())); onClose(); }} style={{ background:"#0F172A",color:"white",border:"none",padding:"10px 24px",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer" }}>Guardar</button>
      </div>
    </Modal>
  );
}

function OutlookBtn({ date, slot, label }) {
  const start = fmtOutlookDate(date, slot.startH, slot.startM);
  const end = fmtOutlookDate(date, slot.endH, slot.endM);
  const subject = encodeURIComponent("Reunión con Guillermo Prado");
  const body = encodeURIComponent("Hola Guillermo,\n\nTe convoco en tu horario disponible.\n\nSaludos");
  const url = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${subject}&body=${body}&startdt=${start}&enddt=${end}&to=guillermo@externia.es`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:6,background:"#0078D4",color:"white",padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,textDecoration:"none" }}>
      📧 {label || "Outlook"}
    </a>
  );
}

function TeamsBtn({ date, slot }) {
  const start = fmtOutlookDate(date, slot.startH, slot.startM);
  const subject = encodeURIComponent("Reunión con Guillermo Prado");
  const url = `https://teams.microsoft.com/l/meeting/new?subject=${subject}&startTime=${start}&content=${encodeURIComponent("Convocatoria en horario disponible")}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:6,background:"#5B5FC7",color:"white",padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,textDecoration:"none" }}>
      💬 Teams
    </a>
  );
}

function IcsBtn({ date, slot }) {
  const dl = () => {
    try {
      const ds = date.toISOString().split("T")[0].replace(/-/g,"");
      const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${ds}T${pad(slot.startH)}${pad(slot.startM)}00\nDTEND:${ds}T${pad(slot.endH)}${pad(slot.endM)}00\nSUMMARY:Reunión con Guillermo Prado\nEND:VEVENT\nEND:VCALENDAR`;
      downloadFile(ics, `reunion-guillermo-${ds}.ics`, "text/calendar");
    } catch (e) { console.error(e); }
  };
  return <button onClick={dl} style={{ display:"inline-flex",alignItems:"center",gap:6,background:"#E2E8F0",color:"#475569",padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:"none",cursor:"pointer" }}>📅 .ics</button>;
}

export default function App() {
  const [view, setView] = useState("admin");
  const [monday, setMonday] = useState(getMonday(new Date()));
  const [weeks, setWeeks] = useState({});
  const [clients, setClients] = useState(DEFAULT_CLIENTS);
  const [templates, setTemplates] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [showClientMgr, setShowClientMgr] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [painting, setPainting] = useState(null);
  const [expandedSlot, setExpandedSlot] = useState(null);
  const [shareModal, setShareModal] = useState(null);
  const [emailField, setEmailField] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);

  const weekKey = fmtWeekKey(monday);
  const currentBlocks = weeks[weekKey] || defaultBlocks();

  useEffect(() => {
    const w = store.get("gp3-weeks");
    const c = store.get("gp3-clients");
    const t = store.get("gp3-templates");
    if (w) setWeeks(w);
    if (c) setClients(c);
    if (t) setTemplates(t);
    setLoaded(true);
  }, []);

  const persist = useCallback((w, c, t) => {
    if (w !== undefined) store.set("gp3-weeks", w);
    if (c !== undefined) store.set("gp3-clients", c);
    if (t !== undefined) store.set("gp3-templates", t);
  }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const clientMap = useMemo(() => {
    const m = {}; clients.forEach(c => m[c.id] = c); return m;
  }, [clients]);

  const setBlock = (slotKey, clientId) => {
    const updated = { ...weeks, [weekKey]: { ...currentBlocks, [slotKey]: clientId } };
    setWeeks(updated); persist(updated, undefined, undefined);
  };

  const cycleBlock = (slotKey) => {
    const opts = [...clients.map(c => c.id), FREE];
    const cur = currentBlocks[slotKey];
    return opts[(opts.indexOf(cur) + 1) % opts.length];
  };

  const navWeek = (d) => { const dt = new Date(monday); dt.setDate(dt.getDate() + d * 7); setMonday(dt); };
  const goToday = () => setMonday(getMonday(new Date()));

  const copyPrev = () => {
    const prev = new Date(monday); prev.setDate(prev.getDate() - 7);
    const pk = fmtWeekKey(prev);
    if (weeks[pk]) { const u = { ...weeks, [weekKey]: { ...weeks[pk] } }; setWeeks(u); persist(u, undefined, undefined); flash("Semana anterior copiada"); }
    else flash("No hay datos en la semana anterior");
  };

  const saveClients = (nc) => { setClients(nc); persist(undefined, nc, undefined); flash("Clientes actualizados"); };
  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const nt = { ...templates, [templateName.trim()]: { ...currentBlocks } };
    setTemplates(nt); persist(undefined, undefined, nt); setTemplateName(""); flash(`Plantilla guardada`);
  };
  const applyTemplate = (n) => {
    const u = { ...weeks, [weekKey]: { ...templates[n] } }; setWeeks(u); persist(u, undefined, undefined); flash(`Plantilla aplicada`); setShowTemplates(false);
  };
  const delTemplate = (n) => { const nt = { ...templates }; delete nt[n]; setTemplates(nt); persist(undefined, undefined, nt); flash("Eliminada"); };

  const stats = useMemo(() => {
    const s = {}; clients.forEach(c => s[c.id] = 0); s[FREE] = 0;
    Object.values(currentBlocks).forEach(v => { if (s[v] !== undefined) s[v]++; });
    return s;
  }, [currentBlocks, clients]);

  const weekRange = fmtRange(monday);

  const getShareEmail = (cId) => {
    return generateNaturalAvailability(currentBlocks, cId, clientMap[cId]?.name || cId, weekRange);
  };

  const getAdminSummary = () => generateAdminSummary(currentBlocks, clientMap, weekRange);

  const copyText = (t) => { navigator.clipboard.writeText(t); flash("Copiado al portapapeles ✓"); };

  const exportFullICS = () => {
    try {
      const ics = generateFullBlockingICS(currentBlocks, monday, clientMap);
      downloadFile(ics, `disponibilidad-${weekKey}.ics`, "text/calendar");
      flash("Archivo .ics descargado");
    } catch (e) { console.error(e); flash("Error al generar .ics"); }
  };

  const exportBlockingICS = (clientId) => {
    try {
      const ics = generateBlockingICS(currentBlocks, clientId, monday, clientMap);
      downloadFile(ics, `bloqueo-${clientMap[clientId]?.short || clientId}-${weekKey}.ics`, "text/calendar");
      flash("Bloqueo .ics descargado — Importa en Outlook");
    } catch (e) { console.error(e); flash("Error al generar bloqueo"); }
  };

  const isClient = view !== "admin" && clientMap[view];

  const [shareEmailText, setShareEmailText] = useState("");

  useEffect(() => {
    if (shareModal) setShareEmailText(getShareEmail(shareModal));
  }, [shareModal, currentBlocks]);

  if (!loaded) return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0F172A",color:"#E2E8F0",fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:"center" }}><div style={{ fontSize:32,marginBottom:12 }}>⏳</div><div>Cargando...</div></div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh",background:"#F8FAFC",fontFamily:"'DM Sans',sans-serif" }}
      onMouseUp={() => setPainting(null)} onMouseLeave={() => setPainting(null)}>
      <Toast msg={toast} />
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateX(-50%) translateY(-8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        * { box-sizing:border-box; margin:0; padding:0; }
        .cell { transition:all 0.12s ease; } .cell:hover { filter:brightness(0.94); }
        .btn { border:none; cursor:pointer; transition:all 0.15s ease; font-family:'DM Sans',sans-serif; }
        .btn:hover { filter:brightness(0.9); } .btn:active { transform:scale(0.97); }
        .nb { background:#E2E8F0; color:#334155; border:none; cursor:pointer; width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; transition:all 0.15s; }
        .nb:hover { background:#CBD5E1; }
        .tab { padding:10px 16px; border-radius:10px; border:none; cursor:pointer; font-size:12px; font-weight:600; transition:all 0.2s; font-family:'DM Sans',sans-serif; white-space:nowrap; }
      `}</style>

      <header style={{ background:"#0F172A",color:"white",padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:38,height:38,borderRadius:12,background:"linear-gradient(135deg,#2563EB,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,fontFamily:"'Space Mono',monospace",color:"white" }}>GP</div>
          <div>
            <div style={{ fontSize:16,fontWeight:700,letterSpacing:"-0.3px" }}>Guillermo Prado</div>
            <div style={{ fontSize:11,color:"#94A3B8",fontWeight:500 }}>Gestión de Disponibilidad</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:4,background:"#1E293B",borderRadius:12,padding:4,flexWrap:"wrap" }}>
          <button className="tab" onClick={() => setView("admin")} style={{ background:view==="admin"?"#7C3AED":"transparent",color:view==="admin"?"white":"#94A3B8" }}>⚙️ Admin</button>
          {clients.map(c => (
            <button key={c.id} className="tab" onClick={() => { setView(c.id); setExpandedSlot(null); }} style={{ background:view===c.id?c.color:"transparent",color:view===c.id?"white":"#94A3B8" }}>
              {c.icon} {c.short}
            </button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth:1000,margin:"0 auto",padding:"20px 16px" }}>

        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <button className="nb" onClick={() => navWeek(-1)}>←</button>
            <button className="nb" onClick={goToday} style={{ width:"auto",padding:"0 12px",fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif" }}>Hoy</button>
            <button className="nb" onClick={() => navWeek(1)}>→</button>
            <span style={{ fontSize:14,fontWeight:600,color:"#1E293B",marginLeft:6 }}>{weekRange}</span>
          </div>
          {view === "admin" && (
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              <button className="btn" onClick={copyPrev} style={{ background:"#E2E8F0",color:"#475569",padding:"7px 12px",borderRadius:10,fontSize:11,fontWeight:600 }}>← Copiar anterior</button>
              <button className="btn" onClick={() => setShowTemplates(!showTemplates)} style={{ background:"#E2E8F0",color:"#475569",padding:"7px 12px",borderRadius:10,fontSize:11,fontWeight:600 }}>📋 Plantillas</button>
              <button className="btn" onClick={() => setShowClientMgr(true)} style={{ background:"#E2E8F0",color:"#475569",padding:"7px 12px",borderRadius:10,fontSize:11,fontWeight:600 }}>👥 Clientes</button>
              <button className="btn" onClick={exportFullICS} style={{ background:"#E2E8F0",color:"#475569",padding:"7px 12px",borderRadius:10,fontSize:11,fontWeight:600 }}>📥 .ics completo</button>
              <button className="btn" onClick={() => copyText(getAdminSummary())} style={{ background:"#7C3AED",color:"white",padding:"7px 12px",borderRadius:10,fontSize:11,fontWeight:600 }}>📋 Copiar resumen</button>
            </div>
          )}
          {isClient && (
            <div style={{ display:"flex",gap:6 }}>
              <button className="btn" onClick={() => setShareModal(view)} style={{ background:clientMap[view].color,color:"white",padding:"7px 14px",borderRadius:10,fontSize:11,fontWeight:600 }}>✉️ Enviar disponibilidad</button>
              <button className="btn" onClick={() => exportBlockingICS(view)} style={{ background:"#0078D4",color:"white",padding:"7px 14px",borderRadius:10,fontSize:11,fontWeight:600 }}>🔒 Bloquear Outlook</button>
            </div>
          )}
        </div>

        {showTemplates && view === "admin" && (
          <div style={{ background:"white",borderRadius:16,padding:18,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#1E293B",marginBottom:10 }}>Plantillas de semana</div>
            <div style={{ display:"flex",gap:8,marginBottom:12 }}>
              <input placeholder="Nombre de plantilla..." value={templateName} onChange={e => setTemplateName(e.target.value)} onKeyDown={e => e.key==="Enter" && saveTemplate()}
                style={{ flex:1,border:"2px solid #E2E8F0",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",outline:"none" }} />
              <button className="btn" onClick={saveTemplate} style={{ background:"#059669",color:"white",padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:600 }}>Guardar actual</button>
            </div>
            {Object.keys(templates).length === 0 && <div style={{ color:"#94A3B8",fontSize:12,fontStyle:"italic" }}>No hay plantillas</div>}
            <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
              {Object.keys(templates).map(n => (
                <div key={n} style={{ display:"flex",alignItems:"center",gap:6,background:"#F1F5F9",borderRadius:8,padding:"6px 12px" }}>
                  <button className="btn" onClick={() => applyTemplate(n)} style={{ background:"none",fontSize:12,fontWeight:600,color:"#1E293B",padding:0 }}>📋 {n}</button>
                  <button className="btn" onClick={() => delTemplate(n)} style={{ background:"none",color:"#EF4444",padding:0,fontSize:11 }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "admin" && (
          <div style={{ display:"flex",gap:6,marginBottom:14,flexWrap:"wrap" }}>
            {clients.map(c => (
              <div key={c.id} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:`${c.color}12`,borderRadius:8,border:`2px solid ${c.color}25` }}>
                <span style={{ fontSize:13 }}>{c.icon}</span>
                <span style={{ fontSize:12,fontWeight:600,color:c.color }}>{c.short}</span>
                <span style={{ fontSize:11,color:c.color,opacity:0.7 }}>{(stats[c.id]||0)*4}h</span>
              </div>
            ))}
            <div style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"#F3F4F6",borderRadius:8,border:"2px solid #E5E7EB" }}>
              <span style={{ fontSize:12,fontWeight:600,color:"#6B7280" }}>✓ Libre</span>
              <span style={{ fontSize:11,color:"#6B7280" }}>{(stats[FREE]||0)*4}h</span>
            </div>
          </div>
        )}

        {isClient && (
          <div style={{ background:`${clientMap[view].color}08`,border:`1px solid ${clientMap[view].color}20`,borderRadius:14,padding:"14px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:12 }}>
            <span style={{ fontSize:24 }}>{clientMap[view].icon}</span>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:"#1E293B" }}>Vista: {clientMap[view].name}</div>
              <div style={{ fontSize:12,color:"#64748B" }}>
                Bloques asignados marcados. Huecos <span style={{ color:"#059669",fontWeight:600 }}>disponibles</span> → clic para convocar por Outlook/Teams.
                Usa <strong>🔒 Bloquear Outlook</strong> para importar los huecos no-disponibles a tu calendario.
              </div>
            </div>
          </div>
        )}

        <div style={{ background:"white",borderRadius:18,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",border:"1px solid #E2E8F0" }}>
          <div style={{ display:"grid",gridTemplateColumns:"72px repeat(5, 1fr)",borderBottom:"2px solid #E2E8F0" }}>
            <div style={{ padding:12 }} />
            {DAYS.map((d, i) => {
              const dd = dayDate(monday, i);
              const isToday = new Date().toDateString() === dd.toDateString();
              return (
                <div key={d.key} style={{ padding:"12px 6px",textAlign:"center",borderLeft:"1px solid #E2E8F0" }}>
                  <div style={{ fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:1 }}>{d.cap}</div>
                  <div style={{ fontSize:20,fontWeight:700,color:isToday?"#2563EB":"#1E293B",fontFamily:"'Space Mono',monospace",background:isToday?"#DBEAFE":"transparent",borderRadius:8,display:"inline-block",padding:"2px 8px",marginTop:2 }}>{dd.getDate()}</div>
                </div>
              );
            })}
          </div>

          {SLOTS.map(s => (
            <div key={s.key} style={{ display:"grid",gridTemplateColumns:"72px repeat(5, 1fr)",borderBottom:s.key==="am"?"1px solid #E2E8F0":"none" }}>
              <div style={{ padding:"12px 8px",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",background:"#F8FAFC" }}>
                <div style={{ fontSize:12,fontWeight:700,color:"#334155" }}>{s.capLabel}</div>
                <div style={{ fontSize:9,color:"#94A3B8",marginTop:2 }}>{s.time}</div>
              </div>
              {DAYS.map((d, di) => {
                const slotKey = `${d.key}_${s.key}`;
                const val = currentBlocks[slotKey];
                const dd = dayDate(monday, di);
                const isExp = expandedSlot === slotKey;

                if (isClient) {
                  const mine = val === view;
                  const free = val === FREE;
                  return (
                    <div key={slotKey} className="cell" style={{
                      borderLeft:"1px solid #E2E8F0",padding:free && isExp?"8px":"10px",
                      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                      background:mine?`${clientMap[view].color}15`:free?"#F0FDF4":"#F9FAFB",
                      cursor:free?"pointer":"default",minHeight:isExp?140:80,
                    }} onClick={() => free && setExpandedSlot(isExp ? null : slotKey)}>
                      {mine && <>
                        <span style={{ fontSize:18 }}>{clientMap[view].icon}</span>
                        <span style={{ fontSize:10,fontWeight:700,color:clientMap[view].color,marginTop:3 }}>Asignado</span>
                      </>}
                      {free && !isExp && <>
                        <div style={{ width:28,height:28,borderRadius:8,background:"#D1FAE5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>🟢</div>
                        <span style={{ fontSize:10,fontWeight:600,color:"#059669",marginTop:3 }}>Disponible</span>
                        <span style={{ fontSize:9,color:"#94A3B8",marginTop:1 }}>Clic → convocar</span>
                      </>}
                      {free && isExp && (
                        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6,width:"100%" }}>
                          <span style={{ fontSize:10,fontWeight:700,color:"#059669" }}>Convocar reunión:</span>
                          <OutlookBtn date={dd} slot={s} label="Outlook" />
                          <TeamsBtn date={dd} slot={s} />
                          <IcsBtn date={dd} slot={s} />
                        </div>
                      )}
                      {!mine && !free && <>
                        <span style={{ fontSize:14,opacity:0.5 }}>⛔</span>
                        <span style={{ fontSize:10,color:"#CBD5E1",marginTop:2,fontWeight:500 }}>No disponible</span>
                      </>}
                    </div>
                  );
                }

                const cl = val === FREE ? null : clientMap[val];
                return (
                  <div key={slotKey} className="cell" style={{
                    borderLeft:"1px solid #E2E8F0",padding:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    background:cl?`${cl.color}12`:"#FAFAFA",cursor:"pointer",userSelect:"none",minHeight:80,
                  }} onMouseDown={() => {
                    const next = cycleBlock(slotKey);
                    setPainting(next); setBlock(slotKey, next);
                  }} onMouseEnter={() => { if (painting !== null) setBlock(slotKey, painting); }}>
                    <span style={{ fontSize:20 }}>{cl ? cl.icon : "✓"}</span>
                    <span style={{ fontSize:11,fontWeight:700,color:cl?cl.color:"#9CA3AF",marginTop:3 }}>{cl ? cl.short : "Libre"}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {view === "admin" && (
          <div style={{ marginTop:16,display:"grid",gridTemplateColumns:`repeat(${Math.min(clients.length + 1, 5)}, 1fr)`,gap:8 }}>
            {clients.map(c => {
              const h = (stats[c.id]||0)*4; const pct = Math.round(((stats[c.id]||0)/10)*100);
              return (
                <div key={c.id} style={{ background:"white",borderRadius:12,padding:"14px 12px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",textAlign:"center",borderTop:`3px solid ${c.color}` }}>
                  <div style={{ fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:0.5 }}>{c.short}</div>
                  <div style={{ fontSize:24,fontWeight:700,color:c.color,fontFamily:"'Space Mono',monospace",margin:"2px 0" }}>{h}h</div>
                  <div style={{ fontSize:10,color:"#94A3B8" }}>{pct}%</div>
                  <div style={{ height:3,background:"#F1F5F9",borderRadius:2,marginTop:6,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${pct}%`,background:c.color,borderRadius:2,transition:"width 0.3s" }} />
                  </div>
                </div>
              );
            })}
            <div style={{ background:"white",borderRadius:12,padding:"14px 12px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",textAlign:"center",borderTop:"3px solid #9CA3AF" }}>
              <div style={{ fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase" }}>Libre</div>
              <div style={{ fontSize:24,fontWeight:700,color:"#9CA3AF",fontFamily:"'Space Mono',monospace",margin:"2px 0" }}>{(stats[FREE]||0)*4}h</div>
              <div style={{ fontSize:10,color:"#94A3B8" }}>{Math.round(((stats[FREE]||0)/10)*100)}%</div>
              <div style={{ height:3,background:"#F1F5F9",borderRadius:2,marginTop:6,overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${Math.round(((stats[FREE]||0)/10)*100)}%`,background:"#9CA3AF",borderRadius:2 }} />
              </div>
            </div>
          </div>
        )}

        {view === "admin" && (
          <div style={{ marginTop:16,background:"white",borderRadius:14,padding:"16px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize:13,fontWeight:700,color:"#1E293B",marginBottom:10 }}>📤 Enviar disponibilidad / Bloquear calendario</div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {clients.map(c => (
                <div key={c.id} style={{ display:"flex",gap:6 }}>
                  <button className="btn" onClick={() => setShareModal(c.id)} style={{ display:"flex",alignItems:"center",gap:6,background:`${c.color}12`,color:c.color,padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:600,border:`1px solid ${c.color}30` }}>
                    {c.icon} Enviar a {c.short}
                  </button>
                  <button className="btn" onClick={() => exportBlockingICS(c.id)} style={{ display:"flex",alignItems:"center",gap:6,background:"#0078D415",color:"#0078D4",padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:600,border:"1px solid #0078D430" }}>
                    🔒 Bloqueo {c.short}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop:12,fontSize:11,color:"#94A3B8",lineHeight:1.5 }}>
              <strong>🔒 Bloqueo:</strong> Descarga un .ics que al importar en Outlook crea eventos "Ocupado" en todos los huecos donde NO estás disponible para ese cliente. Así tu calendario refleja tu disponibilidad real.
            </div>
          </div>
        )}

        <div style={{ marginTop:20,padding:"12px 0",textAlign:"center",color:"#94A3B8",fontSize:10,fontWeight:500 }}>
          Externia · Gestión de Disponibilidad · {new Date().getFullYear()}
        </div>
      </div>

      {showClientMgr && <ClientManager clients={clients} onSave={saveClients} onClose={() => setShowClientMgr(false)} />}

      {shareModal && (
        <Modal onClose={() => { setShareModal(null); setEmailField(""); setEditingEmail(false); }}>
          <div style={{ fontSize:18,fontWeight:700,color:"#1E293B",marginBottom:4 }}>
            ✉️ Disponibilidad → {clientMap[shareModal]?.name}
          </div>
          <div style={{ fontSize:12,color:"#64748B",marginBottom:16 }}>
            Email generado automáticamente con tu disponibilidad de esta semana. Puedes editarlo antes de enviar.
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11,fontWeight:600,color:"#475569",display:"block",marginBottom:6 }}>Para:</label>
            <input value={emailField} onChange={e => setEmailField(e.target.value)} placeholder="nombre@empresa.com"
              style={{ border:"2px solid #E2E8F0",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%" }} />
          </div>

          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
              <label style={{ fontSize:11,fontWeight:600,color:"#475569" }}>Mensaje:</label>
              <button className="btn" onClick={() => setEditingEmail(!editingEmail)} style={{ background:"none",color:"#2563EB",padding:0,fontSize:11,fontWeight:600 }}>
                {editingEmail ? "Vista previa" : "✏️ Editar"}
              </button>
            </div>
            {editingEmail ? (
              <textarea value={shareEmailText} onChange={e => setShareEmailText(e.target.value)}
                style={{ width:"100%",minHeight:220,border:"2px solid #E2E8F0",borderRadius:10,padding:14,fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",lineHeight:1.6,resize:"vertical" }} />
            ) : (
              <div style={{ background:"#F8FAFC",borderRadius:12,padding:16,maxHeight:260,overflowY:"auto",fontSize:13,color:"#334155",whiteSpace:"pre-wrap",lineHeight:1.7 }}>
                {shareEmailText}
              </div>
            )}
            <button className="btn" onClick={() => { setShareEmailText(getShareEmail(shareModal)); setEditingEmail(false); }}
              style={{ marginTop:8,background:"none",color:"#94A3B8",padding:0,fontSize:11 }}>↻ Regenerar texto</button>
          </div>

          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            <a href={`mailto:${emailField ? encodeURIComponent(emailField) : ""}?subject=${encodeURIComponent(`Disponibilidad semana ${weekRange}`)}&body=${encodeURIComponent(shareEmailText)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#0078D4",color:"white",padding:"12px",borderRadius:10,fontSize:13,fontWeight:600,textDecoration:"none" }}>
              📧 Abrir en Outlook / Mail
            </a>
            <div style={{ display:"flex",gap:8 }}>
              <button className="btn" onClick={() => copyText(shareEmailText)} style={{ flex:1,background:"#1E293B",color:"white",padding:"12px",borderRadius:10,fontSize:13,fontWeight:600 }}>
                📋 Copiar texto
              </button>
              <button className="btn" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareEmailText)}`, "_blank")} style={{ flex:1,background:"#25D366",color:"white",padding:"12px",borderRadius:10,fontSize:13,fontWeight:600 }}>
                💬 WhatsApp
              </button>
            </div>
            <button className="btn" onClick={() => exportBlockingICS(shareModal)} style={{ background:"#F1F5F9",color:"#475569",padding:"12px",borderRadius:10,fontSize:13,fontWeight:600,width:"100%" }}>
              🔒 Descargar .ics de bloqueo para tu Outlook
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
