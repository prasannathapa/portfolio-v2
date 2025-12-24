import { AppData, ProfileDocument, SocialsDocument, ExperienceDocument, ContactDocument, BlogsDocument, LanguageDocument } from '../types';
import { getOrCreateUUID, getStoredUser, updateStoredUser } from '../utils/helpers';

// Local Storage Keys
const LS_CONTACT_FORM = 'portfolio_contact_form';
const LS_RESUME_FORM = 'portfolio_resume_form';

// Helper to map raw JSON array to AppData structure
const mapToAppData = (rawData: any[]): AppData => {
    const profile = rawData.find((d: any) => d.type === 'about') as unknown as ProfileDocument;
    const socialsDoc = rawData.find((d: any) => d.type === 'social_icons') as unknown as SocialsDocument;
    const experienceDoc = rawData.find((d: any) => d.type === 'experience') as unknown as ExperienceDocument;
    const blogsDoc = rawData.find((d: any) => d.type === 'blogs') as unknown as BlogsDocument;
    const contactDoc = rawData.find((d: any) => d.type === 'contact') as unknown as ContactDocument;
    const langDoc = rawData.find((d: any) => d.type === 'language') as unknown as LanguageDocument;

    return {
        languages: langDoc?.i18n || ["English"],
        profile,
        socials: socialsDoc?.social_icons || [],
        experience: experienceDoc?.experience || [],
        blogs: blogsDoc?.blogs || [],
        contact: contactDoc?.contact || [],
        tags: blogsDoc?.tags || []
    };
};

interface FetchResult {
    appData: AppData | null;
    meta: { registered: boolean, level: number };
}

interface RequestResult {
    success: boolean;
    data?: AppData;
    meta?: { registered: boolean, level: number };
}

export const fetchData = async (): Promise<FetchResult> => {
    try {
        const uuid = getOrCreateUUID();
        const response = await fetch('/api/portfolio', {
            headers: {
                'x-access-token': uuid
            }
        });
        
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const json = await response.json();
        
        const rawData = Array.isArray(json) ? json : json.content;
        const meta = json.meta || { registered: false, level: 0 };

        if (!Array.isArray(rawData) || rawData.length === 0) {
            console.warn("API returned empty data.");
            return { appData: null, meta };
        }

        return { appData: mapToAppData(rawData), meta };
    } catch (error) {
        console.error("Failed to fetch data", error);
        return { appData: null, meta: { registered: false, level: 0 } };
    }
};

export const requestResume = async (email: string, name: string, company: string, jobDesc: string, ctc: string): Promise<RequestResult> => {
    try {
        const uuid = getOrCreateUUID();
        const response = await fetch('/api/request', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-access-token': uuid 
            },
            body: JSON.stringify({ 
                email, 
                name,
                company,
                message: `[RESUME REQUEST]\nJob: ${jobDesc}\nCTC: ${ctc}`,
                type: 'resume',
                token: "frontend-client"
            })
        });
        if (!response.ok) throw new Error('Request failed');
        
        const json = await response.json();
        
        // Clear saved resume form on success
        localStorage.removeItem(LS_RESUME_FORM);
        
        return { 
            success: true, 
            data: mapToAppData(json.content), 
            meta: json.meta 
        };
    } catch (error) {
        console.error("Failed to request resume", error);
        return { success: false };
    }
};

export const requestAccess = async (name: string, email: string, additionalInfo: string): Promise<RequestResult> => {
    try {
        const uuid = getOrCreateUUID();
        const response = await fetch('/api/request', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-access-token': uuid 
            },
            body: JSON.stringify({ 
                name, 
                email, 
                message: additionalInfo,
                type: 'access_request',
                token: "frontend-client"
            })
        });
        if (!response.ok) throw new Error('Request failed');
        const json = await response.json();

        return { 
            success: true, 
            data: mapToAppData(json.content), 
            meta: json.meta 
        };
    } catch (error) {
        console.error("Failed to request access", error);
        return { success: false };
    }
};

export const sendContactMessage = async (name: string, email: string, message: string): Promise<boolean> => {
    try {
        const uuid = getOrCreateUUID();
        const response = await fetch('/api/request', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-access-token': uuid
            },
            body: JSON.stringify({ 
                name, 
                email, 
                message, 
                type: 'contact',
                token: "frontend-client" 
            })
        });
        
        if (response.ok) {
            localStorage.removeItem(LS_CONTACT_FORM);
            return true;
        }
        return false;
    } catch (error) {
        console.error("Failed to send message", error);
        return false;
    }
};

// --- Local Storage Persistence Helpers ---

export const getLocalForm = (key: 'contact' | 'resume') => {
    const storageKey = key === 'contact' ? LS_CONTACT_FORM : LS_RESUME_FORM;
    const globalUser = getStoredUser();
    
    try {
        const saved = localStorage.getItem(storageKey);
        const parsed = saved ? JSON.parse(saved) : {};
        
        // Merge global identity (Highest priority for Name/Email)
        return {
            ...parsed,
            name: parsed.name || globalUser.name || "",
            email: parsed.email || globalUser.email || ""
        };
    } catch (e) {
        return { name: globalUser.name || "", email: globalUser.email || "" };
    }
};

export const saveLocalForm = (key: 'contact' | 'resume', data: any) => {
    const storageKey = key === 'contact' ? LS_CONTACT_FORM : LS_RESUME_FORM;
    try {
        localStorage.setItem(storageKey, JSON.stringify(data));
        
        // Also update global identity aggressively on every keystroke save
        if (data.name || data.email) {
            updateStoredUser({ name: data.name, email: data.email });
        }
    } catch (e) {
        console.warn("LocalStorage access denied");
    }
};