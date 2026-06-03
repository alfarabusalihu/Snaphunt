import { registry } from '../database/index.js';
import * as crypto from "node:crypto";
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getProviderByKey } from "../utils/provider.js";
import { TokenTracker } from "../tokenTracker.js";

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
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("❌ LLM output was:", text);
    throw new Error("No JSON structure found in response");
  }
  let json = jsonMatch[0];

  try {
    return JSON.parse(json);
  } catch (e) {
    console.warn("💡 Initial JSON parse failed, attempting heuristic repair...");

    json = json.replace(/[\u0000-\u001F]+/g, " ");
    json = json.replace(/,\s*([}\]])/g, "$1");
    json = json.replace(/(": ")(.*?)(",)/g, (match, p1, p2, p3) => {
      const escaped = p2.replace(/"/g, '\\"');
      return p1 + escaped + p3;
    });

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
    maxChunks: 10,
    maxTokens: 2000,
    maxChars: 15000
  },
  pro: {
    maxChunks: 30,
    maxTokens: 8000,
    maxChars: 45000
  }
};

function getModel(apiKey: string, modelName?: string, providerOverride?: string) {
  const targetModel = modelName || 'gemini-2.5-flash';

  const google = createGoogleGenerativeAI({ apiKey });
  return google(targetModel);
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

const prunedJdCache = new Map<string, string>();

async function pruneJD(jd: string, apiKey: string): Promise<string> {
  if (!jd || jd.length < 100) {
    return JSON.stringify({
      skills: [],
      experience: jd || "",
      education: ""
    });
  }

  const normalizedRaw = jd.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const rawHash = crypto.createHash('sha256').update(normalizedRaw).digest('hex');

  if (prunedJdCache.has(rawHash)) {
    console.log(`✂️  [JD Pruning] Cache hit!`);
    return prunedJdCache.get(rawHash)!;
  }

  try {
    const aiModel = getModel(apiKey, 'gemini-2.5-flash');
    const { text } = await generateText({
      model: aiModel,
      system: `You are a recruitment data cleaner. Your job is to strip a job description down to ONLY the essential matching criteria.
You MUST output strictly a valid JSON object. No markdown code blocks, no other text.
The JSON object must have exactly these fields:
- "skills": array of strings (required skills, tools, frameworks, certifications).
- "experience": a concise description of required experience years and responsibilities.
- "education": a concise description of educational qualifications.

Example output:
{
  "skills": ["TypeScript", "Node.js", "AWS"],
  "experience": "3+ years of experience building scalable backend microservices",
  "education": "BS in Computer Science or equivalent"
}`,
      prompt: jd,
      maxOutputTokens: 500,
      temperature: 0
    });

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      JSON.parse(cleanedText);
      prunedJdCache.set(rawHash, cleanedText);
      console.log(`✂️  [JD Pruning] ${jd.length} chars → ${cleanedText.length} chars (JSON format cached)`);
      return cleanedText;
    } catch (parseErr) {
      console.warn("⚠️ Failed to parse pruned JD JSON, robust repairing...");
      const parsed = robustParse(cleanedText);
      const stringified = JSON.stringify(parsed);
      prunedJdCache.set(rawHash, stringified);
      return stringified;
    }
  } catch (e) {
    console.warn('⚠️ JD Pruning failed, falling back to raw JD wrapped in JSON', e);
    return JSON.stringify({
      skills: [],
      experience: jd,
      education: ""
    });
  }
}

export async function analyzeTalentPool(
  chunks: any[],
  jobContext: string,
  apiKey: string,
  model: string = "gemini-2.5-flash",
  tier: AnalysisTier = 'pro',
  requestId?: string,
  externalMaxChunks?: number,
  provider?: string,
  keywords?: string[]
): Promise<any> {
  const tierConfig = (TIERS[tier] || TIERS.pro) as TierConfig;
  const maxChunks = externalMaxChunks || tierConfig.maxChunks;
  const maxChars = tierConfig.maxChars;

  // 0. JD Pruning
  const prunedJD = await pruneJD(jobContext, apiKey);

  // Normalization logic for prunedJD
  let normalizedPrunedJD = "";
  try {
    const parsedJd = JSON.parse(prunedJD);
    const sortedSkills = Array.isArray(parsedJd.skills) ? parsedJd.skills.sort().join(",") : "";
    const cleanExp = String(parsedJd.experience || "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    const cleanEdu = String(parsedJd.education || "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    normalizedPrunedJD = `skills:${sortedSkills}|exp:${cleanExp}|edu:${cleanEdu}`;
  } catch (e) {
    normalizedPrunedJD = prunedJD.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  // Hashing logic: Include keywords in the hash so changing tags invalidates the cache
  const hashInput = (normalizedPrunedJD || 'standard') + (keywords?.sort().join(',') || '');
  const jobHash = crypto.createHash('sha256').update(hashInput).digest('hex');
  const finalRequestId = requestId || crypto.randomUUID();

  console.log(`🔍 [${finalRequestId}] Analyzing ${chunks.length} chunks [Tier: ${tier}, MaxChunks: ${maxChunks}]`);

  // 1. Cache Check
  const uniqueSources = Array.from(new Set(chunks.map(c => c.payload.source)));
  const cachedCandidates: any[] = [];
  const docsToAnalyze: string[] = [];

  let allDocs: Array<{ id: string; file_name: string; location: string; text_content?: string }> = [];
  try {
    allDocs = await registry.getAllDocuments();
  } catch (e) {
    console.warn("Registry access failed, skipping cache check", e);
  }

  if (allDocs.length > 0) {
    for (const source of uniqueSources) {
      const cleanName = source.split(/[\\\/]/).pop() || source;
      const doc = allDocs.find((d) => d.location === source || d.file_name === source || d.file_name === cleanName);
      if (doc) {
        const cached = await registry.getAnalysisByDocAndHash(doc.id, jobHash);
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

  const preparedCandidates: string[] = [];
  const sourcesToProcess = docsToAnalyze.filter(s => chunksBySource[s]);

  for (const src of sourcesToProcess) {
    const cleanName = src.split(/[\\\/]/).pop() || src;
    const doc = allDocs.find((d: any) => d.location === src || d.file_name === src || d.file_name === cleanName);
    
    let candidateText = "";
    let isStructured = false;

    if (doc && doc.text_content) {
      try {
        const parsed = JSON.parse(doc.text_content);
        if (parsed.skills || parsed.experience || parsed.education) {
          isStructured = true;
          candidateText = JSON.stringify({
            fileName: doc.file_name,
            skills: parsed.skills || [],
            experience: parsed.experience || "",
            education: parsed.education || ""
          });
        }
      } catch (e) {
        // Not a JSON document, fallback
      }
    }

    if (!isStructured) {
      // Fallback: group the top chunks retrieved for this candidate
      const candidateChunks = chunksBySource[src] || [];
      const combinedChunksText = candidateChunks
        .map(c => c.payload.text)
        .join("\n\n---\n\n");
      candidateText = `[Candidate: ${cleanName}] (Raw Text)\n${combinedChunksText}`;
    }

    preparedCandidates.push(candidateText);
  }

  let contextText = preparedCandidates.join("\n\n---\n\n");

  if (contextText.length > maxChars) {
    console.log(`⚠️ Context too long (${contextText.length} chars), optimizing...`);
    // Attempt to truncate at candidate boundary
    const blocks = contextText.split("\n\n---\n\n");
    let optimizedContext = "";
    for (const block of blocks) {
      if ((optimizedContext.length + block.length + 7) <= maxChars) {
        optimizedContext += (optimizedContext ? "\n\n---\n\n" : "") + block;
      } else {
        break;
      }
    }
    contextText = optimizedContext || contextText.substring(0, maxChars);
  }

  console.log(`📦 Final Context: Compiled ${sourcesToProcess.length} candidates. Length: ${contextText.length} chars.`);

  try {
    const aiModel = getModel(apiKey, model, provider);
    let analysis: any;

    console.log(`🔬 [${finalRequestId}] Requesting analysis...`);

    const { text, usage } = await withRetry(() => generateText({
      model: aiModel,
      system: `You are an expert recruiter. Analyze the CV data below against these job requirements:
"${prunedJD || 'General Assessment'}"

${keywords && keywords.length > 0 ? `MANDATORY SKILLS (must appear in CV to be suitable): ${keywords.join(', ')}` : ''}

Rules:
- Focus ONLY on skills, experience, and role fit. Ignore location, salary expectations, and formatting.
- Score each candidate 0-100 based on requirement match.
- Use the exact filename shown in the "fileName" property of the candidate's JSON profile or [Candidate: ...] header as the "source" field in the output.
- Process EVERY candidate present in the context.
- suitable = true only if score >= 60 AND all mandatory skills present.

You MUST respond with ONLY a valid JSON object. No markdown, no explanation, no code fences.
Exact format required:
{"summary":"<one sentence>","candidates":[{"source":"<filename>","score":<number>,"suitable":<boolean>,"justification":"<one sentence>"}]}`,
      prompt: `CV Data:\n${contextText}`,
      maxOutputTokens: tierConfig.maxTokens,
      temperature: 0,
    }));

    if (usage) {
      TokenTracker.getInstance().trackUsage('Analysis', usage.totalTokens || 0, finalRequestId);
    }

    try {
      analysis = robustParse(text);
    } catch (pErr: any) {
      console.error('❌ Critical Analysis Failure. Raw LLM output:', text);
      throw new Error(`Analysis failed: ${pErr.message}`);
    }

    // 4. Post-process & Cache
    if (analysis.candidates) {
      analysis.candidates = await Promise.all(
        analysis.candidates.map(async (candidate: any) => {
          const cleanSource = candidate.source.split(/[\\\/]/).pop() || candidate.source;
          const doc = allDocs.find(d => d.file_name === cleanSource || d.location.endsWith(cleanSource));

          if (doc) {
            try {
              await registry.saveAnalysis({
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
        })
      );
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
  run: async (args: { query: string, apiKey: string, model?: string, tier?: 'basic' | 'pro', request_id?: string, provider?: string, keywords?: string[] }) => {
    // 1. Get relevant chunks (with keyword gating)
    const retrieval = await queryDocuments(args.query, args.apiKey, { 
      topK: 30, 
      requestId: args.request_id, 
      provider: args.provider,
      keywords: args.keywords
    });

    // 2. Perform Analysis
    const result = await analyzeTalentPool(
      retrieval.chunks,
      args.query,
      args.apiKey,
      args.model,
      args.tier,
      args.request_id,
      undefined,
      args.provider,
      args.keywords
    );

    return result;
  }
};
