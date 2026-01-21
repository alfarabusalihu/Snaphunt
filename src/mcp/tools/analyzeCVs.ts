import { registry } from "../../db.js";
import * as crypto from "node:crypto";
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createMistral } from '@ai-sdk/mistral';
import { getProviderByKey } from "../utils/provider.js";

export type AnalysisTier = 'basic' | 'pro';

interface TierConfig {
  maxChunks: number;
  maxTokens: number;
  maxChars: number;
}

/**
 * Robustly attempts to repair and parse JSON from LLM responses.
 * Handles common issues like unescaped quotes, control characters, and truncation.
 */
function robustParse(text: string): any {
  // 1. Extract the JSON block
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON structure found in response");
  let json = jsonMatch[0];

  try {
    return JSON.parse(json);
  } catch (e) {
    console.warn("💡 Initial JSON parse failed, attempting heuristic repair...");

    // Repair step 1: Control characters
    json = json.replace(/[\u0000-\u001F]+/g, " ");

    // Repair step 2: Trailing commas
    json = json.replace(/,\s*([}\]])/g, "$1");

    // Repair step 3: Simple unescaped quotes in property values
    // This is risky but often works for justification strings: "prop": "value with "quotes" inside"
    // We look for "Key": "Value" pattern and try to escape internal quotes
    json = json.replace(/(": ")(.*?)(",)/g, (match, p1, p2, p3) => {
      const escaped = p2.replace(/"/g, '\\"');
      return p1 + escaped + p3;
    });

    // Repair step 4: Balance braces/brackets (Truncation check)
    let openBraces = (json.match(/\{/g) || []).length;
    let closeBraces = (json.match(/\}/g) || []).length;
    while (openBraces > closeBraces) {
      json += "}";
      closeBraces++;
    }

    let openBrackets = (json.match(/\[/g) || []).length;
    let closeBrackets = (json.match(/\]/g) || []).length;
    while (openBrackets > closeBrackets) {
      json += "]";
      closeBrackets++;
    }

    try {
      return JSON.parse(json);
    } catch (finalError) {
      console.error("❌ Robust repair failed. Raw JSON segment:", json.substring(0, 500));
      throw finalError;
    }
  }
}

/**
 * Logic with exponential backoff for AI calls
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const msg = String(e).toLowerCase();
      if (msg.includes("overloaded") || msg.includes("429") || msg.includes("too many requests")) {
        const delay = Math.pow(2, i + 1) * 1000;
        console.warn(`⚠️ Model overloaded or rate limited, retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

const TIERS: Record<string, TierConfig> = {
  basic: {
    maxChunks: 10, // Optimized for speed on 2.0
    maxTokens: 3000,
    maxChars: 18000
  },
  pro: {
    maxChunks: 30, // Balanced for depth and latency
    maxTokens: 8000,
    maxChars: 45000
  }
};

function getModel(apiKey: string, modelName?: string, providerOverride?: string) {
  const provider = providerOverride || getProviderByKey(apiKey);
  console.log(`🤖 [getModel] Trace:`);
  console.log(`   - Model: ${modelName || 'default'}`);
  console.log(`   - Override: ${providerOverride || 'none'}`);
  console.log(`   - Detected: ${getProviderByKey(apiKey) || 'none'}`);
  console.log(`   - Final: ${provider || 'UNDEFINED'}`);

  if (!provider) {
    throw new Error(`Invalid or unrecognized API key format. Key: ${apiKey?.substring(0, 5)}..., ProviderSig: ${providerOverride}`);
  }

  const targetModel = modelName || 'gemini-2.5-flash';

  if (provider === 'google') {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(targetModel);
  }

  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey });
    // Default to sonnet if a gemini model was somehow passed for an anthropic key
    const finalModel = targetModel.includes('gemini') ? 'claude-3-5-sonnet-20241022' : targetModel;
    return anthropic(finalModel);
  }

  if (provider === 'mistral') {
    const mistral = createMistral({ apiKey });
    // Default if gemini passed for mistral
    const finalModel = targetModel.includes('gemini') ? 'mistral-large-latest' : targetModel;
    return mistral(finalModel);
  }

  if (provider === 'openai') {
    const openai = createOpenAI({ apiKey });
    // Default if gemini passed for openai
    const finalModel = targetModel.includes('gemini') ? 'gpt-4o-mini' : targetModel;
    return openai(finalModel);
  }

  throw new Error(`Provider for the given API key is not supported: ${provider}`);
}

export async function answerQuestion(
  prompt: string,
  contextText: string,
  apiKey: string,
  model?: string,
  provider?: string,
  maxTokens: number = 2000,
  requestId?: string
): Promise<string> {
  try {
    const aiModel = getModel(apiKey, model, provider);
    const { text } = await generateText({
      model: aiModel,
      prompt: `Context:\n${contextText}\n\nQuestion: ${prompt}`,
      maxOutputTokens: maxTokens,
      temperature: 0.1
    });
    return text;
  } catch (e: any) {
    if (e.message?.includes('429')) {
      throw new Error("RATE_LIMIT:60");
    }
    console.error("QA Error:", e);
    throw new Error(`AI generation failed: ${e.message}`);
  }
}

export async function analyzeTalentPool(
  chunks: any[],
  jobContext: string,
  apiKey: string,
  model: string = "gemini-2.5-flash",
  tier: AnalysisTier = 'basic',
  requestId?: string,
  externalMaxChunks?: number,
  provider?: string
): Promise<any> {
  const tierConfig = TIERS[tier] || TIERS.basic;
  const maxChunks = externalMaxChunks || tierConfig.maxChunks;
  const maxChars = tierConfig.maxChars;

  const jobHash = crypto.createHash('sha256').update(jobContext || 'standard').digest('hex');
  const finalRequestId = requestId || crypto.randomUUID();

  console.log(`🔍 [${finalRequestId}] Analyzing ${chunks.length} chunks [Tier: ${tier}, MaxChunks: ${maxChunks}]`);

  // 1. Cache Check
  const uniqueSources = Array.from(new Set(chunks.map(c => c.payload.source)));
  const cachedCandidates: any[] = [];
  const docsToAnalyze: string[] = [];

  let allDocs: any[] = [];
  try {
    allDocs = registry.getAllDocuments();
  } catch (e) {
    console.warn("Registry access failed, skipping cache check", e);
  }

  if (allDocs.length > 0) {
    for (const source of uniqueSources) {
      const doc = allDocs.find((d: any) => d.location === source || d.file_name === source);
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
      docsToAnalyze.push(source as string);
    }
  } else {
    docsToAnalyze.push(...uniqueSources as string[]);
  }

  if (docsToAnalyze.length === 0 && cachedCandidates.length > 0) {
    return { candidates: cachedCandidates, summary: "Retrieved from cache." };
  }

  // 2. Smart Context Preparation (Candidate-Centric)
  // Group chunks by source to ensure balanced representation
  const chunksBySource: Record<string, any[]> = {};
  chunks.forEach(c => {
    const src = c.payload.source;
    if (!chunksBySource[src]) chunksBySource[src] = [];
    chunksBySource[src].push(c);
  });

  const selectedChunks: any[] = [];
  const sourcesToProcess = docsToAnalyze.filter(s => chunksBySource[s]);

  // Take top chunks per candidate until we hit maxChunks
  let chunkCount = 0;
  let pass = 0;
  while (chunkCount < maxChunks && sourcesToProcess.some(s => chunksBySource[s].length > pass)) {
    for (const src of sourcesToProcess) {
      if (chunksBySource[src][pass]) {
        selectedChunks.push(chunksBySource[src][pass]);
        chunkCount++;
        if (chunkCount >= maxChunks) break;
      }
    }
    pass++;
  }

  let contextText = selectedChunks
    .map(c => `[Candidate: ${c.payload.fileName || c.payload.source}]\n${c.payload.text}`)
    .join("\n\n---\n\n");

  if (contextText.length > maxChars) {
    console.log(`⚠️ Context too long (${contextText.length} chars), truncating to ${maxChars}`);
    contextText = contextText.substring(0, maxChars) + "... [Truncated]";
  }

  console.log(`📦 Final Context: ${selectedChunks.length} chunks from ${sourcesToProcess.length} candidates. Length: ${contextText.length} chars.`);

  const systemPrompt = `
    You are an expert talent recruiter. Analyze the provided CV data for the role/context: "${jobContext || 'General Talent Assessment'}".
    
    Task:
    1. Evaluate each candidate based on the provided context.
    2. Assign a suitability score (0-100).
    3. Determine if they are 'suitable' (boolean).
    4. Provide a CONCISE, professional justification (1-2 sentences).
    5. Provide a global 'summary' of the entire talent pool.

    - You MUST return a valid JSON object.
    - Ensure EVERY candidate mentioned in the context is included in the 'candidates' array.
    - Match 'source' to the filename shown in the headers (e.g., "John_Doe_CV.pdf").
    - IMPORTANT: JSON values must be strictly escaped. Do NOT include unescaped newlines or quotes inside justification strings.
    `;

  try {
    const aiModel = getModel(apiKey, model, provider);
    let analysis: any;

    try {
      console.log(`🔬 [${finalRequestId}] Requesting structured output...`);
      const result = await withRetry(() => generateObject({
        model: aiModel,
        schema: z.object({
          summary: z.string(),
          candidates: z.array(z.object({
            source: z.string(),
            score: z.number().min(0).max(100),
            suitable: z.boolean(),
            justification: z.string()
          }))
        }),
        system: systemPrompt,
        prompt: `CV Data:\n${contextText}`,
        maxOutputTokens: tierConfig.maxTokens,
        temperature: 0.1,
      }));
      analysis = result.object;
    } catch (structuredError: any) {
      console.warn(`⚠️ [${finalRequestId}] generateObject failed (or was overloaded), falling back...`);

      const { text } = await withRetry(() => generateText({
        model: aiModel,
        system: systemPrompt + "\n\nResponse format: JSON only.",
        prompt: `CV Data:\n${contextText}`,
        maxOutputTokens: tierConfig.maxTokens,
        temperature: 0.1,
      }));

      try {
        analysis = robustParse(text);
      } catch (pErr: any) {
        console.error("❌ Critical Analysis Failure: Could not parse or repair AI response.");
        throw new Error(`Analysis failed: ${pErr.message}`);
      }
    }

    // 4. Post-process & Cache
    if (analysis.candidates) {
      analysis.candidates = analysis.candidates.map((candidate: any) => {
        const cleanSource = candidate.source.split(/[\\\/]/).pop() || candidate.source;
        const doc = allDocs.find(d => d.file_name === cleanSource || d.location.endsWith(cleanSource));

        if (doc) {
          try {
            registry.saveAnalysis({
              id: crypto.randomUUID(),
              document_id: doc.id,
              hash: jobHash,
              score: candidate.score,
              suitable: candidate.suitable,
              report: candidate.justification
            });
          } catch (e) { console.warn("Cache save failed", e); }
          return { ...candidate, source: cleanSource, location: doc.location };
        }
        return { ...candidate, source: cleanSource };
      });
    }

    if (cachedCandidates.length > 0) {
      analysis.candidates = [...(analysis.candidates || []), ...cachedCandidates];
    }

    return analysis;

  } catch (error: any) {
    console.error("Deep Analysis Failed:", error);
    if (error.message?.includes('429')) {
      throw new Error("RATE_LIMIT:60");
    }
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

import { queryDocuments } from "../rag/retriever.js";

export const analyzeTool = {
  name: "analyze_talent_pool",
  description: "Analyze candidates based on job description",
  run: async (args: { query: string, apiKey: string, model?: string, tier?: 'basic' | 'pro', request_id?: string, provider?: string }) => {
    // 1. Get relevant chunks
    const retrieval = await queryDocuments(args.query, args.apiKey, { topK: 30, requestId: args.request_id, provider: args.provider });

    // 2. Perform Analysis
    const result = await analyzeTalentPool(
      retrieval.chunks,
      args.query,
      args.apiKey,
      args.model,
      args.tier,
      args.request_id,
      undefined,
      args.provider
    );

    return result;
  }
};
