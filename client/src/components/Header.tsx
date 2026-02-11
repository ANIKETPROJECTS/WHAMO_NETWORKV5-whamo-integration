import { 
  File, 
  Edit2, 
  PlusCircle, 
  Settings2, 
  Folder, 
  Download,
  FilePlus,
  FolderOpen,
  Save,
  Share2,
  DownloadCloud,
  Type,
  Eraser,
  Trash2,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  MousePointer2,
  Cylinder,
  Circle,
  GitCommitHorizontal,
  ArrowRightCircle,
  ListVideo,
  Layout,
  Info,
  ExternalLink
} from 'lucide-react';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Button } from "@/components/ui/button";
import { useNetworkStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from '@/hooks/use-toast';
import { generateSystemDiagramSVG } from '@/lib/diagram-generator';
import folderIcon from "@assets/open-folder_1770356038145.png";

interface HeaderProps {
  onExport: () => void;
  onGenerateOut: () => void;
  isGeneratingOut: boolean;
  onSave: () => void;
  onLoad: () => void;
  onShowDiagram?: () => void;
}

export function Header({ onExport, onGenerateOut, isGeneratingOut, onSave, onLoad, onShowDiagram }: HeaderProps) {
  const { toast } = useToast();
  const { 
    addNode, 
    clearNetwork, 
    nodes, 
    edges, 
    computationalParams, 
    updateComputationalParams,
    outputRequests,
    addOutputRequest,
    removeOutputRequest,
    projectName,
    setProjectName,
    undo,
    redo,
    history
  } = useNetworkStore();

  const [localParams, setLocalParams] = useState(computationalParams);
  const [selectedElementId, setSelectedElementId] = useState<string>("");
  const [selectedVars, setSelectedVars] = useState<string[]>([]);
  const [requestType, setRequestType] = useState<'HISTORY' | 'PLOT' | 'SPREADSHEET'>('HISTORY');

  useEffect(() => {
    setLocalParams(computationalParams);
  }, [computationalParams]);

  const handleAddRequest = () => {
    if (!selectedElementId || selectedVars.length === 0) return;
    
    const node = nodes.find(n => n.id === selectedElementId);
    const type = node ? 'node' : 'edge';

    addOutputRequest({
      elementId: selectedElementId,
      elementType: type,
      requestType: requestType,
      variables: selectedVars
    });
    setSelectedElementId("");
    setSelectedVars([]);
    toast({ title: "Request Added", description: "Output request added successfully." });
  };

  const availableVars = ["Q", "HEAD", "ELEV", "VEL", "PRESS", "PIEZHEAD"];

  const handleGenerateOutDirectly = async () => {
    try {
      // 1. Generate INP content from current state
      const { generateInpFile } = await import('@/lib/inp-generator');
      const inpContent = generateInpFile(nodes, edges, false);
      
      // 2. Send to backend to run WHAMO
      const response = await fetch("/api/run-whamo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inpContent })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "WHAMO simulation failed.");
      }

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "network.out";
      link.click();
      toast({ title: "Success", description: ".OUT file generated and downloaded." });
    } catch (error: any) {
      console.error("WHAMO Error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col border-b bg-background">
      {/* Top Row: Icon and Project Name */}
      <div className="flex items-center gap-3 px-4 py-1.5">
        <img src={folderIcon} alt="Folder" className="w-10 h-10 object-contain" />
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 h-7">
            <input
              className="text-lg font-normal leading-tight text-black bg-transparent border-none focus:ring-1 focus:ring-[#1a73e8] px-1 -ml-1 rounded cursor-text outline-none hover:bg-[#f1f3f4]"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={() => toast({ title: "Project Renamed", description: `Project name changed to ${projectName}` })}
            />
          </div>
          <Menubar className="border-none bg-transparent shadow-none h-auto p-0 min-h-0">
            <MenubarMenu>
              <MenubarTrigger className="text-[14px] font-normal h-7 text-black hover:bg-[#f1f3f4] data-[state=open]:bg-[#f1f3f4] px-2 rounded cursor-default">File</MenubarTrigger>
              <MenubarContent>
                <MenubarItem onClick={() => { clearNetwork(); }} className="gap-2">
                  <FilePlus className="w-4 h-4" /> New
                </MenubarItem>
                <MenubarItem onClick={onLoad} className="gap-2">
                  <FolderOpen className="w-4 h-4" /> Open
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={onSave} className="gap-2">
                  <Save className="w-4 h-4" /> Save
                </MenubarItem>
                <MenubarItem onClick={() => toast({ title: "Share", description: "Sharing feature coming soon." })} className="gap-2">
                  <Share2 className="w-4 h-4" /> Share
                </MenubarItem>
                <MenubarItem onClick={onExport} className="gap-2">
                  <DownloadCloud className="w-4 h-4" /> Download (.inp)
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.inp';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    const content = await file.text();
                    try {
                      const response = await fetch("/api/run-external-whamo", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ inpContent: content, fileName: file.name })
                      });
                      if (!response.ok) throw new Error("Failed to generate .OUT file");
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = file.name.replace('.inp', '.out');
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } catch (err) {
                      toast({ title: "Error", description: "Failed to generate .OUT file from external .INP", variant: "destructive" });
                    }
                  };
                  input.click();
                }} className="gap-2">
                  <ExternalLink className="w-4 h-4" /> Generate external .out file
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={() => { clearNetwork(); }} className="gap-2 text-destructive focus:text-destructive">
                  <Eraser className="w-4 h-4" /> Clear Canvas
                </MenubarItem>
                <MenubarItem onClick={() => { clearNetwork(); setProjectName("Untitled Network"); }} className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4" /> Delete Project
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger className="text-[14px] font-normal h-7 text-black hover:bg-[#f1f3f4] data-[state=open]:bg-[#f1f3f4] px-2 rounded cursor-default">Edit</MenubarTrigger>
              <MenubarContent>
                <MenubarItem onClick={undo} disabled={history.past.length === 0} className="gap-2">
                  <Undo2 className="w-4 h-4" /> Undo <MenubarShortcut>⌘Z</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={redo} disabled={history.future.length === 0} className="gap-2">
                  <Redo2 className="w-4 h-4" /> Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={() => toast({ description: "Cut feature coming soon." })} className="gap-2">
                  <Scissors className="w-4 h-4" /> Cut <MenubarShortcut>⌘X</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={() => toast({ description: "Copy feature coming soon." })} className="gap-2">
                  <Copy className="w-4 h-4" /> Copy <MenubarShortcut>⌘C</MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={() => toast({ description: "Paste feature coming soon." })} className="gap-2">
                  <Clipboard className="w-4 h-4" /> Paste <MenubarShortcut>⌘V</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={() => toast({ description: "Select All feature coming soon." })}>Select All <MenubarShortcut>⌘A</MenubarShortcut></MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger className="text-[14px] font-normal h-7 text-black hover:bg-[#f1f3f4] data-[state=open]:bg-[#f1f3f4] px-2 rounded cursor-default">View</MenubarTrigger>
              <MenubarContent>
                <MenubarItem>Full Screen</MenubarItem>
                <MenubarItem>Show Grid</MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger className="text-[14px] font-normal h-7 text-black hover:bg-[#f1f3f4] data-[state=open]:bg-[#f1f3f4] px-2 rounded cursor-default">Insert</MenubarTrigger>
              <MenubarContent>
                <MenubarItem onClick={() => addNode('reservoir', { x: 100, y: 100 })} className="gap-2">
                  <Cylinder className="w-4 h-4 text-blue-600" /> Reservoir
                </MenubarItem>
                <MenubarItem onClick={() => addNode('node', { x: 150, y: 150 })} className="gap-2">
                  <Circle className="w-4 h-4 text-slate-600" /> Node
                </MenubarItem>
                <MenubarItem onClick={() => addNode('junction', { x: 200, y: 150 })} className="gap-2">
                  <GitCommitHorizontal className="w-4 h-4 text-red-600" /> Junction
                </MenubarItem>
                <MenubarItem onClick={() => addNode('surgeTank', { x: 250, y: 100 })} className="gap-2">
                  <PlusCircle className="w-4 h-4 text-orange-600" /> Surge Tank
                </MenubarItem>
                <MenubarItem onClick={() => addNode('flowBoundary', { x: 50, y: 150 })} className="gap-2">
                  <ArrowRightCircle className="w-4 h-4 text-green-600" /> Flow BC
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger className="text-[14px] font-normal h-7 text-black hover:bg-[#f1f3f4] data-[state=open]:bg-[#f1f3f4] px-2 rounded cursor-default">Tools</MenubarTrigger>
              <MenubarContent>
                <MenubarItem onClick={onShowDiagram} className="gap-2">
                  <Layout className="w-4 h-4" /> System Diagram Console
                </MenubarItem>
                <MenubarSeparator />
                <Dialog>
                  <DialogTrigger asChild>
                    <MenubarItem onSelect={(e) => e.preventDefault()} className="gap-2">
                      <ListVideo className="w-4 h-4" /> Output Requests
                    </MenubarItem>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Configure Output Requests</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Request Type</Label>
                        <Select value={requestType} onValueChange={(v: 'HISTORY' | 'PLOT' | 'SPREADSHEET') => setRequestType(v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HISTORY">HISTORY</SelectItem>
                            <SelectItem value="PLOT">PLOT</SelectItem>
                            <SelectItem value="SPREADSHEET">SPREADSHEET</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Select Element</Label>
                        <Select value={selectedElementId} onValueChange={setSelectedElementId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select element..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_" disabled>Nodes</SelectItem>
                            {nodes.map(n => (
                              <SelectItem key={n.id} value={n.id}>{String(n.data.nodeNumber)}</SelectItem>
                            ))}
                            <SelectItem value="__" disabled>Conduits</SelectItem>
                            {edges.map(e => (
                              <SelectItem key={e.id} value={e.id}>{e.data?.label || `Edge ${e.id}`}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Variables</Label>
                        <div className="flex flex-wrap gap-4">
                          {availableVars.map(v => (
                            <div key={v} className="flex items-center gap-2">
                              <Checkbox 
                                id={`var-${v}`} 
                                checked={selectedVars.includes(v)}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedVars([...selectedVars, v]);
                                  else setSelectedVars(selectedVars.filter(sv => sv !== v));
                                }}
                              />
                              <Label htmlFor={`var-${v}`}>{v}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button onClick={handleAddRequest}>Add Request</Button>
                      <Separator />
                      <div className="max-h-[200px] overflow-auto">
                        <Label className="mb-2 block text-xs">Current Requests ({requestType})</Label>
                            {outputRequests.filter(req => req.requestType === requestType).map(req => {
                              const el = nodes.find(n => n.id === req.elementId) || edges.find(e => e.id === req.elementId);
                              const displayLabel = String(el?.data?.nodeNumber || el?.data?.label || req.elementId);
                              return (
                                <div key={req.id} className="flex items-center justify-between text-xs py-1 border-b">
                                  <span>{displayLabel}: {req.variables.join(', ')}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeOutputRequest(req.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              );
                            })}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <MenubarItem onSelect={(e) => e.preventDefault()} className="gap-2">
                      <Settings2 className="w-4 h-4" /> Computation Parameters
                    </MenubarItem>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Computational Parameters</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="dtcomp" className="text-right">DTCOMP</Label>
                        <Input 
                          id="dtcomp" 
                          type="number" 
                          step="0.001"
                          className="col-span-3" 
                          value={localParams.dtcomp}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            setLocalParams({...localParams, dtcomp: val});
                            updateComputationalParams({...localParams, dtcomp: val});
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="dtout" className="text-right">DTOUT</Label>
                        <Input 
                          id="dtout" 
                          type="number" 
                          step="0.01"
                          className="col-span-3" 
                          value={localParams.dtout}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            setLocalParams({...localParams, dtout: val});
                            updateComputationalParams({...localParams, dtout: val});
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tmax" className="text-right">TMAX</Label>
                        <Input 
                          id="tmax" 
                          type="number" 
                          className="col-span-3" 
                          value={localParams.tmax}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            setLocalParams({...localParams, tmax: val});
                            updateComputationalParams({...localParams, tmax: val});
                          }}
                        />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger className="text-[14px] font-normal h-7 text-black hover:bg-[#f1f3f4] data-[state=open]:bg-[#f1f3f4] px-2 rounded cursor-default">Help</MenubarTrigger>
              <MenubarContent>
                <MenubarItem>WHAMO Help</MenubarItem>
                <MenubarItem>Shortcuts</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        </div>


        <div className="ml-auto flex items-center gap-2 pr-4">
          <Button 
            variant="default" 
            size="sm" 
            onClick={onExport}
            className="h-9 px-6 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium shadow-sm transition-all"
            data-testid="button-generate-inp"
          >
            <Download className="w-4 h-4 mr-2" />
            Generate .INP
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGenerateOutDirectly}
            disabled={isGeneratingOut}
            className="h-9 px-6 rounded-full border-[#1a73e8] text-[#1a73e8] hover:bg-[#1a73e8]/10 font-medium shadow-sm transition-all"
            data-testid="button-generate-out"
          >
            <Download className="w-4 h-4 mr-2" />
            {isGeneratingOut ? "Processing..." : "Generate .OUT"}
          </Button>
        </div>
      </div>
    </div>
  );
}
