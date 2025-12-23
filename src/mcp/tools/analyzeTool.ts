import { answerQuestion } from "../tools/analyzeCVs.js";

export const analyzeChunksTool = {
  name: "analyze_chunks",
  description: "Analyze multiple relevant chunks across PDFs using LLM",
  run: async (args: {
    chunks: Array<{ payload: { text: string; source: string; chunkIndex: number }; score: number }>;
    apiKey: string;
    model?: string;
    question?: string;
  }) => {
    const { chunks, apiKey, model = "gpt-4o-mini", question } = args;

    if (!chunks || chunks.length === 0) {
      return "No chunks provided for analysis.";
    }

    const contextText = chunks
      .sort((a, b) => b.score - a.score)
      .map(c => `[${c.payload.source} - chunk ${c.payload.chunkIndex}]\n${c.payload.text}`)
      .join("\n\n");

    const prompt = question
      ? `${question}\n\nContext:\n${contextText}`
      : `Analyze the following CVs and summarize key information:\n\n${contextText}`;

    return await answerQuestion(prompt, contextText, apiKey, model);
  },
};


