import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { registry } from "../../db.js";
import * as crypto from "node:crypto";
import { TokenTracker } from "../tokenTracker.js";
import { burstGuard } from "../utils/burstGuard.js";

let globalRateLimitUntil = 0;

export type AnalysisTier = 'basic' | 'pro';

const TIERS = {
  basic: {
    maxChunks: 5,
    maxTokens: 2000,
    maxChars: 10000
  },
  pro: {
    maxChunks: 15,
    maxTokens: 4000,
    maxChars: 30000
  }
};

/**
 * Automatically identifies the AI provider based on the API key format.
 */
export function identifyProvider(apiKey: string): 'gemini' | 'openai' | 'anthropic' | 'unknown' {
  if (apiKey.startsWith('AIza')) return 'gemini';
  if (apiKey.startsWith('sk-ant')) return 'anthropic';
  if (apiKey.startsWith('sk-')) return 'openai';
  return 'unknown';
}

/**
 * Lists models for the detected provider. 
 * (Currently implemented for Gemini as requested for diagnostics).
 */
export async function listAvailableModels(apiKey: string, provider: string) {
  if (provider === 'gemini') {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await resp.json();
      if (data.models) {
        console.log(`✅ [Gemini] Available models for this key:`, data.models.map((m: any) => m.name).join(', '));
      }
    } catch (e) {
      console.warn("⚠️ [Gemini] Could not list models.");
    }
  } else if (provider === 'openai') {
    console.log("ℹ️ [OpenAI] gpt-4o-mini is the default stable model.");
  }
}

export async function answerQuestion(
  prompt: string,
  context: string,
  apiKey: string,
  model?: string,
  providerOverride?: 'gemini' | 'openai', // Kept for backward compat but usually auto-detected
  maxTokens = 2000,
  requestId?: string
): Promise<string> {
  const provider = identifyProvider(apiKey);
  const now = Date.now();

  if (now < globalRateLimitUntil) {
    const remaining = Math.ceil((globalRateLimitUntil - now) / 1000);
    throw new Error(`RATE_LIMIT:${remaining}`);
  }

  if (!context?.trim()) {
    return "No context provided for analysis.";
  }

  const finalPrompt = prompt.includes(context.substring(0, 100)) ? prompt : `${prompt}\n\nContext:\n${context}`;

  // 1. Burst Guard - Wait if we're spamming
  await burstGuard.wait(provider === 'gemini' ? 'google' : 'openai');

  // 2. Token Tracker (Sized for diagnostic, now commented out as requested)
  /*
  const inputEstimate = Math.ceil(finalPrompt.length / 4);
  await TokenTracker.getInstance().checkAndRegister({ requests: 1, tokens: inputEstimate });
  */

  // --- OPENAI PATH ---
  if (provider === 'openai') {
    const openai = new OpenAI({ apiKey });
    const targetModel = model || "gpt-4o-mini";
    try {
      console.log(`📡 [OpenAI] Request: Model=${targetModel}, Prompt=${finalPrompt.length} chars`);
      const response = await openai.chat.completions.create({
        model: targetModel,
        messages: [
          { role: "system", content: "You are a helpful AI assistant analyzing CVs." },
          { role: "user", content: finalPrompt }
        ],
        max_tokens: maxTokens,
        temperature: 0,
      });

      const text = response.choices[0].message.content || "No answer generated.";

      /*
      const usedTokens = response.usage?.total_tokens || (inputEstimate + Math.ceil(text.length / 4));
      TokenTracker.getInstance().trackUsage('Analysis', usedTokens, requestId);
      */

      return text;
    } catch (e: any) {
      console.error("❌ [OpenAI Raw Error]:", e?.response?.data || e.message || e);
      if (e.message?.includes("429") || e.message?.toLowerCase().includes("quota")) {
        globalRateLimitUntil = Date.now() + 60000;
        throw new Error("RATE_LIMIT:60");
      }
      throw new Error(`OpenAI Analysis failed: ${e.message}`);
    }
  }

  // --- GEMINI PATH (Default) ---
  const targetModel = model || "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(apiKey);

  const attemptGemini = async (modelName: string) => {
    console.log(`📡 [Gemini] Request: Model=${modelName}, Prompt=${finalPrompt.length} chars`);
    const geminiModel = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0,
      }
    }, { apiVersion: 'v1beta' });

    const result = await geminiModel.generateContent(finalPrompt);
    const response = result.response;
    const text = response.text();
    if (!text) throw new Error("AI returned empty response text");

    /*
    const promptTokens = Math.ceil(finalPrompt.length / 4);
    const usedTokens = response.usageMetadata?.totalTokenCount || (promptTokens + Math.ceil(text.length / 4));
    TokenTracker.getInstance().trackUsage('Analysis', usedTokens, requestId);
    */

    return text;
  };

  try {
    return await attemptGemini(targetModel);
  } catch (err: any) {
    const msg = err.message || String(err);
    console.error(`❌ [Gemini Raw Error]:`, msg);

    if (msg.includes("429") || msg.includes("Quota exceeded") || msg.includes("Too Many Requests")) {
      await listAvailableModels(apiKey, 'gemini'); // Diagnostic help
      globalRateLimitUntil = Date.now() + 60000;
      throw new Error(`RATE_LIMIT:60`);
    }

    if (msg.includes("404") || msg.includes("not found")) {
      console.warn(`⚠️ Model ${targetModel} not found. Attempting stable fallback...`);
      await listAvailableModels(apiKey, 'gemini');
      const fallbacks = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-pro"];
      for (const f of fallbacks) {
        if (f === targetModel) continue;
        try {
          return await attemptGemini(f);
        } catch (inner) {
          console.log(`❌ Fallback ${f} failed: ${inner}`);
        }
      }
    }

    throw new Error(`AI Generation failed: ${msg}`);
  }
}

export async function analyzeTalentPool(
  chunks: any[],
  jobContext: string,
  apiKey: string,
  model: string = "gemini-2.5-flash",
  provider?: 'gemini' | 'openai',
  tier: AnalysisTier = 'basic',
  requestId?: string
): Promise<any> {
  const tierConfig = TIERS[tier] || TIERS.basic;
  const maxChunks = tierConfig.maxChunks;
  const maxTokens = tierConfig.maxTokens;
  const maxChars = tierConfig.maxChars;

  const jobHash = crypto.createHash('sha256').update(jobContext || 'standard').digest('hex');
  const finalRequestId = requestId || crypto.randomBytes(4).toString('hex');

  console.log(`🔍 [${finalRequestId}] Analyzing ${chunks.length} chunks [Tier: ${tier}]. Hash: ${jobHash.substring(0, 8)}`);

  // Cache check
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
    return { candidates: cachedCandidates, summary: "Retrieved from cache." };
  }

  const filteredChunks = chunks.filter(c => docsToAnalyze.includes(c.payload.source));
  const topChunks = filteredChunks.sort((a, b) => b.score - a.score).slice(0, maxChunks);

  let contextText = topChunks
    .map(c => `[${c.payload.source} - chunk ${c.payload.chunkIndex}]\n${c.payload.text}`)
    .join("\n\n");

  if (contextText.length > maxChars) {
    contextText = contextText.substring(0, maxChars) + "... [Truncated]";
  }

  const prompt = `
      You are an expert talent recruiter. Analyze these CV chunks for: "${jobContext || 'Standard Assessment'}".
      Return ONLY a JSON object:
      {
        "candidates": [
           { "source": "filename.pdf", "score": 85, "suitable": true, "justification": "2-sentence technical summary" }
        ],
        "summary": "Overall pool summary"
      }

      Data:
      ${contextText}
    `;

  const rawResponse = await answerQuestion(prompt, contextText, apiKey, model, provider, maxTokens, finalRequestId);

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
    console.warn("❌ JSON Parse Failed. Raw response returned.");
  }

  return { summary: rawResponse, candidates: [] };
}
