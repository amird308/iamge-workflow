import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini Client
const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API_KEY is missing from environment variables");
    }
    return new GoogleGenAI({ apiKey });
};

const extractBase64Data = (dataUrl: string) => {
    return dataUrl.split(',')[1];
};

const extractMimeType = (dataUrl: string) => {
    return dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
};

/**
 * Helper to normalize simplified JSON schema definitions into strict Gemini Schema format.
 * Allows users to write { "key": "STRING" } instead of { "type": "OBJECT", "properties": { "key": { "type": "STRING" } } }
 */
const normalizeSchema = (schema: any): any => {
    // 1. If it has 'type' property at root, assume it is already a valid full Schema object
    if (schema.type) {
        return schema;
    }

    // 2. Simplified Object: { key: "TypeString", ... }
    // Check if it looks like a simplified object definition (plain object, not array)
    if (typeof schema === 'object' && schema !== null && !Array.isArray(schema)) {
        const properties: any = {};
        const keys = Object.keys(schema);
        
        // If empty object, return as is (unspecified)
        if (keys.length === 0) return schema;

        let validSimplified = true;

        for (const key of keys) {
            const val = schema[key];
            
            // Case A: val is a Type string (e.g. "STRING", "INTEGER")
            if (typeof val === 'string') {
                const upperType = val.toUpperCase();
                // Basic validation of type string
                if (['STRING', 'NUMBER', 'INTEGER', 'BOOLEAN', 'ARRAY', 'OBJECT'].includes(upperType)) {
                    properties[key] = { type: upperType };
                } else {
                     // If unknown string, might be a description or invalid. 
                     // We default to STRING to be permissive, or we could fail.
                     properties[key] = { type: 'STRING' };
                }
            } 
            // Case B: val is a nested object (e.g. { val: "STRING" } or { type: "STRING" })
            else if (typeof val === 'object' && val !== null) {
                // If the nested object has 'type', use it. If not, recursively normalize.
                if (val.type) {
                    properties[key] = val;
                } else {
                    properties[key] = normalizeSchema(val);
                }
            } else {
                validSimplified = false;
            }
        }
        
        if (validSimplified) {
            return {
                type: 'OBJECT',
                properties: properties
            };
        }
    }
    
    // Fallback: return as is if we couldn't normalize it
    return schema;
};

/**
 * Executes a specific node logic based on type.
 * This is used by the workflow engine.
 */
export const executeAiNode = async (nodeData: any, inputContext: string): Promise<any> => {
    const ai = getClient();
    const isImageNode = nodeData.model?.includes('image') || false;
    
    // Default models based on usage
    const model = nodeData.model || (isImageNode ? 'gemini-2.5-flash-image' : 'gemini-2.5-flash');
    
    // Construct Parts
    const parts: any[] = [];

    // 1. Process Array Inputs (New Multi-Image Support)
    if (nodeData.inputs && Array.isArray(nodeData.inputs)) {
        for (const input of nodeData.inputs) {
            if (input.value && typeof input.value === 'string' && input.value.startsWith('data:')) {
                parts.push({
                    inlineData: {
                        data: extractBase64Data(input.value),
                        mimeType: extractMimeType(input.value)
                    }
                });
            } else if (input.type === 'variable') {
                // If it wasn't resolved to base64, logging it (it might be text)
                console.warn("Input variable was not a valid base64 image:", input.value);
            }
        }
    } 
    // Fallback: Legacy Single Input
    else if (nodeData.inputImage) {
        // Validate Data URL format
        if (typeof nodeData.inputImage !== 'string' || !nodeData.inputImage.startsWith('data:')) {
            console.error("Invalid Input Image Format:", nodeData.inputImage ? nodeData.inputImage.substring(0, 50) + '...' : 'null');
            throw new Error("Input image variable must contain a valid Data URL (e.g. data:image/png;base64,...).");
        }

        parts.push({
            inlineData: {
                data: extractBase64Data(nodeData.inputImage),
                mimeType: extractMimeType(nodeData.inputImage)
            }
        });
    }

    // 2. Add Prompt (Mixed with Context)
    // If it's an image node, the prompt is just the user prompt usually, but we append context for chaining
    const finalPrompt = `${nodeData.prompt || ''}\n\nContext from previous steps:\n${inputContext}`;
    parts.push({ text: finalPrompt });

    // 3. Build Configuration
    const config: any = {};
    if (nodeData.temperature !== undefined) config.temperature = nodeData.temperature;
    if (nodeData.topP !== undefined) config.topP = nodeData.topP;
    if (nodeData.topK !== undefined) config.topK = nodeData.topK;
    if (nodeData.maxOutputTokens !== undefined) config.maxOutputTokens = nodeData.maxOutputTokens;
    
    // JSON Schema processing
    if (nodeData.jsonSchema && nodeData.jsonSchema.trim() !== '') {
        try {
            let schema = JSON.parse(nodeData.jsonSchema);
            // Normalize schema to support simplified key-value format
            schema = normalizeSchema(schema);
            
            config.responseMimeType = "application/json";
            config.responseSchema = schema;
        } catch (e) {
            console.error("Invalid JSON Schema:", e);
            throw new Error("Invalid JSON Schema provided. Please check JSON syntax.");
        }
    }

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts },
            config: Object.keys(config).length > 0 ? config : undefined
        });

        // 4. Process Output
        // Iterate through parts to find output.
        // For ai-image, we look for inlineData (image generation)
        // For ai-text, we look for text.
        
        let outputText = "";
        let outputImage = "";

        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.text) {
                    outputText += part.text;
                }
                if (part.inlineData) {
                    outputImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }

        if (isImageNode) {
            // Prioritize returning the image if it exists, otherwise text (error or description)
            return outputImage || outputText || "No image generated.";
        } else {
            // If json schema was used, parse the output text back to object for better downstream usage
            if (config.responseMimeType === "application/json") {
                try {
                    return JSON.parse(outputText);
                } catch (e) {
                    console.warn("Could not parse JSON output despite schema:", e);
                    // Fallback to raw text if parsing fails
                    return outputText;
                }
            }
            return outputText || "No text generated.";
        }

    } catch (error: any) {
        console.error("Gemini API Error:", error);
        const errorMessage = error.message || error.toString();

        // Specific handling for Token Limits (Max 1M)
        if (errorMessage.includes("token") || errorMessage.includes("exceeds")) {
             throw new Error(`Token Limit Exceeded: The input context passed to the model is too large. Check if you are passing large images or files as text context from previous steps.`);
        }

        // Specific handling for Schema Errors (INVALID_ARGUMENT often masks this)
        // Only trigger this if we actually sent a schema and it wasn't a token error
        if (errorMessage.includes("INVALID_ARGUMENT") && config.responseSchema) {
             throw new Error(`API rejected the request. Please verify your JSON Schema matches the Gemini API requirements (e.g. use 'type': 'OBJECT' and no nulls). Details: ${errorMessage}`);
        }
        
        throw new Error(errorMessage || "Failed to execute AI request");
    }
};
