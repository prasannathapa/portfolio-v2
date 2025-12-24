import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, CheckCircle, Mail } from 'lucide-react';
import { requestResume, getLocalForm, saveLocalForm } from '../services/dataService';
import { translations } from '../translations';
import { AppData } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentLang: string;
    onDataUpdate: (data: AppData, meta: any) => void;
}

const ResumeModal: React.FC<Props> = ({ isOpen, onClose, currentLang, onDataUpdate }) => {
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [isLoading, setIsLoading] = useState(false);
    
    // Form State
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [company, setCompany] = useState("");
    const [jobDesc, setJobDesc] = useState("");
    const [ctc, setCtc] = useState("");

    // Load saved data on mount
    useEffect(() => {
        const saved = getLocalForm('resume');
        if (saved) {
            setEmail(saved.email || "");
            setName(saved.name || "");
            setCompany(saved.company || "");
            setJobDesc(saved.jobDesc || "");
            setCtc(saved.ctc || "");
        }
    }, []);

    // Save on change
    useEffect(() => {
        if (isOpen && step === 'form') {
            saveLocalForm('resume', { email, name, company, jobDesc, ctc });
        }
    }, [email, name, company, jobDesc, ctc, isOpen, step]);

    const tUI = (key: string) => {
        const langData = translations[currentLang] || translations["English"];
        return langData[key] || translations["English"][key] || key;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        
        const result = await requestResume(email, name, company, jobDesc, ctc);
        
        setIsLoading(false);
        if (result.success && result.data) {
            setStep('success');
            // Update global app state immediately
            onDataUpdate(result.data, result.meta);
            
            setTimeout(() => {
                onClose();
                setStep('form');
                setEmail("");
                setName("");
                setCompany("");
                setJobDesc("");
                setCtc("");
            }, 3500);
        } else {
            alert(tUI('apiError'));
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 overflow-y-auto py-10">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden p-8 z-10"
                    >
                        <button 
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
                        >
                            <X size={20} />
                        </button>

                        {step === 'form' ? (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl mx-auto flex items-center justify-center mb-4 text-white dark:text-black">
                                        <Mail size={20} />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2">{tUI('requestAccess')}</h3>
                                    <p className="text-gray-500 text-sm">{tUI('privacyNote')}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">{tUI('yourName')} *</label>
                                        <input required 
                                            type="text" 
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-black dark:focus:border-white transition-colors text-sm" 
                                            placeholder={tUI('namePlaceholder')}
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">{tUI('yourEmail')} *</label>
                                        <input required 
                                            type="email" 
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-black dark:focus:border-white transition-colors text-sm" 
                                            placeholder={tUI('emailPlaceholder')}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">{tUI('company')} *</label>
                                    <input required 
                                        type="text" 
                                        value={company}
                                        onChange={(e) => setCompany(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-black dark:focus:border-white transition-colors text-sm" 
                                        placeholder={tUI('companyPlaceholder')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">{tUI('jobDesc')} *</label>
                                    <textarea required 
                                        value={jobDesc}
                                        onChange={(e) => setJobDesc(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-black dark:focus:border-white transition-colors text-sm resize-none h-20" 
                                        placeholder={tUI('descPlaceholder')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">{tUI('ctc')}</label>
                                    <input 
                                        type="text" 
                                        value={ctc}
                                        onChange={(e) => setCtc(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-black dark:focus:border-white transition-colors text-sm" 
                                        placeholder={tUI('ctcPlaceholder')}
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="w-full bg-black text-white dark:bg-white dark:text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 text-sm mt-4"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Send size={16} />
                                            {tUI('requestViaEmail')}
                                        </>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center animate-bounce">
                                    <CheckCircle size={32} />
                                </div>
                                <h3 className="text-2xl font-bold">{tUI('requestSentTitle')}</h3>
                                <p className="text-gray-500 text-sm">{tUI('checkInbox')}</p>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ResumeModal;