import React, { useState, useEffect, useRef } from 'react';
import { Sender, Message, Appointment, BookAppointmentArgs, UserProfile, AuthUser, SystemLog } from '../types';
import { sendMessageToGemini, startChatSession, generateSymptomAnalysis } from '../services/geminiService';
import { ChatInterface } from './ChatInterface';
import { AppointmentCard } from './AppointmentCard';
import { Button } from './Button';
import { LiveAssistantModal } from './LiveAssistantModal';
import { 
  Activity, Calendar, MessageSquare, Menu, X, Plus, Save, Stethoscope, 
  UserCircle, Sun, Moon, Check, ShieldCheck, Mic2, LogOut, Pill, 
  AlertTriangle, Sparkles, Heart, Thermometer, Footprints, Upload, 
  Camera, FileText, ChevronRight, TrendingUp, TrendingDown, Minus, Edit, Languages,
  Droplet, Ruler, Scale, Phone, CreditCard, User, Users, FileBadge,
  Zap, Clock
} from 'lucide-react';
import { STORAGE_KEYS, RECEIVE_SOUND_DATA } from '../constants';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
  RadialBarChart, RadialBar, PolarAngleAxis, BarChart, Bar
} from 'recharts';

interface PatientDashboardProps {
  user: AuthUser;
  onLogout: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}

// Static Mock Data for Health Dashboard
const STATIC_METRICS = {
  wellnessScore: 88,
  heartRate: { 
    value: 72, 
    unit: 'bpm', 
    status: 'Normal', 
    trend: '+2',
    history: [
      { day: 'Mon', value: 68 }, { day: 'Tue', value: 70 }, { day: 'Wed', value: 72 }, 
      { day: 'Thu', value: 75 }, { day: 'Fri', value: 71 }, { day: 'Sat', value: 69 }, { day: 'Sun', value: 72 }
    ]
  },
  bloodPressure: { 
    sys: 118,
    dia: 78,
    unit: 'mmHg', 
    status: 'Optimal',
    trend: '-1',
    history: [
      { day: 'Mon', sys: 121, dia: 80 }, { day: 'Tue', sys: 119, dia: 79 }, { day: 'Wed', sys: 122, dia: 82 },
      { day: 'Thu', sys: 117, dia: 76 }, { day: 'Fri', sys: 120, dia: 78 }, { day: 'Sat', sys: 116, dia: 77 }, { day: 'Sun', sys: 118, dia: 78 }
    ]
  },
  temperature: { 
    value: 98.4, 
    unit: '°F', 
    status: 'Normal',
    trend: '0',
    history: [
      { day: 'Mon', value: 98.2 }, { day: 'Tue', value: 98.5 }, { day: 'Wed', value: 98.1 }, 
      { day: 'Thu', value: 98.6 }, { day: 'Fri', value: 98.3 }, { day: 'Sat', value: 98.4 }, { day: 'Sun', value: 98.4 }
    ]
  },
  sleep: { 
    value: 7.5, 
    unit: 'hrs', 
    status: 'Good',
    trend: '+0.5',
    history: [
      { day: 'Mon', value: 6.5 }, { day: 'Tue', value: 7.0 }, { day: 'Wed', value: 8.2 }, 
      { day: 'Thu', value: 6.8 }, { day: 'Fri', value: 7.5 }, { day: 'Sat', value: 8.0 }, { day: 'Sun', value: 7.5 }
    ]
  },
  steps: { 
    value: 8432, 
    unit: 'steps', 
    goal: 10000,
    trend: '+12%',
    history: [
      { day: 'Mon', value: 6500 }, { day: 'Tue', value: 8200 }, { day: 'Wed', value: 10500 }, 
      { day: 'Thu', value: 7800 }, { day: 'Fri', value: 9200 }, { day: 'Sat', value: 11200 }, { day: 'Sun', value: 8432 }
    ]
  },
};

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ user, onLogout, theme, setTheme }) => {
  // State initialization with LocalStorage
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch (e) {
        console.error("Failed to parse messages", e);
      }
    }
    return [];
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    return saved ? JSON.parse(saved) : [];
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    const defaultProfile: UserProfile = { 
        name: user.name || '', 
        age: 0, 
        gender: '',
        bloodType: '',
        height: '',
        weight: '',
        allergies: [], 
        currentMedications: [],
        chronicConditions: [],
        emergencyContact: { name: '', phone: '', relation: '' },
        insuranceProvider: '',
        insurancePolicyNumber: ''
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultProfile, ...parsed };
      } catch (e) {
        return defaultProfile;
      }
    }
    return defaultProfile;
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  
  // App view state
  const [activeTab, setActiveTab] = useState<'chat' | 'appointments' | 'profile' | 'symptom-checker' | 'health-metrics'>('health-metrics');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);

  // Manual Appointment Form State
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    doctorName: '',
    specialty: '',
    date: '',
    time: '',
    reason: ''
  });

  // Profile Form & Edit State
  const [profileForm, setProfileForm] = useState<UserProfile>(userProfile);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState(user.avatar || 'https://ui-avatars.com/api/?name=User');
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const [isProfileCameraOpen, setIsProfileCameraOpen] = useState(false);
  const profileVideoRef = useRef<HTMLVideoElement>(null);
  const profileCanvasRef = useRef<HTMLCanvasElement>(null);

  // Symptom Checker State
  const [symptomText, setSymptomText] = useState('');
  const [symptomImage, setSymptomImage] = useState<string | null>(null);
  const [symptomResult, setSymptomResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [includeHindi, setIncludeHindi] = useState(false);
  const symptomFileInputRef = useRef<HTMLInputElement>(null);

  // Camera State (Symptom Checker)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sound Refs
  const receiveAudioRef = useRef<HTMLAudioElement | null>(null);

  // Helper to add system logs
  const addSystemLog = (
    type: 'symptom_analysis' | 'live_consultation' | 'appointment' | 'system',
    details: string,
    severity: 'low' | 'medium' | 'high' = 'low'
  ) => {
    try {
      const existingLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS) || '[]');
      const newLog: SystemLog = {
        id: Date.now().toString(),
        type,
        userName: user.name,
        timestamp: new Date().toISOString(),
        details,
        severity
      };
      // Keep only last 100 logs
      const updatedLogs = [newLog, ...existingLogs].slice(0, 100);
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updatedLogs));
    } catch (e) {
      console.error("Failed to save log", e);
    }
  };

  // Log Live Session End
  useEffect(() => {
    if (!isLiveModalOpen) return;
    // When modal opens (effect triggers), return cleanup function for close
    return () => {
        addSystemLog('live_consultation', 'Voice Consultation Session ended.', 'medium');
    };
  }, [isLiveModalOpen]);

  // Initialize Audio
  useEffect(() => {
    receiveAudioRef.current = new Audio(RECEIVE_SOUND_DATA);
    receiveAudioRef.current.volume = 0.5;
  }, []);

  // Initialize Chat & Persistence
  useEffect(() => {
    startChatSession();
    if (messages.length === 0) {
      const welcomeMsg: Message = {
        id: 'welcome',
        text: `Hello ${user.name}, I'm PulseTalk. I can help you check symptoms, suggest OTC remedies, or schedule an appointment with a specialist. How are you feeling today?`,
        sender: Sender.BOT,
        timestamp: new Date()
      };
      setMessages([welcomeMsg]);
    }
  }, []); 

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(userProfile));
    setProfileForm(userProfile);
  }, [userProfile]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (profileVideoRef.current && profileVideoRef.current.srcObject) {
         const stream = profileVideoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Sound Helper
  const playSound = (type: 'receive' | 'thinking_start') => {
    try {
      if (type === 'receive') {
        receiveAudioRef.current?.play().catch(() => {});
      } else if (type === 'thinking_start') {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 600;
        gain.gain.value = 0.05;
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch (e) {
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Handlers
  const handleSymptomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSymptomImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    setTimeout(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera Error:", err);
            setIsCameraOpen(false);
            showNotification("Unable to access camera. Please check permissions.");
        }
    }, 100);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setSymptomImage(dataUrl);
            stopCamera();
        }
    }
  };

  const handleBookAppointment = async (args: BookAppointmentArgs): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const newAppointment: Appointment = {
      id: Date.now().toString(),
      doctorName: args.specialty === 'Dermatologist' ? 'Dr. James Wilson' : 'Dr. Sarah Chen',
      specialty: args.specialty,
      date: args.date,
      time: args.time,
      reason: args.reason,
      status: 'confirmed'
    };
    
    setAppointments(prev => [...prev, newAppointment]);
    addSystemLog('appointment', `Scheduled: ${args.specialty} with ${newAppointment.doctorName} on ${args.date}`, 'low');
    showNotification("Appointment scheduled successfully!");
    
    return `Appointment successfully booked with ${newAppointment.doctorName} on ${args.date} at ${args.time}. ID: ${newAppointment.id}`;
  };

  const handleCancelAppointment = (id: string) => {
    if (window.confirm("Are you sure you want to cancel and remove this appointment?")) {
      setAppointments(prev => prev.filter(apt => apt.id !== id));
      addSystemLog('appointment', `Appointment ${id} cancelled by user.`, 'low');
      showNotification("Appointment removed.");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.doctorName || !manualForm.date || !manualForm.time) return;

    const newAppointment: Appointment = {
      id: Date.now().toString(),
      doctorName: manualForm.doctorName,
      specialty: manualForm.specialty || 'General Practice',
      date: manualForm.date,
      time: manualForm.time,
      reason: manualForm.reason || 'Check-up',
      status: 'confirmed'
    };

    setAppointments(prev => [...prev, newAppointment]);
    addSystemLog('appointment', `Manual booking: ${manualForm.specialty} on ${manualForm.date}`, 'low');
    setManualForm({ doctorName: '', specialty: '', date: '', time: '', reason: '' });
    setShowManualForm(false);
    showNotification("Appointment added manually.");
  };

  // --- Profile Logic ---
  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startProfileCamera = async () => {
    setIsProfileCameraOpen(true);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (profileVideoRef.current) {
          profileVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        showNotification("Camera access denied");
        setIsProfileCameraOpen(false);
      }
    }, 100);
  };

  const stopProfileCamera = () => {
    if (profileVideoRef.current?.srcObject) {
       const stream = profileVideoRef.current.srcObject as MediaStream;
       stream.getTracks().forEach(t => t.stop());
    }
    setIsProfileCameraOpen(false);
  };

  const captureProfilePhoto = () => {
    if (profileVideoRef.current && profileCanvasRef.current) {
       const video = profileVideoRef.current;
       const canvas = profileCanvasRef.current;
       canvas.width = video.videoWidth;
       canvas.height = video.videoHeight;
       const ctx = canvas.getContext('2d');
       if (ctx) {
         ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
         setProfileAvatar(canvas.toDataURL('image/jpeg', 0.8));
         stopProfileCamera();
       }
    }
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setUserProfile(profileForm);
    setIsEditingProfile(false);
    
    // Persist Avatar Hack (Update local storage user so it persists on reload)
    const storedUser = localStorage.getItem('pulsetalk_auth_user');
    if (storedUser) {
        const u = JSON.parse(storedUser);
        u.avatar = profileAvatar;
        u.name = profileForm.name;
        localStorage.setItem('pulsetalk_auth_user', JSON.stringify(u));
    }

    addSystemLog('system', 'User profile updated.', 'low');
    showNotification("Profile updated successfully.");
  };

  const handleAnalyzeMeds = () => {
    if (userProfile.currentMedications.length === 0) {
      showNotification("No medications listed to analyze.");
      return;
    }
    
    setActiveTab('chat');
    const prompt = `Please check my current medications for any potential interactions with each other or with my allergies.\n\nMy Medications: ${userProfile.currentMedications.join(', ')}\nMy Allergies: ${userProfile.allergies.join(', ') || 'None'}\n\nPlease provide a safety summary.`;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      text: prompt,
      sender: Sender.USER,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    
    sendMessageToGemini(prompt, undefined, handleBookAppointment)
      .then(response => {
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          text: response,
          sender: Sender.BOT,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
        playSound('receive');
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  };

  const handleAnalyzeSymptom = async () => {
    if (!symptomText && !symptomImage) {
      showNotification("Please provide a description or an image.");
      return;
    }

    setIsAnalyzing(true);
    setSymptomResult(null);

    try {
      const allergiesStr = userProfile.allergies.length > 0 ? userProfile.allergies.join(', ') : 'Unknown';
      const medsStr = userProfile.currentMedications && userProfile.currentMedications.length > 0 ? userProfile.currentMedications.join(', ') : 'None listed';

      let prompt = `
        [ROLE: Medical Triage Assistant]
        [TASK: Analyze the provided symptom description and/or image.]
        
        PATIENT PROFILE:
        - Age/Gender: ${userProfile.age || 'Unknown'} / ${userProfile.gender || 'Unknown'}
        - Allergies: ${allergiesStr}
        - Current Meds: ${medsStr}
        - Conditions: ${userProfile.chronicConditions && userProfile.chronicConditions.length > 0 ? userProfile.chronicConditions.join(', ') : 'None'}
        
        USER INPUT:
        - Description: "${symptomText}"
        - Has Image: ${symptomImage ? 'Yes' : 'No'}
        
        ${includeHindi ? `
        [LANGUAGE CONFIGURATION]
        Generate the report in BOTH English and Hindi (Bilingual).
        For every section (Potential Condition, Clinical Analysis, etc.), provide the English text first, immediately followed by the Hindi translation.
        Ensure medical terms are explained clearly in Hindi.
        ` : ''}

        OUTPUT FORMAT (Strictly adhere to this layout):
        ## Potential Condition
        [Name of possible condition(s) based on visual/text evidence]
        ${includeHindi ? '(Hindi Translation)' : ''}

        ## Clinical Analysis
        [Detailed observation of symptoms, visual characteristics if image provided, and potential causes.]
        ${includeHindi ? '(Hindi Translation)' : ''}

        ## Suggested OTC Treatments
        [List 2-3 specific Over-The-Counter suggestions. 
         IMPORTANT: Check against Patient Profile. If patient takes ${medsStr}, check for interactions. If patient has ${allergiesStr} allergy, check for contraindications.
         If an interaction exists, output "WARNING: [Drug] interacts with [Patient Med]".]
        ${includeHindi ? '(Hindi Translation)' : ''}

        ## Urgency Level
        [Low / Medium / High - with brief reasoning]
        ${includeHindi ? '(Hindi Translation)' : ''}

        ## Disclaimer
        [Standard medical disclaimer]
        ${includeHindi ? '(Hindi Translation)' : ''}
      `;

      // Use the dedicated generation function for the report
      const response = await generateSymptomAnalysis(prompt, symptomImage || undefined);
      setSymptomResult(response);

      // Log for Admin
      const severity = response.toLowerCase().includes('high urgency') ? 'high' : response.toLowerCase().includes('medium urgency') ? 'medium' : 'low';
      addSystemLog(
        'symptom_analysis', 
        `User analyzed symptoms: "${symptomText.substring(0, 50)}...". Result snippet: ${response.substring(0, 50)}...`, 
        severity
      );

    } catch (error) {
      console.error(error);
      setSymptomResult("Error analyzing symptoms. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedImage) || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      image: attachedImage || undefined,
      sender: Sender.USER,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    playSound('thinking_start');

    const currentInput = input;
    const currentImage = attachedImage;
    
    setInput('');
    setAttachedImage(null);

    try {
      let promptToSend = currentInput;
      const allergiesStr = userProfile.allergies.length > 0 ? userProfile.allergies.join(', ') : 'Unknown';
      const medsStr = userProfile.currentMedications && userProfile.currentMedications.length > 0 ? userProfile.currentMedications.join(', ') : 'None listed';
      
      const profileContext = `\n\n[USER CONTEXT: Name: ${userProfile.name || 'Unknown'}, Age: ${userProfile.age || 'Unknown'}, Gender: ${userProfile.gender || 'Unknown'}, Allergies: ${allergiesStr}, Current Medications: ${medsStr}. CRITICAL: Check for interactions.]`;
      promptToSend += profileContext;

      if (currentImage) {
        promptToSend += `\n\n[SYSTEM INSTRUCTION: Analyze image for skin conditions/abnormalities. Describe visual characteristics. Identify potential conditions. MANDATORY DISCLAIMER: "AI visual analysis is not a diagnosis."]`;
      }

      const responseText = await sendMessageToGemini(promptToSend, currentImage || undefined, handleBookAppointment);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: Sender.BOT,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
      playSound('receive');
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "I encountered a temporary error. Please try again.",
        sender: Sender.BOT,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to render structured symptom results
  const renderSymptomResult = (result: string) => {
    const sections = result.split(/(?=## )/g);
    
    return sections.map((section, index) => {
      const trimmed = section.trim();
      if (!trimmed) return null;
      
      const lines = trimmed.split('\n');
      const titleLine = lines[0].replace('## ', '').trim();
      const content = lines.slice(1).join('\n').trim();

      if (titleLine.toLowerCase().includes('otc treatments') || titleLine.toLowerCase().includes('treatments')) {
        return (
          <div key={index} className="my-6 p-5 bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-500 rounded-r-xl shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
             <h4 className="flex items-center gap-2 text-lg font-bold text-indigo-800 dark:text-indigo-300 mb-3">
               <Pill className="text-indigo-600 dark:text-indigo-400" size={20} />
               {titleLine}
             </h4>
             <div className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
               {content}
             </div>
          </div>
        );
      }

      if (titleLine.toLowerCase().includes('urgency')) {
         let urgencyColor = 'bg-slate-100 text-slate-800 border-slate-300';
         if (content.toLowerCase().includes('high')) urgencyColor = 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800';
         else if (content.toLowerCase().includes('medium')) urgencyColor = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800';
         else if (content.toLowerCase().includes('low')) urgencyColor = 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800';

         return (
           <div key={index} className={`my-4 p-4 rounded-xl border ${urgencyColor} flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4`}>
              <h4 className="font-bold shrink-0 flex items-center gap-2 uppercase tracking-wide text-xs">
                 <Activity size={16} /> {titleLine}
              </h4>
              <div className="font-medium whitespace-pre-wrap">{content}</div>
           </div>
         );
      }
      
      if (titleLine.toLowerCase().includes('disclaimer')) {
         return (
            <div key={index} className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500 italic">
               <span className="font-bold not-italic mr-1">{titleLine}:</span> {content}
            </div>
         )
      }

      return (
        <div key={index} className="mb-6">
           <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              {titleLine.includes('Condition') && <FileText size={20} className="text-teal-500" />}
              {titleLine.includes('Analysis') && <Sparkles size={20} className="text-teal-500" />}
              {titleLine}
           </h4>
           <div className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {content}
           </div>
        </div>
      );
    });
  };

  const TrendIndicator = ({ value, label }: { value: string, label?: string }) => {
    const isPositive = value.startsWith('+');
    const isNeutral = value === '0';
    return (
        <div className={`flex items-center gap-1 text-xs font-bold ${isNeutral ? 'text-slate-400' : isPositive ? 'text-green-500' : 'text-amber-500'}`}>
            {isPositive ? <TrendingUp size={14} /> : isNeutral ? <Minus size={14} /> : <TrendingDown size={14} />}
            <span>{value}</span>
            {label && <span className="text-slate-400 font-normal ml-1">{label}</span>}
        </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Live Assistant Modal */}
      {isLiveModalOpen && (
        <LiveAssistantModal 
          onClose={() => setIsLiveModalOpen(false)} 
          onBookAppointment={handleBookAppointment}
          userProfile={userProfile}
        />
      )}

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
          <div className="bg-teal-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-medium">
            <Check size={18} />
            {notification}
          </div>
        </div>
      )}

      {/* Sidebar (Desktop) */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800">
            <div className="bg-teal-600 p-1.5 rounded-lg mr-2">
              <Activity className="text-white h-5 w-5" />
            </div>
            <span className="font-bold text-xl text-slate-800 dark:text-slate-100 tracking-tight">PulseTalk</span>
            <button className="md:hidden ml-auto" onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6 text-slate-500" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button 
              onClick={() => { setIsLiveModalOpen(true); setSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md hover:shadow-lg hover:from-red-600 hover:to-rose-700 mb-4"
            >
              <Mic2 size={18} className="animate-pulse" />
              Live Consultation
            </button>

            <button 
              onClick={() => { setActiveTab('health-metrics'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'health-metrics' ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <Activity size={18} />
              Health Dashboard
            </button>

             <button 
              onClick={() => { setActiveTab('symptom-checker'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'symptom-checker' ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <Stethoscope size={18} />
              Symptom Checker
            </button>

            <button 
              onClick={() => { setActiveTab('chat'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'chat' ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <MessageSquare size={18} />
              Chat Assistant
            </button>
            <button 
              onClick={() => { setActiveTab('appointments'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'appointments' ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <Calendar size={18} />
              Appointments
              {appointments.filter(a => a.status !== 'cancelled').length > 0 && (
                <span className="ml-auto bg-teal-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                  {appointments.filter(a => a.status !== 'cancelled').length}
                </span>
              )}
            </button>
            <button 
              onClick={() => { setActiveTab('profile'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <UserCircle size={18} />
              My Profile
            </button>
          </nav>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
             <button
               onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
               className="w-full flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
             >
               <div className="flex items-center gap-2">
                 {theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}
                 <span>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
               </div>
               <div className={`w-10 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-teal-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
               </div>
             </button>

            {/* Profile / Logout */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-3">
              <img src={user.avatar} alt="Avatar" className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">Patient Account</p>
              </div>
              <button 
                onClick={onLogout}
                className="text-slate-400 hover:text-red-500 transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative w-full bg-slate-50 dark:bg-slate-900 transition-colors">
        {/* Mobile Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:hidden shrink-0">
           <div className="flex items-center gap-2">
              <div className="bg-teal-600 p-1.5 rounded-lg">
                <Activity className="text-white h-4 w-4" />
              </div>
              <span className="font-bold text-lg text-slate-800 dark:text-slate-100">PulseTalk</span>
           </div>
           <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-600 dark:text-slate-400">
             <Menu size={24} />
           </button>
        </header>

        {/* View Switcher */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* --- HEALTH DASHBOARD --- */}
          {activeTab === 'health-metrics' && (
             <div className="h-full overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
               <div className="max-w-5xl mx-auto space-y-6">
                 <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        Health Dashboard
                      </h2>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Weekly physiological overview and trends.</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Clock size={14} />
                        <span>Last updated: Just now</span>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Wellness Score Card */}
                    <div className="md:col-span-1 bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group h-64">
                        <h3 className="text-slate-500 dark:text-slate-400 font-medium mb-1 z-10 text-sm uppercase tracking-wide">Overall Wellness</h3>
                        <div className="h-40 w-full relative z-10 flex items-center justify-center">
                           <ResponsiveContainer width="100%" height="100%">
                              <RadialBarChart 
                                cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={15} 
                                data={[{ name: 'Score', value: STATIC_METRICS.wellnessScore, fill: '#0d9488' }]} 
                                startAngle={180} endAngle={0}
                              >
                                <RadialBar
                                  background={{ fill: theme === 'dark' ? '#334155' : '#e2e8f0' }}
                                  dataKey="value"
                                  cornerRadius={10}
                                />
                                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                              </RadialBarChart>
                           </ResponsiveContainer>
                           <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/3 flex flex-col items-center">
                              <span className="text-4xl font-bold text-slate-900 dark:text-white">{STATIC_METRICS.wellnessScore}</span>
                              <span className="text-xs text-green-500 font-bold uppercase tracking-wider bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full mt-1">Excellent</span>
                           </div>
                        </div>
                        <p className="text-center text-xs text-slate-400 mt-[-20px] z-10 px-4">Calculated based on your weekly activity and vitals stability.</p>
                    </div>

                    {/* Vitals Grid */}
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Heart Rate */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-64 relative overflow-hidden">
                           <div className="flex justify-between items-start mb-2">
                              <div className="bg-rose-100 dark:bg-rose-900/20 p-2 rounded-lg text-rose-600 dark:text-rose-400">
                                 <Heart size={20} />
                              </div>
                              <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full dark:bg-green-900/20 dark:text-green-400">{STATIC_METRICS.heartRate.status}</span>
                           </div>
                           <h4 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Avg Heart Rate</h4>
                           <div className="flex items-end gap-2 mt-1 mb-4">
                              <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">{STATIC_METRICS.heartRate.value}</span>
                              <span className="text-xs text-slate-500 mb-1">{STATIC_METRICS.heartRate.unit}</span>
                              <div className="ml-auto mb-1">
                                <TrendIndicator value={STATIC_METRICS.heartRate.trend} label="vs last week" />
                              </div>
                           </div>
                           <div className="flex-1 w-full -ml-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={STATIC_METRICS.heartRate.history}>
                                  <defs>
                                    <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="day" hide />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', borderRadius: '8px', border: '1px solid #334155', fontSize: '12px' }}
                                    itemStyle={{ color: theme === 'dark' ? '#e2e8f0' : '#334155' }}
                                    labelStyle={{ display: 'none' }}
                                    formatter={(val: number) => [Math.round(val), 'BPM']}
                                  />
                                  <Area type="monotone" dataKey="value" stroke="#f43f5e" fillOpacity={1} fill="url(#colorHr)" strokeWidth={2} />
                                </AreaChart>
                              </ResponsiveContainer>
                           </div>
                        </div>

                        {/* Blood Pressure */}
                         <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-64">
                           <div className="flex justify-between items-start mb-2">
                              <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                                 <Activity size={20} />
                              </div>
                              <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full dark:bg-green-900/20 dark:text-green-400">{STATIC_METRICS.bloodPressure.status}</span>
                           </div>
                           <h4 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Blood Pressure</h4>
                           <div className="flex items-end gap-2 mt-1 mb-4">
                              <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                                {STATIC_METRICS.bloodPressure.sys}/{STATIC_METRICS.bloodPressure.dia}
                              </span>
                              <span className="text-xs text-slate-500 mb-1">{STATIC_METRICS.bloodPressure.unit}</span>
                              <div className="ml-auto mb-1">
                                <TrendIndicator value={STATIC_METRICS.bloodPressure.trend} label="vs last week" />
                              </div>
                           </div>
                           <div className="flex-1 w-full -ml-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={STATIC_METRICS.bloodPressure.history}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                  <XAxis dataKey="day" hide />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', borderRadius: '8px', border: '1px solid #334155', fontSize: '12px' }}
                                    labelStyle={{ display: 'none' }}
                                  />
                                  <Line type="monotone" dataKey="sys" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                  <Line type="monotone" dataKey="dia" stroke="#60a5fa" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                           </div>
                        </div>

                        {/* Sleep */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-64">
                           <div className="flex justify-between items-start mb-2">
                              <div className="bg-indigo-100 dark:bg-indigo-900/20 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                                 <Moon size={20} />
                              </div>
                              <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full dark:bg-green-900/20 dark:text-green-400">{STATIC_METRICS.sleep.status}</span>
                           </div>
                           <h4 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Sleep Duration</h4>
                           <div className="flex items-end gap-2 mt-1 mb-4">
                              <span className="text-3xl font-bold text-slate-900 dark:text-white">{STATIC_METRICS.sleep.value}</span>
                              <span className="text-xs text-slate-500 mb-1">{STATIC_METRICS.sleep.unit}</span>
                              <div className="ml-auto mb-1">
                                <TrendIndicator value={STATIC_METRICS.sleep.trend} label="avg" />
                              </div>
                           </div>
                           <div className="flex-1 w-full -ml-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={STATIC_METRICS.sleep.history}>
                                  <Tooltip 
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', borderRadius: '8px', border: '1px solid #334155', fontSize: '12px' }}
                                  />
                                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                              </ResponsiveContainer>
                           </div>
                        </div>

                         {/* Steps */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-64">
                           <div className="flex justify-between items-start mb-2">
                              <div className="bg-amber-100 dark:bg-amber-900/20 p-2 rounded-lg text-amber-600 dark:text-amber-400">
                                 <Footprints size={20} />
                              </div>
                              <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded-full dark:bg-slate-700 dark:text-slate-300">Goal: 10k</span>
                           </div>
                           <h4 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Daily Steps</h4>
                           <div className="flex items-end gap-2 mt-1 mb-4">
                              <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">{STATIC_METRICS.steps.value.toLocaleString()}</span>
                              <span className="text-xs text-slate-500 mb-1">{STATIC_METRICS.steps.unit}</span>
                              <div className="ml-auto mb-1">
                                <TrendIndicator value={STATIC_METRICS.steps.trend} />
                              </div>
                           </div>
                           <div className="flex-1 w-full -ml-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={STATIC_METRICS.steps.history}>
                                  <defs>
                                    <linearGradient id="colorSteps" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="day" hide />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', borderRadius: '8px', border: '1px solid #334155', fontSize: '12px' }}
                                  />
                                  <Area type="monotone" dataKey="value" stroke="#f59e0b" fillOpacity={1} fill="url(#colorSteps)" strokeWidth={2} />
                                </AreaChart>
                              </ResponsiveContainer>
                           </div>
                        </div>

                        {/* Temperature */}
                        <div className="col-span-1 sm:col-span-2 bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-teal-100 dark:bg-teal-900/20 p-2 rounded-lg text-teal-600 dark:text-teal-400">
                                   <Thermometer size={20} />
                                </div>
                                <div>
                                   <h4 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Body Temperature</h4>
                                   <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{STATIC_METRICS.temperature.value} {STATIC_METRICS.temperature.unit}</p>
                                </div>
                            </div>
                            <div className="h-16 w-40">
                               <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={STATIC_METRICS.temperature.history}>
                                     <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={true} />
                                  </LineChart>
                               </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                 </div>
               </div>
             </div>
          )}

          {/* --- SYMPTOM CHECKER --- */}
          {activeTab === 'symptom-checker' && (
            <div className="h-full overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
              <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                 
                 {/* Left Column: Input */}
                 <div className="flex flex-col gap-6">
                    // ... (rest of symptom checker UI remains same)
                    // Just wrapping content to focus on logic changes in this block
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Symptom Checker</h2>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">AI-powered visual and text analysis for preliminary insights.</p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">1. Describe your symptoms</label>
                       <textarea 
                          className="w-full h-32 rounded-xl border border-slate-300 dark:border-slate-600 p-4 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50 dark:bg-slate-700 dark:text-white resize-none"
                          placeholder="e.g. I have a red itchy rash on my arm that started 2 days ago. It feels warm to the touch..."
                          value={symptomText}
                          onChange={(e) => setSymptomText(e.target.value)}
                       />

                       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mt-6 mb-3">2. Upload an image (Optional)</label>
                       
                       {isCameraOpen ? (
                          <div className="relative w-full h-64 bg-slate-900 rounded-xl overflow-hidden flex flex-col items-center justify-center border border-slate-700 mb-2">
                              <video 
                                  ref={videoRef} 
                                  className="absolute inset-0 w-full h-full object-cover" 
                                  autoPlay 
                                  playsInline 
                                  muted 
                              />
                              <canvas ref={canvasRef} className="hidden" />
                              
                              <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6 z-20">
                                  <button 
                                      onClick={stopCamera} 
                                      className="p-3 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition-colors backdrop-blur-sm"
                                      title="Cancel"
                                  >
                                      <X size={24} />
                                  </button>
                                  <button 
                                      onClick={capturePhoto} 
                                      className="p-1 rounded-full border-4 border-white/30 hover:border-white/50 transition-colors"
                                      title="Capture"
                                  >
                                      <div className="w-14 h-14 bg-white rounded-full border-4 border-transparent"></div>
                                  </button>
                              </div>
                          </div>
                       ) : (
                          <div className="relative group">
                              <input 
                                  type="file" 
                                  accept="image/*"
                                  onChange={handleSymptomImageUpload}
                                  className="hidden"
                                  ref={symptomFileInputRef}
                                />
                              
                              <div 
                                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${symptomImage ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/10' : 'border-slate-300 dark:border-slate-600 hover:border-teal-400 dark:hover:border-teal-500'}`}
                                onClick={() => symptomFileInputRef.current?.click()}
                              >
                                {symptomImage ? (
                                    <div className="relative w-full h-48 rounded-lg overflow-hidden group/image">
                                      <img src={symptomImage} alt="Symptom" className="w-full h-full object-contain" />
                                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity z-20 gap-3">
                                          <p className="text-white font-medium text-sm">Change Image</p>
                                          <div className="flex gap-2">
                                              <button 
                                                  onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      symptomFileInputRef.current?.click();
                                                  }} 
                                                  className="px-4 py-2 bg-white text-slate-900 rounded-lg text-xs font-bold hover:bg-slate-100 flex items-center gap-2"
                                              >
                                                  <Upload size={14}/> Upload
                                              </button>
                                              <button 
                                                  onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      startCamera();
                                                  }}
                                                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 flex items-center gap-2"
                                              >
                                                  <Camera size={14}/> Camera
                                              </button>
                                          </div>
                                      </div>
                                    </div>
                                ) : (
                                    <>
                                      <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-full mb-3 text-slate-500 dark:text-slate-300">
                                        <Upload size={24} />
                                      </div>
                                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Click to upload or drag & drop</p>
                                      <p className="text-xs text-slate-400 mt-1 mb-4">SVG, PNG, JPG or GIF (max. 800x400px)</p>
                                      
                                      <div className="flex items-center gap-2 w-full max-w-[200px]">
                                          <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                                          <span className="text-[10px] text-slate-400 font-bold uppercase">OR</span>
                                          <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                                      </div>

                                      <button 
                                          type="button"
                                          onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation(); 
                                              startCamera();
                                          }}
                                          className="mt-4 relative z-20 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-full text-sm font-semibold shadow-md shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                                      >
                                          <Camera size={16} /> Use Camera
                                      </button>
                                    </>
                                )}
                              </div>
                          </div>
                       )}
                       
                       <button
                          type="button"
                          onClick={() => setIncludeHindi(!includeHindi)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wide transition-all mb-4 w-full justify-center ${
                            includeHindi 
                              ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                          }`}
                       >
                          <Languages size={16} />
                          {includeHindi ? 'English & Hindi Output Enabled' : 'Enable English & Hindi Output'}
                       </button>

                       <Button 
                          onClick={handleAnalyzeSymptom} 
                          className="w-full py-3 text-base flex items-center justify-center gap-2"
                          disabled={isAnalyzing || (!symptomText && !symptomImage) || isCameraOpen}
                          isLoading={isAnalyzing}
                       >
                          {isAnalyzing ? "Analyzing..." : <><Sparkles size={18} /> Analyze Condition</>}
                       </Button>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl flex gap-3">
                       <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                       <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                          <strong>Privacy Notice:</strong> Images are processed securely and not stored permanently. 
                          This tool does not provide a medical diagnosis. In case of emergency, call 911.
                       </p>
                    </div>
                 </div>

                 {/* Right Column: Result */}
                 <div className="flex flex-col h-full">
                    {symptomResult ? (
                       <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
                          <div className="bg-teal-600 px-6 py-4 flex items-center justify-between">
                             <h3 className="text-white font-bold flex items-center gap-2">
                                <FileText size={20} /> Analysis Report
                             </h3>
                             <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">AI Generated</span>
                          </div>
                          <div className="p-6 overflow-y-auto flex-1">
                             {renderSymptomResult(symptomResult)}
                          </div>
                          <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                             <Button 
                               onClick={() => setActiveTab('appointments')}
                               className="w-full" variant="secondary"
                             >
                               Schedule Appointment for this
                             </Button>
                          </div>
                       </div>
                    ) : (
                       <div className="h-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/50 dark:bg-slate-800/50">
                          <Activity size={48} className="mb-4 opacity-20" />
                          <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400">Ready to Analyze</h3>
                          <p className="text-sm max-w-xs mt-2">Fill in the details on the left and click "Analyze Condition" to generate a comprehensive report.</p>
                       </div>
                    )}
                 </div>

              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <ChatInterface 
              messages={messages}
              input={input}
              setInput={setInput}
              onSend={handleSend}
              isLoading={isLoading}
              onImageAttached={setAttachedImage}
              attachedImage={attachedImage}
            />
          )}
          
          {activeTab === 'appointments' && (
            <div className="h-full overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
              <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Your Appointments</h2>
                  <button 
                    onClick={() => setShowManualForm(!showManualForm)}
                    className="flex items-center gap-2 text-sm text-white bg-teal-600 px-4 py-2 rounded-lg font-medium hover:bg-teal-700 transition-colors"
                  >
                    {showManualForm ? <X size={16} /> : <Plus size={16} />}
                    {showManualForm ? 'Cancel' : 'Schedule New'}
                  </button>
                </div>

                {/* Manual Appointment Form */}
                {showManualForm && (
                  <div className="mb-8 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <Stethoscope size={20} className="text-teal-600" />
                      Add Appointment Details
                    </h3>
                    <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Doctor Name</label>
                        <input 
                          type="text" 
                          required
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 dark:text-white"
                          value={manualForm.doctorName}
                          onChange={e => setManualForm({...manualForm, doctorName: e.target.value})}
                          placeholder="e.g. Dr. Smith"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Specialty</label>
                        <input 
                          type="text" 
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 dark:text-white"
                          value={manualForm.specialty}
                          onChange={e => setManualForm({...manualForm, specialty: e.target.value})}
                          placeholder="e.g. Dermatology"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                        <input 
                          type="date" 
                          required
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 dark:text-white"
                          value={manualForm.date}
                          onChange={e => setManualForm({...manualForm, date: e.target.value})}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time</label>
                        <input 
                          type="time" 
                          required
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 dark:text-white"
                          value={manualForm.time}
                          onChange={e => setManualForm({...manualForm, time: e.target.value})}
                        />
                      </div>
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason for Visit</label>
                        <input 
                          type="text" 
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 dark:text-white"
                          value={manualForm.reason}
                          onChange={e => setManualForm({...manualForm, reason: e.target.value})}
                          placeholder="Brief description of symptoms or purpose"
                        />
                      </div>
                      <div className="col-span-1 md:col-span-2 flex justify-end gap-2 mt-2">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          onClick={() => setShowManualForm(false)}
                          className="dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          Cancel
                        </Button>
                        <Button type="submit" className="flex items-center gap-2">
                          <Save size={16} /> Save Appointment
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {appointments.length === 0 && !showManualForm ? (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center flex flex-col items-center">
                    <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-full mb-4">
                        <Calendar size={32} className="text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No appointments yet</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-xs">Chat with our assistant to find a suitable time or add one manually.</p>
                    <div className="flex gap-3">
                      <button 
                          onClick={() => setActiveTab('chat')}
                          className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                      >
                          Go to Chat
                      </button>
                      <button 
                          onClick={() => setShowManualForm(true)}
                          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                      >
                          Add Manually
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 pb-10">
                    {appointments.sort((a,b) => b.id.localeCompare(a.id)).map(apt => (
                      <AppointmentCard key={apt.id} appointment={apt} onCancel={handleCancelAppointment} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
             <div className="h-full overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
               <div className="max-w-4xl mx-auto pb-10">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                       <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Personal Health Profile</h2>
                       <p className="text-sm text-slate-500 dark:text-slate-400">Manage your medical identity and critical information.</p>
                    </div>
                    {!isEditingProfile && (
                      <Button onClick={() => setIsEditingProfile(true)} className="flex items-center gap-2">
                        <Edit size={16} /> Edit Profile
                      </Button>
                    )}
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
                    {/* Read Only View */}
                    {!isEditingProfile ? (
                       <div className="space-y-10">
                          {/* Header Section */}
                          <div className="flex flex-col md:flex-row gap-8 items-start">
                             <div className="shrink-0 relative">
                                <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-slate-50 dark:border-slate-700 shadow-md">
                                  <img src={profileAvatar || user.avatar} alt="Profile" className="object-cover w-full h-full" />
                                </div>
                             </div>
                             
                             <div className="flex-1 w-full">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                   <div>
                                      <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{profileForm.name}</h3>
                                      <div className="flex items-center gap-3 mt-2">
                                         <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold uppercase tracking-wide">
                                            {profileForm.gender || 'Gender not set'}
                                         </span>
                                         <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold uppercase tracking-wide">
                                            {profileForm.age > 0 ? `${profileForm.age} years` : 'Age not set'}
                                         </span>
                                      </div>
                                   </div>
                                </div>

                                {/* Vitals Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                   <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                      <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                                         <Droplet size={16} /> <span className="text-xs font-bold uppercase tracking-wider">Blood Type</span>
                                      </div>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">{profileForm.bloodType || '--'}</p>
                                   </div>
                                   <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                      <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                                         <Ruler size={16} /> <span className="text-xs font-bold uppercase tracking-wider">Height</span>
                                      </div>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">{profileForm.height || '--'}</p>
                                   </div>
                                   <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                      <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                                         <Scale size={16} /> <span className="text-xs font-bold uppercase tracking-wider">Weight</span>
                                      </div>
                                      <p className="text-lg font-bold text-slate-900 dark:text-white">{profileForm.weight || '--'}</p>
                                   </div>
                                </div>
                             </div>
                          </div>
                          
                          {/* Medical Details */}
                          <div className="pt-8 border-t border-slate-100 dark:border-slate-700">
                             <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                <Stethoscope className="text-teal-600" size={20} /> Medical History
                             </h4>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div>
                                   <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Chronic Conditions</p>
                                   {profileForm.chronicConditions && profileForm.chronicConditions.length > 0 ? (
                                      <ul className="space-y-2">
                                         {profileForm.chronicConditions.map((c, i) => (
                                            <li key={i} className="flex items-center gap-2 text-slate-700 dark:text-slate-200 text-sm">
                                               <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div> {c}
                                            </li>
                                         ))}
                                      </ul>
                                   ) : <p className="text-sm text-slate-400 italic">None listed</p>}
                                </div>
                                <div>
                                   <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Allergies</p>
                                   <div className="flex flex-wrap gap-2">
                                      {profileForm.allergies.length > 0 ? profileForm.allergies.map((a, i) => (
                                         <span key={i} className="px-3 py-1 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-full text-sm font-medium border border-red-100 dark:border-red-800">
                                            {a}
                                         </span>
                                      )) : <p className="text-sm text-slate-400 italic">None listed</p>}
                                   </div>
                                </div>
                                <div>
                                   <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Current Meds</p>
                                   {profileForm.currentMedications.length > 0 ? (
                                      <ul className="space-y-2">
                                         {profileForm.currentMedications.map((m, i) => (
                                            <li key={i} className="flex items-center gap-2 text-slate-700 dark:text-slate-200 text-sm">
                                               <Pill size={14} className="text-indigo-500" /> {m}
                                            </li>
                                         ))}
                                      </ul>
                                   ) : <p className="text-sm text-slate-400 italic">None listed</p>}
                                </div>
                             </div>
                          </div>

                          {/* Contact & Insurance */}
                          <div className="pt-8 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-8">
                               <div>
                                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                     <ShieldCheck className="text-indigo-600" size={20} /> Emergency Contact
                                  </h4>
                                  <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                     {profileForm.emergencyContact?.name ? (
                                        <div className="space-y-2">
                                           <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                                              <User size={16} /> {profileForm.emergencyContact.name} 
                                              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({profileForm.emergencyContact.relation})</span>
                                           </div>
                                           <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                              <Phone size={14} /> {profileForm.emergencyContact.phone}
                                           </div>
                                        </div>
                                     ) : <p className="text-sm text-slate-400 italic">No contact set</p>}
                                  </div>
                               </div>

                               <div>
                                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                     <FileBadge className="text-blue-600" size={20} /> Insurance Info
                                  </h4>
                                  <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                      {profileForm.insuranceProvider ? (
                                         <div className="space-y-2">
                                            <div className="font-bold text-slate-900 dark:text-white">
                                               {profileForm.insuranceProvider}
                                            </div>
                                            <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                               <CreditCard size={14} /> ID: <span className="font-mono">{profileForm.insurancePolicyNumber || 'N/A'}</span>
                                            </div>
                                         </div>
                                      ) : <p className="text-sm text-slate-400 italic">No insurance info</p>}
                                  </div>
                               </div>
                          </div>
                       </div>
                    ) : (
                       // Edit Form
                       <form onSubmit={handleProfileSave} className="space-y-8 animate-in fade-in duration-300">
                          
                          {/* Avatar Upload UI */}
                          <div className="flex justify-center mb-6">
                             {isProfileCameraOpen ? (
                                // Camera UI
                                <div className="relative w-40 h-40 bg-slate-900 rounded-full overflow-hidden flex items-center justify-center border-4 border-slate-200 dark:border-slate-700">
                                   <video ref={profileVideoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted />
                                   <canvas ref={profileCanvasRef} className="hidden" />
                                   <button type="button" onClick={captureProfilePhoto} className="absolute bottom-4 z-20 p-2 bg-white rounded-full text-slate-900 shadow-lg hover:scale-105 transition-transform"><Camera size={20}/></button>
                                   <button type="button" onClick={stopProfileCamera} className="absolute top-4 right-4 z-20 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"><X size={16}/></button>
                                </div>
                             ) : (
                                 <div className="relative group">
                                     <div className="h-40 w-40 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-700 shadow-sm bg-slate-100 dark:bg-slate-800">
                                        <img src={profileAvatar || user.avatar} alt="Profile" className="object-cover w-full h-full" />
                                     </div>
                                     <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => profileFileInputRef.current?.click()}>
                                        <Camera className="text-white" size={24} />
                                     </div>
                                     <input type="file" ref={profileFileInputRef} className="hidden" accept="image/*" onChange={handleProfileImageUpload} />
                                     
                                     <div className="absolute -bottom-2 -right-2 flex gap-1">
                                        <button type="button" onClick={() => profileFileInputRef.current?.click()} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-teal-600"><Upload size={16}/></button>
                                        <button type="button" onClick={startProfileCamera} className="p-2 bg-teal-600 rounded-full shadow-md text-white hover:bg-teal-700"><Camera size={16}/></button>
                                     </div>
                                 </div>
                             )}
                          </div>

                          {/* Personal Info Section */}
                          <div className="bg-white dark:bg-slate-800 rounded-xl">
                             <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Personal Information</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="col-span-1 md:col-span-2">
                                   <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Full Name</label>
                                   <input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full rounded-lg border px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Age</label>
                                    <input type="number" value={profileForm.age} onChange={e => setProfileForm({...profileForm, age: parseInt(e.target.value) || 0})} className="w-full rounded-lg border px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Gender</label>
                                    <select value={profileForm.gender} onChange={e => setProfileForm({...profileForm, gender: e.target.value})} className="w-full rounded-lg border px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none dark:text-white">
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Non-binary">Non-binary</option>
                                        <option value="Prefer not to say">Prefer not to say</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                             </div>
                          </div>

                          {/* Vitals Section */}
                          <div className="bg-white dark:bg-slate-800 rounded-xl">
                             <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Key Vitals</h4>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Blood Type</label>
                                    <select value={profileForm.bloodType} onChange={e => setProfileForm({...profileForm, bloodType: e.target.value})} className="w-full rounded-lg border px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none dark:text-white">
                                        <option value="">Select Type</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                    </select>
                                </div>
                                <div>
                                   <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Height</label>
                                   <input type="text" placeholder="e.g. 5'10" value={profileForm.height} onChange={e => setProfileForm({...profileForm, height: e.target.value})} className="w-full rounded-lg border px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none dark:text-white" />
                                </div>
                                <div>
                                   <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Weight</label>
                                   <input type="text" placeholder="e.g. 165 lbs" value={profileForm.weight} onChange={e => setProfileForm({...profileForm, weight: e.target.value})} className="w-full rounded-lg border px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none dark:text-white" />
                                </div>
                             </div>
                          </div>
                          
                          {/* Medical Section */}
                          <div className="bg-white dark:bg-slate-800 rounded-xl">
                             <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Medical History</h4>
                             <div className="space-y-4">
                                <div>
                                   <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Chronic Conditions (comma separated)</label>
                                   <textarea value={profileForm.chronicConditions ? profileForm.chronicConditions.join(', ') : ''} onChange={e => setProfileForm({...profileForm, chronicConditions: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full rounded-lg border px-3 py-2 h-16 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none resize-none dark:text-white" placeholder="e.g. Asthma, Diabetes" />
                                </div>
                                <div>
                                   <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Allergies (comma separated)</label>
                                   <textarea value={profileForm.allergies.join(', ')} onChange={e => setProfileForm({...profileForm, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full rounded-lg border px-3 py-2 h-16 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none resize-none dark:text-white" placeholder="e.g. Penicillin, Peanuts" />
                                </div>
                                <div>
                                   <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Current Medications (comma separated)</label>
                                   <textarea value={profileForm.currentMedications.join(', ')} onChange={e => setProfileForm({...profileForm, currentMedications: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full rounded-lg border px-3 py-2 h-16 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none resize-none dark:text-white" placeholder="e.g. Lisinopril 10mg, Aspirin" />
                                </div>
                             </div>
                          </div>

                          {/* Contact & Insurance */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-white dark:bg-slate-800 rounded-xl">
                                 <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Emergency Contact</h4>
                                 <div className="space-y-4">
                                     <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Contact Name</label>
                                        <input type="text" value={profileForm.emergencyContact?.name || ''} onChange={e => setProfileForm({...profileForm, emergencyContact: { ...profileForm.emergencyContact!, name: e.target.value }})} className="w-full rounded-lg border px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none dark:text-white" />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Relationship</label>
                                        <input type="text" value={profileForm.emergencyContact?.relation || ''} onChange={e => setProfileForm({...profileForm, emergencyContact: { ...profileForm.emergencyContact!, relation: e.target.value }})} className="w-full rounded-lg border px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none dark:text-white" />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Phone Number</label>
                                        <input type="tel" value={profileForm.emergencyContact?.phone || ''} onChange={e => setProfileForm({...profileForm, emergencyContact: { ...profileForm.emergencyContact!, phone: e.target.value }})} className="w-full rounded-lg border px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none dark:text-white" />
                                     </div>
                                 </div>
                              </div>

                              <div className="bg-white dark:bg-slate-800 rounded-xl">
                                 <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Insurance</h4>
                                 <div className="space-y-4">
                                     <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Provider Name</label>
                                        <input type="text" value={profileForm.insuranceProvider || ''} onChange={e => setProfileForm({...profileForm, insuranceProvider: e.target.value})} className="w-full rounded-lg border px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none dark:text-white" />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Policy / Member ID</label>
                                        <input type="text" value={profileForm.insurancePolicyNumber || ''} onChange={e => setProfileForm({...profileForm, insurancePolicyNumber: e.target.value})} className="w-full rounded-lg border px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 outline-none dark:text-white" />
                                     </div>
                                 </div>
                              </div>
                          </div>

                          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700">
                             <Button type="button" variant="ghost" onClick={() => setIsEditingProfile(false)}>Cancel</Button>
                             <Button type="submit">Save Changes</Button>
                          </div>
                       </form>
                    )}
                  </div>
               </div>
             </div>
          )}
        </div>
      </main>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}