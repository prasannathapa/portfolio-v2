const { GoogleGenAI } = require("@google/genai");
const fs = require('fs');
const config = require('../config/config');

// Helper: Context
const getContext = () => {
    try { return fs.readFileSync(config.ABOUT_ME_PATH, 'utf8'); }
    catch { return "Senior Software Engineer."; }
};

// Helper: Retry
const runWithRetry = async (fn, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try { return await fn(); }
        catch (error) {
            const isRateLimit = error.message?.includes('429') || (error.status === 429);
            if (isRateLimit && i < retries - 1) {
                const delay = 2000 * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else { throw error; }
        }
    }
};

const generateResponse = async (name, company, type, message, projects) => {
    if (!config.GEMINI_API_KEY) return { subject: "Re: Request", body: "<p>Received.</p>", attachResume: false };

    const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
    const projectsContext = projects.map(p => ({ title: p.title, description: p.content, link: p.blog || "" }));

    let instructions = "";
    if (type === 'resume') {
        instructions = `
        ACT AS: Prasanna Thapa (Me).
        TONE: Professional, Honest, Protective of Data. First-person, Trustable and dependable
        
        DECISION LOGIC:
        1. ANALYZE the 'From', 'Message', 'Company', 'Type' etc fields.
        2. IF the request seems GENUINE (valid company, clear intent, professional wording):
            - Write a polite response matching my skills (from PROFILE) to their context.
            - You may add projects or blogs or other details based on requirements
            - Set "attachResume": true.
        3. IF the request looks like SPAM, FRAUD, or suspecious:
            - Write a polite but firm response stating: "To protect my privacy, I only share my full resume with verified recruiters or active job opportunities. Please provide your official company email or job details to proceed. or rephrase it depending on the context, like I am already working in X if the recuiter is from X comapny.. make it personalised"
            - You may add projects or blogs or other details based on requirements
            - If you feel like prank by my friends or someone unknown, reply an acknowldgement in a humorous polite way.
            - Set "attachResume": false.
        `;
    } else if (type === 'contact') {
        instructions = `
        ACT AS: Prasanna Thapa (Me).
        TONE: Casual, friendly, slightly humorous. First-person, factually correct
        TASK: Acknowledge the message warmly, you might fact check, refrain for anything controversial
        You may add projects or blogs or other details based on requirements
        ACTION: Set "attachResume": false, (inless needed explicitily)
        `;
    } else {
        instructions = `
        ACT AS: Prasanna Thapa (Me).
        TONE: Neutral, efficient.
        TASK: Confirm receipt of request, add some cool relevant interesting facts (like software engineering) and make it human and personalised. 
        This is just a ask for access request to unlock full details like phone number or other personal things, try not to sell/oversell myself  
        ACTION: Set "attachResume": false.
        `;
    }

    const prompt = `
    ${instructions}
    
    MY PROFILE: ${getContext()}
    MY PROJECTS: ${JSON.stringify(projectsContext)}
    
    INCOMING MESSAGE:
    From: ${name}
    Company: ${company || "Not specified"}
    Type: ${type}
    Message: "${message}"
    Time: ${Date.now()}

    CRITICAL: Output valid JSON matching schema. Body must be HTML. Sign off as 'Prasanna Thapa' and my desgination.
    `;

    return runWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: config.MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseJsonSchema: config.EMAIL_RESPONSE_SCHEMA,
                temperature: 1.2, // Higher (0.0 - 2.0) = More creative/random
                topP: 0.95,       // Wider vocabulary selection
            }
        });
        if (response.text) return JSON.parse(response.text);
        throw new Error("Empty response from AI");
    });
};

module.exports = { generateResponse };