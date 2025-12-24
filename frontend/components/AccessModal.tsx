import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, CheckCircle, Fingerprint, UserPlus } from 'lucide-react';
import { requestAccess, getLocalForm, saveLocalForm } from '../services/dataService';
import { getOrCreateUUID } from '../utils/helpers';
import { translations } from '../translations';
import { AppData } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentLang: string;
    onDataUpdate: (data: AppData, meta: any) => void;
}

const AccessModal: React.FC<Props> = ({ isOpen, onClose, currentLang, onDataUpdate }) => {
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [isLoading, setIsLoading] = useState(false);
    
    // Form State
    const [name, setName] = useState("");
    const [email, setEmail] = useState(""); // Optional
    const [additionalInfo, setAdditionalInfo] = useState(""); // Optional
    const [uuid, setUuid] = useState("");

    // Load saved data on mount
    useEffect(() => {
        setUuid(getOrCreateUUID());
        const savedContact = getLocalForm('contact');
        const savedResume = getLocalForm('resume');
        
        // Auto-populate from previous inputs if available
        if (savedContact?.name) setName(savedContact.name);
        else if (savedResume?.name) setName(savedResume.name);
        
        if (savedContact?.email) setEmail(savedContact.email);
        else if (savedResume?.email) setEmail(savedResume.email);
    }, []);

    const tUI = (key: string) => {
        const langData = translations[currentLang] || translations["English"];
        return langData[key] || translations["English"][key] || key;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        
        const result = await requestAccess(name, email, additionalInfo);
        
        setIsLoading(false);
        if (result.success && result.data) {
            setStep('success');
            // Update app data immediately
            onDataUpdate(result.data, result.meta);
            
            saveLocalForm('contact', { name, email, message: '' }); 
            
            setTimeout(() => {
                onClose();
                setStep('form');
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
                        className="relative w-full max-w-md bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden p-8 z-10"
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
                                        <UserPlus size={20} />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2">{tUI('connectTitle')}</h3>
                                    <p className="text-gray-500 text-sm">{tUI('connectDesc')}</p>
                                </div>

                                {/* Read-Only UUID */}
                                <div className="bg-gray-100 dark:bg-[#111] p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 flex items-center gap-3">
                                    <Fingerprint className="text-gray-400" size={18} />
                                    <div className="overflow-hidden">
                                        <p className="text-[10px] font-bold uppercase text-gray-400">{tUI('uniqueId')}</p>
                                        <p className="text-xs font-mono truncate select-all text-gray-600 dark:text-gray-300">{uuid}</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">{tUI('yourName')} *</label>
                                    <input required 
                                        type="text" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-black dark:focus:border-white transition-colors text-sm" 
                                        placeholder={tUI('namePlaceholder')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">{tUI('yourEmail')} <span className="text-[10px] opacity-50 font-normal">{tUI('optional')}</span></label>
                                    <input 
                                        type="email" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-black dark:focus:border-white transition-colors text-sm" 
                                        placeholder={tUI('emailPlaceholder')}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">{tUI('whatsappOrContact')} <span className="text-[10px] opacity-50 font-normal">{tUI('optional')}</span></label>
                                    <input 
                                        type="text" 
                                        value={additionalInfo}
                                        onChange={(e) => setAdditionalInfo(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-black dark:focus:border-white transition-colors text-sm" 
                                        placeholder="+1 234..."
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
                                            {tUI('requestFullAccess')}
                                        </>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center animate-bounce">
                                    <CheckCircle size={32} />
                                </div>
                                <h3 className="text-2xl font-bold">{tUI('accessRequested')}</h3>
                                <p className="text-gray-500 text-sm">{tUI('accessPending')}</p>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AccessModal;