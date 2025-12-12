import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { Node, Edge, VariableDefinition, VariableType } from './types';
import { WorkflowEngine } from './services/workflowEngine';
import * as Icons from 'lucide-react';

const INITIAL_NODES: Node[] = [
  {
    id: 'start-1',
    type: 'webhook',
    position: { x: 100, y: 100 },
    data: { label: 'Start Trigger', description: 'Manual invocation', status: 'idle', outputVariableName: 'trigger_data', webhookContentType: 'json' }
  }
];

const App: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedNode, setCopiedNode] = useState<Node | null>(null); // Clipboard state
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from LocalStorage on mount (Auto-restore)
  useEffect(() => {
      const saved = localStorage.getItem('flowgen-data');
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              if (parsed.nodes && parsed.edges) {
                  setNodes(parsed.nodes);
                  setEdges(parsed.edges);
                  setLogs(['Restored workflow from local storage.']);
              }
          } catch (e) {
              console.error("Failed to auto-load workflow", e);
          }
      }
  }, []);

  // Handlers
  const handleNodeSelect = useCallback((id: string | null) => {
    setSelectedNodeId(id);
  }, []);

  const handleNodeChange = useCallback((id: string, data: any) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data } : n));
  }, []);

  const handleNodeDelete = useCallback((id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setSelectedNodeId(null);
  }, []);

  const handleRunWorkflow = async () => {
    const engine = new WorkflowEngine(nodes, edges, setNodes, setLogs);
    await engine.run();
  };

  const handleClear = () => {
      if (window.confirm("Are you sure? This will wipe the current workflow.")) {
        setNodes(INITIAL_NODES);
        setEdges([]);
        setLogs([]);
        setSelectedNodeId(null);
      }
  };

  // --- Persistence Handlers ---

  const handleSave = useCallback(() => {
    const data = { nodes, edges, timestamp: Date.now() };
    localStorage.setItem('flowgen-data', JSON.stringify(data));
    const prevTitle = document.title;
    document.title = "Saved! - FlowGen AI";
    setTimeout(() => document.title = prevTitle, 2000);
  }, [nodes, edges]);

  const handleExport = () => {
    const data = { nodes, edges, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowgen-workflow-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
             setNodes(parsed.nodes);
             setEdges(parsed.edges);
             setLogs([`Imported workflow: ${file.name}`]);
          } else {
             alert('Invalid workflow file format. Missing nodes or edges arrays.');
          }
        } catch (err) {
           alert('Failed to parse JSON file.');
           console.error(err);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
    }
  };

  // --- Copy / Paste Logic ---
  
  const handleCopy = useCallback(() => {
    if (selectedNodeId) {
        const node = nodes.find(n => n.id === selectedNodeId);
        if (node) {
            setCopiedNode(node);
            setLogs(prev => [...prev, `Copied node: ${node.data.label}`]);
        }
    }
  }, [selectedNodeId, nodes]);

  const handlePaste = useCallback(() => {
    if (copiedNode) {
        const offset = 30; // Shift new node slightly
        const newNodeId = `node-${Date.now()}`;
        
        // Calculate new position relative to the copied node's last position
        const newPosition = { 
            x: copiedNode.position.x + offset, 
            y: copiedNode.position.y + offset 
        };

        const newData = JSON.parse(JSON.stringify(copiedNode.data));
        // Reset execution state for the new node
        newData.status = 'idle';
        newData.outputValue = null;
        newData.errorMessage = undefined;

        const newNode: Node = {
            id: newNodeId,
            type: copiedNode.type,
            position: newPosition,
            data: newData
        };

        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(newNodeId);
        setLogs(prev => [...prev, `Pasted node: ${newData.label}`]);

        // Update copied node position so subsequent pastes cascade
        setCopiedNode({ ...copiedNode, position: newPosition });
    }
  }, [copiedNode]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Ignore inputs
          const target = e.target as HTMLElement;
          const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
          if (isInput) return;

          // Cmd/Ctrl combinations
          if (e.metaKey || e.ctrlKey) {
              if (e.key === 'c') {
                  e.preventDefault();
                  handleCopy();
              }
              if (e.key === 'v') {
                  e.preventDefault();
                  handlePaste();
              }
              if (e.key === 's') {
                  e.preventDefault();
                  handleSave();
              }
          } 
          // Single keys
          else {
              if (e.key === 'Delete' || e.key === 'Backspace') {
                  if (selectedNodeId) {
                      e.preventDefault();
                      handleNodeDelete(selectedNodeId);
                  }
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, handleSave, selectedNodeId, handleNodeDelete]);


  // Derive available variables from nodes with type inference
  const availableVariables = useMemo<VariableDefinition[]>(() => {
    const vars = new Map<string, VariableType>();

    nodes.forEach(n => {
        // 1. Primary Output Variable
        if (n.data.outputVariableName && n.data.outputVariableName.trim() !== '') {
            let type: VariableType = 'any';
            
            if (n.type === 'ai-image') {
                type = 'image';
            } else if (n.type === 'ai-text') {
                // If using JSON schema, it returns an object (JSON)
                if (n.data.jsonSchema && n.data.jsonSchema.trim().length > 0) {
                    type = 'json';
                } else {
                    type = 'text';
                }
            } else if (n.type === 'webhook') {
                type = 'json';
            } else if (n.type === 'api') {
                type = 'json';
            } else if (n.type === 'loop') {
                type = 'any';
            }

            vars.set(n.data.outputVariableName, type);
        }

        // 2. Output Mappings (Extraction)
        if (n.data.outputMappings) {
            n.data.outputMappings.forEach(m => {
                if (m.variable && m.variable.trim() !== '') {
                    let inferredType: VariableType = 'any';
                    
                    // Attempt to infer type based on source
                    if (n.type === 'webhook' && n.data.webhookContentType === 'form-data') {
                        // If it's form-data, check if the mapped key corresponds to a file field
                        const fieldName = m.field;
                        const formField = n.data.webhookFormData?.find(f => f.key === fieldName);
                        if (formField && formField.type === 'file') {
                            inferredType = 'image'; // Store files/images as 'image' type
                        } else {
                            inferredType = 'text';
                        }
                    } else if (n.type === 'ai-text' && n.data.jsonSchema) {
                        // If extracting from JSON AI output, it's likely text or sub-json
                        inferredType = 'text'; // Default to text for extracted fields
                    }

                    // Only set if not already set (or overwrite 'any')
                    if (!vars.has(m.variable) || vars.get(m.variable) === 'any') {
                         vars.set(m.variable, inferredType);
                    }
                }
            });
        }
    });

    return Array.from(vars.entries()).map(([name, type]) => ({ name, type }));
  }, [nodes]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900">
      
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30 shadow-sm">
        <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
                <Icons.Workflow size={20} />
            </div>
            <div>
                <h1 className="font-bold text-lg text-slate-800 leading-tight">FlowGen AI</h1>
                <p className="text-xs text-slate-500">Visual Pipeline Builder</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
             {/* Hidden File Input for Import */}
             <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".json"
                className="hidden" 
             />

             {/* Persistence Toolbar */}
             <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2 border border-slate-200">
                <button 
                    onClick={handleSave}
                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-md transition-all text-xs font-medium flex items-center gap-1"
                    title="Save to Browser Storage (Ctrl+S)"
                >
                    <Icons.Save size={14} />
                    <span className="hidden lg:inline">Save</span>
                </button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button 
                    onClick={handleExport}
                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-md transition-all text-xs font-medium flex items-center gap-1"
                    title="Export JSON File"
                >
                    <Icons.Download size={14} />
                    <span className="hidden lg:inline">Export</span>
                </button>
                <button 
                    onClick={handleImportClick}
                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-md transition-all text-xs font-medium flex items-center gap-1"
                    title="Import JSON File"
                >
                    <Icons.Upload size={14} />
                    <span className="hidden lg:inline">Import</span>
                </button>
             </div>

             <div className="text-xs text-slate-400 mr-2 hidden xl:block border-l border-slate-200 pl-3">
                 {nodes.length} nodes · {edges.length} connections
             </div>
             
             <button 
                onClick={handleClear}
                className="px-3 py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-md text-sm font-medium transition-colors"
                title="Reset Workflow"
            >
                <Icons.Trash2 size={16} />
            </button>
            <button 
                onClick={handleRunWorkflow}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium shadow-md shadow-indigo-200 transition-all active:scale-95"
            >
                <Icons.Play size={16} fill="currentColor" />
                Run
            </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <Sidebar availableVariables={availableVariables} />

        {/* Canvas Area */}
        <div className="flex-1 relative flex flex-col">
            <WorkflowCanvas 
                nodes={nodes}
                edges={edges}
                onNodesChange={setNodes}
                onEdgesChange={setEdges}
                onNodeSelect={handleNodeSelect}
                onNodeChange={handleNodeChange}
                onNodeDelete={handleNodeDelete}
                selectedNodeId={selectedNodeId}
            />
            
            {/* Logs Console Overlay (Bottom Left) */}
            {logs.length > 0 && (
                <div className="absolute bottom-4 left-4 max-w-md w-full bg-slate-900/90 text-slate-300 text-xs font-mono p-4 rounded-xl shadow-2xl backdrop-blur-sm z-30 max-h-48 overflow-y-auto border border-slate-700">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-700">
                        <span className="font-bold text-slate-100">Execution Logs</span>
                        <button onClick={() => setLogs([])} className="hover:text-white"><Icons.X size={12} /></button>
                    </div>
                    <div className="space-y-1">
                        {logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default App;