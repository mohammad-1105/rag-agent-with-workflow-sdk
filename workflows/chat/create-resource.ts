import type { InferSelectModel } from "drizzle-orm";
import { db } from "@/lib/db";
import { embeddings as embeddingsTable } from "@/lib/db/schema/embeddings";
import {
  insertResourceSchema,
  type NewResourceParams,
  resources,
} from "@/lib/db/schema/resources";
import { generateEmbeddings } from "./shared/embeddings";

// Infer types from schema
type Resource = InferSelectModel<typeof resources>;
// type Embedding = InferSelectModel<typeof embeddingsTable>;

// Type for embedding generation output
type GeneratedEmbedding = {
  embedding: number[];
  content: string;
};

const parseResourceInput = async (
  input: NewResourceParams,
): Promise<NewResourceParams> => {
  "use step";
  return insertResourceSchema.parse(input);
};

const insertResource = async (content: string): Promise<Resource> => {
  "use step";
  const [resource] = await db.insert(resources).values({ content }).returning();

  if (!resource) {
    throw new Error("Failed to insert resource");
  }

  return resource;
};

const insertEmbeddings = async (
  resourceId: string,
  embeddings: ReadonlyArray<GeneratedEmbedding>,
): Promise<void> => {
  "use step";

  if (embeddings.length === 0) {
    return;
  }

  await db.insert(embeddingsTable).values(
    embeddings.map((emb) => ({
      resourceId,
      embedding: emb.embedding,
      content: emb.content,
    })),
  );
};

export const createResource = async (
  input: NewResourceParams,
): Promise<void> => {
  "use step";
  const { content } = await parseResourceInput(input);
  const resource = await insertResource(content);
  const embeddings = await generateEmbeddings(content);
  await insertEmbeddings(resource.id, embeddings);
};
