require("dotenv").config()
const  { createClient } = require("redis")
const express = require("express")
const { randomUUID } = require("crypto")
const { addEmbedding, chat, createRedisStackIndex } = require("./core")

const {
  PORT
} = process.env

void (async () => {
  const app = express()
  const redisClient = createClient()

  redisClient.on('error', err => console.log('Redis Client Error', err))

  await redisClient.connect()

  try {
    await createRedisStackIndex(redisClient)
  } catch(err) {
    if (!err.message.includes("Index already exists")) {
      throw err
    }
  }

  app.use(express.json())

  app.post("/createEmbedding", async (req, res) => {
    await addEmbedding(redisClient, randomUUID(), req.body.text)
    console.log("Embedding created")
    res.json({ success: true })
  })

  app.post("/chat", async (req, res) => {
    try {
    const output = await chat(req.body.prompt, redisClient)
    res.json({
      response: output
    })
    } catch(err) {
      console.log("Error in /chat", err)
      res.status(500).send(err)
    }
  })

  app.use(express.static("public"))

  app.get("/embeddings", async (req, res) => {
    res.send()
  })

  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
})().catch(err => {
  console.error(err)
})
