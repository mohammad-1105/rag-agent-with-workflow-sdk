import { DurableAgent } from "@workflow/ai/agent";
import {
  convertToModelMessages,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { getWritable } from "workflow";
import { z } from "zod";
import { SYSTEM_PROMPT } from "../prompt";
import { createResource } from "./create-resource";
import type { findRelevant } from "./find-relevant";
import { findRelevant as findRelevantImpl } from "./find-relevant";

// ============================================================================
// Types
// ============================================================================

type SimilarGuide = Awaited<ReturnType<typeof findRelevant>>[number];

type ToolExecutionResult =
  | { success: true; data: string | ReadonlyArray<SimilarGuide> }
  | { success: false; error: string };

// ============================================================================
// Configuration
// ============================================================================

const RAG_CONFIG = {
  model: "gpt-4.1" as const,
  relevanceThreshold: 0.5,
  maxResults: 4,
  minContentLength: 3,
  maxContentLength: 10000,
} as const;

// ============================================================================
// Tool Definitions
// ============================================================================

const ADD_RESOURCE_TOOL = {
  description: `Add new information to the knowledge base. 

Use this tool when:
- User explicitly shares information to remember
- User provides documentation, facts, or procedures
- User says "remember this" or similar phrases
- User shares specific knowledge unprompted

Content should be:
- Factual and clear
- Between ${RAG_CONFIG.minContentLength} and ${RAG_CONFIG.maxContentLength} characters
- Well-formatted for future retrieval`,

  inputSchema: z.object({
    content: z
      .string()
      .min(
        RAG_CONFIG.minContentLength,
        `Content must be at least ${RAG_CONFIG.minContentLength} characters`,
      )
      .max(
        RAG_CONFIG.maxContentLength,
        `Content must be less than ${RAG_CONFIG.maxContentLength} characters`,
      )
      .describe(
        "The information to add to the knowledge base. Should be clear, factual, and well-structured.",
      ),
  }),
} as const;

const GET_INFORMATION_TOOL = {
  description: `Search the knowledge base for relevant information.

Use this tool:
- BEFORE answering any factual question
- When user asks about specific topics
- To verify information exists before responding
- Multiple times if the initial query needs refinement

The tool returns relevant content with similarity scores (0-1, higher is better).
Results with similarity > ${RAG_CONFIG.relevanceThreshold} are considered relevant.`,

  inputSchema: z.object({
    question: z
      .string()
      .min(1, "Question cannot be empty")
      .describe(
        "The user's question or search query. Be specific and include key terms for best results.",
      ),
  }),
} as const;

// ============================================================================
// Tool Execution Handlers
// ============================================================================

const executeAddResource = async (
  content: string,
): Promise<ToolExecutionResult> => {
  try {
    console.log(`[addResource] Adding content (${content.length} chars)`);

    await createResource({ content });

    const summary =
      content.length > 100 ? `${content.substring(0, 97)}...` : content;

    console.log("[addResource] Successfully added to knowledge base");

    return {
      success: true,
      data: `✓ Successfully added to knowledge base: "${summary}"`,
    };
  } catch (error) {
    console.error("[addResource] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return {
      success: false,
      error: `Failed to add resource: ${errorMessage}`,
    };
  }
};

const executeGetInformation = async (
  question: string,
): Promise<ToolExecutionResult> => {
  try {
    console.log(`[getInformation] Searching for: "${question}"`);

    const results = await findRelevantImpl(question);

    console.log(
      `[getInformation] Found ${results.length} results`,
      results.map((r) => ({
        similarity: r.similarity.toFixed(3),
        preview: r.name.substring(0, 50),
      })),
    );

    if (results.length === 0) {
      return {
        success: true,
        data: "No relevant information found in the knowledge base.",
      };
    }

    // Filter by relevance threshold
    const relevantResults = results.filter(
      (r) => r.similarity >= RAG_CONFIG.relevanceThreshold,
    );

    if (relevantResults.length === 0) {
      return {
        success: true,
        data: `Found ${results.length} results but none met the relevance threshold (${RAG_CONFIG.relevanceThreshold}). The closest match had similarity ${results[0]?.similarity.toFixed(2)}.`,
      };
    }

    return {
      success: true,
      data: relevantResults,
    };
  } catch (error) {
    console.error("[getInformation] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return {
      success: false,
      error: `Failed to search knowledge base: ${errorMessage}`,
    };
  }
};

// ============================================================================
// Main Chat Workflow
// ============================================================================

export const chat = async (messages: UIMessage[]): Promise<void> => {
  "use workflow";

  console.log(
    `[Workflow] Starting chat workflow with ${messages.length} messages`,
  );

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: RAG_CONFIG.model,
    system: SYSTEM_PROMPT,

    tools: {
      addResource: {
        description: ADD_RESOURCE_TOOL.description,
        inputSchema: ADD_RESOURCE_TOOL.inputSchema,
        execute: async ({ content }) => {
          const result = await executeAddResource(content);
          return result.success ? result.data : result.error;
        },
      },

      getInformation: {
        description: GET_INFORMATION_TOOL.description,
        inputSchema: GET_INFORMATION_TOOL.inputSchema,
        execute: async ({ question }) => {
          const result = await executeGetInformation(question);
          return result.success ? result.data : result.error;
        },
      },
    },
  });

  try {
    await agent.stream({
      messages: convertToModelMessages(messages),
      writable,
    });

    console.log("[Workflow] Chat workflow completed successfully");
  } catch (error) {
    console.error("[Workflow] Error during chat:", error);
    throw error;
  }
};
