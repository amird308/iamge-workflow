import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Node, Edge, NodeType, NodeData } from '../types';
import { Node as NodeComponent } from './Node';
import { ConnectionLine } from './ConnectionLine';
import * as Icons from 'lucide-react';

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
  onNodeChange: (nodeId: string, data: any) => void;
  onNodeDelete: (nodeId: string) => void;
  selectedNodeId: string | null;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
  onNodeChange,
  onNodeDelete,
  selectedNodeId,
}) => {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Dragging State
  const [isDraggingNode, setIsDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Panning State
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });

  // Connecting State
  const [connectingSource, setConnectingSource] = useState<{ nodeId: string, x: number, y: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  // Helper to get raw coordinates relative to canvas content (accounting for pan/scale)
  const getCanvasCoordinates = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / scale,
      y: (clientY - rect.top - pan.y) / scale
    };
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow') as NodeType;
    if (!type) return;

    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      position: { x: coords.x - 128, y: coords.y - 40 }, // Center-ish
      data: {
        label: type === 'webhook' ? 'Start Trigger' : `New ${type}`,
        description: 'Configure this block.',
        status: 'idle'
      }
    };

    onNodesChange([...nodes, newNode]);
    onNodeSelect(newNode.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle mouse or Space+Click (simulated) for panning
    if (e.button === 1 || e.button === 0 && e.shiftKey) {
        setIsPanning(true);
        setLastPanPosition({ x: e.clientX, y: e.clientY });
        return;
    }
    // Deselect if clicking on empty canvas
    onNodeSelect(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent canvas panning/deselect
    onNodeSelect(id);
    setIsDraggingNode(id);
    
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    const node = nodes.find(n => n.id === id);
    if (node) {
        setDragOffset({
            x: coords.x - node.position.x,
            y: coords.y - node.position.y
        });
    }
  };

  const handleHandleMouseDown = (e: React.MouseEvent, nodeId: string, type: 'source' | 'target') => {
    e.stopPropagation();
    if (type === 'source') {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            // Calculate absolute position of the handle
            // Node width is w-96 (24rem = 384px), Handle is centered vertically relative to header
            const handleX = node.position.x + 384; 
            const handleY = node.position.y + 28; // Header center approx
            setConnectingSource({ nodeId, x: handleX, y: handleY });
            
            const coords = getCanvasCoordinates(e.clientX, e.clientY);
            setMousePos(coords);
        }
    } else if (type === 'target' && connectingSource) {
        // Complete connection logic is handled in MouseUp usually
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    setMousePos(coords);

    if (isPanning) {
        const dx = e.clientX - lastPanPosition.x;
        const dy = e.clientY - lastPanPosition.y;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastPanPosition({ x: e.clientX, y: e.clientY });
        return;
    }

    if (isDraggingNode) {
        onNodesChange(nodes.map(n => {
            if (n.id === isDraggingNode) {
                return {
                    ...n,
                    position: {
                        x: coords.x - dragOffset.x,
                        y: coords.y - dragOffset.y
                    }
                };
            }
            return n;
        }));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDraggingNode(null);
    setIsPanning(false);

    if (connectingSource) {
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        const targetNode = nodes.find(n => {
            if (n.id === connectingSource.nodeId) return false;
            // Target handle detection
            const handleX = n.position.x;
            const handleY = n.position.y + 28; // Header center
            const dist = Math.sqrt(Math.pow(coords.x - handleX, 2) + Math.pow(coords.y - handleY, 2));
            return dist < 30; // 30px radius tolerance
        });

        if (targetNode) {
            const newEdge: Edge = {
                id: `e-${connectingSource.nodeId}-${targetNode.id}`,
                source: connectingSource.nodeId,
                target: targetNode.id
            };
            onEdgesChange([...edges, newEdge]);
        }

        setConnectingSource(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
     const zoomSensitivity = 0.001;
     const newScale = Math.min(Math.max(0.5, scale - e.deltaY * zoomSensitivity), 2);
     setScale(newScale);
  };

  return (
    <div 
        className="flex-1 h-full relative overflow-hidden bg-slate-100 cursor-crosshair"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        ref={canvasRef}
    >
        {/* Grid Background */}
        <div 
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
                backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
                backgroundSize: `${20 * scale}px ${20 * scale}px`,
                backgroundPosition: `${pan.x}px ${pan.y}px`
            }}
        />

        {/* Workspace Content */}
        <div 
            className="transform-gpu origin-top-left absolute top-0 left-0 w-full h-full"
            style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
            }}
        >
            {/* Edges Layer (Bottom) */}
            <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
                {edges.map(edge => {
                    const sourceNode = nodes.find(n => n.id === edge.source);
                    const targetNode = nodes.find(n => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;
                    
                    return (
                        <ConnectionLine 
                            key={edge.id}
                            x1={sourceNode.position.x + 384} // Width of node (w-96)
                            y1={sourceNode.position.y + 28} // Header center
                            x2={targetNode.position.x}
                            y2={targetNode.position.y + 28}
                        />
                    );
                })}
                {connectingSource && (
                    <ConnectionLine 
                        x1={connectingSource.x}
                        y1={connectingSource.y}
                        x2={mousePos.x}
                        y2={mousePos.y}
                        isTemp
                    />
                )}
            </svg>

            {/* Nodes Layer */}
            {nodes.map(node => (
                <NodeComponent
                    key={node.id}
                    node={node}
                    selected={selectedNodeId === node.id}
                    onMouseDown={handleNodeMouseDown}
                    onHandleMouseDown={handleHandleMouseDown}
                    onChange={onNodeChange}
                    onDelete={onNodeDelete}
                />
            ))}
        </div>

        {/* Controls Overlay */}
        <div className="absolute bottom-4 left-4 flex gap-2">
            <div className="bg-white p-2 rounded-lg shadow border border-slate-200 text-slate-500 text-xs font-mono">
                {Math.round(scale * 100)}%
            </div>
            <button 
                onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}
                className="bg-white p-2 rounded-lg shadow border border-slate-200 hover:bg-slate-50 text-slate-600"
            >
                <Icons.Maximize size={16} />
            </button>
        </div>
    </div>
  );
};