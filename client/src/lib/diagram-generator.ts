import { WhamoNode, WhamoEdge } from './store';

export function generateSystemDiagramSVG(nodes: WhamoNode[], edges: WhamoEdge[], options: { showLabels: boolean } = { showLabels: true }) {
  // 1. Systematic Layout Parameters
  const spacingX = 220; // Increased spacing for better alignment
  const spacingY = 160;
  
  const diagramNodes = [...nodes];
  
  // Build adjacency list for layout
  const adj: Record<string, string[]> = {};
  edges.forEach(e => {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  });

  // Assign levels (columns) based on distance from reservoirs
  const levels: Record<string, number> = {};
  const reservoirs = diagramNodes.filter(n => n.type === 'reservoir');
  const queue: string[] = reservoirs.map(r => r.id);
  reservoirs.forEach(r => levels[r.id] = 0);

  // Catch disconnected nodes or different entry points
  const unvisited = new Set(diagramNodes.map(n => n.id));
  reservoirs.forEach(r => unvisited.delete(r.id));

  while (queue.length > 0 || unvisited.size > 0) {
    if (queue.length === 0) {
      const nextId = Array.from(unvisited)[0];
      levels[nextId] = 0;
      queue.push(nextId);
      unvisited.delete(nextId);
    }

    const u = queue.shift()!;
    unvisited.delete(u);
    const neighbors = adj[u] || [];
    neighbors.forEach(v => {
      if (levels[v] === undefined) {
        levels[v] = (levels[u] || 0) + 1;
        queue.push(v);
        unvisited.delete(v);
      } else {
        levels[v] = Math.max(levels[v], (levels[u] || 0) + 1);
      }
    });
  }

  // Group nodes by level and sort them for systematic alignment
  const levelsMap: Record<number, string[]> = {};
  diagramNodes.forEach(n => {
    const lvl = levels[n.id] || 0;
    if (!levelsMap[lvl]) levelsMap[lvl] = [];
    levelsMap[lvl].push(n.id);
  });

  // Calculate dynamic dimensions
  const maxNodesInLevel = Math.max(...Object.values(levelsMap).map(ids => ids.length), 1);
  const numLevels = Object.keys(levelsMap).length;
  const svgWidth = Math.max(1200, (numLevels + 1) * spacingX);
  const svgHeight = Math.max(800, (maxNodesInLevel + 1) * spacingY);

  const posMap: Record<string, {x: number, y: number}> = {};
  Object.entries(levelsMap).forEach(([lvlStr, nodeIds]) => {
    const lvl = parseInt(lvlStr);
    // Sort nodeIds to maintain systematic order
    nodeIds.sort();
    const columnHeight = (nodeIds.length - 1) * spacingY;
    const startY = (svgHeight - columnHeight) / 2;
    
    nodeIds.forEach((id, idx) => {
      posMap[id] = {
        x: 100 + lvl * spacingX,
        y: startY + idx * spacingY
      };
    });
  });

  const findNode = (id: string) => nodes.find(n => n.id === id);

  const formatData = (data: any) => {
    if (!data) return '';
    return Object.entries(data)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n');
  };

  let svgContent = `
    <svg id="system-diagram-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="w-full h-full bg-white" style="pointer-events: all;">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#3498db" />
        </marker>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="1" dy="1" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
  `;

  // Draw Edges (Pipes)
  edges.forEach(edge => {
    const sourceNode = findNode(edge.source);
    const targetNode = findNode(edge.target);
    if (!sourceNode || !targetNode) return;

    const p1 = posMap[edge.source];
    const p2 = posMap[edge.target];
    if (!p1 || !p2) return;

    const isDummy = edge.data?.type === 'dummy';
    const className = isDummy ? 'stroke="#95a5a6" stroke-width="2" stroke-dasharray="5,5"' : 'stroke="#3498db" stroke-width="3"';
    const marker = isDummy ? '' : 'marker-end="url(#arrowhead)"';

    const x1 = p1.x;
    const y1 = p1.y;
    const x2 = p2.x;
    const y2 = p2.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const path = `M ${x1} ${y1} Q ${mx} ${my - dy * 0.1} ${x2} ${y2}`;

    const tooltip = `Conduit: ${edge.data?.pipeId || edge.id}\n${formatData(edge.data)}`;

    svgContent += `
      <g class="edge-group" style="cursor: pointer;">
        <title>${tooltip}</title>
        <path d="${path}" ${className} ${marker} fill="none" />
        ${options.showLabels && edge.data?.pipeId ? `
          <g transform="translate(${(x1+x2)/2}, ${(y1+y2)/2 - 15})">
            <rect x="-30" y="-10" width="60" height="20" fill="white" fill-opacity="0.8" rx="4" />
            <text text-anchor="middle" font-size="10" fill="#2c3e50" font-weight="bold">${edge.data.pipeId}</text>
          </g>
        ` : ''}
      </g>
    `;
  });

  // Draw Nodes
  diagramNodes.forEach(node => {
    const pos = posMap[node.id];
    if (!pos) return;
    const { x, y } = pos;
    const label = node.data.label || '';
    const nodeNum = node.data.nodeNumber || node.id;
    const tooltip = `Node: ${nodeNum}\nType: ${node.type}\n${formatData(node.data)}`;

    svgContent += `<g class="node-group" filter="url(#shadow)" style="cursor: pointer;"><title>${tooltip}</title>`;

    if (node.type === 'reservoir') {
      svgContent += `
          <rect x="${x - 25}" y="${y - 20}" width="50" height="40" fill="#3498db" stroke="#2980b9" stroke-width="2" rx="4" />
          <text x="${x}" y="${y + 5}" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${label || 'HW'}</text>
      `;
    } else if (node.type === 'surgeTank') {
      svgContent += `
          <rect x="${x - 20}" y="${y - 30}" width="40" height="60" fill="#f39c12" stroke="#e67e22" stroke-width="2" rx="4" />
          <text x="${x}" y="${y + 5}" text-anchor="middle" fill="white" font-size="11" font-weight="bold">ST</text>
      `;
    } else if (node.type === 'flowBoundary') {
      svgContent += `
          <path d="M ${x-25} ${y-15} L ${x+25} ${y} L ${x-25} ${y+15} Z" fill="#2ecc71" stroke="#27ae60" stroke-width="2" />
          <text x="${x - 5}" y="${y + 4}" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${label || 'FB'}</text>
      `;
    } else if (node.type === 'junction') {
      svgContent += `
          <circle cx="${x}" cy="${y}" r="10" fill="#e74c3c" stroke="#c0392b" stroke-width="2" />
      `;
    } else {
      svgContent += `
          <circle cx="${x}" cy="${y}" r="8" fill="#95a5a6" stroke="#7f8c8d" stroke-width="2" />
      `;
    }

    if (options.showLabels) {
      svgContent += `
        <text x="${x}" y="${y - 35}" text-anchor="middle" fill="#2c3e50" font-size="10" font-weight="bold">Node ${nodeNum}</text>
      `;
    }

    svgContent += `</g>`;
  });

  svgContent += `</svg>`;
  return svgContent;
}

export const generateSystemDiagram = generateSystemDiagramSVG;
