class TaskQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    add(task, meta = { retries: 0, id: Date.now() }) {
        console.log(`[Queue] Task ${meta.id} added. Position: ${this.queue.length + 1}`);
        this.queue.push({ task, meta });
        this.process();
    }

    async process() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        const { task, meta } = this.queue.shift();

        try {
            console.log(`[Queue] Processing Task ${meta.id} (Attempt ${meta.retries + 1})...`);
            await task();
            console.log(`[Queue] Task ${meta.id} Completed Successfully. ✅`);
        } catch (error) {
            const msg = error.message || JSON.stringify(error);
            console.error(`[Queue] Task ${meta.id} Failed:`, msg);

            // --- SMART RETRY LOGIC ---
            // 1. FATAL ERRORS (Do NOT Retry)
            if (msg.includes('404') || msg.includes('Not Found') || msg.includes('400') || msg.includes('API key')) {
                console.error(`[Queue] 🛑 Fatal Error detected (Model not found / Auth error). Dropping task.`);
            } 
            // 2. RETRYABLE ERRORS (Rate Limits / Server Issues)
            else if (meta.retries < 5) {
                // Exponential Backoff: 1m, 2m, 4m, 8m...
                const delay = Math.pow(2, meta.retries) * 60 * 1000; 
                console.log(`[Queue] ⚠️ Transient Error. Re-queueing in ${delay / 1000}s...`);
                
                setTimeout(() => {
                    console.log(`[Queue] 🔄 Re-adding Task ${meta.id} for retry.`);
                    this.add(task, { retries: meta.retries + 1, id: meta.id });
                }, delay);
            } 
            // 3. MAX RETRIES REACHED
            else {
                console.error(`[Queue] ❌ Max retries (5) exceeded. Task dropped.`);
            }
        }

        this.isProcessing = false;
        if (this.queue.length > 0) this.process();
    }
}

module.exports = new TaskQueue();