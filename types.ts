
export type NodeType = 'webhook' | 'ai-text' | 'ai-image' | 'condition' | 'loop' | 'api' | 'variable';
export type VariableType = 'text' | 'image' | 'json' | 'any';

export interface WebhookFormField {
  id: string;
  key: string;
  type: 'text' | 'file';
  value: string;
}

export interface NodeInput {
  id: string;
  type: 'variable' | 'file';
  value: string; // Variable name or Base64 data
}

export interface NodeData {
  label: string;
  description?: string;
  // Specific properties based on type
  prompt?: string;
  model?: string;
  inputImage?: string; // Legacy: Base64 data URL for input image
  inputImageVariable?: string; // Legacy: Variable name to use as input image
  inputs?: NodeInput[]; // New: Array of inputs (images)
  
  variableName?: string; // For Variable node (legacy)
  outputVariableName?: string; // Name of the variable to store the result in
  // Map JSON fields to specific variables
  outputMappings?: { field: string; variable: string }[]; 
  condition?: string; // For IF nodes
  apiUrl?: string;
  apiMethod?: 'GET' | 'POST';
  webhookContentType?: 'json' | 'form-data';
  webhookPayload?: string; // JSON String for mock webhook payload
  webhookFormData?: WebhookFormField[]; // Array of form fields
  loopArray?: string;
  outputValue?: any; // Stores the result after execution
  status?: 'idle' | 'running' | 'success' | 'error';
  errorMessage?: string;
  // Advanced AI Settings
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  jsonSchema?: string; // JSON String for response schema
}

export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // 'output' usually
  targetHandle?: string; // 'input' usually
}

export interface VariableDefinition {
    name: string;
    type: VariableType;
}

export interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  isRunning: boolean;
  executionLog: string[];
}

export const NODE_COLORS: Record<NodeType, string> = {
  webhook: 'bg-purple-100 border-purple-500 text-purple-900',
  'ai-text': 'bg-blue-100 border-blue-500 text-blue-900',
  'ai-image': 'bg-pink-100 border-pink-500 text-pink-900',
  condition: 'bg-orange-100 border-orange-500 text-orange-900',
  loop: 'bg-yellow-100 border-yellow-500 text-yellow-900',
  api: 'bg-green-100 border-green-500 text-green-900',
  variable: 'bg-gray-100 border-gray-500 text-gray-900',
};

export const NODE_ICONS: Record<NodeType, string> = {
  webhook: 'zap',
  'ai-text': 'bot',
  'ai-image': 'image',
  condition: 'split',
  loop: 'repeat',
  api: 'globe',
  variable: 'database',
};
