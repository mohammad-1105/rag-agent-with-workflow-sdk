import { embed, embedMany } from "ai";

export const generateEmbeddings = async (
  value: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  "use step";

  const chunks = value
    .trim()
    .split(".")
    .filter((i) => i !== "");

  const { embeddings } = await embedMany({
    model: "text-embedding-ada-002",
    values: chunks,
  });

  return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }));
};

export const generateEmbedding = async (value: string): Promise<number[]> => {
  "use step";

  const input = value.replaceAll("\\n", " ");

  const { embedding } = await embed({
    model: "text-embedding-ada-002",
    value: input,
  });

  return embedding;
};
