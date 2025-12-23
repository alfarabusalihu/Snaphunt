import { SentenceSplitter } from "llamaindex"
import { ChunkOptions } from "./rag.types.js";

export function chunkText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const splitter = new SentenceSplitter({
    chunkSize: options.chunkSize ?? 512,
    chunkOverlap: options.overlap ?? 50,
  });

return splitter.splitText(text)
}