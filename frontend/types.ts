export interface I18nText {
    i18n: string;
    text: string;
    access?: number;
}

export interface LocalizedData {
    data: I18nText[];
}

export interface SocialIcon {
    access: number;
    type: string;
    link: string;
    viewBox: string;
    paths: string[];
}

export interface ProfileDocument {
    _id: { $oid: string };
    type: "about";
    about: LocalizedData;
    title: LocalizedData;
    subtitle: LocalizedData;
    link: string;
    pdf: I18nText[];
}

export interface SocialsDocument {
    _id: { $oid: string };
    type: "social_icons";
    social_icons: SocialIcon[];
}

export interface TimelineItem {
    access: number;
    year: number;
    title: LocalizedData;
    description: LocalizedData;
    image?: {
        link: string;
        src: string;
        title: string;
    };
}

export interface ExperienceItem {
    access: number;
    heading: LocalizedData;
    link: string;
    title: LocalizedData;
    image: string;
    start: { $numberLong: string };
    end: { $numberLong: string };
    timeline: TimelineItem[];
}

export interface ExperienceDocument {
    _id: { $oid: string };
    type: "experience";
    experience: ExperienceItem[];
}

export interface ContactItem {
    type: string;
    access: number;
    icon: { paths: string[]; viewBox: string };
    link: string;
    text: LocalizedData;
}

export interface ContactDocument {
    _id: { $oid: string };
    type: "contact";
    contact: ContactItem[];
}

export interface BlogItem {
    tags: string[];
    type: string;
    title: string;
    content: string;
    image: string;
    blog?: string;
    download?: string;
}

export interface TagItem {
    src: string;
    title: string;
}

export interface BlogsDocument {
    _id: { $oid: string };
    type: "blogs";
    blogs: BlogItem[];
    tags: TagItem[];
}

export interface LanguageDocument {
    _id: { $oid: string };
    type: "language";
    i18n: string[];
}

// Unified App Data State for the UI
export interface AppData {
    languages: string[];
    profile: ProfileDocument;
    socials: SocialIcon[];
    experience: ExperienceItem[];
    blogs: BlogItem[];
    contact: ContactItem[];
    tags: TagItem[];
}
