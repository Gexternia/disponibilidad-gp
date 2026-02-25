import { useState, useEffect, useCallback, useMemo, useRef } from "react";

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

const HOURS = [];
for (let h = 9; h < 19; h++) HOURS.push(h);

const FREE = "__free__";
const CAL_EVENT = "__cal__";
const TOTAL_SLOTS = DAYS.length * HOURS.length;

const MSAL_CDN = "https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js";
const GRAPH_SCOPES = ["Calendars.Read"];
const GRAPH_CALENDAR_URL = "https://graph.microsoft.com/v1.0/me/calendarView";

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
function fmtHour(h) { return `${h}:00`; }

function fmtOutlookDate(date, h, m) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(h)}:${pad(m)}:00`;
}

function defaultBlocks() {
  const b = {};
  DAYS.forEach(d => HOURS.forEach(h => b[`${d.key}_${h}`] = FREE));
  return b;
}

function joinNatural(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(", ") + " y " + items[items.length - 1];
}

function groupConsecutiveHours(hours) {
  if (hours.length === 0) return [];
  const sorted = [...hours].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0], end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) { end = sorted[i]; }
    else { ranges.push({ start, end: end + 1 }); start = sorted[i]; end = sorted[i]; }
  }
  ranges.push({ start, end: end + 1 });
  return ranges;
}

function describeRanges(ranges) {
  return ranges.map(r => {
    if (r.end - r.start === 1) return `${r.start}:00`;
    return `${r.start}:00 a ${r.end}:00`;
  });
}

function generateNaturalAvailability(blocks, clientId, clientName, weekRange) {
  const assignedByDay = {};
  const availableByDay = {};

  DAYS.forEach(d => {
    assignedByDay[d.key] = [];
    availableByDay[d.key] = [];
    HOURS.forEach(h => {
      const v = blocks[`${d.key}_${h}`];
      if (v === clientId) assignedByDay[d.key].push(h);
      else if (v === FREE) availableByDay[d.key].push(h);
    });
  });

  function describeDayHours(dayHoursMap) {
    const parts = [];
    const fullDays = [];
    const morningOnly = [];
    const afternoonOnly = [];
    const customDays = [];

    DAYS.forEach(d => {
      const hours = dayHoursMap[d.key];
      if (hours.length === 0) return;
      if (hours.length === 10) { fullDays.push(d.label); }
      else {
        const ranges = groupConsecutiveHours(hours);
        const isMorning = ranges.length === 1 && ranges[0].start === 9 && ranges[0].end === 14;
        const isAfternoon = ranges.length === 1 && ranges[0].start === 15 && ranges[0].end === 19;
        if (isMorning) morningOnly.push(d.label);
        else if (isAfternoon) afternoonOnly.push(d.label);
        else customDays.push({ day: d.label, ranges });
      }
    });

    if (fullDays.length > 0) parts.push(`${joinNatural(fullDays)} jornada completa (9:00–19:00)`);
    if (morningOnly.length > 0) parts.push(`${joinNatural(morningOnly)} por la mañana (9:00–14:00)`);
    if (afternoonOnly.length > 0) parts.push(`${joinNatural(afternoonOnly)} por la tarde (15:00–19:00)`);
    customDays.forEach(cd => {
      const desc = describeRanges(cd.ranges);
      parts.push(`${cd.day} de ${joinNatural(desc)}`);
    });
    return parts;
  }

  const dedicationParts = describeDayHours(assignedByDay);
  const availParts = describeDayHours(availableByDay);
  let msg = `¡Buenas!\n\nOs paso mi disponibilidad para esta semana (${weekRange}).`;
  if (dedicationParts.length > 0) msg += `\n\nEn principio, la dedicación al proyecto de ${clientName} será: ${joinNatural(dedicationParts)}.`;
  if (availParts.length > 0) msg += `\n\nAparte de eso, tengo hueco libre ${joinNatural(availParts)}, por si necesitáis cuadrar alguna reunión o llamada extra.`;
  else if (dedicationParts.length > 0) msg += `\n\nEl resto de la semana lo tengo comprometido con otros proyectos, así que si necesitáis algo fuera de esos bloques avisadme con tiempo e intentamos cuadrarlo.`;
  if (dedicationParts.length === 0 && availParts.length > 0) msg += `\n\nEsta semana no tengo bloques fijos asignados al proyecto, pero estoy disponible ${joinNatural(availParts)}.`;
  if (dedicationParts.length === 0 && availParts.length === 0) msg += `\n\nEsta semana la tengo bastante comprometida con otros proyectos. Si surge algo urgente escribidme e intentamos buscar un hueco.`;
  msg += `\n\nPara cualquier reunión, enviadme la convocatoria por Outlook/Teams y la acepto directamente.\n\nUn saludo,\nGuillermo`;
  return msg;
}

function generateAdminSummary(blocks, clientMap, weekRange) {
  let msg = `📅 Disponibilidad semana ${weekRange}\n\n`;
  DAYS.forEach(d => {
    const dayHours = {};
    HOURS.forEach(h => {
      const v = blocks[`${d.key}_${h}`];
      const label = v === FREE ? "Libre" : (clientMap[v]?.short || v);
      if (!dayHours[label]) dayHours[label] = [];
      dayHours[label].push(h);
    });
    msg += `${d.cap}:\n`;
    Object.entries(dayHours).forEach(([label, hours]) => {
      const ranges = groupConsecutiveHours(hours);
      const desc = ranges.map(r => `${r.start}:00-${r.end}:00`).join(", ");
      msg += `  ${label}: ${desc}\n`;
    });
    msg += "\n";
  });
  return msg;
}

function generateBlockingICS(blocks, clientId, monday, clientMap) {
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Externia//Bloqueo//ES\nMETHOD:PUBLISH\nX-WR-TIMEZONE:Europe/Madrid\n";
  DAYS.forEach((d, di) => {
    HOURS.forEach(h => {
      const v = blocks[`${d.key}_${h}`];
      if (v !== clientId && v !== FREE) {
        const dd = dayDate(monday, di);
        const ds = dd.toISOString().split("T")[0].replace(/-/g, "");
        ics += `BEGIN:VEVENT\nUID:block-${ds}-${h}@externia.es\nDTSTART;TZID=Europe/Madrid:${ds}T${pad(h)}0000\nDTEND;TZID=Europe/Madrid:${ds}T${pad(h + 1)}0000\nSUMMARY:🔒 No disponible - Guillermo\nTRANSP:OPAQUE\nX-MICROSOFT-CDO-BUSYSTATUS:BUSY\nSTATUS:CONFIRMED\nEND:VEVENT\n`;
      }
    });
  });
  ics += "END:VCALENDAR";
  return ics;
}

function generateFullICS(blocks, monday, clientMap) {
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Externia//Disponibilidad//ES\nMETHOD:PUBLISH\nX-WR-TIMEZONE:Europe/Madrid\n";
  DAYS.forEach((d, di) => {
    HOURS.forEach(h => {
      const v = blocks[`${d.key}_${h}`];
      if (v !== FREE) {
        const cl = clientMap[v];
        const dd = dayDate(monday, di);
        const ds = dd.toISOString().split("T")[0].replace(/-/g, "");
        ics += `BEGIN:VEVENT\nUID:dispo-${ds}-${h}@externia.es\nDTSTART;TZID=Europe/Madrid:${ds}T${pad(h)}0000\nDTEND;TZID=Europe/Madrid:${ds}T${pad(h + 1)}0000\nSUMMARY:${cl ? cl.icon + " " + cl.short : "Ocupado"}\nTRANSP:OPAQUE\nX-MICROSOFT-CDO-BUSYSTATUS:BUSY\nSTATUS:CONFIRMED\nEND:VEVENT\n`;
      }
    });
  });
  ics += "END:VCALENDAR";
  return ics;
}

function downloadFile(content, filename, type) {
  try {
    const base64 = btoa(unescape(encodeURIComponent(content)));
    const a = document.createElement("a");
    a.href = `data:${type};base64,${base64}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) { console.error("Download error:", e); }
}

const store = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let msalInstance = null;
let msalLoaded = false;
let msalLoadPromise = null;

function loadMsal() {
  if (msalLoadPromise) return msalLoadPromise;
  msalLoadPromise = new Promise((resolve) => {
    if (window.msal) { msalLoaded = true; resolve(true); return; }
    const s = document.createElement("script");
    s.src = MSAL_CDN;
    s.onload = () => { msalLoaded = true; resolve(true); };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return msalLoadPromise;
}

function initMsal(clientId, redirectUri) {
  if (!window.msal || !clientId) return null;
  try {
    msalInstance = new window.msal.PublicClientApplication({
      auth: { clientId, authority: "https://login.microsoftonline.com/common", redirectUri },
      cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
    });
    return msalInstance;
  } catch (e) { console.error("MSAL init error:", e); return null; }
}

async function msalLogin(instance, loginHint) {
  try {
    const resp = await instance.loginPopup({
      scopes: GRAPH_SCOPES,
      prompt: "select_account",
      loginHint: loginHint || undefined,
    });
    return resp.account;
  } catch (e) { console.error("Login error:", e); return null; }
}

async function msalGetToken(instance, account) {
  try {
    const resp = await instance.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
    return resp.accessToken;
  } catch {
    try {
      const resp = await instance.acquireTokenPopup({ scopes: GRAPH_SCOPES, account });
      return resp.accessToken;
    } catch (e) { console.error("Token error:", e); return null; }
  }
}

async function fetchCalendarEvents(token, startDate, endDate) {
  const start = startDate.toISOString();
  const end = endDate.toISOString();
  const url = `${GRAPH_CALENDAR_URL}?startDateTime=${start}&endDateTime=${end}&$top=200&$select=subject,start,end,isAllDay,showAs,organizer&$orderby=start/dateTime`;
  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error(`Graph API ${resp.status}`);
    const data = await resp.json();
    return data.value || [];
  } catch (e) { console.error("Calendar fetch error:", e); return []; }
}

function parseEventsToSlots(events, monday) {
  const slots = {};
  events.forEach(ev => {
    if (ev.isAllDay) {
      const evDate = new Date(ev.start.dateTime + "Z");
      const dayIdx = Math.round((evDate - monday) / 86400000);
      const day = DAYS[dayIdx];
      if (day) HOURS.forEach(h => {
        const key = `${day.key}_${h}`;
        if (!slots[key]) slots[key] = [];
        slots[key].push({ subject: ev.subject, allDay: true });
      });
      return;
    }

    const startLocal = new Date(ev.start.dateTime + (ev.start.timeZone === "UTC" ? "Z" : ""));
    const endLocal = new Date(ev.end.dateTime + (ev.end.timeZone === "UTC" ? "Z" : ""));

    if (ev.start.timeZone === "UTC") {
      startLocal.setTime(startLocal.getTime());
      endLocal.setTime(endLocal.getTime());
    }

    const startH = startLocal.getHours();
    const endH = endLocal.getMinutes() > 0 ? endLocal.getHours() + 1 : endLocal.getHours();
    const dayIdx = Math.round((new Date(startLocal.getFullYear(), startLocal.getMonth(), startLocal.getDate()) - monday) / 86400000);
    const day = DAYS[dayIdx];
    if (!day) return;

    for (let h = Math.max(startH, 9); h < Math.min(endH, 19); h++) {
      const key = `${day.key}_${h}`;
      if (!slots[key]) slots[key] = [];
      slots[key].push({
        subject: ev.subject,
        start: `${pad(startLocal.getHours())}:${pad(startLocal.getMinutes())}`,
        end: `${pad(endLocal.getHours())}:${pad(endLocal.getMinutes())}`,
      });
    }
  });
  return slots;
}

function Modal({ children, onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div style={{ background:"white",borderRadius:20,padding:28,width:580,maxWidth:"92vw",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div style={{ position:"fixed",top:24,left:"50%",transform:"translateX(-50%)",background:"#0F172A",color:"#E2E8F0",padding:"12px 24px",borderRadius:12,fontSize:14,fontWeight:500,zIndex:1000,boxShadow:"0 8px 32px rgba(0,0,0,0.2)",animation:"fadeIn 0.3s ease" }}>{msg}</div>;
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

function OutlookBtn({ date, hour, compact }) {
  const start = fmtOutlookDate(date, hour, 0);
  const end = fmtOutlookDate(date, hour + 1, 0);
  const subject = encodeURIComponent("Reunión con Guillermo Prado");
  const body = encodeURIComponent("Hola Guillermo,\n\nTe convoco en tu horario disponible.\n\nSaludos");
  const url = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${subject}&body=${body}&startdt=${start}&enddt=${end}&to=guillermo@externia.es`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:4,background:"#0078D4",color:"white",padding:compact?"4px 8px":"6px 12px",borderRadius:6,fontSize:compact?9:11,fontWeight:600,textDecoration:"none",whiteSpace:"nowrap" }}>
      📧 Outlook
    </a>
  );
}

function TeamsBtn({ date, hour, compact }) {
  const start = fmtOutlookDate(date, hour, 0);
  const subject = encodeURIComponent("Reunión con Guillermo Prado");
  const url = `https://teams.microsoft.com/l/meeting/new?subject=${subject}&startTime=${start}&content=${encodeURIComponent("Convocatoria en horario disponible")}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:4,background:"#5B5FC7",color:"white",padding:compact?"4px 8px":"6px 12px",borderRadius:6,fontSize:compact?9:11,fontWeight:600,textDecoration:"none",whiteSpace:"nowrap" }}>
      💬 Teams
    </a>
  );
}

function CalendarSetup({ clients, connections, onUpdate, onClose, msalReady, onConnect, onDisconnect, onSync, syncing }) {
  const [clientId, setClientId] = useState(store.get("gp4-azure-client-id") || "");
  const [saved, setSaved] = useState(!!store.get("gp4-azure-client-id"));

  const saveClientId = () => {
    store.set("gp4-azure-client-id", clientId.trim());
    setSaved(true);
    onUpdate();
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ fontSize:18,fontWeight:700,color:"#1E293B",marginBottom:4 }}>📅 Sincronización con Outlook</div>
      <div style={{ fontSize:12,color:"#64748B",marginBottom:20 }}>Conecta tus cuentas de Microsoft para ver los eventos del calendario en el grid.</div>

      <div style={{ background:"#F0F9FF",borderRadius:12,padding:16,marginBottom:20,border:"1px solid #BAE6FD" }}>
        <div style={{ fontSize:12,fontWeight:700,color:"#0369A1",marginBottom:8 }}>1️⃣ Configuración Azure (una sola vez)</div>
        <div style={{ fontSize:11,color:"#475569",lineHeight:1.7,marginBottom:12 }}>
          Para conectar tus calendarios necesitas registrar una app en Azure AD:
          <br/>• Ve a <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" style={{ color:"#2563EB",fontWeight:600 }}>Azure Portal → App Registrations</a>
          <br/>• Clic en "New registration"
          <br/>• Nombre: "Disponibilidad GP" (o lo que quieras)
          <br/>• Supported account types: <strong>"Accounts in any organizational directory and personal Microsoft accounts"</strong>
          <br/>• Redirect URI → <strong>Single-page application (SPA)</strong> → <code style={{ background:"#E2E8F0",padding:"1px 4px",borderRadius:4,fontSize:10 }}>{window.location.origin + window.location.pathname}</code>
          <br/>• Copia el <strong>Application (client) ID</strong> y pégalo aquí abajo
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <input value={clientId} onChange={e => { setClientId(e.target.value); setSaved(false); }} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            style={{ flex:1,border:"2px solid #E2E8F0",borderRadius:8,padding:"8px 12px",fontSize:12,fontFamily:"'JetBrains Mono',monospace",outline:"none" }} />
          <button onClick={saveClientId} style={{ background:saved?"#059669":"#2563EB",color:"white",border:"none",padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" }}>
            {saved ? "✓ Guardado" : "Guardar"}
          </button>
        </div>
      </div>

      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12,fontWeight:700,color:"#1E293B",marginBottom:10 }}>2️⃣ Conectar cuentas de Microsoft</div>
        <div style={{ fontSize:11,color:"#64748B",marginBottom:12 }}>
          Vincula cada cuenta de Outlook/365 con el cliente correspondiente. Así la app sabe qué calendario pertenece a cada proyecto.
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {clients.map(c => {
            const conn = connections.find(x => x.clientId === c.id);
            return (
              <div key={c.id} style={{ display:"flex",alignItems:"center",gap:10,background:"#F8FAFC",borderRadius:10,padding:"10px 14px",borderLeft:`4px solid ${c.color}` }}>
                <span style={{ fontSize:16 }}>{c.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:"#1E293B" }}>{c.name}</div>
                  {conn ? (
                    <div style={{ fontSize:10,color:"#059669",fontWeight:500 }}>✓ {conn.email}</div>
                  ) : (
                    <div style={{ fontSize:10,color:"#94A3B8" }}>Sin conectar</div>
                  )}
                </div>
                {conn ? (
                  <button onClick={() => onDisconnect(c.id)} style={{ background:"#FEE2E2",color:"#DC2626",border:"none",padding:"5px 10px",borderRadius:6,fontSize:10,fontWeight:600,cursor:"pointer" }}>
                    Desconectar
                  </button>
                ) : (
                  <button onClick={() => onConnect(c.id)} disabled={!msalReady}
                    style={{ background:msalReady?c.color:"#CBD5E1",color:"white",border:"none",padding:"5px 10px",borderRadius:6,fontSize:10,fontWeight:600,cursor:msalReady?"pointer":"not-allowed",opacity:msalReady?1:0.5 }}>
                    Conectar cuenta
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {connections.length > 0 && (
        <button onClick={onSync} disabled={syncing}
          style={{ width:"100%",background:syncing?"#94A3B8":"#0F172A",color:"white",border:"none",padding:"12px",borderRadius:10,fontSize:13,fontWeight:600,cursor:syncing?"wait":"pointer",marginBottom:12 }}>
          {syncing ? "⏳ Sincronizando..." : "🔄 Sincronizar calendarios ahora"}
        </button>
      )}

      {!msalReady && saved && (
        <div style={{ background:"#FEF3C7",borderRadius:8,padding:10,fontSize:11,color:"#92400E" }}>
          ⚠️ MSAL.js cargando... Si no funciona, recarga la página.
        </div>
      )}
    </Modal>
  );
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
  const [showCalSetup, setShowCalSetup] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [painting, setPainting] = useState(null);
  const [expandedSlot, setExpandedSlot] = useState(null);
  const [shareModal, setShareModal] = useState(null);
  const [emailField, setEmailField] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [shareEmailText, setShareEmailText] = useState("");
  const [paintClient, setPaintClient] = useState(null);

  const [msalReady, setMsalReady] = useState(false);
  const [calConnections, setCalConnections] = useState([]);
  const [calEvents, setCalEvents] = useState({});
  const [syncing, setSyncing] = useState(false);
  const msalRef = useRef(null);

  const weekKey = fmtWeekKey(monday);
  const currentBlocks = weeks[weekKey] || defaultBlocks();

  useEffect(() => {
    const w = store.get("gp4-weeks");
    const c = store.get("gp4-clients");
    const t = store.get("gp4-templates");
    const conn = store.get("gp4-cal-connections");
    if (w) setWeeks(w);
    if (c) setClients(c);
    if (t) setTemplates(t);
    if (conn) setCalConnections(conn);
    setLoaded(true);

    initMsalFromStorage();
  }, []);

  async function initMsalFromStorage() {
    const cid = store.get("gp4-azure-client-id");
    if (!cid) return;
    const ok = await loadMsal();
    if (!ok) return;
    const inst = initMsal(cid, window.location.origin + window.location.pathname);
    if (inst) {
      msalRef.current = inst;
      try { await inst.initialize(); } catch {}
      setMsalReady(true);
    }
  }

  const handleMsalUpdate = async () => {
    const cid = store.get("gp4-azure-client-id");
    if (!cid) return;
    const ok = await loadMsal();
    if (!ok) return;
    const inst = initMsal(cid, window.location.origin + window.location.pathname);
    if (inst) {
      msalRef.current = inst;
      try { await inst.initialize(); } catch {}
      setMsalReady(true);
    }
  };

  const connectAccount = async (clientId) => {
    if (!msalRef.current) return;
    const account = await msalLogin(msalRef.current);
    if (!account) { flash("No se pudo conectar"); return; }
    const updated = calConnections.filter(x => x.clientId !== clientId);
    updated.push({ clientId, email: account.username, homeAccountId: account.homeAccountId });
    setCalConnections(updated);
    store.set("gp4-cal-connections", updated);
    flash(`✓ Conectado: ${account.username}`);
  };

  const disconnectAccount = (clientId) => {
    const updated = calConnections.filter(x => x.clientId !== clientId);
    setCalConnections(updated);
    store.set("gp4-cal-connections", updated);
    const evts = { ...calEvents };
    delete evts[clientId];
    setCalEvents(evts);
    flash("Cuenta desconectada");
  };

  const syncCalendars = async () => {
    if (!msalRef.current || calConnections.length === 0) return;
    setSyncing(true);
    const start = new Date(monday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(monday);
    end.setDate(end.getDate() + 5);
    end.setHours(0, 0, 0, 0);

    const allEvents = {};
    for (const conn of calConnections) {
      const accounts = msalRef.current.getAllAccounts();
      const acc = accounts.find(a => a.homeAccountId === conn.homeAccountId);
      if (!acc) { allEvents[conn.clientId] = {}; continue; }

      const token = await msalGetToken(msalRef.current, acc);
      if (!token) { allEvents[conn.clientId] = {}; continue; }

      const events = await fetchCalendarEvents(token, start, end);
      allEvents[conn.clientId] = parseEventsToSlots(events, monday);
    }

    setCalEvents(allEvents);
    setSyncing(false);
    flash(`✓ Sincronizado: ${Object.values(allEvents).reduce((sum, ev) => sum + Object.keys(ev).length, 0)} franjas con eventos`);
  };

  useEffect(() => {
    if (calConnections.length > 0 && msalReady) {
      syncCalendars();
    }
  }, [weekKey, msalReady]);

  const persist = useCallback((w, c, t) => {
    if (w !== undefined) store.set("gp4-weeks", w);
    if (c !== undefined) store.set("gp4-clients", c);
    if (t !== undefined) store.set("gp4-templates", t);
  }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const clientMap = useMemo(() => {
    const m = {}; clients.forEach(c => m[c.id] = c); return m;
  }, [clients]);

  const setBlock = (slotKey, clientId) => {
    const updated = { ...weeks, [weekKey]: { ...currentBlocks, [slotKey]: clientId } };
    setWeeks(updated); persist(updated, undefined, undefined);
  };

  const activePaint = paintClient || clients[0]?.id || FREE;

  const cycleBlock = (slotKey) => {
    const cur = currentBlocks[slotKey];
    if (cur === activePaint) return FREE;
    return activePaint;
  };

  const navWeek = (d) => { const dt = new Date(monday); dt.setDate(dt.getDate() + d * 7); setMonday(dt); };
  const goToday = () => setMonday(getMonday(new Date()));

  const copyPrev = () => {
    const prev = new Date(monday); prev.setDate(prev.getDate() - 7);
    const pk = fmtWeekKey(prev);
    if (weeks[pk]) { const u = { ...weeks, [weekKey]: { ...weeks[pk] } }; setWeeks(u); persist(u, undefined, undefined); flash("Semana anterior copiada"); }
    else flash("No hay datos en la semana anterior");
  };

  const clearWeek = () => { const u = { ...weeks, [weekKey]: defaultBlocks() }; setWeeks(u); persist(u, undefined, undefined); flash("Semana limpiada"); };

  const autoFillFromCalendar = () => {
    if (Object.keys(calEvents).length === 0) { flash("Sincroniza los calendarios primero"); return; }
    const newBlocks = { ...currentBlocks };
    Object.entries(calEvents).forEach(([clientId, slots]) => {
      Object.keys(slots).forEach(slotKey => {
        if (newBlocks[slotKey] === FREE) {
          newBlocks[slotKey] = clientId;
        }
      });
    });
    const u = { ...weeks, [weekKey]: newBlocks };
    setWeeks(u); persist(u, undefined, undefined);
    flash("✓ Bloques rellenados desde calendarios");
  };

  const saveClients = (nc) => { setClients(nc); persist(undefined, nc, undefined); flash("Clientes actualizados"); };
  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const nt = { ...templates, [templateName.trim()]: { ...currentBlocks } };
    setTemplates(nt); persist(undefined, undefined, nt); setTemplateName(""); flash("Plantilla guardada");
  };
  const applyTemplate = (n) => {
    const u = { ...weeks, [weekKey]: { ...templates[n] } }; setWeeks(u); persist(u, undefined, undefined); flash("Plantilla aplicada"); setShowTemplates(false);
  };
  const delTemplate = (n) => { const nt = { ...templates }; delete nt[n]; setTemplates(nt); persist(undefined, undefined, nt); flash("Eliminada"); };

  const stats = useMemo(() => {
    const s = {}; clients.forEach(c => s[c.id] = 0); s[FREE] = 0;
    Object.values(currentBlocks).forEach(v => { if (s[v] !== undefined) s[v]++; else s[FREE]++; });
    return s;
  }, [currentBlocks, clients]);

  const weekRange = fmtRange(monday);
  const getShareEmail = (cId) => generateNaturalAvailability(currentBlocks, cId, clientMap[cId]?.name || cId, weekRange);
  const getAdminSummary = () => generateAdminSummary(currentBlocks, clientMap, weekRange);
  const copyText = (t) => { navigator.clipboard.writeText(t); flash("Copiado ✓"); };

  const exportFullICS = () => {
    try {
      downloadFile(generateFullICS(currentBlocks, monday, clientMap), `disponibilidad-${weekKey}.ics`, "text/calendar");
      flash("ICS descargado");
    } catch { flash("Error al generar .ics"); }
  };

  const exportBlockingICS = (cId) => {
    try {
      downloadFile(generateBlockingICS(currentBlocks, cId, monday, clientMap), `bloqueo-${clientMap[cId]?.short || cId}-${weekKey}.ics`, "text/calendar");
      flash("Bloqueo .ics descargado");
    } catch { flash("Error"); }
  };

  const isClient = view !== "admin" && clientMap[view];

  useEffect(() => {
    if (shareModal) setShareEmailText(getShareEmail(shareModal));
  }, [shareModal, weekKey, currentBlocks]);

  const allCalSlots = useMemo(() => {
    const merged = {};
    Object.entries(calEvents).forEach(([clientId, slots]) => {
      Object.entries(slots).forEach(([slotKey, events]) => {
        if (!merged[slotKey]) merged[slotKey] = [];
        events.forEach(ev => merged[slotKey].push({ ...ev, clientId }));
      });
    });
    return merged;
  }, [calEvents]);

  const hasCalData = Object.keys(calEvents).length > 0;

  if (!loaded) return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0F172A",color:"#E2E8F0",fontFamily:"'Archivo',sans-serif" }}>
      <div style={{ textAlign:"center" }}><div style={{ fontSize:32,marginBottom:12 }}>⏳</div><div>Cargando...</div></div>
    </div>
  );

  const isMorning = (h) => h < 14;

  return (
    <div style={{ minHeight:"100vh",background:"#F1F5F9",fontFamily:"'Archivo',sans-serif" }}
      onMouseUp={() => setPainting(null)} onMouseLeave={() => setPainting(null)}>
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
      <Toast msg={toast} />
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateX(-50%) translateY(-8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        * { box-sizing:border-box; margin:0; padding:0; }
        .cell { transition:background 0.1s ease; } .cell:hover { filter:brightness(0.92); }
        .btn { border:none; cursor:pointer; transition:all 0.15s ease; font-family:'Archivo',sans-serif; }
        .btn:hover { filter:brightness(0.9); } .btn:active { transform:scale(0.97); }
        .nb { background:#E2E8F0; color:#334155; border:none; cursor:pointer; width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:15px; transition:all 0.15s; }
        .nb:hover { background:#CBD5E1; }
        .tab { padding:8px 14px; border-radius:8px; border:none; cursor:pointer; font-size:11px; font-weight:600; transition:all 0.2s; font-family:'Archivo',sans-serif; white-space:nowrap; }
        .paint-btn { padding:6px 12px; border-radius:8px; border:2px solid transparent; cursor:pointer; font-size:11px; font-weight:700; font-family:'Archivo',sans-serif; transition:all 0.15s; display:flex; align-items:center; gap:5px; }
        .paint-btn:hover { filter:brightness(0.95); }
        .cal-dot { width:6px; height:6px; border-radius:50%; display:inline-block; flex-shrink:0; }
        .cal-badge { display:inline-flex; align-items:center; gap:3px; padding:1px 5px; border-radius:4px; font-size:8px; font-weight:600; line-height:1.3; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      `}</style>

      <header style={{ background:"#0F172A",color:"white",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#2563EB,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",color:"white" }}>GP</div>
          <div>
            <div style={{ fontSize:15,fontWeight:700,letterSpacing:"-0.3px" }}>Guillermo Prado</div>
            <div style={{ fontSize:10,color:"#94A3B8",fontWeight:500 }}>Gestión de Disponibilidad</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:3,background:"#1E293B",borderRadius:10,padding:3,flexWrap:"wrap" }}>
          <button className="tab" onClick={() => setView("admin")} style={{ background:view==="admin"?"#7C3AED":"transparent",color:view==="admin"?"white":"#94A3B8" }}>⚙️ Admin</button>
          {clients.map(c => (
            <button key={c.id} className="tab" onClick={() => { setView(c.id); setExpandedSlot(null); }} style={{ background:view===c.id?c.color:"transparent",color:view===c.id?"white":"#94A3B8" }}>
              {c.icon} {c.short}
            </button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth:1100,margin:"0 auto",padding:"16px 12px" }}>

        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8 }}>
          <div style={{ display:"flex",alignItems:"center",gap:5 }}>
            <button className="nb" onClick={() => navWeek(-1)}>←</button>
            <button className="nb" onClick={goToday} style={{ width:"auto",padding:"0 10px",fontSize:11,fontWeight:700,fontFamily:"'Archivo',sans-serif" }}>Hoy</button>
            <button className="nb" onClick={() => navWeek(1)}>→</button>
            <span style={{ fontSize:13,fontWeight:700,color:"#1E293B",marginLeft:6,fontFamily:"'JetBrains Mono',monospace" }}>{weekRange}</span>
          </div>
          {view === "admin" && (
            <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
              <button className="btn" onClick={() => setShowCalSetup(true)} style={{ background:hasCalData?"#059669":"#0891B2",color:"white",padding:"6px 10px",borderRadius:8,fontSize:10,fontWeight:600 }}>
                {hasCalData ? "📅 Calendario ✓" : "📅 Calendario"}
              </button>
              {hasCalData && (
                <>
                  <button className="btn" onClick={syncCalendars} disabled={syncing} style={{ background:"#0F172A",color:"white",padding:"6px 10px",borderRadius:8,fontSize:10,fontWeight:600,opacity:syncing?0.5:1 }}>
                    {syncing ? "⏳" : "🔄"} Sync
                  </button>
                  <button className="btn" onClick={autoFillFromCalendar} style={{ background:"#7C3AED",color:"white",padding:"6px 10px",borderRadius:8,fontSize:10,fontWeight:600 }}>
                    ✨ Auto-rellenar
                  </button>
                </>
              )}
              <button className="btn" onClick={copyPrev} style={{ background:"#E2E8F0",color:"#475569",padding:"6px 10px",borderRadius:8,fontSize:10,fontWeight:600 }}>← Copiar</button>
              <button className="btn" onClick={clearWeek} style={{ background:"#FEE2E2",color:"#DC2626",padding:"6px 10px",borderRadius:8,fontSize:10,fontWeight:600 }}>🗑</button>
              <button className="btn" onClick={() => setShowTemplates(!showTemplates)} style={{ background:"#E2E8F0",color:"#475569",padding:"6px 10px",borderRadius:8,fontSize:10,fontWeight:600 }}>📋</button>
              <button className="btn" onClick={() => setShowClientMgr(true)} style={{ background:"#E2E8F0",color:"#475569",padding:"6px 10px",borderRadius:8,fontSize:10,fontWeight:600 }}>👥</button>
              <button className="btn" onClick={exportFullICS} style={{ background:"#E2E8F0",color:"#475569",padding:"6px 10px",borderRadius:8,fontSize:10,fontWeight:600 }}>📥</button>
              <button className="btn" onClick={() => copyText(getAdminSummary())} style={{ background:"#7C3AED",color:"white",padding:"6px 10px",borderRadius:8,fontSize:10,fontWeight:600 }}>📋 Resumen</button>
            </div>
          )}
          {isClient && (
            <div style={{ display:"flex",gap:5 }}>
              <button className="btn" onClick={() => setShareModal(view)} style={{ background:clientMap[view].color,color:"white",padding:"6px 12px",borderRadius:8,fontSize:10,fontWeight:600 }}>✉️ Enviar</button>
              <button className="btn" onClick={() => exportBlockingICS(view)} style={{ background:"#0078D4",color:"white",padding:"6px 12px",borderRadius:8,fontSize:10,fontWeight:600 }}>🔒 Bloquear</button>
            </div>
          )}
        </div>

        {showTemplates && view === "admin" && (
          <div style={{ background:"white",borderRadius:14,padding:16,marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:13,fontWeight:700,color:"#1E293B",marginBottom:8 }}>Plantillas</div>
            <div style={{ display:"flex",gap:6,marginBottom:10 }}>
              <input placeholder="Nombre..." value={templateName} onChange={e => setTemplateName(e.target.value)} onKeyDown={e => e.key==="Enter" && saveTemplate()}
                style={{ flex:1,border:"2px solid #E2E8F0",borderRadius:8,padding:"7px 10px",fontSize:12,fontFamily:"inherit",outline:"none" }} />
              <button className="btn" onClick={saveTemplate} style={{ background:"#059669",color:"white",padding:"7px 14px",borderRadius:8,fontSize:11,fontWeight:600 }}>Guardar</button>
            </div>
            {Object.keys(templates).length === 0 && <div style={{ color:"#94A3B8",fontSize:11,fontStyle:"italic" }}>No hay plantillas</div>}
            <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
              {Object.keys(templates).map(n => (
                <div key={n} style={{ display:"flex",alignItems:"center",gap:5,background:"#F1F5F9",borderRadius:8,padding:"5px 10px" }}>
                  <button className="btn" onClick={() => applyTemplate(n)} style={{ background:"none",fontSize:11,fontWeight:600,color:"#1E293B",padding:0 }}>📋 {n}</button>
                  <button className="btn" onClick={() => delTemplate(n)} style={{ background:"none",color:"#EF4444",padding:0,fontSize:10 }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "admin" && (
          <div style={{ display:"flex",gap:5,marginBottom:10,flexWrap:"wrap",alignItems:"center" }}>
            <span style={{ fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:0.5 }}>Pintar:</span>
            {clients.map(c => (
              <button key={c.id} className="paint-btn" onClick={() => setPaintClient(c.id)}
                style={{ background:activePaint===c.id?`${c.color}20`:"#F8FAFC",borderColor:activePaint===c.id?c.color:"#E2E8F0",color:c.color }}>
                {c.icon} {c.short} <span style={{ fontSize:9,opacity:0.7 }}>{stats[c.id]||0}h</span>
              </button>
            ))}
            <button className="paint-btn" onClick={() => setPaintClient(FREE)}
              style={{ background:activePaint===FREE?"#F0FDF4":"#F8FAFC",borderColor:activePaint===FREE?"#059669":"#E2E8F0",color:"#6B7280" }}>
              ✓ Libre <span style={{ fontSize:9,opacity:0.7 }}>{stats[FREE]||0}h</span>
            </button>
          </div>
        )}

        {isClient && (
          <div style={{ background:`${clientMap[view].color}08`,border:`1px solid ${clientMap[view].color}20`,borderRadius:12,padding:"12px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:10 }}>
            <span style={{ fontSize:22 }}>{clientMap[view].icon}</span>
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:"#1E293B" }}>{clientMap[view].name}</div>
              <div style={{ fontSize:11,color:"#64748B" }}>Bloques asignados en color. Huecos <span style={{ color:"#059669",fontWeight:600 }}>verdes</span> → clic para convocar.</div>
            </div>
          </div>
        )}

        <div style={{ background:"white",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",border:"1px solid #E2E8F0" }}>
          <div style={{ display:"grid",gridTemplateColumns:"54px repeat(5, 1fr)",borderBottom:"2px solid #E2E8F0",position:"sticky",top:0,zIndex:2,background:"white" }}>
            <div style={{ padding:8 }} />
            {DAYS.map((d, i) => {
              const dd = dayDate(monday, i);
              const isToday = new Date().toDateString() === dd.toDateString();
              return (
                <div key={d.key} style={{ padding:"8px 4px",textAlign:"center",borderLeft:"1px solid #E2E8F0" }}>
                  <div style={{ fontSize:9,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:0.8 }}>{d.cap}</div>
                  <div style={{ fontSize:17,fontWeight:800,color:isToday?"#2563EB":"#1E293B",fontFamily:"'JetBrains Mono',monospace",background:isToday?"#DBEAFE":"transparent",borderRadius:6,display:"inline-block",padding:"1px 6px",marginTop:1 }}>{dd.getDate()}</div>
                </div>
              );
            })}
          </div>

          {HOURS.map(h => (
            <div key={h} style={{ display:"grid",gridTemplateColumns:"54px repeat(5, 1fr)",borderBottom:"1px solid #F1F5F9",position:"relative" }}>
              {h === 14 && <div style={{ position:"absolute",top:-1,left:0,right:0,height:3,background:"linear-gradient(90deg, #F97316 0%, #F9731640 50%, transparent 100%)",zIndex:1 }} />}
              <div style={{ padding:"2px 4px",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",background:isMorning(h)?"#FEFCE8":"#FFF7ED",borderRight:"1px solid #F1F5F9" }}>
                <div style={{ fontSize:11,fontWeight:700,color:"#475569",fontFamily:"'JetBrains Mono',monospace" }}>{fmtHour(h)}</div>
              </div>
              {DAYS.map((d, di) => {
                const slotKey = `${d.key}_${h}`;
                const val = currentBlocks[slotKey];
                const dd = dayDate(monday, di);
                const isExp = expandedSlot === slotKey;
                const calSlotEvents = allCalSlots[slotKey] || [];
                const hasEvt = calSlotEvents.length > 0;

                if (isClient) {
                  const mine = val === view;
                  const free = val === FREE;
                  return (
                    <div key={slotKey} className="cell" style={{
                      borderLeft:"1px solid #F1F5F9",padding:4,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
                      background:mine?`${clientMap[view].color}18`:free?"#F0FDF4":"#FAFAFA",
                      cursor:free?"pointer":"default",minHeight:isExp?60:36,
                    }} onClick={() => free && setExpandedSlot(isExp ? null : slotKey)}>
                      {mine && <span style={{ fontSize:9,fontWeight:700,color:clientMap[view].color }}>{clientMap[view].icon} Asignado</span>}
                      {free && !isExp && <span style={{ fontSize:9,fontWeight:600,color:"#059669" }}>🟢 Disponible</span>}
                      {free && isExp && (
                        <div style={{ display:"flex",gap:4,alignItems:"center",flexWrap:"wrap",justifyContent:"center" }}>
                          <OutlookBtn date={dd} hour={h} compact />
                          <TeamsBtn date={dd} hour={h} compact />
                        </div>
                      )}
                      {!mine && !free && <span style={{ fontSize:9,color:"#CBD5E1",fontWeight:500 }}>⛔</span>}
                    </div>
                  );
                }

                const cl = val === FREE ? null : clientMap[val];
                return (
                  <div key={slotKey} className="cell" style={{
                    borderLeft:"1px solid #F1F5F9",padding:hasEvt?"2px 3px":"4px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:hasEvt?"flex-start":"center",
                    background:cl?`${cl.color}14`:hasEvt?"#FEFCE8":"#FAFAFA",cursor:"pointer",userSelect:"none",minHeight:36,gap:1,position:"relative",
                  }} onMouseDown={(e) => {
                    e.preventDefault();
                    const next = cycleBlock(slotKey);
                    setPainting(next); setBlock(slotKey, next);
                  }} onMouseEnter={() => { if (painting !== null) setBlock(slotKey, painting); }}>
                    {cl ? (
                      <span style={{ fontSize:9,fontWeight:700,color:cl.color }}>{cl.icon} {cl.short}</span>
                    ) : (
                      !hasEvt && <span style={{ fontSize:9,fontWeight:600,color:"#CBD5E1" }}>—</span>
                    )}
                    {hasEvt && calSlotEvents.slice(0, 2).map((ev, i) => {
                      const evClient = clientMap[ev.clientId];
                      return (
                        <div key={i} className="cal-badge" style={{ background:`${evClient?.color || "#94A3B8"}20`,color:evClient?.color || "#475569" }}
                          title={`${ev.subject} (${ev.start || ""}${ev.end ? "–" + ev.end : ""})`}>
                          <span className="cal-dot" style={{ background:evClient?.color || "#94A3B8" }} />
                          {ev.subject?.substring(0, 18) || "Evento"}
                        </div>
                      );
                    })}
                    {calSlotEvents.length > 2 && (
                      <span style={{ fontSize:7,color:"#94A3B8",fontWeight:600 }}>+{calSlotEvents.length - 2}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {view === "admin" && (
          <div style={{ marginTop:12,display:"grid",gridTemplateColumns:`repeat(${Math.min(clients.length + 1, 5)}, 1fr)`,gap:6 }}>
            {clients.map(c => {
              const h = stats[c.id]||0;
              const pct = Math.round((h / TOTAL_SLOTS) * 100);
              return (
                <div key={c.id} style={{ background:"white",borderRadius:10,padding:"10px 8px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",textAlign:"center",borderTop:`3px solid ${c.color}` }}>
                  <div style={{ fontSize:9,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:0.5 }}>{c.short}</div>
                  <div style={{ fontSize:20,fontWeight:800,color:c.color,fontFamily:"'JetBrains Mono',monospace",margin:"1px 0" }}>{h}h</div>
                  <div style={{ fontSize:9,color:"#94A3B8" }}>{pct}%</div>
                  <div style={{ height:3,background:"#F1F5F9",borderRadius:2,marginTop:4,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${pct}%`,background:c.color,borderRadius:2,transition:"width 0.3s" }} />
                  </div>
                </div>
              );
            })}
            <div style={{ background:"white",borderRadius:10,padding:"10px 8px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",textAlign:"center",borderTop:"3px solid #9CA3AF" }}>
              <div style={{ fontSize:9,fontWeight:700,color:"#94A3B8",textTransform:"uppercase" }}>Libre</div>
              <div style={{ fontSize:20,fontWeight:800,color:"#9CA3AF",fontFamily:"'JetBrains Mono',monospace",margin:"1px 0" }}>{stats[FREE]||0}h</div>
              <div style={{ fontSize:9,color:"#94A3B8" }}>{Math.round(((stats[FREE]||0) / TOTAL_SLOTS) * 100)}%</div>
              <div style={{ height:3,background:"#F1F5F9",borderRadius:2,marginTop:4,overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${Math.round(((stats[FREE]||0) / TOTAL_SLOTS) * 100)}%`,background:"#9CA3AF",borderRadius:2 }} />
              </div>
            </div>
          </div>
        )}

        {view === "admin" && (
          <div style={{ marginTop:12,background:"white",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize:12,fontWeight:700,color:"#1E293B",marginBottom:8 }}>📤 Enviar / Bloquear</div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {clients.map(c => (
                <div key={c.id} style={{ display:"flex",gap:4 }}>
                  <button className="btn" onClick={() => setShareModal(c.id)} style={{ display:"flex",alignItems:"center",gap:4,background:`${c.color}12`,color:c.color,padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:`1px solid ${c.color}30` }}>
                    {c.icon} Enviar a {c.short}
                  </button>
                  <button className="btn" onClick={() => exportBlockingICS(c.id)} style={{ display:"flex",alignItems:"center",gap:4,background:"#0078D415",color:"#0078D4",padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:600,border:"1px solid #0078D430" }}>
                    🔒
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop:16,padding:"8px 0",textAlign:"center",color:"#94A3B8",fontSize:9,fontWeight:500 }}>
          Externia · Gestión de Disponibilidad v4 · {new Date().getFullYear()}
        </div>
      </div>

      {showClientMgr && <ClientManager clients={clients} onSave={saveClients} onClose={() => setShowClientMgr(false)} />}

      {showCalSetup && (
        <CalendarSetup
          clients={clients}
          connections={calConnections}
          onUpdate={handleMsalUpdate}
          onClose={() => setShowCalSetup(false)}
          msalReady={msalReady}
          onConnect={connectAccount}
          onDisconnect={disconnectAccount}
          onSync={syncCalendars}
          syncing={syncing}
        />
      )}

      {shareModal && (
        <Modal onClose={() => { setShareModal(null); setEmailField(""); setEditingEmail(false); }}>
          <div style={{ fontSize:16,fontWeight:700,color:"#1E293B",marginBottom:4 }}>✉️ Disponibilidad → {clientMap[shareModal]?.name}</div>
          <div style={{ fontSize:11,color:"#64748B",marginBottom:14 }}>Email generado con tu disponibilidad horaria.</div>

          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:10,fontWeight:600,color:"#475569",display:"block",marginBottom:4 }}>Para:</label>
            <input value={emailField} onChange={e => setEmailField(e.target.value)} placeholder="nombre@empresa.com"
              style={{ border:"2px solid #E2E8F0",borderRadius:8,padding:"7px 10px",fontSize:12,fontFamily:"inherit",outline:"none",width:"100%" }} />
          </div>

          <div style={{ marginBottom:12 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
              <label style={{ fontSize:10,fontWeight:600,color:"#475569" }}>Mensaje:</label>
              <button className="btn" onClick={() => setEditingEmail(!editingEmail)} style={{ background:"none",color:"#2563EB",padding:0,fontSize:10,fontWeight:600 }}>
                {editingEmail ? "Vista previa" : "✏️ Editar"}
              </button>
            </div>
            {editingEmail ? (
              <textarea value={shareEmailText} onChange={e => setShareEmailText(e.target.value)}
                style={{ width:"100%",minHeight:200,border:"2px solid #E2E8F0",borderRadius:10,padding:12,fontSize:12,fontFamily:"'Archivo',sans-serif",outline:"none",lineHeight:1.6,resize:"vertical" }} />
            ) : (
              <div style={{ background:"#F8FAFC",borderRadius:10,padding:14,maxHeight:240,overflowY:"auto",fontSize:12,color:"#334155",whiteSpace:"pre-wrap",lineHeight:1.7 }}>
                {shareEmailText}
              </div>
            )}
            <button className="btn" onClick={() => { setShareEmailText(getShareEmail(shareModal)); setEditingEmail(false); }}
              style={{ marginTop:6,background:"none",color:"#94A3B8",padding:0,fontSize:10 }}>↻ Regenerar</button>
          </div>

          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            <a href={`mailto:${emailField ? encodeURIComponent(emailField) : ""}?subject=${encodeURIComponent(`Disponibilidad semana ${weekRange}`)}&body=${encodeURIComponent(shareEmailText)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"#0078D4",color:"white",padding:"10px",borderRadius:8,fontSize:12,fontWeight:600,textDecoration:"none" }}>
              📧 Abrir en Outlook / Mail
            </a>
            <div style={{ display:"flex",gap:6 }}>
              <button className="btn" onClick={() => copyText(shareEmailText)} style={{ flex:1,background:"#1E293B",color:"white",padding:"10px",borderRadius:8,fontSize:12,fontWeight:600 }}>📋 Copiar</button>
              <button className="btn" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareEmailText)}`, "_blank")} style={{ flex:1,background:"#25D366",color:"white",padding:"10px",borderRadius:8,fontSize:12,fontWeight:600 }}>💬 WhatsApp</button>
            </div>
            <button className="btn" onClick={() => exportBlockingICS(shareModal)} style={{ background:"#F1F5F9",color:"#475569",padding:"10px",borderRadius:8,fontSize:12,fontWeight:600,width:"100%" }}>🔒 Descargar .ics de bloqueo</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
