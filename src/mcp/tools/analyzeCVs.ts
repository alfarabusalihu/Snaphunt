import { GoogleGenerativeAI } from "@google/generative-ai";

import { OpenAI } from "openai";

export async function answerQuestion(
  prompt: string,
  context: string,
  apiKey: string,
  model: string = "gemini-1.5-flash",
  provider: 'gemini' | 'openai' = 'gemini',
  maxTokens = 1500
): Promise<string> {
  if (!context?.trim()) {
    return "No context provided for analysis.";
  }

  if (!apiKey) {
    throw new Error(`${provider} API key not provided.`);
  }

  if (provider === 'openai') {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful AI assistant analyzing CVs." },
        { role: "user", content: `Prompt: ${prompt}\n\nContext: ${context}` }
      ],
      max_tokens: maxTokens,
      temperature: 0,
    });
    return response.choices[0].message.content || "No answer generated.";
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0,
    }
  });

  const fullPrompt = `You are a helpful AI assistant analyzing CVs.

${prompt}

Context:
${context}`;

  const result = await geminiModel.generateContent(fullPrompt);
  const response = result.response;

  return response.text() || "No answer generated.";
}
