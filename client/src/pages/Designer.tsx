import { useCallback, useRef, useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Circle, 
  GitCommitHorizontal, 
  Cylinder, 
  ArrowRightCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  NodeChange,
  EdgeChange,
  Connection,
  Edge,
  Node,
  useReactFlow,
  ReactFlowProvider,
  ControlButton
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/lib/utils';
import { useNetworkStore, WhamoNode, WhamoEdge } from '@/lib/store';
import { ReservoirNode, SimpleNode, JunctionNode, SurgeTankNode, FlowBoundaryNode } from '@/components/NetworkNode';
import { ConnectionEdge } from '@/components/ConnectionEdge';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { Header } from '@/components/Header';
import { generateInpFile } from '@/lib/inp-generator';
import { generateSystemDiagram } from '@/lib/diagram-generator';
import { parseInpFile } from '@/lib/inp-parser';
import { saveAs } from 'file-saver';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { 
  Download, 
  X, 
  Maximize2, 
  Minimize2, 
  Tag, 
  EyeOff,
  Info
} from 'lucide-react';
import html2canvas from 'html2canvas';

const nodeTypes = {
  reservoir: ReservoirNode,
  node: SimpleNode,
  junction: JunctionNode,
  surgeTank: SurgeTankNode,
  flowBoundary: FlowBoundaryNode,
};

const edgeTypes = {
  connection: ConnectionEdge,
};

function DesignerInner() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  // We connect local ReactFlow state to our global Zustand store for properties panel sync
  const { 
    nodes, 
    edges, 
    projectName,
    computationalParams,
    outputRequests,
    onNodesChange: storeOnNodesChange, 
    onEdgesChange: storeOnEdgesChange,
    onConnect: storeOnConnect, 
    selectElement, 
    loadNetwork,
    clearNetwork,
    deleteElement,
    selectedElementId,
    selectedElementType,
    isLocked,
    toggleLock
  } = useNetworkStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Keyboard shortcuts for zoom and view
      if (event.key === '+' || event.key === '=') {
        zoomIn();
      } else if (event.key === '-' || event.key === '_') {
        zoomOut();
      } else if (event.key.toLowerCase() === 'f') {
        fitView();
      } else if (event.key.toLowerCase() === 'l') {
        toggleLock();
        // Find and click the XYFlow lock button to keep it in sync
        const lockButton = document.querySelector('.react-flow__controls-button.react-flow__controls-interactive');
        if (lockButton instanceof HTMLButtonElement) {
          lockButton.click();
        }
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && 
          selectedElementId && 
          selectedElementType) {
        deleteElement(selectedElementId, selectedElementType);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteElement, selectedElementId, selectedElementType, zoomIn, zoomOut, fitView, toggleLock]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (isLocked) return;
      storeOnNodesChange(changes);
    },
    [storeOnNodesChange, isLocked]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (isLocked) return;
      storeOnEdgesChange(changes);
    },
    [storeOnEdgesChange, isLocked]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (isLocked) return;
      if (params.source === params.target) {
        toast({
          variant: "destructive",
          title: "Invalid Connection",
          description: "An element cannot be connected to itself.",
        });
        return;
      }
      storeOnConnect(params);
    },
    [storeOnConnect, toast, isLocked]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectElement(node.id, 'node');
  }, [selectElement]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    selectElement(edge.id, 'edge');
  }, [selectElement]);

  const onSelectionChange = useCallback(({ nodes, edges }: { nodes: WhamoNode[], edges: WhamoEdge[] }) => {
    if (nodes.length > 0) {
      selectElement(nodes[0].id, 'node');
    } else if (edges.length > 0) {
      selectElement(edges[0].id, 'edge');
    } else {
      selectElement(null, null);
    }
  }, [selectElement]);

  const handleSave = () => {
    const data = { 
      projectName,
      nodes, 
      edges,
      computationalParams,
      outputRequests
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'network'}_${Date.now()}.json`);
    toast({ title: "Project Saved", description: "Network topology saved to JSON." });
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const fileName = file.name.toLowerCase();

      try {
        if (fileName.endsWith('.json')) {
          const json = JSON.parse(content);
          if (json.nodes && json.edges) {
            // Use project name from file or fallback to filename
            const loadedProjectName = json.projectName || file.name.replace(/\.json$/i, '');
            loadNetwork(json.nodes, json.edges, json.computationalParams, json.outputRequests, loadedProjectName);
            toast({ title: "Project Loaded", description: `Network topology "${loadedProjectName}" restored from JSON.` });
          } else {
            throw new Error("Invalid JSON format");
          }
        } else if (fileName.endsWith('.inp')) {
          const { nodes, edges } = parseInpFile(content);
          if (nodes.length > 0) {
            const loadedProjectName = file.name.replace(/\.inp$/i, '');
            loadNetwork(nodes, edges, undefined, undefined, loadedProjectName);
            toast({ title: "Project Loaded", description: `Network topology "${loadedProjectName}" restored from .inp file.` });
          } else {
            throw new Error("No valid network elements found in .inp file");
          }
        } else {
          throw new Error("Unsupported file type");
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Load Failed", description: err instanceof Error ? err.message : "Invalid file." });
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleGenerateInp = () => {
    try {
      generateInpFile(nodes, edges);
      
      // Generate system diagram as well
      const diagramHtml = generateSystemDiagram(nodes, edges);
      const diagramBlob = new Blob([diagramHtml], { type: 'text/html' });
      saveAs(diagramBlob, `system_diagram_${Date.now()}.html`);
      
      toast({ title: "Files Generated", description: "WHAMO input file and System Diagram downloaded successfully." });
    } catch (err) {
      toast({ variant: "destructive", title: "Generation Failed", description: "Could not generate files. Check connections." });
    }
  };

  const [showDiagram, setShowDiagram] = useState(false);
  const [diagramSvg, setDiagramSvg] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    if (showDiagram) {
      const svg = generateSystemDiagram(nodes, edges, { showLabels });
      setDiagramSvg(svg);
    }
  }, [nodes, edges, showDiagram, showLabels]);

  const downloadImage = async () => {
    const element = document.getElementById('system-diagram-container');
    if (!element) return;
    
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `system_diagram_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      toast({ variant: "destructive", title: "Download Failed", description: "Could not generate image." });
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json,.inp" 
        className="hidden" 
      />

      {/* Top Bar (Header) */}
      <Header 
        onExport={handleGenerateInp} 
        onSave={handleSave} 
        onLoad={handleLoadClick} 
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={75} minSize={isMaximized ? 0 : 30} className={cn(isMaximized && "hidden")}>
            <div className="flex h-full w-full overflow-hidden relative">
              {/* Canvas Area */}
              <div className="flex-1 relative h-full bg-slate-50 transition-all duration-300">
                <ReactFlow
                  nodes={nodes as any}
                  edges={edges as any}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onNodeClick={onNodeClick}
                  onEdgeClick={onEdgeClick}
                  onSelectionChange={onSelectionChange as any}
                  fitView
                  className="bg-slate-50"
                  proOptions={{ hideAttribution: true }}
                  nodesDraggable={!isLocked}
                  nodesConnectable={!isLocked}
                  elementsSelectable={true}
                >
                  <Background color="#94a3b8" gap={20} size={1} />
                  <Controls className="!bg-white !shadow-xl !border-border">
                  </Controls>
                </ReactFlow>
                
                {isLocked && (
                  <div className="absolute top-4 right-4 bg-orange-100 text-orange-800 px-3 py-1 rounded-md text-sm font-medium border border-orange-200 shadow-sm z-50 flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    Network Locked
                  </div>
                )}

                <div className="absolute bottom-4 right-4 z-50 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-white shadow-md rounded-full px-4"
                    onClick={() => {
                      const svg = generateSystemDiagram(nodes, edges, { showLabels });
                      setDiagramSvg(svg);
                      setShowDiagram(true);
                    }}
                    data-testid="button-show-diagram"
                  >
                    Console Diagram
                  </Button>
                </div>
              </div>

              {/* Properties Panel (Sidebar) */}
              <div 
                className={cn(
                  "h-full border-l border-border bg-card shadow-2xl z-20 flex flex-col transition-all duration-300 ease-in-out overflow-hidden",
                  selectedElementId ? "w-[350px] opacity-100 visible" : "w-0 opacity-0 invisible"
                )}
              >
                <div className="w-[350px] h-full">
                  {selectedElementId && <PropertiesPanel />}
                </div>
              </div>
            </div>
          </ResizablePanel>
          
          {showDiagram && (
            <>
              <ResizableHandle withHandle className={cn(isMaximized && "hidden")} />
              <ResizablePanel defaultSize={25} minSize={isMaximized ? 100 : 10} className={cn(isMaximized && "flex-1")}>
                <div className="h-full w-full bg-background overflow-hidden flex flex-col relative">
                  <div className="flex items-center justify-between p-3 border-b bg-card">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">System Diagram Console</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setShowLabels(!showLabels)} title={showLabels ? "Hide Labels" : "Show Labels"}>
                        {showLabels ? <EyeOff className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setIsMaximized(!isMaximized)} title={isMaximized ? "Restore" : "Maximize"}>
                        {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={downloadImage} title="Download Image">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {setShowDiagram(false); setIsMaximized(false);}} title="Close">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 flex overflow-hidden p-4 gap-4">
                    <div 
                      id="system-diagram-container"
                      className="flex-1 bg-white rounded-lg flex items-center justify-center overflow-auto min-h-[200px] shadow-inner"
                      dangerouslySetInnerHTML={{ __html: diagramSvg || '' }}
                    />
                    
                    {/* Legend and Summary */}
                    <div className="w-64 border rounded-lg bg-card p-4 flex flex-col gap-4 overflow-auto shadow-sm">
                      <div>
                        <h4 className="text-xs font-bold uppercase mb-3 text-muted-foreground">Legend</h4>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-5 bg-[#3498db] border-2 border-[#2980b9] rounded" />
                            <span className="text-xs font-medium">Reservoir (HW)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-8 bg-[#f39c12] border-2 border-[#e67e22] rounded" />
                            <span className="text-xs font-medium">Surge Tank (ST)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-[#e74c3c] border-2 border-[#c0392b] rounded-full" />
                            <span className="text-xs font-medium">Junction</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-[#2ecc71]" />
                            <span className="text-xs font-medium">Flow Boundary</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-1 bg-[#3498db]" />
                            <span className="text-xs font-medium">Conduit (Pipe)</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-auto border-t pt-4">
                        <h4 className="text-xs font-bold uppercase mb-2 text-muted-foreground">Network Summary</h4>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="text-muted-foreground">Nodes:</div>
                          <div className="font-bold text-right">{nodes.length}</div>
                          <div className="text-muted-foreground">Pipes:</div>
                          <div className="font-bold text-right">{edges.length}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default function Designer() {
  return (
    <ReactFlowProvider>
      <DesignerInner />
    </ReactFlowProvider>
  );
}
