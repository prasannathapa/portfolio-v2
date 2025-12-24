import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, LocalizedData } from './types';
import { fetchData, sendContactMessage, getLocalForm, saveLocalForm } from './services/dataService';
import { getLocalizedText } from './utils/helpers';
import { translations } from './translations';
import Header from './components/Header';
import Icon from './components/Icon';
import ResumeModal from './components/ResumeModal';
import AccessModal from './components/AccessModal';
import MarkdownRenderer from './components/MarkdownRenderer';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ExternalLink, Mail, Search, Lock, Code, Briefcase, User, Check, Send, CheckCircle, ArrowLeft, Download, RefreshCw, AlertCircle, Fingerprint } from 'lucide-react';

function App() {
    const [data, setData] = useState<AppData | null>(null);
    const [meta, setMeta] = useState({ registered: false, level: 0 });
    const [error, setError] = useState(false);
    const [lang, setLang] = useState("English");
    const [isDark, setIsDark] = useState(true);
    const [loading, setLoading] = useState(true);

    // Navigation & State
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Multi-Select Tags
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    // Contact Form State
    const [contactForm, setContactForm] = useState({ name: '', email: '', message: '', loading: false, sent: false });

    // Modals
    const [isResumeOpen, setIsResumeOpen] = useState(false);
    const [isAccessOpen, setIsAccessOpen] = useState(false);
    
    const contentRef = useRef<HTMLDivElement>(null);

    const loadContent = async () => {
        setLoading(true);
        setError(false);
        const { appData, meta } = await fetchData();
        if (appData) {
            setData(appData);
            setMeta(meta);
        } else {
            setError(true);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadContent();
        
        // Load saved contact form
        const savedForm = getLocalForm('contact');
        if (savedForm) {
            setContactForm(prev => ({ ...prev, ...savedForm }));
        }

        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            setIsDark(false);
        }
    }, []);

    // Save form on change
    useEffect(() => {
        if (!contactForm.sent) {
            saveLocalForm('contact', { 
                name: contactForm.name, 
                email: contactForm.email, 
                message: contactForm.message 
            });
        }
    }, [contactForm.name, contactForm.email, contactForm.message, contactForm.sent]);

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    useEffect(() => {
        setSearchQuery("");
        setSelectedTags([]); // Reset tags on section change
        if (contentRef.current) contentRef.current.scrollTop = 0;
    }, [activeSection]);

    // Data Translation Helper
    const t = (obj: LocalizedData | undefined) => getLocalizedText(obj, lang);

    // UI Translation Helper
    const tUI = (key: string) => {
        const langData = translations[lang] || translations["English"];
        return langData[key] || translations["English"][key] || key;
    };

    const navItems = [
        { id: 'about', label: tUI('about'), icon: User },
        { id: 'experience', label: tUI('experience'), icon: Briefcase },
        { id: 'projects', label: tUI('work'), icon: Code },
        { id: 'contact', label: tUI('contact'), icon: Mail },
    ];

    // Filter Logic (OR condition for tags)
    const filteredProjects = useMemo(() => {
        if (!data) return [];
        return data.blogs.filter(blog => {
            const matchesSearch = blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                blog.content.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesTags = selectedTags.length === 0
                ? true
                : blog.tags.some(tag => selectedTags.includes(tag));

            return matchesSearch && matchesTags;
        });
    }, [data, searchQuery, selectedTags]);

    const filteredExperience = useMemo(() => {
        if (!data) return [];
        return data.experience.filter(exp => {
            const term = searchQuery.toLowerCase();
            return (
                t(exp.heading).toLowerCase().includes(term) ||
                t(exp.title).toLowerCase().includes(term) ||
                exp.timeline.some(tItem => t(tItem.title).toLowerCase().includes(term) || t(tItem.description).toLowerCase().includes(term))
            );
        });
    }, [data, searchQuery, lang]);

    // Sort Tags: Selected order first, then alphabetical
    const sortedTags = useMemo(() => {
        if (!data) return [];
        const all = Array.from(new Set(data.blogs.flatMap(b => b.tags))).sort();

        // Items in selectedTags should appear first, in the order they were selected
        const selectedPart = selectedTags.filter(t => all.includes(t));
        const unselectedPart = all.filter(t => !selectedTags.includes(t));

        return [...selectedPart, ...unselectedPart];
    }, [data, selectedTags]);

    // Extract Map URL from Data
    const mapUrl = useMemo(() => {
        if (!data) return "";
        const locationItem = data.contact.find(c => c.type === 'location');
        if (!locationItem) return "";
        
        // If the link is already an embed URL, use it
        if (locationItem.link.includes('embed')) return locationItem.link;
        
        // Otherwise, construct a Google Maps Embed URL using the text
        const locationText = t(locationItem.text);
        return `https://maps.google.com/maps?q=${encodeURIComponent(locationText)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
    }, [data, lang]);

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        // Could add a toast here
    };

    const handleContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setContactForm(prev => ({ ...prev, loading: true }));
        
        const success = await sendContactMessage(contactForm.name, contactForm.email, contactForm.message);
        
        if (success) {
            setContactForm(prev => ({ ...prev, loading: false, sent: true }));
            setTimeout(() => setContactForm({ name: '', email: '', message: '', loading: false, sent: false }), 3000);
        } else {
            setContactForm(prev => ({ ...prev, loading: false }));
            alert("Failed to send message. Please try again.");
        }
    };

    // Callback when profile is unlocked via Modals
    const handleDataUpdate = (newData: AppData, newMeta: any) => {
        setData(newData);
        setMeta(newMeta || { registered: true, level: 0 });
    };

    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-black text-black dark:text-white"><div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-gray-800 border-t-black dark:border-t-white animate-spin" /></div>;

    if (error || !data) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-black text-black dark:text-white p-4 text-center">
            <AlertCircle size={48} className="text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">{tUI('apiError')}</h2>
            <button onClick={loadContent} className="flex items-center gap-2 px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-full font-bold">
                <RefreshCw size={16} /> {tUI('retry')}
            </button>
        </div>
    );

    // Reusable component for the Action Buttons to ensure consistency
    const ActionButtons = ({ className }: { className?: string }) => (
        <div className={`flex flex-col items-center gap-3 w-full ${className}`}>
            {/* Resume Button - Primary Action (85% Width) */}
            {data.profile.pdf && data.profile.pdf.length > 0 && t(data.profile.pdf as any) !== "" ? (
                <a 
                    href={t(data.profile.pdf as any)} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="w-[100%] bg-black text-white dark:bg-white dark:text-black py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95 border border-transparent"
                >
                    <Download size={14} /> <span>Download Resume</span>
                </a>
            ) : (
                <button 
                    onClick={() => setIsResumeOpen(true)} 
                    className="w-[100%] bg-black text-white dark:bg-white dark:text-black py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95 border border-transparent"
                >
                    <Lock size={14} /> <span>{tUI('requestResume')}</span>
                </button>
            )}

            {/* Connect / Access Status Button - Secondary Action (Subtle Text Style) */}
            {meta.registered ? (
                <div className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400 dark:text-emerald-800 select-none cursor-default">
                    <CheckCircle size={12} /> {tUI('accessLevel_' + (meta.level > 5 ? 5 : Math.max(0, meta.level)))}
                </div>
            ) : (
                <button 
                    onClick={() => setIsAccessOpen(true)} 
                    className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                >
                    <Fingerprint size={12} /> {tUI('connectTitle')}
                </button>
            )}
        </div>
    );

    return (
        <LayoutGroup>
            <div className="fixed inset-0 bg-white dark:bg-black text-black dark:text-white transition-colors duration-500 flex flex-col lg:flex-row overflow-hidden font-sans">
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] z-0" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, ${isDark ? 'white' : 'black'} 1px, transparent 0)`, backgroundSize: '40px 40px' }} />

                {/* Fixed Header: Only on mobile/tablet or Home Screen. Hidden when Sidebar is active on Desktop to avoid duplication with sidebar settings */}
                <div className={`${activeSection ? 'lg:hidden' : ''}`}>
                    <Header
                        isDark={isDark}
                        toggleTheme={() => setIsDark(!isDark)}
                        currentLang={lang}
                        languages={data.languages}
                        setLanguage={setLang}
                    />
                </div>

                <ResumeModal 
                    isOpen={isResumeOpen} 
                    onClose={() => setIsResumeOpen(false)} 
                    currentLang={lang} 
                    onDataUpdate={handleDataUpdate}
                />
                
                <AccessModal 
                    isOpen={isAccessOpen} 
                    onClose={() => setIsAccessOpen(false)} 
                    currentLang={lang} 
                    onDataUpdate={handleDataUpdate}
                />

                {/* Left Panel / Sidebar */}
                <motion.aside
                    layout
                    className={`
                        relative z-30 flex flex-col shrink-0 transition-all duration-500 ease-[0.25, 1, 0.5, 1] 
                        ${activeSection
                            ? 'basis-auto border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-black/95 backdrop-blur-md lg:w-[320px] lg:h-full justify-start items-center lg:items-start'
                            : 'basis-auto min-h-[40vh] lg:min-h-0 lg:basis-[45%] justify-center items-center p-8 pb-0'
                        }
                    `}
                >
                    {/* Inner Container for Sidebar Scroll - Separated for Z-Index Fix */}
                    <div className={`w-full flex flex-col flex-1 min-h-0 ${activeSection ? 'overflow-y-auto hide-scrollbar py-4 px-6' : 'justify-center items-center p-8 pb-0'}`}>
                        
                        <div className={`flex flex-col transition-all duration-500 ${activeSection ? 'w-full lg:w-auto h-full' : 'items-center text-center w-full'}`}>
                            
                            {/* Profile Header Content */}
                            <motion.div layout="position" className={`flex transition-all duration-500 ${activeSection ? 'flex-row items-center gap-4 lg:flex-col lg:items-start pr-12 lg:pr-0' : 'flex-col items-center'}`}>
                                {/* Profile Image */}
                                <div className={`transition-all duration-500 ${activeSection ? 'w-10 h-10 lg:w-24 lg:h-24 lg:mb-4' : 'w-28 h-28 lg:w-56 lg:h-56 mb-6'} relative flex-shrink-0`}>
                                    <div className="rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-800 shadow-xl bg-gray-100 dark:bg-gray-900 w-full h-full absolute inset-0">
                                        <img src={data.profile.link} alt="Profile" className="w-full h-full object-cover" />
                                    </div>
                                </div>

                                {/* Text Container */}
                                <div className={`flex flex-col transition-all duration-500 ${activeSection ? 'items-start text-left' : 'items-center text-center'}`}>
                                    <h2 className={`font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase transition-all duration-500 ${activeSection ? 'text-[9px] lg:mb-1' : 'text-xs lg:text-sm mb-2'}`}>{t(data.profile.subtitle)}</h2>
                                    <h1 className={`font-bold tracking-tighter whitespace-nowrap transition-all duration-500 ${activeSection ? 'text-lg lg:text-3xl' : 'text-3xl lg:text-6xl'}`}>{t(data.profile.title)}</h1>
                                </div>
                            </motion.div>

                            {/* Social Icons - Moved Up */}
                            <div className={`hidden lg:flex gap-3 mb-6 mt-6 ${!activeSection && 'justify-center'}`}>
                                {data.socials.map((social, idx) => (
                                    <a key={idx} href={social.link} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                                        <Icon paths={social.paths} viewBox={social.viewBox} className="w-5 h-5" />
                                    </a>
                                ))}
                            </div>

                            {/* Desktop Menu */}
                            <div className={`hidden lg:flex flex-col w-full h-full ${!activeSection ? 'items-center lg:items-center' : 'items-center lg:items-start'}`}>
                                {activeSection ? (
                                    /* Active Sidebar View */
                                    <>
                                        <nav className="flex flex-col w-full gap-1 mb-8">
                                            <p className="text-xs font-bold uppercase text-gray-400 mb-4 px-2">{tUI('menu')}</p>
                                            {navItems.map(item => (
                                                <button key={item.id} onClick={() => setActiveSection(item.id)} className={`text-left px-4 py-3 rounded-xl transition-all font-medium text-sm flex items-center justify-between group ${activeSection === item.id ? 'bg-gray-100 dark:bg-gray-900 text-black dark:text-white' : 'text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900/50'}`}>
                                                    {item.label} {activeSection === item.id && <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                                                </button>
                                            ))}
                                            <button onClick={() => setActiveSection(null)} className="mt-4 text-left px-4 py-3 rounded-xl transition-all font-medium text-xs uppercase tracking-wider text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-2">
                                                <ArrowLeft size={14} /> {tUI('backHome')}
                                            </button>
                                        </nav>

                                        {/* Actions Stack in Sidebar */}
                                        <ActionButtons className="mt-auto mb-4" />
                                    </>
                                ) : (
                                    /* Desktop Landing View Buttons */
                                    <div className="mt-8 w-64">
                                        <ActionButtons />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mobile Home Controls */}
                        {!activeSection && (
                            <div className="lg:hidden flex flex-col items-center gap-6 mt-6 w-full px-8 pb-0">
                                <div className="flex gap-4">
                                    {data.socials.map((social, idx) => (
                                        <a key={idx} href={social.link} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-black dark:hover:text-white">
                                            <Icon paths={social.paths} viewBox={social.viewBox} className="w-6 h-6" />
                                        </a>
                                    ))}
                                </div>
                                
                                <ActionButtons />
                            </div>
                        )}
                    </div>
                    
                    {/* Fixed Sidebar Footer (Settings) - Hidden on Mobile */}
                    {activeSection && (
                        <div className="hidden lg:flex w-full flex-none px-6 py-4 border-t border-gray-100 dark:border-gray-900 bg-white/95 dark:bg-black/95 backdrop-blur-md items-center justify-between z-40">
                            <span className="text-[10px] text-gray-400">© 2025</span>
                            <Header
                                isDark={isDark}
                                toggleTheme={() => setIsDark(!isDark)}
                                currentLang={lang}
                                languages={data.languages}
                                setLanguage={setLang}
                                className="relative"
                                direction="up"
                                variant="ghost" 
                            />
                        </div>
                    )}
                </motion.aside>

                <motion.main layout className="flex-1 relative z-10 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-black/50">
                    <AnimatePresence mode="wait">
                        {!activeSection ? (
                            <motion.div
                                key="home-menu"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="w-full h-full flex flex-col justify-start lg:justify-center overflow-y-auto"
                            >
                                <div className="flex flex-col justify-center gap-2 lg:gap-4 max-w-2xl mx-auto w-full p-6 pt-0 lg:p-12 pb-20 lg:pb-40">
                                    {navItems.map((item, i) => (
                                        <motion.button
                                            key={item.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            onClick={() => setActiveSection(item.id)}
                                            className="group flex items-center justify-between py-6 lg:py-8 border-b border-gray-200 dark:border-gray-800 hover:border-black dark:hover:border-white transition-colors"
                                        >
                                            <div className="flex items-center gap-6 lg:gap-8">
                                                <span className="text-xs font-mono text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors">0{i + 1}</span>
                                                <span className="text-3xl lg:text-6xl font-bold tracking-tight group-hover:pl-4 transition-all duration-300">{item.label}</span>
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-300 text-gray-400">
                                                <item.icon size={32} />
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="section-content"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col h-full w-full"
                            >
                                {/* Sticky Bottom Mobile Nav - High z-index */}
                                <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#111]/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 pb-safe pb-2">
                                    <div className="flex items-center justify-around p-2">
                                        <button onClick={() => setActiveSection(null)} className="p-2 flex flex-col items-center gap-1 text-gray-400 hover:text-black dark:hover:text-white">
                                            <ArrowLeft size={20} />
                                            <span className="text-[10px] font-bold uppercase">{tUI('back')}</span>
                                        </button>
                                        {navItems.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveSection(item.id)}
                                                className={`p-2 flex flex-col items-center gap-1 transition-all ${activeSection === item.id ? 'text-black dark:text-white' : 'text-gray-400 hover:text-black dark:hover:text-white'}`}
                                            >
                                                <item.icon size={20} />
                                                <span className="text-[10px] font-bold uppercase">{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div ref={contentRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar scroll-smooth">
                                    <div className="w-full lg:p-12">
                                        <div className="max-w-5xl mx-auto pb-32 lg:pb-0 min-h-full">

                                            {activeSection === 'about' && (
                                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 p-4 lg:p-0">
                                                    <div className="prose dark:prose-invert max-w-none">
                                                        <h3 className="text-3xl lg:text-5xl font-bold mb-8">{tUI('aboutMe')}</h3>
                                                        <MarkdownRenderer
                                                            content={t(data.profile.about)}
                                                            className="text-lg lg:text-xl text-gray-700 dark:text-gray-300 font-light"
                                                        />
                                                        <div className="pt-8">
                                                            <button onClick={() => setActiveSection('projects')} className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
                                                                <span>{tUI('checkBlogs')}</span>
                                                                <ArrowLeft size={16} className="rotate-180" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {activeSection === 'experience' && (
                                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                                                    {/* Sticky Header */}
                                                    <div className="sticky top-0 z-40 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 px-4 py-4 lg:px-0">
                                                        <div className="flex flex-col lg:flex-row justify-between gap-4">
                                                            <h3 className="text-3xl font-bold">{tUI('experience')}</h3>
                                                            <div className="relative w-full lg:w-72">
                                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                                <input type="text" placeholder={tUI('searchRoles')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 focus:border-black dark:focus:border-white rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all shadow-sm" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-12 px-4 lg:px-0 pt-2">
                                                        {filteredExperience.map((company, idx) => (
                                                            <div key={idx} className="group bg-white dark:bg-[#111] p-6 lg:p-8 rounded-3xl border border-gray-100 dark:border-gray-900 shadow-sm relative overflow-hidden">
                                                                <div className="relative z-10 flex flex-wrap items-center gap-4 mb-8 border-b border-gray-100 dark:border-gray-800 pb-4">
                                                                    <div className="w-16 h-16 p-3 bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-center">
                                                                        <img src={company.image} alt="logo" className="max-w-full max-h-full object-contain" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-xl lg:text-2xl font-bold">{t(company.heading)}</h4>
                                                                        <a href={company.link} target="_blank" rel="noreferrer" className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">{t(company.title)} <ExternalLink size={12} /></a>
                                                                    </div>
                                                                </div>

                                                                <div className="relative pl-6 lg:pl-8">
                                                                    <div className="absolute left-0 top-3 bottom-0 w-[2px] bg-gray-200 dark:bg-gray-800 rounded-full" />

                                                                    <div className="space-y-12 pb-4">
                                                                        {company.timeline.map((item, tIdx) => (
                                                                            <div key={tIdx} className="relative">
                                                                                {/* FIX: Horizontally aligned timeline dot using absolute positioning */}
                                                                                <div className="absolute -left-[31px] lg:-left-[38px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-[#111] border-[3px] border-black dark:border-white z-10 box-border shadow-[0_0_0_4px_rgba(255,255,255,1)] dark:shadow-[0_0_0_4px_rgba(17,17,17,1)]" />

                                                                                <div className="flex flex-row items-center justify-between mb-2">
                                                                                    <h5 className="font-bold text-lg lg:text-xl pr-4">{t(item.title)}</h5>
                                                                                    <span className="shrink-0 text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full font-mono">{item.year}</span>
                                                                                </div>

                                                                                <div className="mb-4">
                                                                                    <MarkdownRenderer content={t(item.description)} className="text-sm lg:text-base text-gray-600 dark:text-gray-400 leading-relaxed" />
                                                                                </div>

                                                                                {item.image && (
                                                                                    <div className="mt-3">
                                                                                        <a
                                                                                            href={item.image.link}
                                                                                            target="_blank"
                                                                                            rel="noreferrer"
                                                                                            className="inline-flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors group"
                                                                                        >
                                                                                            <div className="w-8 h-8 rounded bg-white p-1 shadow-sm">
                                                                                                <img src={item.image.src} alt={item.image.title} className="w-full h-full object-contain" />
                                                                                            </div>
                                                                                            <div className="flex flex-col items-start">
                                                                                                <span className="text-xs font-bold uppercase tracking-wider opacity-60">{tUI('credential')}</span>
                                                                                                <span className="text-xs font-bold">{item.image.title}</span>
                                                                                            </div>
                                                                                            <ExternalLink size={14} className="ml-2 opacity-50 group-hover:opacity-100" />
                                                                                        </a>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {activeSection === 'projects' && (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                                                    <div className="sticky top-0 z-40 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 px-4 py-4 lg:px-0">
                                                        <div className="flex flex-col gap-4">
                                                            <div className="flex items-center justify-between">
                                                                <h3 className="text-3xl font-bold">{tUI('workAndBlogs')}</h3>
                                                                <span className="text-xs font-mono bg-black text-white dark:bg-white dark:text-black px-2 py-1 rounded">{filteredProjects.length} {tUI('results')}</span>
                                                            </div>
                                                            <div className="flex flex-col lg:flex-row gap-4">
                                                                <div className="relative flex-1">
                                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                                    <input type="text" placeholder={tUI('searchProjects')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 focus:border-black dark:focus:border-white rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all shadow-sm" />
                                                                </div>
                                                                <div className="flex gap-2 overflow-x-auto hide-scrollbar lg:max-w-md pb-1.5 pt-0.5">
                                                                    {sortedTags.map(tag => {
                                                                        const isSelected = selectedTags.includes(tag);
                                                                        return (
                                                                            <button
                                                                                key={tag}
                                                                                onClick={() => toggleTag(tag)}
                                                                                className={`
                                                                                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all whitespace-nowrap flex-none
                                                                                    ${isSelected
                                                                                        ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-md'
                                                                                        : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800 text-gray-500 hover:border-black dark:hover:border-white'}
                                                                                `}
                                                                            >
                                                                                {isSelected && <Check size={10} />}
                                                                                {tag}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 px-4 lg:px-0">
                                                        {filteredProjects.map((blog, idx) => (
                                                            <a href={blog.blog || blog.download || '#'} target="_blank" rel="noreferrer" key={idx} className="group block bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-all hover:shadow-2xl shadow-sm flex flex-col h-full transform hover:scale-[1.02] duration-300">
                                                                <div className="h-56 overflow-hidden relative">
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 opacity-60 group-hover:opacity-40 transition-opacity" />
                                                                    <img src={blog.image} alt={blog.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                                </div>
                                                                <div className="p-6 flex flex-col flex-1 relative">
                                                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                                                        {blog.tags.slice(0, 3).map(tag => (
                                                                            <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] uppercase font-bold rounded-md">{tag}</span>
                                                                        ))}
                                                                    </div>
                                                                    <h4 className="font-bold text-xl mb-3 leading-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{blog.title}</h4>
                                                                    <p className="text-sm text-gray-500 line-clamp-3 mb-6 flex-1 leading-relaxed">{blog.content}</p>
                                                                    <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider pt-4 border-t border-gray-100 dark:border-gray-800">
                                                                        <span>{blog.type}</span>
                                                                        <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform text-black dark:text-white">{tUI('view')} <ExternalLink size={12} /></div>
                                                                    </div>
                                                                </div>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {activeSection === 'contact' && (
                                                <div className="min-h-full flex flex-col justify-start animate-in fade-in zoom-in-95 duration-500 pt-8 pb-32 lg:pt-0 px-4 lg:px-0">
                                                    {/* Fix: Stack vertically (flex-col) for full width on all screens */}
                                                    <div className="flex flex-col gap-12 lg:gap-16">

                                                        {/* Info & Links */}
                                                        <div className="flex-1 flex flex-col gap-10">
                                                            <div className="text-left">
                                                                <h3 className="text-5xl lg:text-7xl font-bold mb-4 tracking-tight leading-[1.1]">{tUI('letsWork')}</h3>
                                                                <p className="text-gray-500 text-lg lg:text-xl max-w-xl mt-4">{tUI('openForOpp')}</p>
                                                                {/* Add Access Button - Hidden if registered */}
                                                                {!meta.registered && (
                                                                    <button onClick={() => setIsAccessOpen(true)} className="mt-6 flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold hover:underline">
                                                                        <Fingerprint size={16} /> {tUI('connectTitle')}
                                                                    </button>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-col gap-6">
                                                                {data.contact.filter(c => c.type !== 'location').map((item, idx) => (
                                                                    <div key={idx} className="group">
                                                                        <div className="flex items-baseline gap-2 mb-1">
                                                                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{item.type}</span>
                                                                        </div>
                                                                        <div
                                                                            onClick={() => item.type === 'email' ? handleCopy(t(item.text)) : window.open(item.link)}
                                                                            className="text-2xl lg:text-3xl font-bold cursor-pointer hover:text-gray-500 transition-colors break-words flex items-center gap-3"
                                                                        >
                                                                            {t(item.text)} <ArrowLeft size={20} className="rotate-[135deg] opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {/* Social Links Inline */}
                                                                <div className="flex gap-4 pt-4">
                                                                    {data.socials.map((social, idx) => (
                                                                        <a key={idx} href={social.link} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
                                                                            <Icon paths={social.paths} viewBox={social.viewBox} className="w-5 h-5" />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Form */}
                                                        <div className="flex-1 space-y-8 lg:pt-12 pb-32">
                                                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm">
                                                                <h4 className="text-xl font-bold mb-6">{tUI('sendMessage')}</h4>
                                                                {!contactForm.sent ? (
                                                                    <form onSubmit={handleContactSubmit} className="space-y-4">
                                                                        <input
                                                                            required
                                                                            type="text"
                                                                            value={contactForm.name}
                                                                            onChange={(e) => setContactForm(p => ({ ...p, name: e.target.value }))}
                                                                            className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-4 outline-none focus:border-black dark:focus:border-white transition-colors text-sm"
                                                                            placeholder={tUI('namePlaceholder')}
                                                                        />
                                                                        <input
                                                                            required
                                                                            type="email"
                                                                            value={contactForm.email}
                                                                            onChange={(e) => setContactForm(p => ({ ...p, email: e.target.value }))}
                                                                            className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-4 outline-none focus:border-black dark:focus:border-white transition-colors text-sm"
                                                                            placeholder={tUI('emailPlaceholder')}
                                                                        />
                                                                        <textarea
                                                                            value={contactForm.message}
                                                                            onChange={(e) => setContactForm(p => ({ ...p, message: e.target.value }))}
                                                                            className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-4 outline-none focus:border-black dark:focus:border-white transition-colors text-sm resize-none h-40"
                                                                            placeholder={tUI('howHelp')}
                                                                        />
                                                                        <button
                                                                            type="submit"
                                                                            disabled={contactForm.loading}
                                                                            className="w-full bg-black text-white dark:bg-white dark:text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
                                                                        >
                                                                            {contactForm.loading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <><Send size={16} /> {tUI('sendBtn')}</>}
                                                                        </button>
                                                                    </form>
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                                                                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center animate-bounce">
                                                                            <CheckCircle size={32} />
                                                                        </div>
                                                                        <h3 className="text-lg font-bold">{tUI('sent')}</h3>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Map - Dynamic from API Data */}
                                                        {mapUrl && (
                                                            <div className="w-full relative h-64 rounded-3xl overflow-hidden grayscale hover:grayscale-0 transition-all duration-700 border border-gray-200 dark:border-gray-800">
                                                                <iframe
                                                                    width="100%"
                                                                    height="100%"
                                                                    style={{ border: 0, filter: isDark ? 'invert(90%) hue-rotate(180deg)' : '' }}
                                                                    loading="lazy"
                                                                    allowFullScreen
                                                                    src={mapUrl}
                                                                ></iframe>
                                                            </div>
                                                        )}
                                                        
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.main>
            </div>
        </LayoutGroup>
    );
}

export default App;