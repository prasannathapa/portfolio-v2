import React from 'react';

interface Props {
    content: string;
    className?: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content, className = "" }) => {
    if (!content) return null;

    // Split by new lines to handle paragraphs and lists
    const lines = content.split('\n');
    
    return (
        <div className={`space-y-4 ${className}`}>
            {lines.map((line, index) => {
                // List Item
                if (line.trim().startsWith('- ')) {
                    return (
                        <li key={index} className="ml-4 list-disc marker:text-gray-400 pl-2">
                            {parseInline(line.replace('- ', ''))}
                        </li>
                    );
                }
                
                // Empty line (paragraph break)
                if (line.trim() === '') {
                    return <div key={index} className="h-2" />;
                }

                // Standard Paragraph
                return (
                    <p key={index} className="leading-relaxed text-gray-600 dark:text-gray-300">
                        {parseInline(line)}
                    </p>
                );
            })}
        </div>
    );
};

// Helper to parse:
// 1. **bold**
// 2. *italic*
// 3. Custom Link: [(url)text]
// 4. Standard Link: [text](url)
const parseInline = (text: string) => {
    // Regex explanation:
    // (\*\*.*?\*\*) -> Bold
    // (\*.*?\*) -> Italic
    // (\[\(.*?\).*?\]) -> Custom Link [(url)text]
    // (\[.*?\]\(.*?\)) -> Standard Link [text](url)
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|\[\(.*?\).*?\]|\[.*?\]\(.*?\))/g);
    
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-black dark:text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        }
        // Handle Custom Link: [(url)text]
        if (part.startsWith('[(') && part.endsWith(']')) {
            const content = part.slice(2, -1); // remove '[(' and ']'
            const splitIdx = content.indexOf(')');
            if (splitIdx !== -1) {
                const url = content.slice(0, splitIdx);
                const label = content.slice(splitIdx + 1);
                return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-teal-400 hover:underline font-medium inline-flex items-baseline">
                        {label}
                    </a>
                );
            }
        }
        // Handle Standard Link: [text](url)
        if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
            const [label, url] = part.slice(1, -1).split('](');
            return (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-teal-400 hover:underline font-medium inline-flex items-baseline">
                    {label}
                </a>
            );
        }
        return part;
    });
};

export default MarkdownRenderer;