
const  { VectorAlgorithms, SchemaFieldTypes } = require("redis")
const { OpenAI } = require("openai")

const {
  OPENAI_KEY,
  INDEX_NAME = "idx:doc"
} = process.env

const openai = new OpenAI({ apiKey: OPENAI_KEY })

const generateEmbeddingBuffer = async (text) => {
  const { data } = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text
  })

  const vector = data[0].embedding
  const buffer = Buffer.alloc(vector.length * 4);

  for (let i = 0; i < vector.length; i++) {
    buffer.writeFloatLE(vector[i], i * 4);
  }

  return buffer
}

const addEmbedding = async (redisClient, id, text) => {
  const buffer = await generateEmbeddingBuffer(text)
  await redisClient.hSet(`doc:${id}`, { text, embedding: buffer })
}

const search = async(redisClient, text, knn) => {
  const buffer = await generateEmbeddingBuffer(text)
  const data = await redisClient.ft.search(INDEX_NAME, `*=>[KNN ${knn} @embedding $vector AS score]`,  {
    PARAMS: {
      vector: buffer
    },
    SORTBY: "score",
    DIALECT: 2,
    RETURN: ["score", "text"]
  })

  data.documents.forEach(doc => {
    doc.value.score = Math.floor((1 - doc.value.score) * 100) / 100
  })

  return data
}

const chat = async (prompt, redisClient) => {
  let data = await search(redisClient, prompt, 5)

  let chatCompletion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You're a generic assistant of an event called socrates-IT" },
      { role: "system", content: `Your dataset: ${JSON.stringify(data)}` },
      { role: "user", content: prompt },
    ],
  })

  if (!chatCompletion?.choices?.length) {
    throw new Error("No chat completion response")
  }

  return chatCompletion.choices[0].message.content
}

const createRedisStackIndex = async(redisClient) => await redisClient.ft.create(INDEX_NAME, {
  text: {
    type: SchemaFieldTypes.TEXT,
    SORTABLE: false
  },
  embedding: {
    type: SchemaFieldTypes.VECTOR,
    ALGORITHM: VectorAlgorithms.HNSW,
    TYPE: "FLOAT32",
    DISTANCE_METRIC: "COSINE",
    DIM: 1536
  }
}, {
  ON: "HASH",
  PREFIX: ["doc:"]
})

module.exports = {
  createRedisStackIndex,
  generateEmbeddingBuffer,
  addEmbedding,
  search,
  chat
}
