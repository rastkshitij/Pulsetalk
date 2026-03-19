import { GoogleGenAI, Type, FunctionDeclaration, Chat } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { BookAppointmentArgs } from "../types";

// Initialize the API client
// NOTE: We assume import.meta.env.VITE_GEMINI_API_KEY is available.
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Define the function tool for booking appointments
const bookAppointmentTool: FunctionDeclaration = {
  name: 'bookAppointment',
  parameters: {
    type: Type.OBJECT,
    description: 'Schedule a medical appointment for the user.',
    properties: {
      specialty: {
        type: Type.STRING,
        description: 'The type of doctor or specialty needed (e.g., Dermatologist, GP).',
      },
      date: {
        type: Type.STRING,
        description: 'The requested date for the appointment (YYYY-MM-DD format preferred).',
      },
      time: {
        type: Type.STRING,
        description: 'The requested time for the appointment (HH:MM format).',
      },
      reason: {
        type: Type.STRING,
        description: 'A brief reason for the visit.',
      },
    },
    required: ['specialty', 'date', 'time', 'reason'],
  },
};

let chatSession: Chat | null = null;

export const startChatSession = () => {
  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: [bookAppointmentTool] }],
    },
  });
  return chatSession;
};

// Helper to clean base64 string
const parseBase64 = (base64String: string) => {
  if (base64String.startsWith('data:')) {
    const matches = base64String.match(/^data:(.+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      return { mimeType: matches[1], data: matches[2] };
    }
  }
  return { mimeType: 'image/png', data: base64String };
};

export const sendMessageToGemini = async (
  message: string,
  imageBase64?: string,
  onToolCall?: (args: BookAppointmentArgs) => Promise<string>
): Promise<string> => {
  if (!chatSession) {
    startChatSession();
  }

  try {
    let result;

    if (imageBase64) {
      const { mimeType, data } = parseBase64(imageBase64);
      
      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: data,
        },
      };
      
      const textPart = { text: message || "Analyze this image." };
      
      result = await chatSession!.sendMessage({
        message: { parts: [imagePart, textPart] }
      });
    } else {
      result = await chatSession!.sendMessage({
        message: message,
      });
    }

    // Check for function calls
    const toolCalls = result.functionCalls;
    if (toolCalls && toolCalls.length > 0) {
      // We only support one tool for now
      const call = toolCalls[0];
      if (call.name === 'bookAppointment' && onToolCall) {
        const args = call.args as unknown as BookAppointmentArgs;
        
        // Execute the client-side logic
        const toolResultString = await onToolCall(args);

        // Send the tool response back to Gemini so it can generate a confirmation message
        const nextResponse = await chatSession!.sendMessage({
            message: {
                role: 'tool',
                parts: [{
                    functionResponse: {
                        name: 'bookAppointment',
                        response: { result: toolResultString }
                    }
                }]
            }
        });
        
        return nextResponse.text || "Appointment processed.";
      }
    }

    return result.text || "I'm listening...";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm sorry, I'm having trouble connecting to the medical database right now. Please try again.";
  }
};

/**
 * Dedicated function for generating symptom analysis reports.
 * Uses generateContent (stateless) to avoid polluting chat history.
 */
export const generateSymptomAnalysis = async (
  prompt: string,
  imageBase64?: string
): Promise<string> => {
  try {
    const parts: any[] = [];
    
    if (imageBase64) {
      const { mimeType, data } = parseBase64(imageBase64);
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: data
        }
      });
    }
    
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2, // More deterministic for analysis reports
      }
    });

    return response.text || "Unable to generate analysis report.";
  } catch (error) {
    console.error("Analysis Error:", error);
    return "I encountered an error while analyzing the symptoms. Please try again.";
  }
};

/**
 * Analyzes partial text in real-time to provide autocomplete-style medical context.
 * This uses a lightweight, separate call to avoid polluting the main chat history.
 */
export const analyzeSymptomsRealtime = async (text: string): Promise<string> => {
  if (!text || text.length < 8) return "";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a medical triage autocomplete assistant. 
      Analyze this partial input: "${text}".
      Instruction: If the text describes specific physical symptoms, output a SINGLE, VERY BRIEF phrase (max 5 words) categorizing it (e.g., "Possible tension headache", "Skin irritation signs", "Allergy indicators"). 
      If the text is conversational (hello, thanks), regarding appointments, or unclear, return NOTHING.
      Do NOT provide advice or diagnoses. Just labels.`,
      config: {
        maxOutputTokens: 20,
        temperature: 0.1,
      },
    });
    
    return response.text?.trim() || "";
  } catch (error) {
    // Fail silently for realtime features
    return "";
  }
};