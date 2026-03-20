// Self-contained HTML export matching the original Agent Motus v2 style
import type { Swarm } from '../../shared/types/index.js';

export function generateStandaloneHTML(swarm: Swarm): string {
  const agentsByLayer = new Map<string, typeof swarm.agents>();
  for (const layer of swarm.layers.sort((a, b) => a.order - b.order)) {
    agentsByLayer.set(layer.id, swarm.agents.filter(a => a.layerId === layer.id));
  }

  const layerColors: Record<number, string> = { 0: '#00d9ff', 1: '#a855f7', 2: '#10b981', 3: '#f59e0b', 4: '#fbbf24' };

  const agentCards = swarm.layers.sort((a, b) => a.order - b.order).map((layer, li) => {
    const agents = agentsByLayer.get(layer.id) || [];
    if (agents.length === 0) return '';
    const color = layer.colorTheme || layerColors[li] || '#00d9ff';

    return `
    <div class="layer">
      <div class="layer-title" style="border-left-color: ${color}">${layer.name}</div>
      <div class="agents-grid">
        ${agents.map(agent => {
          const config = agent.config as any;
          const emoji = config?.emoji || '🤖';
          const isHub = agent.badges.includes('HUB');
          const healthClass = 'healthy';

          return `
          <div class="agent-card${isHub ? ' hub' : ''}" data-agent="${agent.nickname}" onclick="selectAgent('${agent.nickname}')">
            <div class="health-indicator ${healthClass}"></div>
            <div class="agent-emoji">${emoji}</div>
            <div class="agent-nickname">${agent.nickname}</div>
            <div class="agent-formal">${agent.formalName}</div>
            <div class="agent-descriptor">"${agent.descriptor}"</div>
            <div class="agent-badges">
              ${agent.badges.map(b => {
                const cls = b === 'AUTO' ? 'badge-auto' : b === 'HUMAN' ? 'badge-human' : b === 'ENTRY' ? 'badge-entry' : b === 'HUB' ? 'badge-hub' : b === 'CRITICAL' ? 'badge-critical' : '';
                return `<span class="badge ${cls}">${b.replace('_', ' ')}</span>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  // Build relationship data for JS
  const relData: Record<string, { dependsOn: string[]; feedsInto: string[]; collaboratesWith: string[]; canOverride: string[] }> = {};
  for (const agent of swarm.agents) {
    relData[agent.nickname] = { dependsOn: [], feedsInto: [], collaboratesWith: [], canOverride: [] };
  }
  for (const rel of swarm.relationships) {
    const source = swarm.agents.find(a => a.id === rel.sourceAgentId)?.nickname;
    const target = swarm.agents.find(a => a.id === rel.targetAgentId)?.nickname;
    if (source && target && relData[source]) {
      (relData[source] as any)[rel.type]?.push(target);
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${swarm.name} - Agent Motus Map</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:linear-gradient(135deg,#0a0e27 0%,#1a1f3a 50%,#0a0e27 100%);font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;padding:40px 20px;color:#fff}
.container{max-width:1600px;margin:0 auto}
h1{text-align:center;color:#00d9ff;font-size:42px;margin-bottom:10px;text-transform:uppercase;letter-spacing:4px;text-shadow:0 0 20px rgba(0,217,255,0.5)}
.subtitle{text-align:center;color:#8b9dc3;font-size:18px;margin-bottom:10px}
.stats{text-align:center;color:#64748b;font-size:13px;margin-bottom:30px}
.click-instruction{text-align:center;color:#00d9ff;font-size:16px;margin-bottom:20px;animation:glow 2s ease-in-out infinite}
@keyframes glow{0%,100%{opacity:1}50%{opacity:0.6}}
.legend{display:flex;justify-content:center;gap:30px;margin-bottom:30px;flex-wrap:wrap}
.legend-item{display:flex;align-items:center;gap:8px;color:#8b9dc3;font-size:13px}
.legend-line{width:40px;height:3px;border-radius:2px}
.layer{margin-bottom:60px}
.layer-title{color:#fff;font-size:24px;margin-bottom:20px;text-align:center;padding:12px;background:rgba(255,255,255,0.05);border-radius:10px;border-left:5px solid}
.agents-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px;padding:10px}
.agent-card{background:linear-gradient(145deg,#1e293b,#0f172a);border-radius:15px;padding:20px;cursor:pointer;transition:all 0.3s;border:2px solid rgba(255,255,255,0.1);position:relative;min-height:160px}
.agent-card:hover{transform:translateY(-5px);border-color:#00d9ff;box-shadow:0 10px 30px rgba(0,217,255,0.3)}
.agent-card.hub{grid-column:span 2}
.agent-card.highlighted{box-shadow:0 0 40px rgba(0,217,255,0.8);transform:translateY(-10px) scale(1.05);z-index:10}
.agent-card.connected{box-shadow:0 0 20px rgba(251,191,36,0.5);z-index:5}
.health-indicator{position:absolute;top:10px;right:10px;width:14px;height:14px;border-radius:50%;box-shadow:0 0 8px currentColor;animation:pulse 2s ease-in-out infinite}
.health-indicator.healthy{background:#10b981;color:#10b981}
.health-indicator.warning{background:#fbbf24;color:#fbbf24}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.agent-emoji{font-size:40px;text-align:center;margin-bottom:8px}
.agent-nickname{font-size:20px;font-weight:bold;color:#00d9ff;text-align:center;margin-bottom:4px}
.agent-formal{font-size:11px;color:#8b9dc3;text-align:center;margin-bottom:4px}
.agent-descriptor{font-size:13px;color:#64748b;text-align:center;font-style:italic;margin-bottom:8px}
.agent-badges{display:flex;gap:4px;flex-wrap:wrap;justify-content:center}
.badge{padding:2px 8px;border-radius:12px;font-size:10px;font-weight:bold;text-transform:uppercase;background:rgba(255,255,255,0.1);color:#8b9dc3}
.badge-auto{background:#10b981;color:white}
.badge-human{background:#f59e0b;color:white}
.badge-entry{background:#ef4444;color:white}
.badge-hub{background:#a855f7;color:white}
.badge-critical{background:#dc2626;color:white}
.relationship-panel{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:linear-gradient(145deg,#1e293b,#0f172a);border:2px solid #00d9ff;border-radius:16px;padding:20px 30px;max-width:700px;z-index:100;display:none;box-shadow:0 20px 60px rgba(0,0,0,0.8)}
.relationship-panel.show{display:block;animation:slideUp 0.3s ease}
@keyframes slideUp{from{transform:translateX(-50%) translateY(100px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
.close-panel{position:absolute;top:8px;right:12px;background:none;border:none;color:#ef4444;cursor:pointer;font-size:20px}
.rel-section{margin-bottom:6px}
.rel-section strong{margin-right:6px}
.footer{text-align:center;color:#475569;font-size:12px;margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.05)}
</style>
</head>
<body>
<div class="container">
<h1>${swarm.name}</h1>
<p class="subtitle">${swarm.description || 'Agent Swarm Architecture'}</p>
<p class="stats">${swarm.agents.length} Agents | ${swarm.relationships.length} Relationships | ${swarm.layers.length} Layers</p>
<p class="click-instruction">Click any agent to see its relationships</p>
<div class="legend">
<div class="legend-item"><div class="legend-line" style="background:#00d9ff"></div><span>Depends On</span></div>
<div class="legend-item"><div class="legend-line" style="background:#a855f7"></div><span>Feeds Into</span></div>
<div class="legend-item"><div class="legend-line" style="background:#fbbf24"></div><span>Collaborates</span></div>
<div class="legend-item"><div class="legend-line" style="background:#ef4444"></div><span>Can Override</span></div>
</div>
${agentCards}
</div>
<div id="relationshipPanel" class="relationship-panel">
<button class="close-panel" onclick="clearSelection()">X</button>
<h3 style="color:#00d9ff;margin-bottom:12px" id="panelTitle"></h3>
<div id="relationshipList"></div>
</div>
<div class="footer">Generated by Agent Modus Map on ${new Date().toISOString().split('T')[0]}</div>
<script>
const relationships=${JSON.stringify(relData)};
let selectedAgent=null;
function selectAgent(name){
if(selectedAgent===name){clearSelection();return}
selectedAgent=name;
document.querySelectorAll('.agent-card').forEach(c=>{c.classList.remove('highlighted','connected')});
const card=document.querySelector('[data-agent="'+name+'"]');
if(card)card.classList.add('highlighted');
const rels=relationships[name];
if(!rels)return;
[...rels.dependsOn,...rels.feedsInto,...rels.collaboratesWith,...rels.canOverride].forEach(n=>{
const c=document.querySelector('[data-agent="'+n+'"]');
if(c)c.classList.add('connected');
});
const panel=document.getElementById('relationshipPanel');
document.getElementById('panelTitle').textContent=name+' Relationships';
let html='';
if(rels.dependsOn.length)html+='<div class="rel-section"><strong style="color:#00d9ff">Depends On:</strong>'+rels.dependsOn.join(', ')+'</div>';
if(rels.feedsInto.length)html+='<div class="rel-section"><strong style="color:#a855f7">Feeds Into:</strong>'+rels.feedsInto.join(', ')+'</div>';
if(rels.collaboratesWith.length)html+='<div class="rel-section"><strong style="color:#fbbf24">Collaborates:</strong>'+rels.collaboratesWith.join(', ')+'</div>';
if(rels.canOverride.length)html+='<div class="rel-section"><strong style="color:#ef4444">Can Override:</strong>'+rels.canOverride.join(', ')+'</div>';
document.getElementById('relationshipList').innerHTML=html;
panel.classList.add('show');
}
function clearSelection(){
selectedAgent=null;
document.querySelectorAll('.agent-card').forEach(c=>{c.classList.remove('highlighted','connected')});
document.getElementById('relationshipPanel').classList.remove('show');
}
</script>
</body>
</html>`;
}
