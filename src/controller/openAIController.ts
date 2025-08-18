import { Request, Response } from "express";
import OpenAI from "openai";
import { TextContentBlock } from "openai/resources/beta/threads/messages";
import Stream from "stream";
if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY environment variable is not set");
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID as string;

// --- ADDED: Per-thread lock implementation ---
const threadLocks = new Map();
async function withThreadLock(threadId: string, fn: () => Promise<any>) {
    while (threadLocks.get(threadId)) {
        await threadLocks.get(threadId);
    }
    let resolveLock: (() => void) | undefined;
    const lockPromise = new Promise<void>(res => { resolveLock = res; });
    threadLocks.set(threadId, lockPromise);
    try {
        return await fn();
    } finally {
        threadLocks.delete(threadId);
        resolveLock && resolveLock();
    }
}
// --- END ADDED ---


export const imageIdentification = async (req: Request, res: Response) => {
    try {
        const { threadId, image_url = null, prompt } = req.body;
        
        if (!image_url) {
            return res.status(400).json({ error: 'Image URL is required for identification' });
        }

        let activeThreadId = threadId;
        if (!activeThreadId) {
            try {
                const thread = await openai.beta.threads.create();
                activeThreadId = thread.id;
                console.log('Created new thread:', activeThreadId);
            } catch (err) {
                console.error('Failed to create thread:', err);
                return res.status(500).json({ error: 'Failed to create thread' });
            }
        }

        // Simplified, more reliable prompt
        let content: Array<any> = [
            {
                type: 'text',
                text: prompt
            },
            {
                type: 'image_url',
                image_url: {
                    url: image_url
                }
            }
        ];

        // Add message to thread
        await openai.beta.threads.messages.create(activeThreadId, {
            role: 'user',
            content: content
        });

        // Run assistant with timeout
        const run = await openai.beta.threads.runs.create(activeThreadId, {
            assistant_id: ASSISTANT_ID,
        });

        // Wait for completion with timeout and better error handling
        let runStatus = run.status;
        let retries = 0;
        const maxRetries = 30; // 30 seconds max

        while (runStatus !== 'completed' && retries < maxRetries) {
            await new Promise((r) => setTimeout(r, 1000));
            
            try {
                const checkRun = await openai.beta.threads.runs.retrieve(run.id, { thread_id: activeThreadId });
                runStatus = checkRun.status;
                
                if (runStatus === 'failed') {
                    console.error('Run failed:', checkRun.last_error);
                    return res.status(500).json({ 
                        error: 'Assistant run failed', 
                        details: checkRun.last_error 
                    });
                }
                
                if (runStatus === 'cancelled') {
                    return res.status(500).json({ error: 'Assistant run was cancelled' });
                }
            
                
            } catch (err) {
                console.error('Error checking run status:', err);
                return res.status(500).json({ error: 'Failed to check run status' });
            }
            
            retries++;
        }

        if (runStatus !== 'completed') {
            return res.status(408).json({ error: 'Request timeout - assistant took too long to respond' });
        }

        // Get the response
        const messages = await openai.beta.threads.messages.list(activeThreadId);
        const latest = messages.data.find(m => m.role === 'assistant');
        const reply = (latest?.content[0] as TextContentBlock)?.text?.value || 'No reply received.';

        // Try to parse JSON response
        let parsedReply;
        try {
            parsedReply = JSON.parse(reply);
        } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', reply);
            return res.status(500).json({ 
                error: 'Invalid JSON response from AI',
                rawResponse: reply
            });
        }

        res.status(200).json({
            success: true,
            threadId: activeThreadId,
            reply: parsedReply,
        });

    } catch (error) {
        console.error('Error in imageIdentification:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}


export const olleAIChatting = async (req: Request, res: Response) => {
    // Accept parameters from query for GET/SSE
    const threadId = req.query.threadId as string;
    const image_url = req.query.image_url as string | undefined;
    const prompt = req.query.prompt as string;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    let activeThreadId = threadId;
    console.log(activeThreadId)

    // --- ADDED: Use per-thread lock ---
    await withThreadLock(activeThreadId, async () => {
        // --- Check for active runs and wait for completion ---
        if (activeThreadId) {
            try {
                const runs = await openai.beta.threads.runs.list(activeThreadId);
                const activeRun = runs.data.find(run => run.status === 'in_progress' || run.status === 'queued');
                if (activeRun) {
                    let status = activeRun.status;
                    let retries = 0;
                    while (status !== 'completed' && status !== 'failed' && status !== 'cancelled' && retries < 20) {
                        await new Promise(r => setTimeout(r, 1000));
                        const checkRun = await openai.beta.threads.runs.retrieve(activeRun.id, { thread_id: activeThreadId });
                        status = checkRun.status;
                        retries++;
                    }
                    if (status !== 'completed') {
                        return res.status(400).json({ error: 'Previous run is still active or failed to complete.' });
                    }
                }
            } catch (err) {
                console.error('Error checking active runs:', err);
                return res.status(500).json({ error: 'Failed to check thread run status.' });
            }
        }
        // --- END run check ---
        let content: Array<any> = [
            {
                type: 'text',
                text: prompt
            }
        ]
        image_url && content.push({
            type: 'image_url',
            image_url: {
                url: image_url
            }
        })
        await openai.beta.threads.messages.create(
            activeThreadId,
            {
                role: "user",
                content: content
            }
        );
        const stream = await openai.beta.threads.runs.createAndStream(
            activeThreadId,
            { assistant_id: ASSISTANT_ID },
            { stream: true }
        );
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        for await (const event of stream) {
            // Log every event for debugging
            console.log('[OpenAI Stream Event]', JSON.stringify(event));
            
            // Log assistant message deltas for debugging
            if (event.event === 'thread.message.delta') {
                console.log('[Assistant Message Delta]', JSON.stringify(event.data));
            }
            // Stream normal events to client
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        res.write('event: end\ndata: [DONE]\n\n');
        res.end();
    });
    // --- END per-thread lock ---
}

export const olleChat = async (req: Request, res: Response) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            res.status(500).json({
                error: "OpenAI API key is not configured"
            });
            return
        }

        const { prompt } = req.body;
        console.log(prompt);

        const response = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                    ],
                },
            ],
        });
        console.log(response.choices[0]);
        res.json(response.choices[0]);

    } catch (error) {
        console.error("Error in AI Chatting:", error);
        res.status(500).json({
            error: "Failed to process AI chatting"
        });
    }
}

export const getChats = async (req: Request, res: Response) => {
    const { threadId } = req.params;
    try {
        const chats = await openai.beta.threads.messages.list(threadId);
        res.status(200).json(chats.data);
    } catch (error) {
        console.error("Error in getChats:", error);
        res.status(500).json({ error: "Failed to get chats" });
    }
}


