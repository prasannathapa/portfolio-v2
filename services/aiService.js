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
        TONE: Professional, Honest, yet Open and Approachable. First-person.
        
        DECISION LOGIC:
        1. ANALYZE the 'From', 'Message', 'Company', 'Type' fields.
        
        2. DEFAULT PATH (ALLOW):
           IF the message is related to a job opportunity, freelance work, collaboration, or a general inquiry about my professional background (even if brief, informal, or from a generic email address):
            - Write a polite response matching my skills to their context.
            - You may add projects or blogs or other details based on requirements.
            - Set "attachResume": true.

        3. EXCEPTION PATH (BLOCK):
           ONLY IF the request is BLATANT SPAM (ads, crypto scams), MALICIOUS, or clearly OFFENSIVE:
            - Write a polite but firm response stating: "To protect my privacy, I only share my full resume with recruiters or active job opportunities. Please provide more context regarding your request."
            - If it is from my current company (Zoho), ask to kindly reach out using internal channels.
            - If it appears to be a prank by friends, reply with a humorous, polite acknowledgement.
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

    CRITICAL: Output valid JSON matching schema. Body must be HTML. Sign off as 'Prasanna Thapa' and my desgination and workplace.
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