import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations } from '../translations';

interface Props {
    isDark: boolean;
    toggleTheme: () => void;
    currentLang: string;
    languages: string[];
    setLanguage: (l: string) => void;
    className?: string;
    direction?: 'up' | 'down';
    variant?: 'default' | 'ghost';
}

const Header: React.FC<Props> = ({ 
    isDark, 
    toggleTheme, 
    currentLang, 
    languages, 
    setLanguage, 
    className = "fixed top-4 right-4", 
    direction = 'down',
    variant = 'default'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // UI Translation Helper
    const tUI = (key: string) => {
        const langData = translations[currentLang] || translations["English"];
        return langData[key] || translations["English"][key] || key;
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isUp = direction === 'up';

    // Styles based on variant
    const buttonStyles = variant === 'default' 
        ? `p-3 rounded-full transition-all duration-300 shadow-lg border ${isOpen ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white rotate-90' : 'bg-white/90 dark:bg-black/90 text-black dark:text-white border-gray-200 dark:border-gray-800 backdrop-blur-md'}`
        : `p-2 rounded-xl transition-all duration-300 ${isOpen ? 'bg-gray-100 dark:bg-gray-800 rotate-90' : 'text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`;

    return (
        <div className={`${className} z-[60] flex items-center gap-2 pointer-events-auto`} ref={menuRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={buttonStyles}
            >
                {isOpen ? <X size={20} /> : <Settings size={20} />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: isUp ? 10 : -10, x: 0 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: isUp ? 10 : -10, x: 0 }}
                        className={`absolute ${isUp ? 'bottom-full mb-2 left-0' : 'top-full mt-2 right-0'} w-64 bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden p-2 flex flex-col gap-1`}
                    >
                        <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{tUI('appearance')}</div>
                        <button 
                            onClick={toggleTheme}
                            className="flex items-center justify-between w-full px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                        >
                            <span className="flex items-center gap-3">
                                {isDark ? <Moon size={16} /> : <Sun size={16} />}
                                {isDark ? tUI('darkMode') : tUI('lightMode')}
                            </span>
                            <div className={`w-8 h-4 rounded-full relative transition-colors ${isDark ? 'bg-green-500' : 'bg-gray-300'}`}>
                                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isDark ? 'left-4.5' : 'left-0.5'}`} style={{ left: isDark ? '18px' : '2px'}} />
                            </div>
                        </button>

                        <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
                        
                        <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{tUI('language')}</div>
                        <div className="grid grid-cols-2 gap-1 px-1">
                            {languages.map(lang => (
                                <button
                                    key={lang}
                                    onClick={() => setLanguage(lang)}
                                    className={`
                                        px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left
                                        ${currentLang === lang 
                                            ? 'bg-black text-white dark:bg-white dark:text-black' 
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}
                                    `}
                                >
                                    {lang}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Header;