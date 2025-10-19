// ---------------- Translation ----------------

// loadLanguage(lang?:string) → void
// Load translation JSON file and refresh all translatable elements.
// ex: loadLanguage("en")
let translations = {};
const loadLanguage = async (lang = 'en') => {
  try {
    const res = await fetch(`/language/${lang}.json`);
    translations = await res.json();
    refreshTranslations();
  } catch (e) {
    console.error('[-] Translation load error:', e);
  }
};

// t(key:string) → string
// Return translated text or fallback key.
// ex: t("Welcome")
const t = key => translations[key] || key;

// refreshTranslations() → void
// Update all DOM elements with [data-i18n] attributes.
const refreshTranslations = () => {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    el.innerText = t(k);
  });
};

// ---------------- Colorize -------------------

// colorFactory(val:string, opts?:{animated?:boolean,speed?:number,direction?:string}) → CSSStyleDeclaration
// Return style object for solid/gradient colors with optional animation.
// ex: colorFactory("linear-gradient(...)", {animated:true,speed:5})
const colorFactory = (val, { animated = false, speed = 3, direction = "to right" } = {}) => {
  if (!val) return { color: "#6c757d" };
  if (/gradient/i.test(val)) {
    const style = {
      backgroundImage: val,
      color: "transparent",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      backgroundSize: "200% 200%"
    };
    if (animated) {
      const id = `grad-${speed}-${direction.replace(/\s+/g,"")}`;
      if (!document.getElementById(id)) {
        const st = document.createElement("style");
        st.id = id;
        st.textContent = `
          @keyframes ${id} {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }`;
        document.head.appendChild(st);
      }
      style.animation = `${id} ${speed}s linear infinite`;
    }
    return style;
  }
  return { color: val };
};

// getRarityStyle(rarity:string, opts?:object) → CSSStyleDeclaration
// Return style object based on rarity key (common, rare, epic, etc.).
// ex: getRarityStyle("Epic",{animated:true})
const raritiesColor = {
  common: "#6c757d",
  uncommon: "#198754",
  rare: "#0d6efd",
  epic: "#6610f2",
  legendary: "#d4af37",
  mythic: "#dc3545",
  secret: "linear-gradient(90deg, #684c4c, #ffffff)",
  transcendent: "linear-gradient(90deg, #09ff00, #005704)"
};
const getRarityStyle = (rarity, opts = {}) => {
  const key = rarity?.toLowerCase().trim();
  return colorFactory(raritiesColor[key] || null, opts);
};

// animationColor(name:string, speed:number, content:string) → string
// Define CSS keyframe animation and return animation ID.
// ex: animationColor("rainbow",3,"0%{...}")
const animationColor = (name, speed = 3, content = `
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`) => {
  const hash = btoa(content).slice(0,6);
  const id = `anim-${name}-${speed}-${hash}`;
  if (!document.getElementById(id)) {
    const st = document.createElement("style");
    st.id = id;
    st.textContent = `@keyframes ${id} { ${content} }`;
    document.head.appendChild(st);
  }
  return id;
};

// colorNode(text:string, color:string, opts?:{animated?:boolean,speed?:number,animationContent?:string}) → HTMLSpanElement
// Return span with solid/gradient text + optional animation.
// ex: colorNode("Epic Item","linear-gradient(...)",{animated:true})
const colorNode = (text, color, { animated = false, speed = 3, animationContent } = {}) => {
  const span = el("span", "", text);
  if (!color) {
    span.style.color = "#6c757d";
    return span;
  }
  if (/gradient/i.test(color)) {
    span.style.backgroundImage = color;
    span.style.color = "transparent";
    span.style.backgroundClip = "text";
    span.style.WebkitBackgroundClip = "text";
    span.style.backgroundSize = "200% 200%";
    if (animated) {
      const id = animationColor("grad", speed, animationContent || `
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      `);
      span.style.animation = `${id} ${speed}s linear infinite`;
    }
  } else span.style.color = color;
  return span;
};

// ---------------- Factory Functions ----------------

// el(tag:string, cls?:string, html?:string) → HTMLElement
// Create DOM element.
// ex: el("div","text-muted","Hello")
const el = (tag, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

// row(...children:Node[]) → HTMLDivElement
// Create Bootstrap row with gap.
// ex: row(col("col-md-6", card("Title", el("div","","Body"))))
const row = (...children) => {
  const r = el('div', 'row g-4');
  children.forEach(c => r.appendChild(c));
  return r;
};

// col(width:string, child:Node) → HTMLDivElement
// Wrap a child inside Bootstrap column.
// ex: col("col-md-4", kpiCard("Users","123"))
const col = (w, child) => {
  const c = el('div', w);
  c.appendChild(child);
  return c;
};

// card(title:string|Node, body:Node|string, footer?:Node|string) → HTMLDivElement
// Generic card with header/body/footer.
// ex: card("Title", el("div","","Body"))
const card = (title, bodyNode, footerNode = null) => {
  const c = el("div", "card soft-card p-3 h-100");
  if (title) {
    const h = el("h5", "card-title mb-3");
    if (title instanceof Node) h.appendChild(title);
    else {
      h.textContent = title;
      h.setAttribute("data-i18n", title);
    }
    c.appendChild(h);
  }
  if (bodyNode) {
    const b = el("div", "card-body");
    if (bodyNode instanceof Node) b.appendChild(bodyNode);
    else b.innerHTML = bodyNode;
    c.appendChild(b);
  }
  if (footerNode) {
    const f = el("div", "card-footer text-center");
    if (footerNode instanceof Node) f.appendChild(footerNode);
    else f.innerHTML = footerNode;
    c.appendChild(f);
  }
  return c;
};

// kpiCard(label:string, value:string|number) → HTMLDivElement
// Metric/KPI card.
// ex: kpiCard("Revenue","$58K")
const kpiCard = (label, value) => {
  const d = el('div');
  d.innerHTML = `<div class="fs-2 fw-bold">${value}</div><div class="text-muted" data-i18n="${label}">${t(label)}</div>`;
  return card('', d);
};

// listCard(title:string, items:string[]) → HTMLDivElement
// Card with list-group items.
// ex: listCard("Activity", ["Login - Alice","Logout - Bob"])
const listCard = (title, items) => {
  const ul = el('ul', 'list-group list-group-flush');
  items.forEach(i => {
    const li = el('li', 'list-group-item');
    li.setAttribute('data-i18n', i);
    li.innerText = t(i);
    ul.appendChild(li);
  });
  return card(title, ul);
};

// badge(text:string, type:string) → HTMLSpanElement
// Bootstrap badge.
// ex: badge("New","success")
const badge = (text, type = 'primary') => {
  const b = el('span', `badge bg-${type} soft-badge`, t(text));
  b.setAttribute('data-i18n', text);
  return b;
};

// alert(msg:string, type:string, timeout?:number) → HTMLDivElement
// Auto-fading dismissible alert.
// ex: alert("Saved!","success",2000)
const alert = (msg, type = 'info', timeout = 3000) => {
  const a = el('div', `alert alert-${type} alert-dismissible fade show mb-4`);
  a.innerHTML = `<span data-i18n="${msg}">${t(msg)}</span><button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  setTimeout(() => a.remove(), timeout);
  return a;
};

// button(label:string, type:string, attrs?:Record<string,string>) → HTMLButtonElement
// Bootstrap button with attributes.
// ex: button("Click","primary",{"data-id":"1"})
const button = (label, type = 'primary', attrs = {}) => {
  const b = el('button', `btn btn-${type} soft-btn me-2`, t(label));
  b.setAttribute('data-i18n', label);
  Object.entries(attrs).forEach(([k, v]) => b.setAttribute(k, v));
  return b;
};

// header(title:string) → HTMLElement
// Dashboard navbar/header.
// ex: header("Dredbot dashboard")
const header = title => {
  const h = el('nav', 'navbar navbar-light bg-white px-3 mb-4 shadow-sm soft-card');
  const s = el('span', 'navbar-brand mb-0 h1', t(title));
  s.setAttribute('data-i18n', title);
  h.appendChild(s);
  return h;
};

// headerButton(header: HTMLElement, text: string, onClick: () => void, classes?: string) → HTMLElement
// ex: headerButton(nav, "Settings", () => alert("Settings clicked!"))
const headerButton = (header, text, onClick, classes = "btn btn-primary btn-sm") => {
  const btn = el("button", classes, t(text));
  btn.setAttribute("type", "button");
  btn.addEventListener("click", onClick);
  header.appendChild(btn);
  return btn;
};

// toolbar(...controls:Node[]) → HTMLDivElement
// Horizontal flex container.
// ex: toolbar(button("Save","success"))
const toolbar = (...controls) => {
  const t = el('div', 'd-flex mb-3');
  controls.forEach(c => t.appendChild(c));
  return t;
};

// formCard(title:string, fields:{label:string,type:string,placeholder?:string}[], btn:string, onSubmit:(vals:Record<string,string>)=>void) → HTMLDivElement
// Form inside card.
// ex: formCard("Add User",[{"label":"Name","type":"text"}],"Add",vals=>{})
const formCard = (title, fields, btnLabel = 'Submit', onSubmit = () => {}) => {
  const f = el('form');
  fields.forEach(fi => {
    const g = el('div', 'mb-3');
    g.innerHTML = `<label class="form-label" data-i18n="${fi.label}">${t(fi.label)}</label><input type="${fi.type}" class="form-control soft-input" placeholder="${fi.placeholder}" required>`;
    f.appendChild(g);
  });
  const sb = button(btnLabel, 'primary', { type: 'submit' });
  f.appendChild(sb);
  f.addEventListener('submit', e => {
    e.preventDefault();
    const vals = {};
    f.querySelectorAll('input').forEach((i, idx) => {
      vals[fields[idx].label] = i.value;
    });
    onSubmit(vals);
    f.reset();
  });
  return card(title, f);
};

// modal(id:string, title:string, body:string|Node) → HTMLDivElement
// Bootstrap modal with header/body/footer.
// ex: modal("info","Info","This is a modal")
const modal = (id, title, body) => {
  const m = el('div', 'modal fade');
  m.id = id;
  m.tabIndex = -1;
  m.innerHTML = `<div class="modal-dialog"><div class="modal-content soft-card"><div class="modal-header"><h5 class="modal-title" data-i18n="${title}">${t(
    title
  )}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal" data-i18n="Close">${t(
    'Close'
  )}</button></div></div></div>`;
  m.querySelector('.modal-body').appendChild(typeof body === 'string' ? el('div', '', t(body)) : body);
  document.body.appendChild(m);
  return m;
};

// pagination(pages:number, active:number, onClick:(i:number)=>void) → HTMLElement
// Page number controls.
// ex: pagination(5,1,i=>console.log(i))
const pagination = (pages, active = 1, onClick = () => {}) => {
  const nav = el('nav', 'd-flex justify-content-center mt-3');
  const ul = el('ul', 'pagination');
  for (let i = 1; i <= pages; i++) {
    const li = el('li', 'page-item' + (i === active ? ' active' : ''));
    const a = el('a', 'page-link', i);
    a.href = '#';
    a.addEventListener('click', e => {
      e.preventDefault();
      onClick(i);
    });
    li.appendChild(a);
    ul.appendChild(li);
  }
  nav.appendChild(ul);
  return nav;
};

// tableWithPagination(title:string, cols:string[], data:(string|number)[][], pageSize:number) → HTMLDivElement
// Paginated table inside card.
// ex: tableWithPagination("Orders",["ID","User"],[[1,"Alice"]],5)
const tableWithPagination = (title, cols, data, pageSize = 3) => {
  const container = el('div', 'table-responsive');
  let curPage = 1;
  const renderPage = p => {
    container.innerHTML = '';
    const tbl = el('table', 'table table-striped mb-0');
    const thead = el('thead');
    thead.appendChild(el('tr', '', cols.map(c => `<th data-i18n="${c}">${t(c)}</th>`).join('')));
    tbl.appendChild(thead);
    const tbody = el('tbody');
    data.slice((p - 1) * pageSize, p * pageSize).forEach(r => {
      const tr = el('tr');
      r.forEach(v => {
        const td = el('td');
        td.innerText = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    container.appendChild(tbl);
    container.appendChild(
      pagination(Math.ceil(data.length / pageSize), p, i => {
        curPage = i;
        renderPage(curPage);
      })
    );
  };
  renderPage(curPage);
  return card(title, container);
};

// tableWithButtons(title:string, cols:string[], data:(string|number)[][], buttons:{label:string,type?:string,onClick?:(row:any[],idx:number)=>void}[]) → HTMLDivElement
// Table with row action buttons.
// ex: tableWithButtons("Users",["Name"],[["Alice"]],[{label:"Edit"}])
const tableWithButtons = (title, cols, data, buttons = []) => {
  const container = el('div', 'table-responsive');
  const tbl = el('table', 'table table-striped mb-0');
  const thead = el('thead');
  thead.appendChild(el('tr', '', cols.map(c => `<th data-i18n="${c}">${t(c)}</th>`).join('') + '<th>Actions</th>'));
  tbl.appendChild(thead);
  const tbody = el('tbody');
  data.forEach((row, rowIndex) => {
    const tr = el('tr');
    row.forEach(v => {
      const td = el('td');
      td.innerText = v;
      tr.appendChild(td);
    });
    const tdBtns = el('td');
    buttons.forEach(b => {
      const btn = button(b.label, b.type || 'primary', {});
      if (typeof b.onClick === 'function') {
        btn.addEventListener('click', e => {
          e.preventDefault();
          b.onClick(row, rowIndex, e);
        });
      }
      tdBtns.appendChild(btn);
    });
    tr.appendChild(tdBtns);
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  container.appendChild(tbl);
  return card(title, container);
};

// tableWithPaginationAndButtons(title:string, cols:string[], data:(string|number)[][], pageSize:number, buttons:{label:string,type?:string,onClick?:(row:any[],idx:number)=>void}[]) → HTMLDivElement
// Paginated table with row action buttons.
// ex: tableWithPaginationAndButtons("Users",["Name"],[["Alice"]],5,[{label:"Edit"}])
const tableWithPaginationAndButtons = (title, cols, data, pageSize = 3, buttons = []) => {
  const container = el('div', 'table-responsive');
  let curPage = 1;
  const renderPage = p => {
    container.innerHTML = '';
    const tbl = el('table', 'table table-striped mb-0');
    const thead = el('thead');
    thead.appendChild(el('tr', '', cols.map(c => `<th data-i18n="${c}">${t(c)}</th>`).join('') + '<th>Actions</th>'));
    tbl.appendChild(thead);
    const tbody = el('tbody');
    data.slice((p - 1) * pageSize, p * pageSize).forEach((row, rowIndex) => {
      const tr = el('tr');
      row.forEach(v => {
        const td = el('td');
        td.innerText = v;
        tr.appendChild(td);
      });
      const tdBtns = el('td');
      buttons.forEach(b => {
        const btn = button(b.label, b.type || 'primary', {});
        if (typeof b.onClick === 'function') {
          btn.addEventListener('click', e => {
            e.preventDefault();
            b.onClick(row, (curPage - 1) * pageSize + rowIndex, e);
          });
        }
        tdBtns.appendChild(btn);
      });
      tr.appendChild(tdBtns);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    container.appendChild(tbl);
    container.appendChild(
      pagination(Math.ceil(data.length / pageSize), p, i => {
        curPage = i;
        renderPage(curPage);
      })
    );
  };
  renderPage(curPage);
  return card(title, container);
};

// pillText(text:string, color:string) → HTMLSpanElement
// Pill-shaped badge text.
// ex: pillText("Active","success")
const pillText = (text, color = "primary") => {
  const cls = "px-3 py-1 rounded-pill fw-semibold me-2";
  const p = el("span", cls, t(text));
  p.setAttribute("data-i18n", text);
  if (/^(primary|secondary|success|danger|warning|info|light|dark)$/.test(color)) p.classList.add(`bg-${color}`, "text-white");
  else {
    p.style.background = color;
    p.style.color = "#fff";
  }
  return p;
};

// styleText(text:string, opts?:object) → HTMLSpanElement
// Per-character styled text with rules.
// ex: styleText("Hello",{rules:[{index:1,color:"red"}]})
const styleText = (text, { rules = [], color = null, weight = null, italic = false, underline = false } = {}) => {
  const span = el('span');
  const apply = (s, r) => {
    if (r.color) s.style.color = r.color;
    if (r.weight) s.style.fontWeight = r.weight;
    if (r.italic) s.style.fontStyle = 'italic';
    if (r.underline) s.style.textDecoration = 'underline';
  };
  if (rules.length === 0) {
    const full = el('span', '', t(text));
    full.setAttribute('data-i18n', text);
    apply(full, { color, weight, italic, underline });
    span.appendChild(full);
  } else {
    text.split('').forEach((ch, i) => {
      const c = el('span', '', ch);
      rules.forEach(r => {
        if ((r.index !== undefined && i === r.index) || (r.range && i >= r.range[0] && i <= r.range[1])) apply(c, r);
      });
      span.appendChild(c);
    });
  }
  return span;
};

// sidebarNav(items:{label:string,content:()=>Node|Promise<Node>}[]) → HTMLDivElement
// Sidebar navigation with content area.
// ex: sidebarNav([{label:"Home",content:()=>el("div","","Home")}])
const sidebarNav = items => {
  const wrap = el('div', 'd-flex');
  const side = el('div', 'd-flex flex-column p-3 bg-white soft-card me-3');
  side.style.width = '220px';
  const content = el('div', 'flex-grow-1 position-relative');
  const tabs = [];
  items.forEach((it, i) => {
    const tab = el('div', 'tab-pane');
    tab.style.display = i === 0 ? 'block' : 'none';
    const c = it.content();
    if (c instanceof Promise)
      c.then(node => {
        if (node) tab.appendChild(node);
      });
    else {
      if (c) tab.appendChild(c);
    }
    tabs.push(tab);
    content.appendChild(tab);
    const link = el('a', 'nav-link mb-2 fw-semibold', t(it.label));
    link.setAttribute('data-i18n', it.label);
    link.href = '#';
    if (i === 0) link.classList.add('active');
    link.onclick = e => {
      e.preventDefault();
      side.querySelectorAll('a').forEach(a => a.classList.remove('active'));
      link.classList.add('active');
      tabs.forEach((t, j) => (t.style.display = j === i ? 'block' : 'none'));
      animateCards();
    };
    side.appendChild(link);
  });
  wrap.appendChild(side);
  wrap.appendChild(content);
  return wrap;
};

// addCopyIcon(value:string|Node) → HTMLSpanElement
// Text with clipboard copy icon.
// ex: addCopyIcon("Copy me!")
const addCopyIcon = (value) => {
  const wrap = el("span", "d-inline-flex align-items-center");
  const text =
    value instanceof Node
      ? value.cloneNode(true)
      : el("span", "me-2 fw-semibold text-dark", String(value));
  const icon = el("i", "bi bi-clipboard ms-1 text-muted fs-6");
  icon.style.cursor = "pointer";
  icon.onclick = async () => {
    try {
      const copyVal = text.textContent || String(value);
      await navigator.clipboard.writeText(copyVal);
      icon.className = "bi bi-clipboard-check ms-1 text-success fs-6";
      setTimeout(() => (icon.className = "bi bi-clipboard ms-1 text-muted fs-6"), 1500);
    } catch {
      icon.className = "bi bi-x-circle ms-1 text-danger fs-6";
      setTimeout(() => (icon.className = "bi bi-clipboard ms-1 text-muted fs-6"), 1500);
    }
  };
  wrap.appendChild(text);
  wrap.appendChild(icon);
  return wrap;
};

// wrapWithTooltip(text:string, maxWidth:string) → HTMLSpanElement
// Wrap text with max width + tooltip.
// ex: wrapWithTooltip("Long text","40%")
const wrapWithTooltip = (text, maxWidth) => {
  const span = el("span");
  span.textContent = text;
  span.style.maxWidth = maxWidth;
  span.style.display = "inline-block";
  span.style.whiteSpace = "normal";
  span.style.wordBreak = "break-word";
  span.style.overflowWrap = "anywhere"; 
  span.title = text;
  return span;
};

// buildNestedSections(data:array, depth?:number, opts?:object) → HTMLDivElement
// opts.collapsIf1:{bool:boolean, exclude:string[]} 
//   - bool → if true, even single child collapses
//   - exclude → array of section titles to skip collapsing
const buildNestedSections = (data, depth = 0, opts = { collapsIf1: { bool:false, exclude:[] } }) => {
  const wrap = el("div", depth === 0 ? "" : "p-2");
  data.forEach(([title, children]) => {
    const sec = el("div", "mb-2 border rounded");
    const head = el("div","d-flex justify-content-between align-items-center p-2 flex-wrap");
    if (title instanceof Node) head.appendChild(title);
    else {
      const span = el("span", depth===0?"fw-bold text-truncate":"fw-semibold small text-truncate", title);
      span.style.maxWidth = "90%";
      head.appendChild(span);
    }
    const body = el("div");
    const isNested = Array.isArray(children) && Array.isArray(children[0]);
    if (isNested) {
      const childCount = children.length;
      const nestedBody = buildNestedSections(children, depth+1, opts);
      body.appendChild(nestedBody);
      const excluded = typeof title==="string" && opts.collapsIf1.exclude.includes(title);
      if ((opts.collapsIf1.bool || childCount > 1) && !excluded) {
        const icon = el("span","ms-2","▼");
        head.appendChild(icon);
        head.style.cursor = "pointer";
        body.style.display = "block";
        head.onclick = () => {
          const open = body.style.display === "block";
          body.style.display = open ? "none" : "block";
          icon.textContent = open ? "▶" : "▼";
        };
      }
    } else {
      const list = el("div","list-group list-group-flush");
      const safe = Array.isArray(children)?children:[[children,"—"]];
      safe.forEach(([k,v])=>{
        const item = el("div","list-group-item d-flex justify-content-between align-items-center flex-wrap");
        if (k instanceof Node) item.appendChild(k); else item.appendChild(wrapWithTooltip(k??"—","40%"));
        if (v instanceof Node) item.appendChild(v); else item.appendChild(wrapWithTooltip(v??"—","55%"));
        list.appendChild(item);
      });
      body.appendChild(list);
    }
    sec.appendChild(head);
    sec.appendChild(body);
    wrap.appendChild(sec);
  });
  return wrap;
};

// fieldCardCollapsibleSections(title:string|Node, sections:array, opts?:object) → HTMLDivElement
// opts.collapsIf1:{bool:boolean, exclude:string[]} 
// ex: fieldCardCollapsibleSections("User Info", [...], {collapsIf1:{bool:true,exclude:["General"]}})
const fieldCardCollapsibleSections = (title, sections, opts={collapsIf1:{bool:false,exclude:[]}}) => {
  const head = el("div","d-flex justify-content-between align-items-center mb-3 flex-wrap");
  if (title instanceof Node) head.appendChild(title);
  else {
    const span=el("div","fw-bold fs-5 text-truncate",title);
    span.style.maxWidth="90%";
    head.appendChild(span);
  }
  const body=buildNestedSections(sections,0,opts);
  const cont=el("div");
  cont.appendChild(head);
  cont.appendChild(body);
  const icon=el("span","ms-2","▼");
  head.appendChild(icon);
  head.style.cursor="pointer";
  head.onclick=()=>{
    const open=body.style.display!=="none";
    body.style.display=open?"none":"block";
    icon.textContent=open?"▶":"▼";
  };
  return card("",cont);
};


// ---------------- Dashboard with Sidebar ----------------
const dash = document.getElementById('dashboard');
dash.appendChild(header('Dredbot Admin Dashboard'));

dash.appendChild(
  sidebarNav([
    {
      label: "Overview",
      content: async () => {
        const res = await fetch("/get-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ formatNumber: true }),
        });
        const data = await res.json();
        if (!data.success) return el("div", "text-danger", "Failed to load profile.");
        const profile = data.profile;
        return row(
          fieldCardCollapsibleSections("User Profile", [
            ["Account",
              [["General", [
                ["Username", addCopyIcon(profile.username)],
                ["User ID", addCopyIcon(profile.userId || "N/A")],
                ["Banned", pillText(profile.banned ? "Yes" : "No", profile.banned ? "danger" : "success")],
              ]]]
            ],
            ["Statistics",
              [["Usage", [
                ["Dredcoin Balance", addCopyIcon(profile.balance)],
                ["Commands Executed", profile.command_execute || 0],
                ["Daily Streak", `${profile.dailyStreak} (next: ${profile.next_streaks.daily}, expire: ${profile.expire_streaks.daily})`],
                ["Weekly Streak", `${profile.weeklyStreak} (next: ${profile.next_streaks.weekly}, expire: ${profile.expire_streaks.weekly})`],
                ["Monthly Streak", `${profile.monthlyStreak} (next: ${profile.next_streaks.monthly}, expire: ${profile.expire_streaks.monthly})`],
                ["Yearly Streak", `${profile.yearlyStreak} (next: ${profile.next_streaks.yearly}, expire: ${profile.expire_streaks.yearly})`],
              ]]]
            ],
          ]),
          profile.inventory && fieldCardCollapsibleSections("Inventory",
            Object.entries(profile.inventory || {}).map(([key, item]) => [
              item.name || key,
              [[
                "Details",
                [
                  ["Name", item.name || "—"],
                  ["Description", item.description || "—"],
                  ["Rarity", item.rarity ? pillText(item.rarity, getRarityStyle(item.rarity).color) : "—"],
                  ["Enchanted", pillText(item.enchanted ? "Yes" : "No", item.enchanted ? "success" : "secondary")],
                  ["Enchants", Array.isArray(item.enchants) && item.enchants.length
                    ? pillText(item.enchants.map(e => e.name || "—").join(", "), getRarityStyle(item.enchants[0].rarity).color)
                    : pillText("—", "secondary")
                  ],
                  ["Icon", item.icon ? item.icon : "—"]
                ]
              ]]
            ])
          )
        );
      },
    },
    {
      label: "Users",
      content: () => {
        const cols = ["ID","Name","Role"];
        const data = [
          [1,"Alice","Admin"],
          [2,"Bob","User"],
          [3,"Charlie","Editor"]
        ];
        return tableWithPagination("User List", cols, data, 5);
      },
    },
  ])
);

// ---------------- Animation ----------------
// animateCards() → void
// Apply staggered reveal animation to all cards.
const animateCards = () => {
  document.querySelectorAll('.soft-card').forEach((c, i) => setTimeout(() => c.classList.add('show'), 100 * i));
};
window.addEventListener('load', () => {
  animateCards();
  loadLanguage('en');
});