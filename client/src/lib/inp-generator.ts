import { WhamoNode, WhamoEdge, useNetworkStore } from './store';
import { saveAs } from 'file-saver';

export function generateInpFile(nodes: WhamoNode[], edges: WhamoEdge[], autoDownload: boolean = true) {
  const state = useNetworkStore.getState();
  const lines: string[] = [];

  // Helper to add line
  const add = (str: string) => lines.push(str);
  const addComment = (comment?: string) => {
    if (comment) {
      add(`c ${comment}`);
    }
  };

  const addL = (str: string) => lines.push(str);
  
  addL('c Project Name');
  addL('C  SYSTEM CONNECTIVITY');
  addL('');
  addL('SYSTEM');
  addL('');

  // Connectivity section
  const visitedNodes = new Set<string>();
  const visitedEdges = new Set<string>();
  const connectivityLines: string[] = [];
  const nodeIdsWithSpecialElements = new Set<string>();

  function traverse(nodeId: string) {
    if (visitedNodes.has(nodeId)) return;
    visitedNodes.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const actualNodeId = node.data.nodeNumber?.toString() || node.id;

    // Elements AT this node
    if (node.type === 'reservoir' || node.type === 'surgeTank' || node.type === 'flowBoundary') {
      connectivityLines.push(`ELEM ${node.data.label} AT ${actualNodeId}`);
      nodeIdsWithSpecialElements.add(actualNodeId);
    }

    // Outgoing edges
    const outgoingEdges = edges.filter(e => e.source === nodeId);
    
    if (outgoingEdges.length > 0) {
      if (node.type === 'junction' || outgoingEdges.length > 1) {
        connectivityLines.push('');
        connectivityLines.push(`JUNCTION AT ${actualNodeId}`);
        connectivityLines.push('');
        nodeIdsWithSpecialElements.add(actualNodeId);
      }

      outgoingEdges.forEach(edge => {
        if (visitedEdges.has(edge.id)) return;
        visitedEdges.add(edge.id);
        
        const toNode = nodes.find(n => n.id === edge.target);
        const toId = toNode?.data.nodeNumber?.toString() || toNode?.id || edge.target;
        const fromId = actualNodeId;

        connectivityLines.push(`ELEM ${edge.data?.label || edge.id} LINK ${fromId} ${toId}`);
        traverse(edge.target);
      });
    }
  }

  // Start traversal from reservoirs
  const reservoirs = nodes.filter(n => n.type === 'reservoir');
  reservoirs.forEach(r => traverse(r.id));

  // Handle any disconnected components (e.g. ST, FB if not reached by traversal)
  nodes.forEach(n => {
    if (!visitedNodes.has(n.id)) {
      if (n.type === 'surgeTank' || n.type === 'flowBoundary') {
        const actualNodeId = n.data.nodeNumber?.toString() || n.id;
        connectivityLines.push(`ELEM ${n.data.label} AT ${actualNodeId}`);
        nodeIdsWithSpecialElements.add(actualNodeId);
      }
    }
  });

  connectivityLines.forEach(line => addL(line));

  // NODE Selection Algorithm
  const nodesToInclude = new Set<string>();

  // Parse connectivity to identify chains and transitions
  const elementLinks: { id: string, from: string, to: string, type?: string }[] = [];
  const nodeConnections: Record<string, { incoming: string[], outgoing: string[] }> = {};

  connectivityLines.forEach(line => {
    const linkMatch = line.match(/^ELEM\s+(\S+)\s+LINK\s+(\S+)\s+(\S+)/);
    if (linkMatch) {
      const elementId = linkMatch[1];
      const from = linkMatch[2];
      const to = linkMatch[3];

      elementLinks.push({ id: elementId, from, to });

      if (!nodeConnections[from]) nodeConnections[from] = { incoming: [], outgoing: [] };
      if (!nodeConnections[to]) nodeConnections[to] = { incoming: [], outgoing: [] };

      nodeConnections[from].outgoing.push(elementId);
      nodeConnections[to].incoming.push(elementId);
    }
  });

  // Keep track of branch patterns to identify parallel branches
  // A pattern is defined by the sequence of element IDs from a junction to a terminal node
  const branchPatterns = new Set<string>();

  const allNodeIds = Array.from(new Set([
    ...nodes.map(n => n.data.nodeNumber?.toString() || n.id),
    ...Array.from(nodeIdsWithSpecialElements)
  ]));

  allNodeIds.forEach(nodeId => {
    const connections = nodeConnections[nodeId] || { incoming: [], outgoing: [] };
    const hasSpecial = nodeIdsWithSpecialElements.has(nodeId);

    // RULE 1: ALWAYS INCLUDE - Nodes with Special Elements
    if (hasSpecial) {
      nodesToInclude.add(nodeId);
      return;
    }

    // RULE 2: SKIP - Intermediate Nodes in SAME element chain
    // Skip if EXACTLY one incoming and one outgoing, and they share the SAME element ID
    if (connections.incoming.length === 1 && connections.outgoing.length === 1 &&
        connections.incoming[0] === connections.outgoing[0]) {
      return;
    }

    // Include all other nodes
    nodesToInclude.add(nodeId);
  });

  addL('');
  const sortedNodeIds = Array.from(nodesToInclude).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  sortedNodeIds.forEach(id => {
    const node = nodes.find(n => (n.data.nodeNumber?.toString() || n.id) === id);
    if (node && node.data.elevation !== undefined) {
      const elev = typeof node.data.elevation === 'number' ? node.data.elevation.toFixed(1) : parseFloat(node.data.elevation).toFixed(1);
      addL(`    NODE ${id} ELEV ${elev}`);
    }
  });

  addL('');
  addL('FINISH');
  addL('');
  addL('C ELEMENT PROPERTIES');
  addL('');

  // Properties Section
  const exportedConduitLabels = new Set<string>();

  nodes.filter(n => n.type === 'reservoir').forEach(n => {
    addComment(n.data.comment);
    addL('RESERVOIR');
    addL(` ID ${n.data.label}`);
    addL(` ELEV ${n.data.elevation}`);
    addL(' FINISH');
    addL('');
  });

  edges.filter(e => e.data?.type === 'conduit').forEach(e => {
    const d = e.data;
    if (!d) return;
    
    const label = d.label || e.id;
    if (exportedConduitLabels.has(label)) return;
    exportedConduitLabels.add(label);

    addComment(d.comment);
    addL('CONDUIT');
    addL(` ID ${label}`);
    
    if (d.variable) {
      addL(' VARIABLE');
      if (d.distance !== undefined) addL(` DISTANCE ${d.distance}`);
      if (d.area !== undefined) addL(` AREA ${d.area}`);
      if (d.d !== undefined) addL(` D ${d.d}`);
      if (d.a !== undefined) addL(` A ${d.a}`);
    }

    addL(` LENGTH ${d.length}`);
    if (!d.variable) {
      addL(` DIAM ${d.diameter}`);
    }
    addL(` CELERITY ${d.celerity}`);
    addL(` FRICTION ${d.friction}`);
    
    if (d.cplus !== undefined || d.cminus !== undefined) {
      addL(' ADDEDLOSS');
      if (d.cplus !== undefined) addL(`     CPLUS ${d.cplus.toFixed(2)}`);
      if (d.cminus !== undefined) addL(`     CMINUS ${d.cminus.toFixed(2)}`);
    }
    
    if (d.numSegments !== undefined) {
      addL(` NUMSEG ${d.numSegments}`);
    }
    addL('FINISH');
    addL('');
  });

  edges.filter(e => e.data?.type === 'dummy').forEach(e => {
    const d = e.data;
    if (!d) return;
    addComment(d.comment);
    addL(`CONDUIT ID ${d.label || e.id} `);
    addL(' DUMMY ');
    addL(` DIAMETER ${d.diameter}`);
    addL(' ADDEDLOSS ');
    if (d.cplus !== undefined) addL(` CPLUS ${d.cplus}`);
    if (d.cminus !== undefined) addL(` CMINUS ${d.cminus}`);
    addL('FINISH');
    addL('');
  });

  nodes.filter(n => n.type === 'surgeTank').forEach(n => {
    const d = n.data;
    if (!d) return;
    addComment(d.comment);
    addL('SURGETANK ');
    addL(` ID ${d.label} SIMPLE`);
    addL(` ELTOP ${d.tankTop}`);
    addL(` ELBOTTOM ${d.tankBottom}`);
    addL(` DIAM ${d.diameter}`);
    addL(` CELERITY ${d.celerity}`);
    addL(` FRICTION ${d.friction}`);
    addL('FINISH');
    addL('');
  });

  nodes.filter(n => n.type === 'flowBoundary').forEach(n => {
    const d = n.data;
    if (!d) return;
    addComment(d.comment);
    addL(`FLOWBC ID ${d.label} QSCHEDULE ${d.scheduleNumber} FINISH`);
  });

  addL('');
  addL('');
  addL('SCHEDULE');
  
  const flowBoundaries = nodes.filter(n => n.type === 'flowBoundary');
  flowBoundaries.forEach(n => {
    const d = n.data;
    let schedule = '';
    if (d.schedulePoints && Array.isArray(d.schedulePoints) && d.schedulePoints.length > 0) {
      schedule = d.schedulePoints.map((p: any) => `T ${p.time} Q ${p.flow}`).join(' ');
    } else {
      schedule = 'T 0 Q 3000 T 20 Q 0 T 3000 Q 0';
    }
    addL(` QSCHEDULE ${d.scheduleNumber} ${schedule}`);
  });
  
  addL('');
  addL('FINISH');
  addL('');
  addL('');
  addL('C OUTPUT REQUEST');
  addL('');

  const requestsByType = state.outputRequests.reduce((acc, req) => {
    if (!acc[req.requestType]) acc[req.requestType] = [];
    acc[req.requestType].push(req);
    return acc;
  }, {} as Record<string, typeof state.outputRequests>);

  const requestTypes = Object.keys(requestsByType);

  if (requestTypes.length > 0) {
    requestTypes.forEach(type => {
      addL(type);
      requestsByType[type].forEach(req => {
        const element = req.elementType === 'node' 
          ? nodes.find(n => n.id === req.elementId)
          : edges.find(e => e.id === req.elementId);
        
        const isSurgeTank = req.elementType === 'node' && element?.data?.type === 'surgeTank';
        const label = isSurgeTank 
          ? (element?.data?.label || element?.id || req.elementId)
          : (element?.data?.nodeNumber || element?.data?.label || element?.id || req.elementId);
        const typeStr = isSurgeTank ? 'ELEM' : 'NODE';
        addL(` ${typeStr} ${label} ${req.variables.join(' ')}`);
      });
      addL(' FINISH');
      addL('');
    });

    if (requestTypes.length > 1) {
      addL(' DISPLAY');
      addL('  ALL');
      addL(' FINISH');
      addL('');
    }
  } else {
    addL('HISTORY');
    addL(' NODE 2 Q HEAD');
    addL(' ELEM ST Q ELEV');
    addL(' FINISH');
  }
  addL('');
  addL('');
  addL('C COMPUTATIONAL PARAMETERS');
  addL('CONTROL');
  const cp = state.computationalParams;
  addL(` DTCOMP ${cp.dtcomp} DTOUT ${cp.dtout} TMAX ${cp.tmax}`);
  addL('FINISH');
  addL('');
  addL('C EXECUTION CONTROL');
  addL('GO');
  addL('GOODBYE');

  if (autoDownload) {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `network.inp`);
  }
  return lines.join('\n');
}
