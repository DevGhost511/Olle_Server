import { Request, Response } from "express";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY environment variable is not set");
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const imageIdentification = async (req: Request, res: Response) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            res.status(500).json({
                error: "OpenAI API key is not configured"
            });
            return
        }

        const {imageUrl, prompt} = req.body;
        console.log(imageUrl, prompt);
        
        const response = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                "url": imageUrl
                            },
                        }
                    ],
                },
            ],
        });
        console.log(response.choices[0]);
        res.json(response.choices[0]);

    } catch (error) {
        console.error("Error in image identification:", error);
        res.status(500).json({
            error: "Failed to process image identification"
        });
    }
}
