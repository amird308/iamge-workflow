import React, { useState } from 'react';
import { Node as NodeType, NODE_COLORS, NODE_ICONS, WebhookFormField, NodeInput } from '../types';
import * as Icons from 'lucide-react';

interface NodeProps {
  node: NodeType;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onHandleMouseDown: (e: React.MouseEvent, id: string, type: 'source' | 'target') => void;
  onChange: (id: string, data: any) => void;
  onDelete: (id: string) => void;
}

export const Node: React.FC<NodeProps> = ({ node, selected, onMouseDown, onHandleMouseDown, onChange, onDelete }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const IconComponent = (Icons as any)[NODE_ICONS[node.type] || 'Box'];
  const baseColor = NODE_COLORS[node.type];
  
  const isRunning = node.data.status === 'running';
  const isSuccess = node.data.status === 'success';
  const isError = node.data.status === 'error';

  // Helper to update node data
  const handleChange = (key: string, value: any) => {
    // Convert numbers if needed
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
        // Clear variable if manual upload is used to avoid confusion
        onChange(node.id, { ...node.data, inputImage: reader.result as string, inputImageVariable: undefined });
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper for adding a new mapping
  const addMapping = () => {
    const mappings = node.data.outputMappings || [];
    onChange(node.id, { 
        ...node.data, 
        outputMappings: [...mappings, { field: '', variable: '' }] 
    });
  };

  // Helper for updating a mapping
  const updateMapping = (index: number, key: 'field' | 'variable', value: string) => {
      const mappings = [...(node.data.outputMappings || [])];
      mappings[index] = { ...mappings[index], [key]: value };
      onChange(node.id, { ...node.data, outputMappings: mappings });
  };

  // Helper for removing a mapping
  const removeMapping = (index: number) => {
      const mappings = [...(node.data.outputMappings || [])];
      mappings.splice(index, 1);
      onChange(node.id, { ...node.data, outputMappings: mappings });
  };
  
  // Helper to insert image into webhook payload (JSON Mode)
  const handleWebhookImageInsert = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64 = reader.result as string;
              // Attempt to parse current payload to add field safely
              let payload = node.data.webhookPayload || "{}";
              try {
                  const json = JSON.parse(payload);
                  json.image_data = base64;
                  handleChange('webhookPayload', JSON.stringify(json, null, 2));
              } catch {
                  // If invalid json, just append string (user can fix)
                  handleChange('webhookPayload', payload + `\n\n// Added Image:\n"image_data": "${base64}"`);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  // --- Form Data Handlers ---
  const addFormDataField = () => {
      const fields = node.data.webhookFormData || [];
      onChange(node.id, {
          ...node.data,
          webhookFormData: [...fields, { id: Date.now().toString(), key: '', type: 'text', value: '' }]
      });
  };

  const updateFormDataField = (index: number, key: keyof WebhookFormField, value: any) => {
      const fields = [...(node.data.webhookFormData || [])];
      fields[index] = { ...fields[index], [key]: value };
      // If switching to text, ensure value is string; if file, value will be set via upload
      if (key === 'type' && value === 'file') {
          fields[index].value = ''; // Reset value when switching to file
      }
      onChange(node.id, { ...node.data, webhookFormData: fields });
  };

  const removeFormDataField = (index: number) => {
      const fields = [...(node.data.webhookFormData || [])];
      fields.splice(index, 1);
      onChange(node.id, { ...node.data, webhookFormData: fields });
  };

  const handleFormDataFileUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              updateFormDataField(index, 'value', reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };


  // Prevent canvas dragging when interacting with forms
  const stopPropagation = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      e.stopPropagation();
  };
  
  // Generic handler for dropping text variables into text inputs
  const handleTextDrop = (e: React.DragEvent, fieldKey: string) => {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling to canvas
    const text = e.dataTransfer.getData('text/plain');
    if (text) {
       const target = e.currentTarget as HTMLInputElement | HTMLTextAreaElement;
       // Insert at cursor if possible, otherwise append/replace
       if (typeof target.selectionStart === 'number' && typeof target.selectionEnd === 'number') {
           const val = String(node.data[fieldKey] || '');
           const start = target.selectionStart || 0;
           const end = target.selectionEnd || 0;
           const newVal = val.slice(0, start) + text + val.slice(end);
           handleChange(fieldKey, newVal);
           
           // Defer focus restore if needed, usually React re-render handles value update
       } else {
           handleChange(fieldKey, (node.data[fieldKey] || '') + text);
       }
    }
  };
  
  const handleDragOverInput = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation(); // Essential: prevents Canvas from hijacking the drop
      e.dataTransfer.dropEffect = 'copy';
  };
  
  // --- New Multi-Input Handlers ---

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

  const handleInputDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const text = e.dataTransfer.getData('text/plain');
      if (text) {
          // Add a new variable input
          const inputs = node.data.inputs || [];
          onChange(node.id, {
              ...node.data,
              inputs: [...inputs, { id: Date.now().toString(), type: 'variable', value: text }]
          });
      }
  };


  // Helper to Render Output
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
                    className="absolute top-1 right-1 p-1.5 bg-white/90 text-slate-600 rounded shadow-sm opacity-0 group-hover/image:opacity-100 transition-opacity hover:text-indigo-600 hover:scale-105 z-10"
                    title="Download Image"
                    onMouseDown={(e) => e.stopPropagation()} // Prevent node drag
                >
                    <Icons.Download size={14} />
                </a>
            </div>
        );
    }

    return <span>{strVal}</span>;
  };

  return (
    <div
      className={`absolute w-96 rounded-xl shadow-sm transition-all duration-200 group
        ${selected ? 'ring-2 ring-indigo-500 shadow-xl z-20' : 'hover:shadow-md z-10'}
        ${isRunning ? 'ring-2 ring-yellow-400' : ''}
        ${isSuccess ? 'ring-2 ring-green-500' : ''}
        ${isError ? 'ring-2 ring-red-500' : ''}
        bg-white border border-slate-200 flex flex-col
      `}
      style={{
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
        cursor: 'default' // Default cursor for content, grab for header
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e) => onMouseDown(e, node.id)}
    >
      {/* Input Handle */}
      {node.type !== 'webhook' && (
        <div
          className="absolute -left-3 top-7 w-3 h-3 bg-slate-400 rounded-full border-2 border-white hover:bg-indigo-500 hover:scale-125 transition-all cursor-crosshair z-30"
          onMouseDown={(e) => onHandleMouseDown(e, node.id, 'target')}
        />
      )}

      {/* Header (Draggable Handle) */}
      <div 
        className={`px-4 py-3 rounded-t-xl flex items-center justify-between border-b border-slate-100 cursor-grab active:cursor-grabbing ${baseColor.split(' ')[0]}`}
      >
        <div className="flex items-center gap-2">
          <div className={`text-slate-700`}>
             {IconComponent && <IconComponent size={16} />}
          </div>
          <input 
            value={node.data.label}
            onChange={(e) => handleChange('label', e.target.value)}
            onMouseDown={stopPropagation}
            onDragOver={handleDragOverInput}
            onDrop={(e) => handleTextDrop(e, 'label')}
            className="font-semibold text-sm text-slate-800 bg-transparent border-none focus:ring-0 w-48 truncate placeholder-slate-500"
          />
        </div>
        <div className="flex items-center gap-2">
            {node.data.status === 'success' && <Icons.CheckCircle2 size={14} className="text-green-600" />}
            {node.data.status === 'error' && <Icons.AlertCircle size={14} className="text-red-600" />}
            {node.data.status === 'running' && <Icons.Loader2 size={14} className="text-blue-600 animate-spin" />}
            
            {/* Delete Button (Visible on Hover or Selected) */}
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                className={`text-slate-400 hover:text-red-500 transition-opacity ${isHovered || selected ? 'opacity-100' : 'opacity-0'}`}
            >
                <Icons.X size={14} />
            </button>
        </div>
      </div>

      {/* Configuration Body */}
      <div className="p-4 space-y-4 text-left">
        
        {/* Webhook Configuration */}
        {node.type === 'webhook' && (
            <div className="space-y-3">
                {/* Content Type Selector */}
                <div className="flex items-center gap-2 mb-2 p-1 bg-slate-100 rounded-lg w-max" onMouseDown={stopPropagation}>
                    <button 
                        onClick={() => handleChange('webhookContentType', 'json')}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${(!node.data.webhookContentType || node.data.webhookContentType === 'json') ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        JSON
                    </button>
                    <button 
                        onClick={() => handleChange('webhookContentType', 'form-data')}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${node.data.webhookContentType === 'form-data' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Form-Data
                    </button>
                </div>

                {/* JSON Editor */}
                {(!node.data.webhookContentType || node.data.webhookContentType === 'json') && (
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Test Payload (JSON)</label>
                            <label className="cursor-pointer flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded transition-colors" onMouseDown={stopPropagation}>
                                <Icons.ImagePlus size={10} />
                                <span>Insert Image</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handleWebhookImageInsert} />
                            </label>
                        </div>
                        <textarea 
                            value={node.data.webhookPayload || '{\n  "message": "Hello World",\n  "timestamp": 123456\n}'}
                            onChange={(e) => handleChange('webhookPayload', e.target.value)}
                            onMouseDown={stopPropagation}
                            onDragOver={handleDragOverInput}
                            onDrop={(e) => handleTextDrop(e, 'webhookPayload')}
                            rows={6}
                            placeholder='{"key": "value"}'
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-y"
                        />
                    </div>
                )}

                {/* Form Data Editor */}
                {node.data.webhookContentType === 'form-data' && (
                     <div className="space-y-2">
                         <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Form Fields</label>
                            <button 
                                onClick={addFormDataField}
                                onMouseDown={stopPropagation}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-1 py-0.5 rounded hover:bg-indigo-50"
                            >
                                <Icons.Plus size={10} /> Add Field
                            </button>
                        </div>

                        <div className="space-y-1">
                            {node.data.webhookFormData && node.data.webhookFormData.length > 0 ? (
                                node.data.webhookFormData.map((field, idx) => (
                                    <div key={field.id} className="flex gap-1 items-start group/field">
                                        <div className="flex-1 space-y-1">
                                             <div className="flex gap-1">
                                                <input 
                                                    type="text" 
                                                    placeholder="Key"
                                                    value={field.key}
                                                    onChange={(e) => updateFormDataField(idx, 'key', e.target.value)}
                                                    onMouseDown={stopPropagation}
                                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono focus:ring-1 focus:ring-indigo-500"
                                                />
                                                <select
                                                    value={field.type}
                                                    onChange={(e) => updateFormDataField(idx, 'type', e.target.value as 'text'|'file')}
                                                    onMouseDown={stopPropagation}
                                                    className="w-16 px-1 py-1 bg-slate-100 border-none rounded text-[10px] text-slate-600 font-bold"
                                                >
                                                    <option value="text">Text</option>
                                                    <option value="file">File</option>
                                                </select>
                                             </div>
                                             
                                             {field.type === 'text' ? (
                                                 <input 
                                                    type="text" 
                                                    placeholder="Value"
                                                    value={field.value}
                                                    onChange={(e) => updateFormDataField(idx, 'value', e.target.value)}
                                                    onMouseDown={stopPropagation}
                                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[10px]"
                                                />
                                             ) : (
                                                 <label className="flex items-center justify-between w-full px-2 py-1 bg-white border border-slate-200 border-dashed rounded cursor-pointer hover:bg-slate-50" onMouseDown={stopPropagation}>
                                                     <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                                         {field.value ? 'File Loaded' : 'Select File...'}
                                                     </span>
                                                     {field.value ? <Icons.Check size={10} className="text-green-500" /> : <Icons.Upload size={10} className="text-slate-400" />}
                                                     <input type="file" className="hidden" onChange={(e) => handleFormDataFileUpload(e, idx)} />
                                                 </label>
                                             )}
                                        </div>
                                        <button 
                                            onClick={() => removeFormDataField(idx)}
                                            onMouseDown={stopPropagation}
                                            className="text-slate-300 hover:text-red-500 p-1 mt-1 opacity-0 group-hover/field:opacity-100 transition-opacity"
                                        >
                                            <Icons.Trash2 size={12} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 bg-slate-50 rounded border border-dashed border-slate-200 text-slate-400 text-[10px]">
                                    No fields added. Click 'Add Field' to start.
                                </div>
                            )}
                        </div>
                     </div>
                )}

                <p className="text-[9px] text-slate-400">
                    {node.data.webhookContentType === 'form-data' 
                        ? "Simulates multipart/form-data. Files are converted to binary/base64." 
                        : "Simulates raw JSON body."}
                </p>
            </div>
        )}

        {/* AI Configuration */}
        {(node.type === 'ai-text' || node.type === 'ai-image') && (
            <div className="space-y-3">
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Model</label>
                    <select 
                        value={node.data.model || (node.type === 'ai-image' ? 'gemini-2.5-flash-image' : 'gemini-2.5-flash')}
                        onChange={(e) => handleChange('model', e.target.value)}
                        onMouseDown={stopPropagation}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

                <div className="space-y-1">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Prompt</label>
                        <span className="text-[9px] text-slate-400">Supports <code className="bg-slate-100 px-1 rounded text-indigo-600">{"{{variable}}"}</code></span>
                    </div>
                    <textarea 
                        value={node.data.prompt || ''}
                        onChange={(e) => handleChange('prompt', e.target.value)}
                        onMouseDown={stopPropagation}
                        onDragOver={handleDragOverInput}
                        onDrop={(e) => handleTextDrop(e, 'prompt')}
                        rows={3}
                        placeholder="Enter instructions..."
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-y"
                    />
                </div>
            </div>
        )}

        {/* Mappings & Schema Logic (Shared for ai-text and webhook) */}
        {(node.type === 'ai-text' || node.type === 'webhook') && (
             <div className="space-y-2">
                {node.type === 'ai-text' ? (
                     <button 
                        onClick={(e) => { stopPropagation(e); setShowSchema(!showSchema); }}
                        onMouseDown={stopPropagation}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase hover:text-indigo-600 transition-colors"
                    >
                        {showSchema ? <Icons.ChevronDown size={12} /> : <Icons.ChevronRight size={12} />}
                        <span>JSON Response Structure</span>
                    </button>
                ) : (
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Payload Mappings</label>
                )}
                
                {(showSchema || node.type === 'webhook') && (
                    <div className="space-y-2">
                        {node.type === 'ai-text' && (
                             <>
                                <textarea 
                                    value={node.data.jsonSchema || ''}
                                    onChange={(e) => handleChange('jsonSchema', e.target.value)}
                                    onMouseDown={stopPropagation}
                                    onDragOver={handleDragOverInput}
                                    onDrop={(e) => handleTextDrop(e, 'jsonSchema')}
                                    rows={4}
                                    placeholder='{ "name": "STRING", "age": "INTEGER" }'
                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-y"
                                />
                                <p className="text-[9px] text-slate-400">Define the expected output JSON structure. Supports strict Gemini Schema or simplified key-type pairs.</p>
                            </>
                        )}

                        {/* Output Mappings Table */}
                        <div className={`pt-2 ${node.type === 'ai-text' ? 'border-t border-slate-100' : ''}`}>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-bold text-indigo-500 uppercase">Extract {node.type === 'webhook' ? 'Fields' : 'JSON Fields'}</label>
                                <button 
                                    onClick={addMapping}
                                    onMouseDown={stopPropagation}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-1 py-0.5 rounded hover:bg-indigo-50"
                                >
                                    <Icons.Plus size={10} /> Add
                                </button>
                            </div>
                            
                            <div className="space-y-1">
                                {node.data.outputMappings && node.data.outputMappings.length > 0 ? (
                                    node.data.outputMappings.map((mapping, idx) => (
                                        <div key={idx} className="flex gap-1 items-start">
                                            <input 
                                                type="text" 
                                                placeholder={node.type === 'webhook' ? (node.data.webhookContentType === 'form-data' ? "Form Key" : "JSON Key") : "JSON Key"}
                                                value={mapping.field}
                                                onChange={(e) => updateMapping(idx, 'field', e.target.value)}
                                                onMouseDown={stopPropagation}
                                                className="flex-1 min-w-0 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono"
                                            />
                                            <div className="flex items-center justify-center pt-1.5 px-0.5">
                                               <Icons.ArrowRight size={10} className="text-slate-300" />
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder="Var Name"
                                                value={mapping.variable}
                                                onChange={(e) => updateMapping(idx, 'variable', e.target.value)}
                                                onMouseDown={stopPropagation}
                                                className="flex-1 min-w-0 px-2 py-1 bg-teal-50 border border-teal-200 rounded text-[10px] font-mono text-teal-800"
                                            />
                                            <button 
                                                onClick={() => removeMapping(idx)}
                                                onMouseDown={stopPropagation}
                                                className="text-red-400 hover:text-red-600 p-1 mt-0.5"
                                            >
                                                <Icons.Trash2 size={10} />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[9px] text-slate-400 italic">No field mappings defined.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Output Variable Section for AI Nodes */}
        {(node.type === 'ai-text' || node.type === 'ai-image') && (
            <div className="space-y-1 mt-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Icons.Save size={10} /> Store Result As
                    </label>
                </div>
                <div className="relative">
                    <input 
                        type="text" 
                        value={node.data.outputVariableName || ''}
                        onChange={(e) => handleChange('outputVariableName', e.target.value)}
                        onMouseDown={stopPropagation}
                        placeholder="variable_name"
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 pl-6"
                    />
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Icons.Variable size={10} className="text-slate-400" />
                    </div>
                </div>
            </div>
        )}

        {/* Multi-Image Input Section - Only for AI Nodes */}
        {(node.type === 'ai-text' || node.type === 'ai-image') && (
             <div 
                className={`space-y-2 border-t border-dashed pt-2 rounded transition-colors ${isDragOver ? 'bg-indigo-50 border-indigo-300' : 'border-slate-200'}`}
                onDrop={handleInputDrop} 
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
             >
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                        <Icons.ImageIcon size={12} /> Multimedia Inputs
                    </label>
                    <div className="flex gap-1" onMouseDown={stopPropagation}>
                        <button 
                            onClick={() => addInput('variable')}
                            className="text-[10px] bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 px-1.5 py-0.5 rounded transition-colors"
                            title="Add Variable"
                        >
                            + Var
                        </button>
                        <button 
                            onClick={() => addInput('file')}
                            className="text-[10px] bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 px-1.5 py-0.5 rounded transition-colors"
                            title="Add File"
                        >
                            + File
                        </button>
                    </div>
                </div>
                
                <div className="space-y-2">
                    {node.data.inputs && node.data.inputs.length > 0 ? (
                        node.data.inputs.map((input, idx) => (
                            <div key={input.id} className="relative bg-slate-50 border border-slate-200 rounded p-1.5 flex gap-2 items-start group/input">
                                <div className="mt-1">
                                    {input.type === 'variable' ? (
                                        <Icons.Variable size={12} className="text-indigo-400" />
                                    ) : (
                                        <Icons.Image size={12} className="text-pink-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {input.type === 'variable' ? (
                                        <input 
                                            type="text"
                                            value={input.value}
                                            onChange={(e) => updateInput(idx, 'value', e.target.value)}
                                            onMouseDown={stopPropagation}
                                            placeholder="{{variable}}"
                                            className="w-full bg-transparent border-none p-0 text-xs font-mono text-indigo-600 focus:ring-0 placeholder-slate-300"
                                        />
                                    ) : (
                                        <div className="relative">
                                            {input.value ? (
                                                <div className="relative group/preview">
                                                    <img src={input.value} alt="Preview" className="h-8 rounded border border-slate-200 object-cover" />
                                                    <button 
                                                        onClick={() => updateInput(idx, 'value', '')}
                                                        onMouseDown={stopPropagation}
                                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/preview:opacity-100 transition-opacity"
                                                    >
                                                        <Icons.X size={8} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="flex items-center gap-1 cursor-pointer text-xs text-slate-400 hover:text-slate-600" onMouseDown={stopPropagation}>
                                                    <span className="underline">Upload</span>
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleInputFileUpload(e, idx)} />
                                                </label>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => removeInput(idx)}
                                    onMouseDown={stopPropagation}
                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                >
                                    <Icons.Trash2 size={12} />
                                </button>
                            </div>
                        ))
                    ) : (
                         (!node.data.inputImageVariable && !node.data.inputImage) && (
                            <div className="text-center py-2 border border-dashed border-slate-200 rounded text-[10px] text-slate-400 bg-slate-50/50">
                                Drag variables here or click + to add images
                            </div>
                        )
                    )}

                    {/* Legacy Fallback Display (Read Only migration view) */}
                    {(node.data.inputImageVariable || node.data.inputImage) && (!node.data.inputs || node.data.inputs.length === 0) && (
                        <div className="opacity-75 relative">
                             <div className="absolute inset-0 bg-slate-50/50 z-10 flex items-center justify-center">
                                 <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-1 rounded shadow-sm">Legacy Input</span>
                             </div>
                             <div className="relative">
                                <input 
                                    type="text"
                                    value={node.data.inputImageVariable || 'Manual Image'}
                                    disabled
                                    className="w-full px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-400 pr-6"
                                />
                             </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Output Result Display */}
        {node.data.outputValue && (
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl -mx-4 -mb-4 mt-2">
                 <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-green-600 uppercase flex items-center gap-1">
                        <Icons.CheckCircle2 size={10} /> Result
                    </label>
                 </div>
                 <div className="text-xs font-mono break-all max-h-60 overflow-y-auto">
                    {renderOutput(node.data.outputValue)}
                 </div>
            </div>
        )}

      </div>
      
      {/* Output Handle */}
      <div
        className="absolute -right-3 top-7 w-3 h-3 bg-slate-400 rounded-full border-2 border-white hover:bg-indigo-500 hover:scale-125 transition-all cursor-crosshair z-30"
        onMouseDown={(e) => onHandleMouseDown(e, node.id, 'source')}
      />
    </div>
  );
};
