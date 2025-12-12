import React, { useState } from 'react';
import { Node, NodeType, NodeInput } from '../types';
import * as Icons from 'lucide-react';

interface PropertiesPanelProps {
  node: Node | null;
  onChange: (nodeId: string, data: any) => void;
  onDelete: (nodeId: string) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ node, onChange, onDelete }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!node) {
    return (
      <div className="w-80 bg-white border-l border-slate-200 p-6 flex flex-col items-center justify-center text-slate-400 h-full">
        <Icons.MousePointerClick size={48} className="mb-4 opacity-20" />
        <p className="text-sm text-center">Select a block to configure its properties.</p>
      </div>
    );
  }

  const handleChange = (key: string, value: any) => {
    // Convert number inputs to actual numbers
    if (['temperature', 'topP', 'topK', 'maxOutputTokens'].includes(key)) {
        const num = parseFloat(value);
        onChange(node.id, { ...node.data, [key]: isNaN(num) ? undefined : num });
    } else {
        onChange(node.id, { ...node.data, [key]: value });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(node.id, { ...node.data, inputImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Multi-Input Handlers (Mirrored from Node.tsx) ---
  const addInput = (type: 'variable' | 'file') => {
      const inputs = node.data.inputs || [];
      onChange(node.id, {
          ...node.data,
          inputs: [...inputs, { id: Date.now().toString(), type, value: '' }]
      });
  };

  const removeInput = (index: number) => {
      const inputs = [...(node.data.inputs || [])];
      inputs.splice(index, 1);
      onChange(node.id, { ...node.data, inputs });
  };

  const updateInput = (index: number, key: keyof NodeInput, value: any) => {
      const inputs = [...(node.data.inputs || [])];
      inputs[index] = { ...inputs[index], [key]: value };
      onChange(node.id, { ...node.data, inputs });
  };

  const handleInputFileUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              updateInput(index, 'value', reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  // Helper to Render Output (Shared Logic)
  const renderOutput = (value: any) => {
    if (value === null || value === undefined) return <span className="text-slate-400 italic">Empty</span>;

    // Handle Objects/JSON
    if (typeof value === 'object') {
        return <pre className="whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>;
    }

    const strVal = String(value);
    
    // Check if it's an image (Data URL or HTTP URL with image extension)
    const isDataImage = strVal.startsWith('data:image');
    // Simple regex for image urls (jpeg, jpg, png, gif, webp, svg, etc)
    const isImageUrl = strVal.match(/^https?:\/\/.*\.(jpeg|jpg|png|gif|webp|svg)(\?.*)?$/i);

    if (isDataImage || isImageUrl) {
        return (
            <div className="relative group/image">
                <img 
                    src={strVal} 
                    alt="Output Result" 
                    className="w-full h-auto max-h-60 object-contain rounded border border-slate-200 bg-slate-100" 
                    onMouseDown={(e) => e.stopPropagation()} 
                />
                <a 
                    href={strVal} 
                    download={`output-${node.id}.${isDataImage ? 'png' : 'jpg'}`}
                    className="absolute top-1 right-1 p-2 bg-white/90 text-slate-600 rounded shadow-sm opacity-0 group-hover/image:opacity-100 transition-opacity hover:text-indigo-600 hover:scale-105 z-10"
                    title="Download Image"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <Icons.Download size={16} />
                </a>
            </div>
        );
    }

    return <span>{strVal}</span>;
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full z-20 shadow-xl">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Icons.Settings2 size={16} />
          Configuration
        </h3>
        <button 
          onClick={() => onDelete(node.id)}
          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition-colors"
          title="Delete Node"
        >
          <Icons.Trash2 size={16} />
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        
        {/* Common Fields */}
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Label</label>
            <input 
                type="text" 
                value={node.data.label}
                onChange={(e) => handleChange('label', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
        </div>

        {/* AI Fields */}
        {(node.type === 'ai-text' || node.type === 'ai-image') && (
             <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-indigo-600">
                    <Icons.Sparkles size={16} />
                    <span className="font-semibold text-sm">AI Settings</span>
                </div>
                
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Model</label>
                    <select 
                        value={node.data.model || (node.type === 'ai-image' ? 'gemini-2.5-flash-image' : 'gemini-2.5-flash')}
                        onChange={(e) => handleChange('model', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                    >
                        {node.type === 'ai-text' ? (
                          <>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                            <option value="gemini-2.5-flash-lite-latest">Gemini Flash Lite</option>
                            <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                          </>
                        ) : (
                          <>
                            <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                            <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image (HD)</option>
                          </>
                        )}
                    </select>
                </div>

                {/* Multimedia Inputs (New Array) */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-500 uppercase">Input Images / Content</label>
                        <div className="flex gap-1">
                            <button onClick={() => addInput('variable')} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-200">+ Var</button>
                            <button onClick={() => addInput('file')} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-200">+ File</button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {node.data.inputs && node.data.inputs.map((input, idx) => (
                             <div key={input.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200">
                                 <div className="text-slate-400">
                                    {input.type === 'variable' ? <Icons.Variable size={14} /> : <Icons.Image size={14} />}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     {input.type === 'variable' ? (
                                         <input 
                                            type="text" 
                                            value={input.value} 
                                            onChange={(e) => updateInput(idx, 'value', e.target.value)}
                                            className="w-full bg-transparent text-xs border-none p-0 focus:ring-0 text-indigo-600 font-mono"
                                            placeholder="{{var}}"
                                         />
                                     ) : (
                                         input.value ? (
                                             <div className="flex items-center gap-2">
                                                 <img src={input.value} className="h-6 w-6 object-cover rounded" alt="thumb" />
                                                 <button onClick={() => updateInput(idx, 'value', '')} className="text-[10px] text-red-500 hover:underline">Clear</button>
                                             </div>
                                         ) : (
                                             <input type="file" className="text-[10px]" accept="image/*" onChange={(e) => handleInputFileUpload(e, idx)} />
                                         )
                                     )}
                                 </div>
                                 <button onClick={() => removeInput(idx)} className="text-slate-300 hover:text-red-500"><Icons.Trash2 size={14} /></button>
                             </div>
                        ))}
                        {(!node.data.inputs || node.data.inputs.length === 0) && (
                             <div className="text-xs text-slate-400 italic text-center py-2 border border-dashed border-slate-200 rounded">
                                 No inputs added.
                             </div>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">System Instruction / Prompt</label>
                    <textarea 
                        value={node.data.prompt || ''}
                        onChange={(e) => handleChange('prompt', e.target.value)}
                        rows={6}
                        placeholder={node.type === 'ai-image' ? "Describe the image you want to generate or edit..." : "Enter your prompt here..."}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <p className="text-xs text-slate-400">
                        {node.type === 'ai-image' ? 'Provide a prompt to generate or modify the image.' : 'Use natural language to instruct the model.'}
                    </p>
                </div>

                {/* Advanced Settings Toggle */}
                <div className="pt-2">
                   <button 
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center justify-between w-full text-xs font-bold text-slate-500 uppercase hover:text-indigo-600 transition-colors py-1"
                   >
                      <span>Advanced Parameters</span>
                      {showAdvanced ? <Icons.ChevronUp size={14} /> : <Icons.ChevronDown size={14} />}
                   </button>
                </div>
                
                {showAdvanced && (
                    <div className="space-y-4 bg-slate-50 p-3 rounded-md border border-slate-100 animate-in fade-in slide-in-from-top-1">
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <label className="text-xs font-bold text-slate-500">Temperature</label>
                                <span className="text-xs text-slate-400">{node.data.temperature ?? 1.0}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="2" step="0.1"
                                value={node.data.temperature ?? 1.0}
                                onChange={(e) => handleChange('temperature', e.target.value)}
                                className="w-full accent-indigo-600"
                            />
                            <p className="text-[10px] text-slate-400">Controls randomness (0 = deterministic, 2 = creative).</p>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <label className="text-xs font-bold text-slate-500">Top P</label>
                                <span className="text-xs text-slate-400">{node.data.topP ?? 0.95}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="1" step="0.05"
                                value={node.data.topP ?? 0.95}
                                onChange={(e) => handleChange('topP', e.target.value)}
                                className="w-full accent-indigo-600"
                            />
                            <p className="text-[10px] text-slate-400">Nucleus sampling probability.</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">Top K</label>
                            <input 
                                type="number" 
                                value={node.data.topK ?? 40}
                                onChange={(e) => handleChange('topK', e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                            />
                             <p className="text-[10px] text-slate-400">Limits cumulative probability.</p>
                        </div>

                         <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">Max Output Tokens</label>
                            <input 
                                type="number" 
                                value={node.data.maxOutputTokens ?? ''}
                                placeholder="e.g. 2048"
                                onChange={(e) => handleChange('maxOutputTokens', e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                            />
                        </div>
                    </div>
                )}
             </div>
        )}

        {/* API Fields */}
        {node.type === 'api' && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Endpoint URL</label>
                    <input 
                        type="text" 
                        value={node.data.apiUrl || ''}
                        onChange={(e) => handleChange('apiUrl', e.target.value)}
                        placeholder="https://api.example.com/data"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-mono"
                    />
                </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Method</label>
                    <select 
                        value={node.data.apiMethod || 'GET'}
                        onChange={(e) => handleChange('apiMethod', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                    >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                    </select>
                </div>
            </div>
        )}
        
        {/* Variable Output Configuration (Common for nodes that produce output) */}
        {(node.type === 'ai-text' || node.type === 'ai-image' || node.type === 'webhook' || node.type === 'api') && (
            <div className="space-y-2 pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Icons.Save size={14} /> Output Variable
                </label>
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <input 
                            type="text" 
                            value={node.data.outputVariableName || ''}
                            onChange={(e) => handleChange('outputVariableName', e.target.value)}
                            placeholder="e.g. generated_image"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-mono text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 pl-8"
                        />
                         <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Icons.Variable size={14} className="text-slate-400" />
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-slate-400">
                    Variable name to store the {node.type === 'ai-image' ? 'image' : 'result'} for use in later steps.
                </p>
            </div>
        )}

         {/* Logic Fields */}
         {node.type === 'condition' && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Condition (Pseudo-code)</label>
                    <input 
                        type="text" 
                        value={node.data.condition || ''}
                        onChange={(e) => handleChange('condition', e.target.value)}
                        placeholder="value == 'true'"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-mono"
                    />
                </div>
            </div>
         )}
        
        {/* Output Preview (Read Only) */}
        {node.data.outputValue && (
            <div className="space-y-2 pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-green-600 uppercase flex items-center gap-1">
                    <Icons.CheckCircle2 size={12} /> Last Output
                </label>
                <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-xs font-mono break-all max-h-64 overflow-y-auto">
                    {renderOutput(node.data.outputValue)}
                </div>
            </div>
        )}
        
        {node.data.errorMessage && (
            <div className="space-y-2 pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-red-600 uppercase flex items-center gap-1">
                    <Icons.AlertTriangle size={12} /> Error
                </label>
                <div className="bg-red-50 p-3 rounded-md border border-red-200 text-red-800 text-xs">
                    {node.data.errorMessage}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};
