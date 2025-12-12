import React from 'react';
import { NodeType, NODE_COLORS, NODE_ICONS, VariableDefinition } from '../types';
import * as Icons from 'lucide-react';

interface SidebarProps {
  availableVariables?: VariableDefinition[];
}

const NodeItem = ({ type, label, description }: { type: NodeType; label: string; description: string }) => {
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const IconComponent = (Icons as any)[NODE_ICONS[type] || 'Box'];
  const colorClass = NODE_COLORS[type];

  return (
    <div
      className={`p-3 mb-2 rounded-lg border-2 cursor-grab hover:shadow-md transition-all select-none bg-white border-slate-200`}
      onDragStart={(event) => onDragStart(event, type)}
      draggable
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-md ${colorClass}`}>
          {IconComponent && <IconComponent size={18} />}
        </div>
        <div>
          <h4 className="font-semibold text-sm text-slate-700">{label}</h4>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ availableVariables = [] }) => {
  
  const handleCopyVariable = (varName: string) => {
      const text = `{{${varName}}}`;
      navigator.clipboard.writeText(text);
      // Optional: Show toast
  };

  const handleDragStartVariable = (e: React.DragEvent, varName: string) => {
      e.dataTransfer.setData('text/plain', `{{${varName}}}`);
      e.dataTransfer.effectAllowed = 'copy';
  };

  const getTypeStyles = (type: string) => {
      switch (type) {
          case 'image': return 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100';
          case 'json': return 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100';
          case 'text': return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
          default: return 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100';
      }
  };

  const getTypeIcon = (type: string) => {
      switch (type) {
          case 'image': return <Icons.Image size={10} />;
          case 'json': return <Icons.Braces size={10} />;
          case 'text': return <Icons.Type size={10} />;
          default: return <Icons.Database size={10} />;
      }
  };

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 h-full flex flex-col p-4 z-10 overflow-hidden">
      <h2 className="text-sm font-bold text-slate-400 uppercase mb-4 tracking-wider flex items-center gap-2">
        <Icons.BoxSelect size={14} /> Toolbox
      </h2>
      
      <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-500 mb-2">Triggers</h3>
          <NodeItem type="webhook" label="Webhook" description="Start workflow via HTTP" />
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-500 mb-2">AI Models</h3>
          <NodeItem type="ai-text" label="Gemini Text" description="Generate text content" />
          <NodeItem type="ai-image" label="Gemini Image" description="Generate or edit images" />
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-500 mb-2">Logic & Data</h3>
          <NodeItem type="condition" label="If / Else" description="Conditional logic" />
          <NodeItem type="loop" label="Loop" description="Iterate over a list" />
          <NodeItem type="api" label="API Call" description="Make HTTP requests" />
        </div>
        
        {/* Global Variables Section */}
        {availableVariables.length > 0 && (
            <div className="mb-6 pt-4 border-t border-slate-200">
                <h3 className="text-xs font-bold text-indigo-600 mb-3 uppercase flex items-center gap-2">
                    <Icons.Database size={12} /> Global Variables
                </h3>
                <p className="text-[10px] text-slate-400 mb-2">Drag to inputs or click to copy</p>
                <div className="flex flex-wrap gap-2">
                    {availableVariables.map((v, i) => (
                        <div
                            key={i}
                            draggable
                            onDragStart={(e) => handleDragStartVariable(e, v.name)}
                            onClick={() => handleCopyVariable(v.name)}
                            title={`Type: ${v.type}`}
                            className={`px-2 py-1 border rounded text-xs font-mono transition-colors flex items-center gap-1 group cursor-grab active:cursor-grabbing ${getTypeStyles(v.type)}`}
                        >
                            {getTypeIcon(v.type)}
                            <span className="font-bold">{v.name}</span>
                            <Icons.Copy size={10} className="opacity-0 group-hover:opacity-100 ml-1" />
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
      
      <div className="pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-400">Drag blocks onto the canvas to build your workflow.</p>
      </div>
    </aside>
  );
};