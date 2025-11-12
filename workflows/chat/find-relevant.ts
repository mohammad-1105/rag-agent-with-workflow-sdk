import { cosineDistance, desc, gt, type SQL, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { embeddings } from "@/lib/db/schema/embeddings";
import { generateEmbedding } from "./shared/embeddings";

// Define the shape of similarity search results
type SimilarGuide = {
  name: string;
  similarity: number;
};

// Type for the embedding vector
type EmbeddingVector = number[];

// Constants for similarity search
const SIMILARITY_THRESHOLD = 0.5;
const MAX_RESULTS = 4;

const getSimilarGuides = async (
  userQueryEmbedded: EmbeddingVector,
): Promise<ReadonlyArray<SimilarGuide>> => {
  "use step";

  // Explicitly type the similarity SQL expression
  const similarity: SQL<number> = sql<number>`
    1 - (${cosineDistance(embeddings.embedding, userQueryEmbedded)})`;

  const similarGuides = await db
    .select({
      name: embeddings.content,
      similarity,
    })
    .from(embeddings)
    .where(gt(similarity, SIMILARITY_THRESHOLD))
    .orderBy(desc(similarity))
    .limit(MAX_RESULTS);

  // Validate results have expected shape
  return similarGuides.map(
    (guide): SimilarGuide => ({
      name: guide.name,
      similarity: guide.similarity,
    }),
  );
};

export const findRelevant = async (
  userQuery: string,
): Promise<ReadonlyArray<SimilarGuide>> => {
  "use step";

  if (!userQuery.trim()) {
    throw new Error("User query cannot be empty");
  }

  const userQueryEmbedded = await generateEmbedding(userQuery);

  // validate embedding has expected dimensions (1536 based on the schema)
  if (!Array.isArray(userQueryEmbedded) || userQueryEmbedded.length !== 1536) {
    throw new Error(
      `Invalid embedding dimensions: expected 1536, got ${userQueryEmbedded.length}`,
    );
  }

  const similarGuides = await getSimilarGuides(userQueryEmbedded);

  return similarGuides;
};
