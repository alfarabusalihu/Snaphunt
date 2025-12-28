import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { registry } from "../../db.js";
import * as crypto from "node:crypto";
import { sleep } from "../../utils.js";

let globalRateLimitUntil = 0;

export async function answerQuestion(
  prompt: string,
  context: string,
  apiKey: string,
  model: string = "gemini-1.5-flash",
  provider: 'gemini' | 'openai' = 'gemini',
  maxTokens = 1500
): Promise<string> {
  const now = Date.now();
  if (now < globalRateLimitUntil) {
    const remaining = Math.ceil((globalRateLimitUntil - now) / 1000);
    throw new Error(`RATE_LIMIT:${remaining}`);
  }

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

  let targetModel = model;

  const genAI = new GoogleGenerativeAI(apiKey);

  const finalPrompt = prompt.includes(context.substring(0, 100)) ? prompt : `${prompt}\n\nContext:\n${context}`;

  const attemptGeneration = async (modelName: string) => {
    console.log(`📡 [Gemini] Generation Request: Model=${modelName}, Prompt=${finalPrompt.length} chars`);
    const geminiModel = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0,
      }
    }, { apiVersion: 'v1' });

    const result = await geminiModel.generateContent(finalPrompt);
    const response = result.response;
    const text = response.text();
    if (!text) throw new Error("AI returned empty response text");
    return text;
  };

  try {
    return await attemptGeneration(targetModel);
  } catch (err: any) {
    const msg = err.message || String(err);

    if (msg.includes("429") || msg.includes("Quota exceeded") || msg.includes("Too Many Requests")) {
      let retrySeconds = 60;
      try {
        const errorData = JSON.parse(msg.substring(msg.indexOf('{')));
        const retryInfo = errorData.error?.details?.find?.((d: any) => d['@type']?.includes('RetryInfo'));
        if (retryInfo?.retryDelay) {
          retrySeconds = parseInt(retryInfo.retryDelay);
        }
      } catch (e) {
        const match = msg.match(/retry in ([\d.]+)s/i);
        if (match) retrySeconds = Math.ceil(parseFloat(match[1]));
        else if (msg.includes("limit for 2.0-flash")) retrySeconds = 60;
      }

      globalRateLimitUntil = Date.now() + (retrySeconds * 1000);
      throw new Error(`RATE_LIMIT:${retrySeconds}`);
    }

    // Handle Model Not Found (404) or similar errors -> Fallback
    if (msg.includes("404") || msg.includes("not found") || msg.includes("not supported")) {
      console.warn(`⚠️ Model ${targetModel} failed: ${msg}. Attempting safety fallbacks...`);

      const variants = [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-pro"
      ];

      for (const variant of variants) {
        if (targetModel === variant) continue;
        try {
          console.log(`🔄 Retrying with fallback: ${variant}`);
          return await attemptGeneration(variant);
        } catch (e: any) {
          const innerMsg = e.message || String(e);
          if (innerMsg.includes("429") || innerMsg.includes("Quota exceeded") || innerMsg.includes("Too Many Requests")) {
            globalRateLimitUntil = Date.now() + (60 * 1000);
            throw new Error(`RATE_LIMIT:60`);
          }
          console.log(`❌ Fallback ${variant} failed: ${innerMsg}`);
        }
      }
    }

    console.error("❌ Gemini API Error:", err);
    if (msg.includes("API_KEY_INVALID")) throw new Error("Invalid Gemini API Key");
    if (msg.includes("SAFETY")) throw new Error("AI response blocked by safety filters");
    throw new Error(`AI Generation failed: ${msg}`);
  }

  throw new Error("AI Generation failed after max retries.");
}

export async function analyzeTalentPool(
  chunks: any[],
  jobContext: string,
  apiKey: string,
  model: string = "gemini-1.5-flash",
  provider: 'gemini' | 'openai' = 'gemini',
  maxChunks = 5
): Promise<any> {
  const jobHash = crypto.createHash('sha256').update(jobContext || 'standard').digest('hex');
  const requestId = crypto.randomBytes(4).toString('hex');
  console.log(`🔍 [Backend] [${requestId}] Analyzing ${chunks.length} chunks against job hash: ${jobHash.substring(0, 8)}`);

  const uniqueSources = Array.from(new Set(chunks.map(c => c.payload.source)));
  const cachedCandidates: any[] = [];
  const docsToAnalyze: string[] = [];

  const allDocs = registry.getAllDocuments();

  for (const source of uniqueSources) {
    const doc = allDocs.find(d => d.location === source || d.file_name === source);
    if (doc) {
      const cached = registry.getAnalysisByDocAndHash(doc.id, jobHash);
      if (cached) {
        cachedCandidates.push({
          source: doc.file_name,
          score: cached.suitability_score,
          suitable: !!cached.is_suitable,
          justification: cached.report
        });
        continue;
      }
    }
    docsToAnalyze.push(source);
  }

  if (docsToAnalyze.length === 0 && cachedCandidates.length > 0) {
    console.log(`🚀 Returning cached analysis for ${cachedCandidates.length} candidates.`);
    return { candidates: cachedCandidates, summary: "Retrieved from cache." };
  }
  console.log(`📝 Chunks indicate ${uniqueSources.length} unique sources. ${docsToAnalyze.length} need new analysis.`);

  const MAX_CHARS = 10000;

  // OPTIMIZATION: Filter chunks to ONLY those that need analysis
  const filteredChunks = chunks.filter(c => docsToAnalyze.includes(c.payload.source));

  const topChunks = filteredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks);

  console.log(`✂️ Optimized context: Using top ${topChunks.length} chunks (Filtered from ${chunks.length}).`);

  let contextText = topChunks
    .map(c => `[${c.payload.source} - chunk ${c.payload.chunkIndex}]\n${c.payload.text}`)
    .join("\n\n");

  if (contextText.length > MAX_CHARS) {
    console.warn(`📜 Context too long (${contextText.length} chars). Truncating to ${MAX_CHARS}...`);
    contextText = contextText.substring(0, MAX_CHARS) + "... [Truncated for sustainability]";
  }

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
      const analysis = JSON.parse(jsonMatch[0]);

      if (analysis.candidates) {
        for (const candidate of analysis.candidates) {
          const doc = allDocs.find(d => d.file_name === candidate.source || d.location === candidate.source);
          if (doc) {
            registry.saveAnalysis({
              id: crypto.randomUUID(),
              document_id: doc.id,
              hash: jobHash,
              score: candidate.score,
              suitable: candidate.suitable,
              report: candidate.justification
            });
          }
        }
      }
      return analysis;
    }
  } catch (e) {
    console.warn("Failed to parse MCP analysis as JSON, returning raw text wrap.");
  }

  return { summary: rawResponse, candidates: [] };
}
