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

export async function analyzeTalentPool(
  chunks: any[],
  jobContext: string,
  apiKey: string,
  model: string = "gemini-1.5-flash",
  provider: 'gemini' | 'openai' = 'gemini'
): Promise<any> {
  const contextText = chunks
    .sort((a, b) => b.score - a.score)
    .map(c => `[${c.payload.source} - chunk ${c.payload.chunkIndex}]\n${c.payload.text}`)
    .join("\n\n");

  const prompt = `
      You are an expert talent recruiter. Analyze the following CV chunks against this job context: "${jobContext || 'Standard Assessment'}".
      
      For each candidate identified by their source name, provide:
      1. A suitability score (0-100).
      2. A boolean 'suitable' (true if score > 70).
      3. A brief 2-sentence technical justification.

      Return your response as a JSON object with this shape:
      {
        "candidates": [
           { "source": "filename.pdf", "score": 85, "suitable": true, "justification": "..." }
        ],
        "summary": "Overall summary of the talent pool..."
      }

      Context Data:
      ${contextText}
    `;

  const rawResponse = await answerQuestion(prompt, contextText, apiKey, model, provider);

  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("Failed to parse MCP analysis as JSON, returning raw text wrap.");
  }

  return { summary: rawResponse, candidates: [] };
}
