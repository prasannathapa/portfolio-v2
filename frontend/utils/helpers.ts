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
    let uuid = localStorage.getItem(STORAGE_KEY);
    if (!uuid) {
        uuid = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, uuid);
    }
    return uuid;
};
