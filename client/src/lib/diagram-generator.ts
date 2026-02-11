import { WhamoNode, WhamoEdge } from './store';

export function generateSystemDiagramSVG(nodes: WhamoNode[], edges: WhamoEdge[], options: { showLabels: boolean } = { showLabels: true }) {
  // 1. Better horizontal layout algorithm
  const spacingX = 180;
  const spacingY = 140;
  
  // Create a copy of nodes to not mutate store
  const diagramNodes = [...nodes];
  
  // Identify start nodes (reservoirs)
  const reservoirs = diagramNodes.filter(n => n.type === 'reservoir');
  
  // Build adjacency list for layout
  const adj: Record<string, string[]> = {};
  edges.forEach(e => {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  });

  // Assign levels (columns) based on distance from reservoirs
  const levels: Record<string, number> = {};
  const queue: string[] = reservoirs.map(r => r.id);
  reservoirs.forEach(r => levels[r.id] = 0);

  while (queue.length > 0) {
    const u = queue.shift()!;
    const neighbors = adj[u] || [];
    neighbors.forEach(v => {
      if (levels[v] === undefined) {
        levels[v] = levels[u] + 1;
        queue.push(v);
      } else {
        levels[v] = Math.max(levels[v], levels[u] + 1);
      }
    });
  }

  // Group nodes by level
  const levelsMap: Record<number, string[]> = {};
  diagramNodes.forEach(n => {
    const lvl = levels[n.id] || 0;
    if (!levelsMap[lvl]) levelsMap[lvl] = [];
    levelsMap[lvl].push(n.id);
  });

  // Assign horizontal positions based on level, and vertical based on index in level
  const posMap: Record<string, {x: number, y: number}> = {};
  Object.entries(levelsMap).forEach(([lvlStr, nodeIds]) => {
    const lvl = parseInt(lvlStr);
    const startY = (750 - (nodeIds.length - 1) * spacingY) / 2;
    nodeIds.forEach((id, idx) => {
      posMap[id] = {
        x: 80 + lvl * spacingX,
        y: startY + idx * spacingY
      };
    });
  });

  const svgWidth = Math.max(1300, (Object.keys(levelsMap).length + 1) * spacingX);
  const svgHeight = 750;

  const findNode = (id: string) => nodes.find(n => n.id === id);

  let svgContent = `
    <svg id="system-diagram-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="w-full h-full bg-white">
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

    const x1 = p1.x;
    const y1 = p1.y;
    const x2 = p2.x;
    const y2 = p2.y;

    const isDummy = edge.data?.type === 'dummy';
    const className = isDummy ? 'stroke="#95a5a6" stroke-width="2" stroke-dasharray="5,5"' : 'stroke="#3498db" stroke-width="3"';
    const marker = isDummy ? '' : 'marker-end="url(#arrowhead)"';

    const dx = x2 - x1;
    const dy = y2 - y1;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const path = `M ${x1} ${y1} Q ${mx} ${my - dy * 0.1} ${x2} ${y2}`;

    svgContent += `<path d="${path}" ${className} ${marker} fill="none" />`;
    
    // Label with background to ensure readability
    if (options.showLabels) {
      const label = edge.data?.label || edge.data?.pipeId || '';
      if (label) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2 - 15;
        
        const length = edge.data?.length !== undefined ? `L:${edge.data.length}` : '';
        const diam = edge.data?.diameter !== undefined ? `D:${edge.data.diameter}` : '';
        
        // Dynamic width based on text
        const textLen = Math.max(label.length, (length + " " + diam).length);
        const boxWidth = textLen * 7 + 10;

        svgContent += `
          <g>
            <rect x="${midX - boxWidth/2}" y="${midY - 12}" width="${boxWidth}" height="24" fill="white" fill-opacity="0.9" rx="4" stroke="#bdc3c7" stroke-width="1" />
            <text x="${midX}" y="${midY - 2}" font-size="9" fill="#2c3e50" font-weight="bold" text-anchor="middle">${label}</text>
            <text x="${midX}" y="${midY + 8}" font-size="7" fill="#7f8c8d" text-anchor="middle">${length} ${diam}</text>
          </g>
        `;
      }
    }
  });

  // Draw Nodes
  diagramNodes.forEach(node => {
    const pos = posMap[node.id];
    if (!pos) return;
    const { x, y } = pos;
    const label = node.data.label || '';
    const nodeNum = node.data.nodeNumber || node.id;
    const elev = node.data.elevation !== undefined ? node.data.elevation : '';

    if (node.type === 'reservoir') {
      svgContent += `
        <g class="node" filter="url(#shadow)">
          <rect x="${x - 25}" y="${y - 20}" width="50" height="40" fill="#3498db" stroke="#2980b9" stroke-width="2" rx="4" />
          <text x="${x}" y="${y + 5}" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${label || 'HW'}</text>
          ${options.showLabels ? `
          <text x="${x}" y="${y - 30}" text-anchor="middle" fill="#2c3e50" font-size="10" font-weight="bold">Node ${nodeNum}</text>
          <text x="${x}" y="${y + 35}" text-anchor="middle" fill="#7f8c8d" font-size="8">Elev: ${elev}</text>
          ` : ''}
        </g>
      `;
    } else if (node.type === 'surgeTank') {
      svgContent += `
        <g class="node" filter="url(#shadow)">
          <rect x="${x - 20}" y="${y - 30}" width="40" height="60" fill="#f39c12" stroke="#e67e22" stroke-width="2" rx="4" />
          <text x="${x}" y="${y + 5}" text-anchor="middle" fill="white" font-size="11" font-weight="bold">ST</text>
          ${options.showLabels ? `
          <text x="${x}" y="${y - 40}" text-anchor="middle" fill="#2c3e50" font-size="10" font-weight="bold">Node ${nodeNum}</text>
          ` : ''}
        </g>
      `;
    } else if (node.type === 'flowBoundary') {
      svgContent += `
        <g class="node" filter="url(#shadow)">
          <path d="M ${x-25} ${y-15} L ${x+25} ${y} L ${x-25} ${y+15} Z" fill="#2ecc71" stroke="#27ae60" stroke-width="2" />
          <text x="${x - 5}" y="${y + 4}" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${label || 'FB'}</text>
          ${options.showLabels ? `
          <text x="${x}" y="${y + 30}" text-anchor="middle" fill="#2c3e50" font-size="10" font-weight="bold">Node ${nodeNum}</text>
          ` : ''}
        </g>
      `;
    } else if (node.type === 'junction') {
      svgContent += `
        <g class="node" filter="url(#shadow)">
          <circle cx="${x}" cy="${y}" r="8" fill="#e74c3c" stroke="#c0392b" stroke-width="2" />
          ${options.showLabels ? `
          <text x="${x}" y="${y - 15}" text-anchor="middle" fill="#2c3e50" font-size="10" font-weight="bold">Node ${nodeNum}</text>
          <text x="${x}" y="${y + 25}" text-anchor="middle" fill="#7f8c8d" font-size="8">Elev: ${elev}</text>
          ` : ''}
        </g>
      `;
    } else {
      svgContent += `
        <g class="node">
          <circle cx="${x}" cy="${y}" r="6" fill="#95a5a6" stroke="#7f8c8d" stroke-width="2" />
          ${options.showLabels ? `
          <text x="${x}" y="${y - 15}" text-anchor="middle" fill="#2c3e50" font-size="10">Node ${nodeNum}</text>
          <text x="${x}" y="${y + 20}" text-anchor="middle" fill="#7f8c8d" font-size="8">Elev: ${elev}</text>
          ` : ''}
        </g>
      `;
    }
  });

  svgContent += `</svg>`;
  return svgContent;
}

export const generateSystemDiagram = generateSystemDiagramSVG;
