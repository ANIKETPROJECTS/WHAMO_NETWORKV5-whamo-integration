import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { NodeType, LinkType } from '@shared/schema';

// Define base data structures for our specific engineering domain
interface NodeData extends Record<string, unknown> {
  label: string;
  type: NodeType;
  elevation?: number;
  nodeNumber?: number;
  comment?: string;
  // Specific properties
  topElevation?: number;
  bottomElevation?: number;
  diameter?: number;
  celerity?: number;
  friction?: number;
  scheduleNumber?: number;
}

interface EdgeData extends Record<string, unknown> {
  label: string;
  type: LinkType;
  length?: number;
  diameter?: number;
  celerity?: number;
  friction?: number;
  numSegments?: number;
  cplus?: number;
  cminus?: number;
  comment?: string;
  variable?: boolean;
  distance?: number;
  area?: number;
  d?: number;
  a?: number;
}

export type WhamoNode = Node<NodeData>;
export type WhamoEdge = Edge<EdgeData>;

interface ComputationalParameters {
  dtcomp: number;
  dtout: number;
  tmax: number;
}

interface OutputRequest {
  id: string; // Internal ID for the request
  elementId: string; // ID of the node or edge
  elementType: 'node' | 'edge';
  requestType: 'HISTORY' | 'PLOT' | 'SPREADSHEET';
  variables: string[]; // e.g., ['Q', 'HEAD', 'ELEV']
}

interface NetworkState {
  nodes: WhamoNode[];
  edges: WhamoEdge[];
  selectedElementId: string | null;
  selectedElementType: 'node' | 'edge' | null;
  computationalParams: ComputationalParameters;
  outputRequests: OutputRequest[];
  isLocked: boolean;
  projectName: string;
  history: {
    past: Partial<NetworkState>[];
    future: Partial<NetworkState>[];
  };

  // Actions
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;
  updateEdgeData: (id: string, data: Partial<EdgeData>) => void;
  deleteElement: (id: string, type: 'node' | 'edge') => void;
  selectElement: (id: string | null, type: 'node' | 'edge' | null) => void;
  loadNetwork: (nodes: WhamoNode[], edges: WhamoEdge[], params?: ComputationalParameters, requests?: OutputRequest[], projectName?: string) => void;
  clearNetwork: () => void;
  updateComputationalParams: (params: Partial<ComputationalParameters>) => void;
  addOutputRequest: (request: Omit<OutputRequest, 'id'>) => void;
  removeOutputRequest: (id: string) => void;
  toggleLock: () => void;
  setProjectName: (name: string) => void;
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
}

let idCounter = 1;
const getId = () => `${idCounter++}`;

export const useNetworkStore = create<NetworkState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedElementId: null,
  selectedElementType: null,
  computationalParams: {
    dtcomp: 0.01,
    dtout: 0.1,
    tmax: 500.0,
  },
  outputRequests: [],
  isLocked: false,
  projectName: "Untitled Network",
  history: {
    past: [],
    future: [],
  },

  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes as any) as WhamoNode[],
    });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges as any) as WhamoEdge[],
    });
  },

  onConnect: (connection: Connection) => {
    get().saveToHistory();
    const id = getId();
    const edges = get().edges;
    const conduitCount = edges.filter(e => e.data?.type === 'conduit').length;
    const connectionLabel = `C${conduitCount + 1}`;

    set({
      edges: addEdge(
        {
          ...connection,
          id,
          type: 'connection',
          style: { stroke: '#3b82f6', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#3b82f6',
          },
          data: { 
            label: connectionLabel, 
            type: 'conduit', 
            length: 1000, 
            diameter: 0.5, 
            celerity: 1000, 
            friction: 0.02, 
            numSegments: 1 
          }
        },
        get().edges
      ),
    });
  },

  addNode: (type, position) => {
    get().saveToHistory();
    const id = getId();
    let initialData: NodeData = { label: '', type };

    // Common node number logic for all physical nodes
    const nodeTypesWithNumbers: NodeType[] = ['reservoir', 'node', 'junction', 'surgeTank', 'flowBoundary'];
    let nodeNumber = parseInt(id);

    switch (type) {
      case 'reservoir':
        initialData = { ...initialData, label: 'HW', nodeNumber, elevation: 100 };
        break;
      case 'node':
        initialData = { ...initialData, label: `Node ${nodeNumber}`, nodeNumber, elevation: 50 };
        break;
      case 'junction':
        initialData = { ...initialData, label: `Node ${nodeNumber}`, nodeNumber, elevation: 50 };
        break;
      case 'surgeTank':
        initialData = { ...initialData, label: 'ST', nodeNumber, topElevation: 120, bottomElevation: 80, diameter: 5, celerity: 1000, friction: 0.01 };
        break;
      case 'flowBoundary':
        initialData = { ...initialData, label: `FB${id}`, nodeNumber, scheduleNumber: 1 };
        break;
    }

    const newNode: WhamoNode = {
      id,
      type,
      position,
      data: initialData,
    };

    set({ nodes: [...get().nodes, newNode] });
  },

  updateNodeData: (id, data) => {
    get().saveToHistory();
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } as WhamoNode : node
      ),
    });
  },

  updateEdgeData: (id, data) => {
    get().saveToHistory();
    set({
      edges: get().edges.map((edge) => {
        if (edge.id === id) {
          const oldType = edge.data?.type;
          const newType = data.type || oldType;
          let label = data.label || edge.data?.label || "";

          // If type changed, recalculate label
          if (data.type && data.type !== oldType) {
            const sameTypeEdges = get().edges.filter(e => e.data?.type === data.type && e.id !== id);
            const prefix = data.type === 'conduit' ? 'C' : 'D';
            label = `${prefix}${sameTypeEdges.length + 1}`;
          }

          const newData = { ...edge.data, ...data, label };
          let style = edge.style;
          let markerEnd = edge.markerEnd;

          if (newType === 'conduit') {
            style = { stroke: '#3b82f6', strokeWidth: 2 };
            markerEnd = { type: MarkerType.ArrowClosed, color: '#3b82f6' };
          } else if (newType === 'dummy') {
            style = { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5,5' };
            markerEnd = { type: MarkerType.ArrowClosed, color: '#94a3b8' };
          }

          return { 
            ...edge, 
            data: newData as EdgeData,
            style,
            markerEnd: markerEnd as any
          };
        }
        return edge;
      }),
    });
  },

  deleteElement: (id, type) => {
    get().saveToHistory();
    const state = get();
    if (type === 'node') {
      const remainingNodes = state.nodes.filter(n => n.id !== id);
      const remainingEdges = state.edges.filter(e => e.source !== id && e.target !== id);
      
      set({ 
        nodes: remainingNodes, 
        edges: remainingEdges,
        selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
        selectedElementType: state.selectedElementId === id ? null : state.selectedElementType
      });
    } else {
      set({ 
        edges: state.edges.filter(e => e.id !== id),
        selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
        selectedElementType: state.selectedElementId === id ? null : state.selectedElementType
      });
    }
  },

  selectElement: (id, type) => {
    set({ selectedElementId: id, selectedElementType: type });
  },

  loadNetwork: (nodes, edges, params, requests, projectName) => {
    const maxId = Math.max(
      ...nodes.map(n => parseInt(n.id) || 0),
      ...edges.map(e => parseInt(e.id) || 0),
      0
    );
    idCounter = maxId + 1;
    
    // Flatten variableData for conduits if it exists
    const processedEdges = edges.map(edge => {
      if (edge.data?.variableData) {
        const { variableData, ...restData } = edge.data;
        return {
          ...edge,
          data: {
            ...restData,
            ...variableData,
            variable: true // Ensure variable flag is set
          }
        };
      }
      return edge;
    });
    
    set({ 
      nodes, 
      edges: processedEdges, 
      computationalParams: params || get().computationalParams,
      outputRequests: requests || [],
      projectName: projectName || get().projectName,
      selectedElementId: null, 
      selectedElementType: null 
    });
  },

  clearNetwork: () => {
    get().saveToHistory();
    set({ 
      nodes: [], 
      edges: [], 
      selectedElementId: null, 
      selectedElementType: null, 
      outputRequests: [],
      projectName: "Untitled Network" 
    });
    idCounter = 1;
  },

  updateComputationalParams: (params) => {
    get().saveToHistory();
    set({ computationalParams: { ...get().computationalParams, ...params } });
  },

  addOutputRequest: (request) => {
    get().saveToHistory();
    const id = `req-${Date.now()}`;
    set({ outputRequests: [...get().outputRequests, { ...request, id }] });
  },

  removeOutputRequest: (id) => {
    get().saveToHistory();
    set({ outputRequests: get().outputRequests.filter(r => r.id !== id) });
  },

  toggleLock: () => {
    set({ isLocked: !get().isLocked });
  },

  setProjectName: (name: string) => {
    set({ projectName: name });
  },

  saveToHistory: () => {
    const { nodes, edges, computationalParams, outputRequests, history } = get();
    const currentState = { nodes, edges, computationalParams, outputRequests };
    set({
      history: {
        past: [currentState, ...history.past].slice(0, 50),
        future: [],
      },
    });
  },

  undo: () => {
    const { nodes, edges, computationalParams, outputRequests, history } = get();
    if (history.past.length === 0) return;

    const previous = history.past[0];
    const newPast = history.past.slice(1);
    const currentState = { nodes, edges, computationalParams, outputRequests };

    set({
      ...previous,
      history: {
        past: newPast,
        future: [currentState, ...history.future],
      },
    });
  },

  redo: () => {
    const { nodes, edges, computationalParams, outputRequests, history } = get();
    if (history.future.length === 0) return;

    const next = history.future[0];
    const newFuture = history.future.slice(1);
    const currentState = { nodes, edges, computationalParams, outputRequests };

    set({
      ...next,
      history: {
        past: [currentState, ...history.past],
        future: newFuture,
      },
    });
  },
}));
