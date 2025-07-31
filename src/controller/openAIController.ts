import { Request, Response } from "express";
import OpenAI from "openai";
import { TextContentBlock } from "openai/resources/beta/threads/messages";
import Stream from "stream";
import axios from "axios";
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
    const { threadId, image_url = null, prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    let activeThreadId = threadId;
    if (!activeThreadId) {

        try {
            const thread = await openai.beta.threads.create();
            activeThreadId = thread.id;
            console.log(activeThreadId)
        } catch (err) {
        }
    }
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
    // Step 2: Add user's message to thread
    image_url && await openai.beta.threads.messages.create(activeThreadId, {
        role: 'user',
        content: content
    });

    // Step 3: Run assistant
    const run = await openai.beta.threads.runs.create(activeThreadId, {
        assistant_id: ASSISTANT_ID,
    });
    // Step 4: Wait until run is completed
    let runStatus = run.status;
    let retries = 0;

    while (runStatus !== 'completed' && retries < 20) {
        await new Promise((r) => setTimeout(r, 1000));
        const checkRun = await openai.beta.threads.runs.retrieve(run.id, { thread_id: activeThreadId });
        runStatus = checkRun.status;
        if (runStatus === 'failed' || runStatus === 'cancelled') {
            throw new Error(`Run ${run.id} failed or was cancelled.`);
        }
        retries++;
    }
    const messages = await openai.beta.threads.messages.list(activeThreadId);
    const latest = messages.data.find(m => m.role === 'assistant');
    const reply = (latest?.content[0] as TextContentBlock)?.text?.value || 'No reply received.';
    res.status(200).json({
        success: true,
        threadId: activeThreadId,
        reply,
    });

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
            // Handle tool calls (function calls) in OpenAI streaming events
            if (
                event.event === 'thread.run.step.created' &&
                event.data?.step_details?.type === 'tool_calls' &&
                Array.isArray(event.data.step_details.tool_calls)
            ) {
                const runId = event.data.run_id;
                const toolCalls = event.data.step_details.tool_calls;
                for (const toolCall of toolCalls) {
                    if (
                        toolCall.type === 'function' &&
                        toolCall.function?.name === 'webSearch'
                    ) {
                        // toolCall.function.arguments is a JSON string
                        let argsObj: any = {};
                        try {
                            argsObj = JSON.parse(toolCall.function.arguments);
                        } catch (e) {}
                        let query = argsObj.query || argsObj["query"];
                        console.log('[toolCall] webSearch function called with arguments:', argsObj); // LOGGING
                        if (typeof query !== "string") query = String(query);
                        let result;
                        try {
                            result = await webSearch(query);
                        } catch (err) {
                            result = "Web search failed: " + (err as Error).message;
                        }
                        // Send tool result back to OpenAI (thread_id required)
                        await openai.beta.threads.runs.submitToolOutputs(
                            runId,
                            {
                                tool_outputs: [
                                    {
                                        tool_call_id: toolCall.id,
                                        output: result
                                    }
                                ],
                                thread_id: activeThreadId
                            }
                        );
                    }
                }
            } else {
                // Log assistant message deltas for debugging
                if (event.event === 'thread.message.delta') {
                    console.log('[Assistant Message Delta]', JSON.stringify(event.data));
                }
                // Stream normal events to client
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            }
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

// Web search tool function for SerpAPI
async function webSearch(query: string) {
    console.log('[webSearch] Tool called with query:', query); // LOGGING
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) throw new Error("SERPAPI_KEY not set");
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}`;
    const response = await axios.get(url);
    // Return only the top result snippet for brevity
    const topResult = response.data?.organic_results?.[0]?.snippet || "No results found.";
    return topResult;
}


