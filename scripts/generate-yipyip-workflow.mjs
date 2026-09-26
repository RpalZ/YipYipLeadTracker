import { writeFileSync } from "node:fs";

const outputBase = new URL("../docs/yipyip-workflow", import.meta.url);
const updated = 1790208000000;
let sequence = 0;

const palette = {
  ink: "#18312d",
  muted: "#60716d",
  paper: "#fbfaf5",
  lane: "#f5f6f1",
  verified: "#e2f4df",
  verifiedStroke: "#1f6b55",
  contract: "#e5efff",
  contractStroke: "#35618e",
  planned: "#fff0c2",
  plannedStroke: "#9a6700",
  decision: "#f0f2f1",
  decisionStroke: "#596562",
};

const nodes = [
  { id: "open", x: 70, y: 245, w: 180, h: 92, label: "Open pursuit\nLead gallery", state: "verified" },
  { id: "filter", x: 290, y: 245, w: 205, h: 92, label: "Pursuit · Monitoring\nNeeds attention · All", state: "verified", fontSize: 14 },
  { id: "scan", x: 535, y: 222, w: 260, h: 138, label: "Scan each card\nWHAT · WHY · BUDGET\nWHERE · WHO · SOURCES", state: "verified" },
  { id: "select", x: 835, y: 245, w: 210, h: 92, label: "Click a lead\npush ?lead=<id>", state: "verified" },
  { id: "drawer", x: 1085, y: 222, w: 275, h: 138, label: "Artifact-style drawer\nOverview · Evaluation · Sources\nOutreach · Review", state: "verified", fontSize: 15 },
  { id: "basket-add", x: 1400, y: 245, w: 190, h: 92, label: "Add to\nreview basket", state: "verified" },
  { id: "basket", x: 1630, y: 222, w: 205, h: 138, label: "Pursuit workspace\n/reviewed\nautomatic · manual\nworking · research · passed", state: "verified", fontSize: 13 },
  { id: "review-mutation", x: 1630, y: 425, w: 205, h: 86, label: "Persistent review\npursue · pass · research\nroute + history", state: "verified", fontSize: 13 },

  { id: "strategy", x: 60, y: 690, w: 210, h: 112, label: "Editable Lead Strategy\ncapability · sectors\nbudget · capacity", state: "verified", fontSize: 14 },
  { id: "scout", x: 310, y: 690, w: 210, h: 112, label: "Source Scout\nproposes reputable\nsources", state: "verified", fontSize: 15 },
  { id: "approve", x: 560, y: 690, w: 210, h: 112, label: "ONE-TIME GATE\napprove each source", state: "verified", fontSize: 15 },
  { id: "schedule", x: 810, y: 690, w: 210, h: 112, label: "Weekday monitor\n07:00 local · leases\nCron activation pending", state: "contract", fontSize: 14 },
  { id: "monitor", x: 1060, y: 690, w: 210, h: 112, label: "Source Monitor\nbounded web search", state: "verified", fontSize: 15 },
  { id: "normalize", x: 1310, y: 690, w: 220, h: 112, label: "Normalize + validate\ncitations · dates · dedupe", state: "verified", fontSize: 14 },
  { id: "resolve", x: 1570, y: 690, w: 230, h: 112, label: "Exact resolver\norg-specific → Opportunity\nprogramme → Signal only", state: "verified", fontSize: 13 },

  { id: "assess", x: 1570, y: 865, w: 230, h: 112, label: "First Assessor\napplication scoring", state: "verified", fontSize: 15 },
  { id: "gaps", x: 1310, y: 865, w: 220, h: 112, label: "Gap Analyst\nbudget · capability\nactionability · contact", state: "verified", fontSize: 13 },
  { id: "research", x: 1060, y: 865, w: 210, h: 112, label: "Research Agent\nfocused evidence bundles\n2 attempts · unknown OK", state: "verified", fontSize: 13 },
  { id: "final", x: 810, y: 865, w: 210, h: 112, label: "Final Assessor\nevidence snapshot\nemail + call drafts", state: "verified", fontSize: 14 },
  { id: "router", x: 560, y: 865, w: 210, h: 112, label: "Deterministic Router\nqualify · monitor · reject\nor genuine exception", state: "verified", fontSize: 13 },
  { id: "qualified", x: 310, y: 865, w: 210, h: 112, label: "Versioned Lead\n+ immutable outreach\nappears automatically", state: "verified", fontSize: 14 },
  { id: "attention", x: 60, y: 865, w: 210, h: 112, label: "Needs attention\nmonitoring · rejected\nmanual promotion option", state: "verified", fontSize: 14 },
];

const edges = [
  { from: "open", to: "filter" },
  { from: "filter", to: "scan" },
  { from: "scan", to: "select" },
  { from: "select", to: "drawer" },
  { from: "drawer", to: "basket-add" },
  { from: "basket-add", to: "basket" },
  { points: [[1732, 360], [1732, 425]], label: "atomic + version checked", labelX: 1585, labelY: 380 },
  { points: [[1222, 382], [1222, 402], [390, 402], [390, 337]], label: "Back · Close · Escape · backdrop", labelX: 720, labelY: 375 },

  { from: "strategy", to: "scout" },
  { from: "scout", to: "approve" },
  { from: "approve", to: "schedule" },
  { from: "schedule", to: "monitor" },
  { from: "monitor", to: "normalize" },
  { from: "normalize", to: "resolve" },
  { points: [[1685, 802], [1685, 865]] },
  { points: [[1570, 921], [1530, 921]] },
  { points: [[1310, 921], [1270, 921]] },
  { points: [[1060, 921], [1020, 921]] },
  { points: [[810, 921], [770, 921]] },
  { points: [[560, 921], [520, 921]] },
  { points: [[560, 946], [520, 1010], [165, 1010], [165, 977]], label: "exception", labelX: 335, labelY: 982 },
  { points: [[665, 865], [665, 590], [390, 590], [390, 337]], label: "promising · public facts unavailable", labelX: 405, labelY: 565 },
  { points: [[310, 921], [25, 921], [25, 291], [70, 291]], label: "automatic qualified Lead", labelX: 45, labelY: 572 },
  { points: [[60, 946], [45, 946], [45, 430], [160, 430], [160, 337]], label: "owner/reviewer · attributed manual pursuit", labelX: 70, labelY: 407 },
];

const byId = new Map(nodes.map((node) => [node.id, node]));
for (const edge of edges) {
  if (!edge.points) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    edge.points = [[from.x + from.w, from.y + from.h / 2], [to.x, to.y + to.h / 2]];
  }
}

function base(type, id, x, y, width, height) {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: palette.ink,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: `a${(sequence++).toString(36)}`,
    roundness: type === "rectangle" ? { type: 3 } : null,
    seed: 1000 + sequence * 97,
    version: 1,
    versionNonce: 5000 + sequence * 131,
    isDeleted: false,
    boundElements: [],
    updated,
    link: null,
    locked: false,
  };
}

function rectangle(id, x, y, width, height, backgroundColor, strokeColor, strokeStyle = "solid", roughness = 1) {
  return { ...base("rectangle", id, x, y, width, height), backgroundColor, strokeColor, strokeStyle, roughness };
}

function textElement(id, x, y, width, height, text, fontSize = 18, textAlign = "left", color = palette.ink, fontFamily = 3) {
  return {
    ...base("text", id, x, y, width, height),
    strokeColor: color,
    strokeWidth: 1,
    roughness: 0,
    text,
    fontSize,
    fontFamily,
    textAlign,
    verticalAlign: "top",
    containerId: null,
    originalText: text,
    autoResize: false,
    lineHeight: 1.25,
  };
}

function arrowElement(id, absolutePoints, dashed = false) {
  const [start] = absolutePoints;
  const relative = absolutePoints.map(([x, y]) => [x - start[0], y - start[1]]);
  const xs = relative.map(([x]) => x);
  const ys = relative.map(([, y]) => y);
  return {
    ...base("arrow", id, start[0], start[1], Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
    strokeColor: dashed ? palette.plannedStroke : palette.ink,
    strokeStyle: dashed ? "dashed" : "solid",
    points: relative,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false,
  };
}

const elements = [
  rectangle("lane-review", 35, 155, 1850, 420, palette.lane, "#c7cfcc", "solid", 0),
  rectangle("lane-pipeline", 35, 615, 1850, 405, palette.lane, "#c7cfcc", "solid", 0),
  rectangle("data-plane", 70, 1100, 1215, 120, palette.contract, palette.contractStroke, "solid", 0),
  rectangle("controls", 1330, 1100, 520, 120, palette.planned, palette.plannedStroke, "dashed", 0),
  ...edges.map((edge, index) => arrowElement(`edge-${index}`, edge.points, edge.dashed)),
];

for (const node of nodes) {
  const background = palette[node.state];
  const stroke = palette[`${node.state}Stroke`] ?? palette.decisionStroke;
  const shape = node.shape === "diamond" ? "diamond" : "rectangle";
  const box = { ...base(shape, `${node.id}-box`, node.x, node.y, node.w, node.h), backgroundColor: background, strokeColor: stroke, strokeStyle: node.state === "planned" ? "dashed" : "solid" };
  elements.push(box);
  const lines = node.label.split("\n");
  const fontSize = node.fontSize ?? (node.shape === "diamond" ? 18 : 17);
  const textHeight = lines.length * fontSize * 1.25;
  elements.push(textElement(`${node.id}-text`, node.x + 12, node.y + (node.h - textHeight) / 2, node.w - 24, textHeight, node.label, fontSize, "center"));
}

for (const [index, edge] of edges.entries()) {
  if (edge.label) elements.push(textElement(`edge-label-${index}`, edge.labelX, edge.labelY, 260, 24, edge.label, 13, "left", edge.dashed ? palette.plannedStroke : palette.muted));
}

elements.push(
  textElement("title", 45, 36, 1150, 46, "YipYip — signal-to-lead and review workflow", 30, "left"),
  textElement("subtitle", 45, 86, 1300, 28, "Lead Strategy → source approval once → recurring autonomous qualification → human review", 16, "left", palette.muted),
  textElement("lane-review-title", 60, 177, 720, 28, "A · OPERATOR REVIEW FLOW — WORKS NOW", 19, "left", palette.verifiedStroke),
  textElement("lane-pipeline-title", 60, 638, 1120, 28, "B · AUTONOMOUS SOURCE-TO-LEAD PIPELINE — IMPLEMENTED VERTICAL SLICE", 19, "left", palette.verifiedStroke),
  textElement("data-title", 92, 1121, 420, 25, "SUPABASE DURABLE DATA PLANE", 17, "left", palette.contractStroke),
  textElement("data-copy", 92, 1155, 1160, 45, "Auth + workspaces + RLS  |  Lead Strategy + sources  |  workflows + stages + health events\nsignals + opportunities + qualification checks + outreach snapshots + attributed Lead origins + review events", 14, "left"),
  textElement("controls-title", 1352, 1121, 450, 25, "BOUNDED CONTROLS — IMPLEMENTED", 17, "left", palette.verifiedStroke),
  textElement("controls-copy", 1352, 1155, 455, 45, "Idempotency · stage leases · retries · time/cost limits\nserver-only secrets · hosted Cron activation pending", 14, "left"),
  rectangle("legend-verified-box", 1372, 48, 26, 22, palette.verified, palette.verifiedStroke, "solid", 0),
  textElement("legend-verified", 1407, 50, 120, 22, "Verified now", 14),
  rectangle("legend-contract-box", 1530, 48, 26, 22, palette.contract, palette.contractStroke, "solid", 0),
  textElement("legend-contract", 1565, 50, 150, 22, "Contract exists", 14),
  rectangle("legend-planned-box", 1710, 48, 26, 22, palette.planned, palette.plannedStroke, "dashed", 0),
  textElement("legend-planned", 1745, 50, 120, 22, "Planned", 14)
);

const excalidraw = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements,
  appState: { gridSize: 20, viewBackgroundColor: palette.paper },
  files: {},
};

writeFileSync(new URL(`${outputBase.pathname}.excalidraw`, "file://"), `${JSON.stringify(excalidraw, null, 2)}\n`);

const esc = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const svgText = (x, y, width, height, label, size = 17, color = palette.ink, anchor = "middle") => {
  const lines = label.split("\n");
  const startY = y + height / 2 - ((lines.length - 1) * size * 1.25) / 2;
  const tx = anchor === "middle" ? x + width / 2 : x;
  return `<text x="${tx}" y="${startY}" text-anchor="${anchor}" fill="${color}" font-size="${size}" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="${size >= 19 ? 700 : 500}">${lines.map((line, i) => `<tspan x="${tx}" dy="${i ? size * 1.25 : 0}">${esc(line)}</tspan>`).join("")}</text>`;
};
const svgPath = (points) => points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1260" viewBox="0 0 1920 1260" role="img" aria-labelledby="workflow-title workflow-desc">
  <title id="workflow-title">YipYip signal-to-lead and review workflow</title>
  <desc id="workflow-desc">Two lanes show Lead review and the autonomous workflow from an editable Lead Strategy through Source Scout, source approval, recurring monitoring, validation, assessment, focused research, automatic qualification, exception routing, and a separately attributed manual-pursuit override.</desc>
  <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${palette.ink}"/></marker><marker id="arrowhead-planned" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${palette.plannedStroke}"/></marker></defs>
  <rect width="1920" height="1260" fill="${palette.paper}"/>
  <rect x="35" y="155" width="1850" height="420" rx="18" fill="${palette.lane}" stroke="#c7cfcc"/>
  <rect x="35" y="615" width="1850" height="405" rx="18" fill="${palette.lane}" stroke="#c7cfcc"/>
  ${edges.map((edge) => `<path d="${svgPath(edge.points)}" fill="none" stroke="${edge.dashed ? palette.plannedStroke : palette.ink}" stroke-width="2.5" ${edge.dashed ? "stroke-dasharray=\"9 8\"" : ""} marker-end="url(#${edge.dashed ? "arrowhead-planned" : "arrowhead"})"/>`).join("\n  ")}
  ${nodes.map((node) => { const background = palette[node.state]; const stroke = palette[`${node.state}Stroke`] ?? palette.decisionStroke; const dash = node.state === "planned" ? "stroke-dasharray=\"9 8\"" : ""; const shape = node.shape === "diamond" ? `<polygon points="${node.x + node.w / 2},${node.y} ${node.x + node.w},${node.y + node.h / 2} ${node.x + node.w / 2},${node.y + node.h} ${node.x},${node.y + node.h / 2}" fill="${background}" stroke="${stroke}" stroke-width="2.5" ${dash}/>` : `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="12" fill="${background}" stroke="${stroke}" stroke-width="2.5" ${dash}/>`; return `${shape}\n  ${svgText(node.x + 8, node.y, node.w - 16, node.h, node.label, node.fontSize ?? (node.shape === "diamond" ? 18 : 17))}`; }).join("\n  ")}
  <rect x="70" y="1100" width="1215" height="120" rx="14" fill="${palette.contract}" stroke="${palette.contractStroke}" stroke-width="2.5"/>
  <rect x="1330" y="1100" width="520" height="120" rx="14" fill="${palette.planned}" stroke="${palette.plannedStroke}" stroke-width="2.5" stroke-dasharray="9 8"/>
  ${svgText(45, 28, 1100, 48, "YipYip — signal-to-lead and review workflow", 30, palette.ink, "start")}
  ${svgText(45, 75, 1300, 34, "Lead Strategy → source approval once → recurring autonomous qualification → human review", 16, palette.muted, "start")}
  ${svgText(60, 170, 720, 32, "A · OPERATOR REVIEW FLOW — WORKS NOW", 19, palette.verifiedStroke, "start")}
  ${svgText(60, 631, 1120, 32, "B · AUTONOMOUS SOURCE-TO-LEAD PIPELINE — IMPLEMENTED VERTICAL SLICE", 19, palette.verifiedStroke, "start")}
  ${edges.filter((edge) => edge.label).map((edge) => `<text x="${edge.labelX}" y="${edge.labelY + 14}" fill="${edge.dashed ? palette.plannedStroke : palette.muted}" font-size="13" font-family="JetBrains Mono, ui-monospace, monospace">${esc(edge.label)}</text>`).join("\n  ")}
  ${svgText(92, 1110, 500, 35, "SUPABASE DURABLE DATA PLANE", 17, palette.contractStroke, "start")}
  ${svgText(92, 1150, 1160, 52, "Auth + workspaces + RLS  |  Lead Strategy + sources  |  workflows + stages + health events\nsignals + opportunities + qualification checks + outreach snapshots + attributed Lead origins + review events", 14, palette.ink, "start")}
  ${svgText(1352, 1110, 450, 35, "BOUNDED CONTROLS — IMPLEMENTED", 17, palette.verifiedStroke, "start")}
  ${svgText(1352, 1150, 455, 52, "Idempotency · stage leases · retries · time/cost limits\nserver-only secrets · hosted Cron activation pending", 14, palette.ink, "start")}
  <rect x="1372" y="48" width="26" height="22" rx="4" fill="${palette.verified}" stroke="${palette.verifiedStroke}"/><text x="1407" y="65" fill="${palette.ink}" font-size="14" font-family="JetBrains Mono, ui-monospace, monospace">Verified now</text>
  <rect x="1530" y="48" width="26" height="22" rx="4" fill="${palette.contract}" stroke="${palette.contractStroke}"/><text x="1565" y="65" fill="${palette.ink}" font-size="14" font-family="JetBrains Mono, ui-monospace, monospace">Contract exists</text>
  <rect x="1710" y="48" width="26" height="22" rx="4" fill="${palette.planned}" stroke="${palette.plannedStroke}" stroke-dasharray="5 4"/><text x="1745" y="65" fill="${palette.ink}" font-size="14" font-family="JetBrains Mono, ui-monospace, monospace">Planned</text>
</svg>`;

writeFileSync(new URL(`${outputBase.pathname}.svg`, "file://"), `${svg}\n`);
