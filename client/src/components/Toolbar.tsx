import { 
  PlusCircle, 
  Circle, 
  GitCommitHorizontal, 
  Cylinder, 
  ArrowRightCircle, 
  Trash2, 
  RotateCcw, 
  Download, 
  Save, 
  Upload, 
  MousePointer2,
  Settings2,
  ListVideo
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNetworkStore } from '@/lib/store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
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
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export function Toolbar({ onExport, onSave, onLoad }: { onExport: () => void, onSave: () => void, onLoad: () => void }) {
  const { 
    addNode, 
    clearNetwork, 
    nodes, 
    edges, 
    computationalParams, 
    updateComputationalParams,
    outputRequests,
    addOutputRequest,
    removeOutputRequest
  } = useNetworkStore();

  const [localParams, setLocalParams] = useState(computationalParams);
  const [selectedElementId, setSelectedElementId] = useState<string>("");
  const [selectedVars, setSelectedVars] = useState<string[]>([]);

  const handleAddRequest = () => {
    if (!selectedElementId || selectedVars.length === 0) return;
    
    const node = nodes.find(n => n.id === selectedElementId);
    const edge = edges.find(e => e.id === selectedElementId);
    const type = node ? 'node' : 'edge';

    addOutputRequest({
      elementId: selectedElementId,
      elementType: type,
      requestType: 'HISTORY', // Default to HISTORY as this dialog doesn't have a selector yet
      variables: selectedVars
    });
    setSelectedElementId("");
    setSelectedVars([]);
  };

  const availableVars = ["Q", "HEAD", "ELEV", "VEL", "PRESS", "PIEZHEAD"];

  const tools = [
    { label: 'Reservoir', icon: Cylinder, action: () => addNode('reservoir', { x: 100, y: 100 }), color: 'text-blue-600' },
    { label: 'Node', icon: Circle, action: () => addNode('node', { x: 150, y: 150 }), color: 'text-blue-500' },
    { label: 'Junction', icon: GitCommitHorizontal, action: () => addNode('junction', { x: 200, y: 150 }), color: 'text-red-500' },
    { label: 'Surge Tank', icon: PlusCircle, action: () => addNode('surgeTank', { x: 250, y: 100 }), color: 'text-orange-600' },
    { label: 'Flow BC', icon: ArrowRightCircle, action: () => addNode('flowBoundary', { x: 50, y: 150 }), color: 'text-green-600' },
  ];

  const handleRunWhamo = async () => {
    try {
      // 1. Generate INP content from current state
      const { generateInpFile } = await import('@/lib/inp-generator');
      const inpContent = generateInpFile(nodes, edges, false);

      // 2. Send to backend
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
    } catch (error: any) {
      console.error("WHAMO Error:", error);
      alert(error.message);
    }
  };

  return (
    <div className="h-16 border-b border-border bg-card px-4 flex items-center justify-between shadow-sm z-10 relative">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 data-[active=true]:bg-accent">
                <MousePointer2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Select / Move</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-8 mx-2" />

        <div className="flex items-center gap-1">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-9">
                <ListVideo className="w-4 h-4" />
                Output Request
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Configure Output Requests</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Select Element</Label>
                  <Select value={selectedElementId} onValueChange={setSelectedElementId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select element..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_" disabled>Nodes</SelectItem>
                      {nodes.map(n => (
                        <SelectItem key={n.id} value={n.id}>
                          {String(n.data.nodeNumber)}
                        </SelectItem>
                      ))}
                      <SelectItem value="__" disabled>Conduits</SelectItem>
                      {edges.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.data?.label || `Edge ${e.id}`}
                        </SelectItem>
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
                  <Label className="mb-2 block">Current Requests</Label>
                  {outputRequests.map(req => {
                    const el = nodes.find(n => n.id === req.elementId) || edges.find(e => e.id === req.elementId);
                    const displayLabel = String(el?.data?.nodeNumber || el?.data?.label || req.elementId);
                    return (
                      <div key={req.id} className="flex items-center justify-between text-sm py-1 border-b">
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
              <Button variant="outline" size="sm" className="gap-2 h-9">
                <Settings2 className="w-4 h-4" />
                COMPUTATIONAL PARAMETERS
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
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
        </div>

        <Separator orientation="vertical" className="h-8 mx-2" />

        <div className="flex items-center gap-1">
          {tools.map((tool) => (
            <Tooltip key={tool.label}>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={tool.action}
                  className="gap-2 h-9 px-3 hover:bg-muted/50 transition-colors"
                >
                  <tool.icon className={`w-4 h-4 ${tool.color}`} />
                  <span className="hidden xl:inline">{tool.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add {tool.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={clearNetwork} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear Canvas</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-8 mx-2" />

        <div className="flex items-center gap-1">
           <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="sm" onClick={onLoad}>
                <Upload className="w-4 h-4 mr-2" />
                Load
              </Button>
            </TooltipTrigger>
            <TooltipContent>Load JSON Project</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="sm" onClick={onSave}>
                <Save className="w-4 h-4 mr-2" />
                Save JSON
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save Project State</TooltipContent>
          </Tooltip>

          <Button onClick={onExport} className="ml-2 shadow-lg shadow-primary/20" data-testid="button-generate-inp">
            <Download className="w-4 h-4 mr-2" />
            Generate .INP
          </Button>

          <Button 
            onClick={handleRunWhamo} 
            variant="outline" 
            className="ml-2 border-primary text-primary hover:bg-primary/10"
            data-testid="button-generate-out"
          >
            <Download className="w-4 h-4 mr-2" />
            Generate .OUT
          </Button>
        </div>
      </div>
    </div>
  );
}
