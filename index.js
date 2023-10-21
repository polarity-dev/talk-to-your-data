require("dotenv").config()
const path = require("path")
const { createClient } = require("redis")
const express = require("express")
const { randomUUID } = require("crypto")
const { addEmbedding, chat, createRedisStackIndex } = require("./core")

const { engine } = require("express-handlebars")

const { urlencoded } = express

const {
  PORT
} = process.env

void (async () => {
  const app = express()

  app.engine(".hbs", engine({ "extname": ".hbs", "partialsDir": path.resolve(__dirname, "views", "partials"), "layout": "none" }))
  app.set("view engine", ".hbs")
  app.set("views", path.resolve(__dirname, "views"))

  const redisClient = createClient()

  redisClient.on('error', err => {
    if (err.code === "ECONNREFUSED") {
      console.log("waiting for redis to start...")
    } else {
      console.log('Redis Client Error', err)
    }
  })

  await redisClient.connect()

  try {
    await createRedisStackIndex(redisClient)
  } catch(err) {
    if (!err.message.includes("Index already exists")) {
      throw err
    }
  }

  app.use(express.json())

  app.get("/", (req, res) => {
    res.render("index")
  })

  app.post("/createEmbedding", urlencoded({ "extended": true }), async (req, res) => {
    const text = req.body.text
    const id = randomUUID()
    await addEmbedding(redisClient, id, text)
    console.log("Embedding created:", id, text)
    res.render("partials/add-data")
  })

  app.post("/chat", urlencoded({ "extended": true }), async (req, res) => {
    try {
      const output = await chat(req.body.text, redisClient)
      res.render("partials/chat", { "response": output })
    } catch(err) {
      res.status(500).render("partials/chat", { "error": err })
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
