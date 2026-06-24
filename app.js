const state = {
  selectedTea: "全部",
  selectedArea: "全部茶区",
  query: "",
  data: null,
};

const svg = document.getElementById("atlasSvg");
const tip = document.getElementById("hoverTip");
const NS = "http://www.w3.org/2000/svg";

const teaOrder = ["绿茶", "黄茶", "红茶", "白茶", "黑茶", "青茶"];
const teaAngles = {
  绿茶: -46,
  黄茶: -12,
  红茶: 18,
  白茶: 48,
  黑茶: 74,
  青茶: 112,
};

const chinaOutline = [
  [79.4, 42.2], [85.4, 47.2], [94.5, 46.9], [100.2, 42.8], [108.3, 45.4],
  [119.6, 49.2], [126.2, 47.0], [126.6, 42.3], [121.3, 39.5], [121.8, 35.7],
  [119.3, 32.0], [122.2, 29.4], [120.0, 24.2], [116.8, 22.8], [111.8, 21.3],
  [107.5, 21.7], [101.8, 21.3], [98.0, 24.2], [96.2, 28.3], [91.1, 27.9],
  [88.0, 30.3], [82.8, 30.8], [79.0, 33.5], [74.8, 37.0], [76.4, 40.4],
];

const innerLines = [
  [[96, 42], [101, 36], [106, 31], [112, 26], [119, 24]],
  [[88, 31], [96, 32], [104, 31], [112, 30], [120, 32]],
  [[101, 43], [103, 37], [105, 31], [106, 25]],
  [[112, 43], [113, 37], [115, 31], [118, 26]],
];

function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function polar(radius, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return [Math.cos(rad) * radius, Math.sin(rad) * radius];
}

function arcPath(r, startDeg, endDeg) {
  const [sx, sy] = polar(r, startDeg);
  const [ex, ey] = polar(r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
}

function project([lon, lat]) {
  const x = (lon - 104) * 12.7;
  const y = (34.2 - lat) * 14.2;
  return [x, y];
}

function chinaPath(points) {
  return points.map((p, i) => {
    const [x, y] = project(p);
    return `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z";
}

function linePath(start, end, curve = 0.28) {
  const [x1, y1] = start;
  const [x2, y2] = end;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const cx = mx * (1 - curve);
  const cy = my * (1 - curve);
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function clearSvg() {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function filteredRecords() {
  const q = state.query.trim();
  return state.data.records.filter((r) => {
    const byTea = state.selectedTea === "全部" || r["茶类"] === state.selectedTea;
    const byArea = state.selectedArea === "全部茶区" || r["四大茶区"] === state.selectedArea;
    const byQuery = !q || `${r["品种级茶名"]} ${r["省级"]} ${r["市级"]} ${r["最小产地(县/镇/村)"]} ${r["子类"]}`.includes(q);
    return byTea && byArea && byQuery;
  });
}

function aggregate(records, keyFn) {
  const map = new Map();
  for (const r of records) {
    const key = keyFn(r);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

function drawAtlas() {
  clearSvg();
  const records = filteredRecords();
  const colors = state.data.colors.teaTypes;
  const root = el("g");
  svg.appendChild(root);

  root.appendChild(el("circle", { class: "ring-bg", r: 510 }));
  [130, 205, 280, 355, 430].forEach((r) => root.appendChild(el("circle", { class: "ring-guide", r })));
  root.appendChild(el("circle", { class: "dash-ring", r: 382 }));

  const total = state.data.records.length;
  let cursor = -52;
  for (const tea of teaOrder) {
    const count = state.data.summary.teaTypes.find((x) => x.name === tea)?.value || 0;
    const span = count / total * 360;
    const segment = el("path", {
      class: "outer-segment",
      d: arcPath(505, cursor, cursor + span - 2),
      stroke: colors[tea],
      "stroke-width": 46,
    });
    root.appendChild(segment);
    cursor += span;
  }

  const mapGroup = el("g", { transform: "scale(1.12)" });
  mapGroup.appendChild(el("path", { class: "china-shape", d: chinaPath(chinaOutline) }));
  for (const line of innerLines) {
    const d = line.map((p, i) => {
      const [x, y] = project(p);
      return `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
    mapGroup.appendChild(el("path", { class: "china-inner-line", d }));
  }
  root.appendChild(mapGroup);

  const flowGroup = el("g");
  root.appendChild(flowGroup);
  const selected = aggregate(records, (r) => `${r["茶类"]}|${r["省级"]}`);
  for (const [key, items] of selected.entries()) {
    const [tea, province] = key.split("|");
    const start = polar(360, teaAngles[tea] || 0);
    const endRaw = state.data.provinces.find((p) => p.name === province)?.coords || items[0].coords;
    const [x, y] = project(endRaw);
    const path = el("path", {
      class: "flow-line",
      d: linePath(start, [x * 1.12, y * 1.12], 0.36),
      stroke: colors[tea],
      "stroke-width": Math.max(1.5, Math.min(10, Math.sqrt(items.length) * 2.2)),
    });
    flowGroup.appendChild(path);
  }

  const provinceGroups = aggregate(records, (r) => r["省级"]);
  for (const [province, items] of provinceGroups.entries()) {
    const coords = state.data.provinces.find((p) => p.name === province)?.coords || items[0].coords;
    const [x, y] = project(coords);
    const dominant = items.reduce((acc, r) => {
      acc[r["茶类"]] = (acc[r["茶类"]] || 0) + 1;
      return acc;
    }, {});
    const topTea = Object.entries(dominant).sort((a, b) => b[1] - a[1])[0]?.[0] || "绿茶";
    const dot = el("circle", {
      class: "province-dot",
      cx: x * 1.12,
      cy: y * 1.12,
      r: 7 + Math.sqrt(items.length) * 2.1,
      fill: colors[topTea],
    });
    dot.addEventListener("mousemove", (e) => showTip(e, province, `${items.length} 条记录 · ${topTea}最集中`));
    dot.addEventListener("mouseleave", hideTip);
    root.appendChild(dot);
    if (items.length >= 4) {
      root.appendChild(el("text", {
        class: "province-label",
        x: x * 1.12 + 13,
        y: y * 1.12 + 5,
        text: province.replace("省", "").replace("壮族自治区", ""),
      }));
    }
  }

  const teaNodeGroup = el("g");
  root.appendChild(teaNodeGroup);
  for (const tea of teaOrder) {
    const count = records.filter((r) => r["茶类"] === tea).length;
    const [x, y] = polar(360, teaAngles[tea]);
    const active = state.selectedTea === "全部" || state.selectedTea === tea;
    const group = el("g", { class: "tea-node", transform: `translate(${x} ${y})`, opacity: active ? 1 : 0.36 });
    group.appendChild(el("circle", {
      r: 45,
      fill: colors[tea],
      filter: "url(#softShadow)",
    }));
    group.appendChild(el("text", { text: tea }));
    group.appendChild(el("text", {
      y: 64,
      text: count ? `${count}` : "",
      fill: colors[tea],
      "font-size": 15,
      "font-weight": 900,
      "text-anchor": "middle",
    }));
    group.addEventListener("click", () => {
      state.selectedTea = state.selectedTea === tea ? "全部" : tea;
      updateAll();
    });
    teaNodeGroup.appendChild(group);
  }

  const defs = el("defs");
  const filter = el("filter", { id: "softShadow", x: "-40%", y: "-40%", width: "180%", height: "180%" });
  filter.appendChild(el("feDropShadow", { dx: 0, dy: 12, stdDeviation: 10, "flood-color": "#2b665b", "flood-opacity": 0.22 }));
  defs.appendChild(filter);
  svg.insertBefore(defs, svg.firstChild);

  drawLeafLabels(records);
}

function drawLeafLabels(records) {
  const rim = el("g");
  svg.appendChild(rim);
  const sorted = [...records].sort((a, b) => teaOrder.indexOf(a["茶类"]) - teaOrder.indexOf(b["茶类"]) || a["品种级茶名"].localeCompare(b["品种级茶名"], "zh"));
  const start = -52;
  const span = 286;
  sorted.forEach((r, i) => {
    const angle = start + (i / Math.max(1, sorted.length - 1)) * span;
    const [x1, y1] = polar(530, angle);
    const [x2, y2] = polar(585, angle);
    rim.appendChild(el("line", { class: "leaf-tick", x1, y1, x2, y2 }));
    const [tx, ty] = polar(595, angle);
    const rotate = angle;
    const anchor = angle > 0 && angle < 180 ? "start" : "end";
    const text = r["品种级茶名"].length > 7 ? `${r["品种级茶名"].slice(0, 7)}…` : r["品种级茶名"];
    const label = el("text", {
      class: "leaf-label",
      x: tx,
      y: ty,
      transform: `rotate(${rotate} ${tx} ${ty})`,
      "text-anchor": anchor,
      text,
    });
    label.addEventListener("mousemove", (e) => showTip(e, r["品种级茶名"], `${r["茶类"]} · ${r["省级"]}${r["市级"]}`));
    label.addEventListener("mouseleave", hideTip);
    rim.appendChild(label);
  });
}

function showTip(event, title, detail) {
  tip.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
  const box = event.currentTarget.closest(".atlas-wrap").getBoundingClientRect();
  tip.style.left = `${event.clientX - box.left}px`;
  tip.style.top = `${event.clientY - box.top}px`;
  tip.style.opacity = 1;
}

function hideTip() {
  tip.style.opacity = 0;
}

function renderFilters() {
  const wrap = document.getElementById("teaFilters");
  const colors = state.data.colors.teaTypes;
  const counts = new Map(state.data.summary.teaTypes.map((x) => [x.name, x.value]));
  wrap.innerHTML = "";
  const all = document.createElement("button");
  all.className = `tea-filter ${state.selectedTea === "全部" ? "is-active" : ""}`;
  all.innerHTML = `<i class="swatch" style="background:#1f6f69"></i><strong>全部茶类</strong><span>${state.data.records.length}</span>`;
  all.addEventListener("click", () => {
    state.selectedTea = "全部";
    updateAll();
  });
  wrap.appendChild(all);
  for (const tea of teaOrder) {
    const btn = document.createElement("button");
    btn.className = `tea-filter ${state.selectedTea === tea ? "is-active" : ""}`;
    btn.innerHTML = `<i class="swatch" style="background:${colors[tea]}"></i><strong>${tea}</strong><span>${counts.get(tea) || 0}</span>`;
    btn.addEventListener("click", () => {
      state.selectedTea = state.selectedTea === tea ? "全部" : tea;
      updateAll();
    });
    wrap.appendChild(btn);
  }
}

function renderLegends() {
  const area = document.getElementById("areaLegend");
  area.innerHTML = state.data.summary.areas.map((a) => {
    const color = state.data.colors.areas[a.name] || "#9CA3AF";
    return `<div class="area-pill"><i style="background:${color}"></i><span>${a.name}</span><strong>${a.value}</strong></div>`;
  }).join("");

  const select = document.getElementById("areaSelect");
  select.innerHTML = `<option>全部茶区</option>${state.data.summary.areas.map((a) => `<option>${a.name}</option>`).join("")}`;
  select.value = state.selectedArea;
}

function renderProvinceList() {
  const records = filteredRecords();
  const groups = aggregate(records, (r) => r["省级"]);
  const max = Math.max(...[...groups.values()].map((x) => x.length), 1);
  const rows = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12);
  document.getElementById("provinceList").innerHTML = rows.map(([name, items]) => {
    const topTea = Object.entries(items.reduce((acc, r) => {
      acc[r["茶类"]] = (acc[r["茶类"]] || 0) + 1;
      return acc;
    }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "绿茶";
    return `<div class="province-row"><i style="background:${state.data.colors.teaTypes[topTea]}"></i><span>${name}</span><em><b style="width:${items.length / max * 100}%"></b></em><strong>${items.length}</strong></div>`;
  }).join("");

  const uniqueProvince = new Set(records.map((r) => r["省级"]));
  document.getElementById("focusLabel").textContent = state.selectedTea === "全部" ? "全量数据" : state.selectedTea;
  document.getElementById("focusCount").textContent = records.length;
  document.getElementById("focusMeta").textContent = `覆盖 ${uniqueProvince.size} 个省级产地`;
}

function renderCards() {
  const records = filteredRecords().slice(0, 72);
  const grid = document.getElementById("teaCards");
  grid.innerHTML = records.map((r) => `
    <article class="tea-card">
      <header>
        <h3>${r["品种级茶名"]}</h3>
        <span class="tag" style="background:${r.color}">${r["茶类"]}</span>
      </header>
      <p>${r["子类"]}<br>${r["最小产地(县/镇/村)"]}</p>
      <footer>
        <span class="mini-pill">${r["省级"]}</span>
        <span class="mini-pill">${r["市级"]}</span>
        <span class="mini-pill">${r["四大茶区"]}</span>
      </footer>
    </article>
  `).join("");
}

function renderInsights() {
  const topProvince = state.data.summary.provinces[0];
  const topCity = state.data.summary.cities[0];
  const topSubclass = state.data.summary.subclasses[0];
  document.getElementById("insightText").innerHTML = `
    <div class="insight-item">表中数量最高的茶类是青茶，共 ${state.data.summary.teaTypes.find((x) => x.name === "青茶")?.value || 0} 条，凤凰单丛、闽南乌龙、台湾乌龙共同撑起青茶的复杂谱系。</div>
    <div class="insight-item">${topProvince.name} 记录最多，共 ${topProvince.value} 条；${topCity.name} 是城市层级中最密集的节点之一。</div>
    <div class="insight-item">子类中「${topSubclass.name}」最突出，共 ${topSubclass.count} 条，适合作为进一步展开的专题章节。</div>
  `;
}

function renderCharts() {
  if (!window.echarts) return;
  const teaChart = echarts.init(document.getElementById("teaChart"));
  teaChart.setOption({
    color: state.data.summary.teaTypes.map((x) => state.data.colors.teaTypes[x.name]),
    tooltip: {},
    series: [{
      type: "pie",
      radius: ["42%", "72%"],
      label: { formatter: "{b}\n{c}", fontWeight: 700 },
      data: state.data.summary.teaTypes,
    }],
  });

  const areaChart = echarts.init(document.getElementById("areaChart"));
  areaChart.setOption({
    color: state.data.summary.areas.map((x) => state.data.colors.areas[x.name]),
    grid: { left: 48, right: 18, top: 20, bottom: 34 },
    tooltip: {},
    xAxis: { type: "category", data: state.data.summary.areas.map((x) => x.name), axisLabel: { interval: 0 } },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: state.data.summary.areas.map((x) => x.value), barWidth: 34 }],
  });
  window.addEventListener("resize", () => {
    teaChart.resize();
    areaChart.resize();
  });
}

function updateAll() {
  renderFilters();
  renderProvinceList();
  renderCards();
  drawAtlas();
}

async function init() {
  const res = await fetch("./data/tea-data.json");
  state.data = await res.json();
  document.getElementById("metric-total").textContent = state.data.records.length;
  renderFilters();
  renderLegends();
  renderProvinceList();
  renderInsights();
  renderCards();
  renderCharts();
  drawAtlas();

  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.query = e.target.value;
    updateAll();
  });
  document.getElementById("areaSelect").addEventListener("change", (e) => {
    state.selectedArea = e.target.value;
    updateAll();
  });
}

init();
