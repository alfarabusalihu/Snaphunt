# Analysis of the RAG-based CV Analysis System

## Executive Summary

This report details the findings from a comprehensive analysis of the RAG-based CV analysis system. The primary issue identified is a critical performance bottleneck in the CV ingestion process, which prevents the system from handling even a small number of CVs effectively. The root cause is a synchronous, sequential processing model that fails to leverage modern asynchronous patterns, leading to a slow and inefficient pipeline.

## Key Findings

The investigation into the codebase has revealed three main areas of concern:

### 1. Sequential and Blocking Ingestion Process

The core of the problem lies in the `/ingest` endpoint located in `src/mcp/server.ts`. This endpoint processes uploaded CVs within a `for` loop, handling them one by one.

```typescript
// src/mcp/server.ts

app.post("/ingest", async (req: Request, res: Response) => {
  // ...
  for (const file of files) {
    try {
      const parsedDocs = await parseInput(file.location);
      const doc = parsedDocs[0];
      if (doc) {
        await ingestDocument(/* ... */);
        // ...
      }
    } catch (e) {
      console.error(`Failed to ingest ${file.location}:`, e);
    }
  }
  // ...
});
```

This sequential approach means that the system's total processing time is the sum of the time taken to process each CV. If one CV takes a long time to process, it blocks the entire queue, leaving other CVs waiting. This design is not scalable and is the primary reason for the system's inability to handle multiple files.

### 2. CPU-Intensive Synchronous Parsing

The PDF parsing logic, found in `src/mcp/parser/parse.ts`, uses the `pdfjs-dist` library to extract text from PDF files.

```typescript
// src/mcp/parser/parse.ts

export async function parsePdf(buffer: Buffer): Promise<string> {
    // ...
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // ...
    }
    return text;
}
```

While this is a standard method for PDF text extraction, it is a computationally expensive and synchronous operation. In the context of a Node.js single-threaded event loop, performing such a CPU-intensive task directly within the request-response cycle blocks the entire server. This means that while a PDF is being parsed, the server cannot handle any other incoming requests, leading to a poor user experience and a system that appears unresponsive.

### 3. Lack of Concurrency and Parallelism

The combination of sequential processing and synchronous parsing results in a complete lack of concurrency. The system does not take advantage of modern asynchronous capabilities to process multiple CVs in parallel. In an I/O-bound application like this, where the system is often waiting for file operations or API responses, a non-blocking, parallel approach is essential for performance.

## Conclusion and Recommendations

The current architecture of the CV ingestion pipeline is not fit for a production environment. The sequential and blocking nature of the process makes it slow, inefficient, and unable to scale.

While the user has requested that no code be changed, the following recommendations are provided for future consideration:

*   **Introduce a Job Queue:** Implement a message queue system (e.g., BullMQ, RabbitMQ) to decouple the file upload from the processing. The `/ingest` endpoint would add jobs to the queue, providing an immediate response to the user.
*   **Create a Worker Service:** A separate worker process would consume jobs from the queue, handling the CPU-intensive tasks of parsing and ingestion. This would offload the main server and allow for concurrent processing.
*   **Implement Concurrent Processing:** The worker service could be configured to process multiple jobs in parallel, significantly reducing the time it takes to ingest a batch of CVs.

By implementing these changes, the system would become more robust, scalable, and capable of handling a high volume of CVs efficiently.
