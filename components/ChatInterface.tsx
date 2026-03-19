import React, { useRef, useEffect, useState } from 'react';
import { Message, Sender } from '../types';
import { Bot, User, Paperclip, Send, Loader2, AlertTriangle, ShieldCheck, Mic, X, ImageIcon, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { analyzeSymptomsRealtime } from '../services/geminiService';

interface ChatInterfaceProps {
  messages: Message[];
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  onSend: () => void;
  isLoading: boolean;
  onImageAttached: (image: string | null) => void;
  attachedImage: string | null;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  input,
  setInput,
  onSend,
  isLoading,
  onImageAttached,
  attachedImage
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, attachedImage, suggestion]);

  // Real-time analysis debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (input.trim().length > 8 && !isLoading) {
         try {
            const result = await analyzeSymptomsRealtime(input);
            setSuggestion(result || null);
         } catch(e) {
            setSuggestion(null);
         }
      } else {
        setSuggestion(null);
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [input, isLoading]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${transcript}` : transcript;
      });
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Clear suggestion when sending
      setSuggestion(null);
      onSend();
    }
  };

  // --- Image Handling Logic ---

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageAttached(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) processFile(file);
        break;
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // Determine loading text based on context
  const lastUserMsg = messages[messages.length - 1]?.sender === Sender.USER ? messages[messages.length - 1] : null;
  const isAnalyzingImage = isLoading && !!lastUserMsg?.image;

  return (
    <div 
      className={`flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative overflow-hidden transition-colors duration-200 ${isDragging ? 'bg-teal-50 dark:bg-teal-900/10' : ''}`}
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-teal-500/10 backdrop-blur-sm border-2 border-dashed border-teal-500 m-4 rounded-2xl pointer-events-none animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl flex flex-col items-center animate-bounce">
              <ImageIcon size={48} className="text-teal-600 mb-3" />
              <p className="font-bold text-lg text-teal-800 dark:text-teal-200">Drop image to attach</p>
           </div>
        </div>
      )}

      {/* Header / Disclaimer Strip */}
      <div className="bg-teal-50 dark:bg-teal-900/30 border-b border-teal-100 dark:border-teal-800 px-4 py-2 flex items-center justify-center text-xs text-teal-800 dark:text-teal-300 gap-2 text-center">
        <ShieldCheck size={14} />
        <span>Privacy-First Mode: Conversations are not stored on our servers.</span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 opacity-60">
            <Bot size={48} className="mb-4 text-teal-500 dark:text-teal-400" />
            <p className="text-lg font-medium">How can I help you today?</p>
            <p className="text-sm">Try explaining your symptoms, pasting an image, or using voice.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${
              msg.sender === Sender.USER ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`flex max-w-[85%] md:max-w-[70%] gap-3 ${
                msg.sender === Sender.USER ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.sender === Sender.USER
                    ? 'bg-indigo-600 text-white'
                    : 'bg-teal-600 text-white dark:bg-teal-700'
                }`}
              >
                {msg.sender === Sender.USER ? <User size={16} /> : <Bot size={16} />}
              </div>

              <div
                className={`flex flex-col gap-1 ${
                  msg.sender === Sender.USER ? 'items-end' : 'items-start'
                }`}
              >
                {msg.image && (
                   <div className="mb-2 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg max-w-[200px] shadow-sm">
                      <img src={msg.image} alt="User upload" className="rounded-md w-full h-auto" />
                   </div>
                )}
                
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                    msg.sender === Sender.USER
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">
                    {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start w-full">
             <div className="flex max-w-[80%] gap-3 flex-row">
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center flex-shrink-0">
                    <Bot size={16} />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-teal-600 dark:text-teal-400" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {isAnalyzingImage ? "Analyzing image..." : "PulseTalk is thinking..."}
                    </span>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.1)] z-10">
        
        {/* Suggestion Bubble */}
        {suggestion && (
            <div className="mb-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-full flex items-center gap-2 w-fit animate-in fade-in slide-in-from-bottom-2 shadow-sm cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors" onClick={() => setInput(suggestion)}>
                <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400 fill-indigo-100 dark:fill-indigo-900" />
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    Insight: <span className="font-normal">{suggestion}</span>
                </span>
            </div>
        )}

        {/* Attachment Preview */}
        {attachedImage && (
            <div className="flex items-center gap-3 mb-3 bg-slate-50 dark:bg-slate-700 p-2 rounded-lg border border-slate-200 dark:border-slate-600 w-fit animate-in fade-in slide-in-from-bottom-2">
                <div className="h-12 w-12 relative overflow-hidden rounded bg-slate-200 dark:bg-slate-600 border border-slate-300 dark:border-slate-500">
                    <img src={attachedImage} alt="Preview" className="object-cover h-full w-full" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1">
                    <ImageIcon size={10} /> Image attached
                  </span>
                  <span className="text-[10px] text-slate-400">Ready to send</span>
                </div>
                <button 
                    onClick={() => onImageAttached(null)} 
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors ml-2 group"
                    title="Remove image"
                >
                    <X size={14} className="text-slate-500 dark:text-slate-400 group-hover:text-red-500" />
                </button>
            </div>
        )}
        
        <div className="flex gap-2 items-end">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileInputChange}
          />
          <Button
            variant="secondary"
            className={`rounded-full w-10 h-10 p-0 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
              attachedImage 
                ? 'text-teal-600 border-teal-200 bg-teal-50 dark:bg-teal-900/30 dark:border-teal-700 ring-2 ring-teal-100 dark:ring-teal-900' 
                : 'dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
            onClick={() => fileInputRef.current?.click()}
            title="Attach image (Click, Paste, or Drop)"
          >
            {attachedImage ? <ImageIcon size={18} /> : <Paperclip size={18} />}
          </Button>

          <Button
            variant={isListening ? "danger" : "secondary"}
            className={`rounded-full w-10 h-10 p-0 flex items-center justify-center flex-shrink-0 ${!isListening ? 'dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600' : ''}`}
            onClick={toggleListening}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? (
              <Mic size={18} className="animate-pulse" />
            ) : (
              <Mic size={18} />
            )}
          </Button>
          
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : "Type, paste image, or drop file..."}
              className="w-full resize-none rounded-2xl border border-slate-300 dark:border-slate-600 py-3 pl-4 pr-12 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-700 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-all text-sm max-h-32 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              rows={1}
              style={{ minHeight: '44px' }}
            />
            <button
                onClick={() => {
                   setSuggestion(null);
                   onSend();
                }}
                disabled={(!input.trim() && !attachedImage) || isLoading}
                className="absolute right-2 bottom-2 p-1.5 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-600 transition-colors"
                title="Send message"
            >
                <Send size={16} />
            </button>
          </div>
        </div>
        
        {/* Disclaimer Footer */}
         <div className="mt-2 flex justify-center">
             <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <AlertTriangle size={10} />
                <span>AI can make mistakes. Always consult a professional.</span>
             </div>
         </div>
      </div>
    </div>
  );
};