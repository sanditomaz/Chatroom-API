import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const mongoClient = new MongoClient(process.env.MONGO_URI); //Variavel de ambiente
console.log(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db("Chatroom");
});

const participantSchema = joi.object({
  name: joi.string().trim().min(1).required(),
});

const messageSchema = joi.object({
  to: joi.string().trim().min(1).required(),
  text: joi.string().trim().min(1).required(),
  type: joi.valid("message", "private_message").required(),
});

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const validation = participantSchema.validate(req.body, {
    abortEarly: false,
  });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  try {
    const participant = await db.collection("participants").find().toArray();
    participant.find((value) => {
      if (value.name === name) {
        res.sendStatus(409);
        return;
      }
    });

    await db.collection("participants").insertOne({
      name,
      lastStatus: Date.now(),
    });

    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:MM:ss"),
    });

    res.sendStatus(201);
  } catch (error) {
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(
      participants.map((value) => ({
        ...value,
        _id: undefined,
      }))
    );
  } catch (error) {
    res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  const user = req.headers.user;

  const validation = messageSchema.validate(req.body, {
    abortEarly: false,
  });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  try {
    const participant = await db.collection("participants").find().toArray();
    const validUser = participant.find((item) => item.name === user);

    if (!validUser) {
      res.sendStatus(422);
      return;
    }
    console.log(validUser);

    await db.collection("messages").insertOne({
      from: validUser.name,
      to: req.body.to,
      text: req.body.text,
      type: req.body.type,
      time: dayjs().format("HH:MM:ss"),
    });

    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const user = req.headers.user;

  try {
    const msg = await db.collection("messages").find().toArray();

    const validToSend = [];
    msg.filter((i, index) => {
      if (
        i.type === "message" ||
        i.type === "status" ||
        (i.type === "private_message" && i.from === user) ||
        i.to === user
      ) {
        validToSend.push(i);
      }
    });

    res.send(validToSend.filter((i, index) => (limit ? index < limit : i)));
  } catch {
    res.sendStatus(500);
  }
});

app.listen(5000, () => console.log("Listening on port 5000"));
