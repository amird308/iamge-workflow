import { Node, Edge, NodeInput } from '../types';
import { executeAiNode } from './geminiService';

export class WorkflowEngine {
  nodes: Node[];
  edges: Edge[];
  logs: string[];
  variables: Record<string, any> = {}; // Global variable store
  setNodes: (nodes: Node[]) => void;
  setLogs: (logs: string[]) => void;

  constructor(
    nodes: Node[], 
    edges: Edge[], 
    setNodes: (nodes: Node[]) => void,
    setLogs: (log: string[]) => void
  ) {
    this.nodes = JSON.parse(JSON.stringify(nodes)); // Deep copy to avoid direct mutation issues
    this.edges = edges;
    this.logs = [];
    this.setNodes = setNodes;
    this.setLogs = setLogs;
  }

  log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.push(`[${timestamp}] ${message}`);
    this.setLogs([...this.logs]);
  }

  updateNodeStatus(id: string, status: 'idle' | 'running' | 'success' | 'error', output?: any, error?: string) {
    this.nodes = this.nodes.map(n => {
      if (n.id === id) {
        return {
          ...n,
          data: {
            ...n.data,
            status,
            outputValue: output !== undefined ? output : n.data.outputValue,
            errorMessage: error
          }
        };
      }
      return n;
    });
    this.setNodes([...this.nodes]);
  }

  /**
   * Replaces {{variable}} placeholders in a string with values from the global store.
   * Supports alphanumeric, underscores, and hyphens.
   */
  resolveVariables(text: string): string {
      if (!text) return "";
      // Updated regex to allow spaces inside braces: {{ var }} and support hyphens
      return text.replace(/\{\{\s*([a-zA-Z0-9_\-]+)\s*\}\}/g, (match, varName) => {
          if (this.variables.hasOwnProperty(varName)) {
              const val = this.variables[varName];
              return typeof val === 'object' ? JSON.stringify(val) : String(val);
          }
          throw new Error(`Variable '${varName}' not found. Available: ${Object.keys(this.variables).join(', ')}`);
      });
  }

  /**
   * Resolves a single variable value.
   */
  resolveVariableValue(varName: string): any {
      const stripped = varName.trim().replace(/^\{\{\s*|\s*\}\}$/g, '');
      if (this.variables.hasOwnProperty(stripped)) {
          return this.variables[stripped];
      }
      throw new Error(`Variable '${stripped}' not found. Available: ${Object.keys(this.variables).join(', ')}`);
  }

  /**
   * Resolves the list of inputs for AI nodes.
   * Handles both file (base64) and variable references.
   */
  resolveInputs(inputs: NodeInput[]): NodeInput[] {
      if (!inputs) return [];
      
      return inputs.map(input => {
          if (input.type === 'variable') {
              try {
                  const val = this.resolveVariableValue(input.value);
                  // We return the resolved value in the 'value' field so the execution service can use it directly
                  return { ...input, value: val }; 
              } catch (e: any) {
                  this.log(`Warning: ${e.message}`);
                  return input; // Return original if fail, service might handle or fail later
              }
          }
          return input;
      });
  }

  /**
   * Legacy resolver for single input image.
   */
  resolveInputImage(nodeData: any): string | undefined {
      if (nodeData.inputImageVariable) {
          try {
              return this.resolveVariableValue(nodeData.inputImageVariable);
          } catch (e: any) {
             throw new Error(e.message);
          }
      }
      return nodeData.inputImage;
  }

  /**
   * Sanitizes input data for use as AI text context.
   * Truncates long strings and removes Base64 image data to prevent token explosion.
   */
  getSafeContext(input: any): string {
       if (typeof input === 'string') {
           if (input.startsWith('data:')) return "[Image Data URL - Content Omitted from Text Context]";
           if (input.length > 50000) return input.substring(0, 50000) + "... [Truncated]";
           return input;
       }
       if (typeof input === 'object' && input !== null) {
           try {
               return JSON.stringify(input, (key, val) => {
                   if (typeof val === 'string') {
                       if (val.startsWith('data:') && val.length > 500) return "[Image Data]";
                       if (val.length > 5000) return val.substring(0, 5000) + "... [Truncated]";
                   }
                   return val;
               }, 2);
           } catch {
               return String(input);
           }
       }
       return String(input);
  }

  async run() {
    this.log("Starting workflow execution...");
    
    // 1. Find Start Node (Webhook)
    const startNode = this.nodes.find(n => n.type === 'webhook');
    if (!startNode) {
      this.log("Error: No Webhook/Start trigger found.");
      return;
    }

    // Reset all statuses and variables
    this.variables = {};
    this.nodes = this.nodes.map(n => ({ ...n, data: { ...n.data, status: 'idle', outputValue: null, errorMessage: undefined } }));
    this.setNodes([...this.nodes]);

    // Start execution BFS/Traversal
    await this.executeNode(startNode, "Workflow triggered.");
    
    this.log("Workflow execution finished.");
    this.log(`Final Global Variables: ${JSON.stringify(Object.keys(this.variables))}`);
  }

  async executeNode(node: Node, inputData: any) {
    this.updateNodeStatus(node.id, 'running');
    this.log(`Executing node: ${node.data.label} (${node.type})`);

    let outputData = inputData;

    try {
      // 1. Resolve Inputs (Prompt, URL, etc.) using Variables
      const processedNodeData = { ...node.data };
      
      // Resolve textual prompt
      if (processedNodeData.prompt) {
          processedNodeData.prompt = this.resolveVariables(processedNodeData.prompt);
      }
      
      // Resolve API URL
      if (processedNodeData.apiUrl) {
          processedNodeData.apiUrl = this.resolveVariables(processedNodeData.apiUrl);
      }

      // Resolve Input Images (Support New Multi-Input and Legacy Single Input)
      if (processedNodeData.inputs && processedNodeData.inputs.length > 0) {
          processedNodeData.inputs = this.resolveInputs(processedNodeData.inputs);
      } else {
          // Fallback to legacy single input resolution
          processedNodeData.inputImage = this.resolveInputImage(processedNodeData);
      }

      switch (node.type) {
        case 'webhook':
          if (processedNodeData.webhookContentType === 'form-data') {
              // Construct object from form fields
              const formDataObj: Record<string, any> = {};
              (processedNodeData.webhookFormData || []).forEach((field: any) => {
                  if (field.key) {
                      formDataObj[field.key] = field.value;
                  }
              });
              outputData = formDataObj;
              this.log("Loaded simulation Form-Data payload.");
          } else {
              // Default to JSON
              if (processedNodeData.webhookPayload) {
                 try {
                     outputData = JSON.parse(processedNodeData.webhookPayload);
                     this.log("Loaded simulation JSON payload.");
                 } catch (e) {
                     this.log("Error parsing Webhook payload, using default.");
                     outputData = { error: "Invalid JSON Payload", raw: processedNodeData.webhookPayload };
                 }
              } else {
                 outputData = { trigger: 'manual', timestamp: Date.now() };
              }
          }
          break;

        case 'ai-text':
          // Pass context from previous node + prompt
          const textContext = this.getSafeContext(inputData);
          if (!processedNodeData.model) processedNodeData.model = 'gemini-2.5-flash';
          outputData = await executeAiNode(processedNodeData, textContext);
          break;

        case 'ai-image':
          this.log("Requesting image generation/editing...");
          const imageContext = this.getSafeContext(inputData);
          if (!processedNodeData.model) processedNodeData.model = 'gemini-2.5-flash-image';
          outputData = await executeAiNode(processedNodeData, imageContext);
          break;

        case 'variable':
          outputData = inputData;
          break;
        
        case 'api':
           this.log(`Calling API: ${processedNodeData.apiUrl || 'No URL'}`);
           // Simulate API call
           await new Promise(r => setTimeout(r, 1000));
           outputData = { status: 200, data: { mock: "result" } };
           break;

        case 'condition':
           const condition = processedNodeData.condition || '';
           this.log(`Checking condition: ${condition}`);
           // Logic to be implemented. For now pass through.
           break;

        default:
          break;
      }

      // 2. Store Output in Global Variables if configured
      // 2a. Primary Output Variable
      if (node.data.outputVariableName) {
          const varName = node.data.outputVariableName.trim();
          if (varName) {
              this.variables[varName] = outputData;
              this.log(`Stored output to variable '${varName}'`);
          }
      }

      // 2b. Mapped JSON Fields
      if (node.data.outputMappings && node.data.outputMappings.length > 0) {
          if (typeof outputData === 'object' && outputData !== null) {
               node.data.outputMappings.forEach(mapping => {
                   if (mapping.field && mapping.variable) {
                       const fieldName = mapping.field.trim();
                       const varName = mapping.variable.trim();
                       
                       if (outputData.hasOwnProperty(fieldName)) {
                           this.variables[varName] = outputData[fieldName];
                           this.log(`Stored field '${fieldName}' to variable '${varName}'`);
                       } else {
                           this.log(`Warning: Field '${fieldName}' not found in output.`);
                       }
                   }
               });
          } else {
               this.log(`Warning: Output Mappings ignored because output is not an object.`);
          }
      }

      this.updateNodeStatus(node.id, 'success', outputData);
      this.log(`Node ${node.data.label} completed.`);

      // Find next nodes
      const outgoingEdges = this.edges.filter(e => e.source === node.id);
      
      for (const edge of outgoingEdges) {
        const nextNode = this.nodes.find(n => n.id === edge.target);
        if (nextNode) {
          await this.executeNode(nextNode, outputData);
        }
      }

    } catch (err: any) {
      console.error(err);
      this.updateNodeStatus(node.id, 'error', undefined, err.message);
      this.log(`Error in node ${node.data.label}: ${err.message}`);
    }
  }
}
