import { answerQuestion, identifyProvider } from "../tools/analyzeCVs.js";

export const analyzeChunksTool = {
  name: "analyze_chunks",
  description: "Analyze multiple relevant chunks across PDFs using LLM",
  run: async (args: {
    chunks: Array<{ payload: { text: string; source: string; chunkIndex: number }; score: number }>;
    apiKey: string;
    model?: string;
    question?: string;
    requestId?: string;
  }) => {
    const { chunks, apiKey, model = "gemini-2.5-flash", question, requestId } = args;
    console.log(`🛠️ [analyzeTool] Routing through Model=${model}`);

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

    const provider = identifyProvider(apiKey);
    return await answerQuestion(prompt, contextText, apiKey, model, provider === 'openai' ? 'openai' : 'gemini', 1500, requestId);
  },
};
