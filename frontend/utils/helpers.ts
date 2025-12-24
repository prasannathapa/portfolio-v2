import { LocalizedData } from '../types';

// Helper to get text based on current language
export const getLocalizedText = (obj: LocalizedData | undefined, lang: string): string => {
    if (!obj || !obj.data) return "";
    const item = obj.data.find(d => d.i18n === lang);
    if (item) return item.text;
    
    // Fallback to English
    const englishItem = obj.data.find(d => d.i18n === "English");
    return englishItem ? englishItem.text : (obj.data[0]?.text || "");
};

// UUID Management
export const getOrCreateUUID = (): string => {
    const STORAGE_KEY = 'user_device_uuid';
    let uuid = getStoredUser().email || localStorage.getItem(STORAGE_KEY);
    if (!uuid) {
        uuid = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, uuid);
    }
    return uuid;
};

const IDENTITY_KEY = 'portfolio_user_identity';

export interface UserIdentity {
    name?: string;
    email?: string;
    company?: string;
}

export const getStoredUser = (): UserIdentity => {
    try {
        const stored = localStorage.getItem(IDENTITY_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        return {};
    }
};

export const updateStoredUser = (data: Partial<UserIdentity>) => {
    try {
        const current = getStoredUser();
        // Only update fields that are not empty/undefined
        const updated = {
            ...current,
            name: data.name || current.name,
            email: data.email || current.email,
            company: data.company || current.company
        };
        localStorage.setItem(IDENTITY_KEY, JSON.stringify(updated));
        return updated;
    } catch (e) {
        console.warn("LocalStorage Error:", e);
        return {};
    }
};
