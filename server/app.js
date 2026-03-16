import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;
const GEMINI_MODEL = "gemini-2.5-flash";
const DATA_FILE = path.join(__dirname, "feedback.json");
const VALID_STATUSES = new Set(["open", "in-progress", "resolved"]);
const SENTIMENT_MAP = {
  positive: "positive",
  negative: "negative",
  neutral: "neutral",
};
const CATEGORY_MAP = {
  bug: "Bug",
  feature: "Feature",
  ux: "UX",
  performance: "Performance",
  other: "Other",
};
const FALLBACK_AI_FIELDS = {
  sentiment: "neutral",
  category: "Other",
  action_summary: "Review this feedback and prioritize the next action.",
};

let writeQueue = Promise.resolve();

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf-8");
  }
}

async function readFeedbackItems() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");

  if (!raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFeedbackItems(items) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf-8"),
  );

  return writeQueue;
}

function extractJsonObject(text) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : text;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");

    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function normalizeAIFields(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...FALLBACK_AI_FIELDS };
  }

  const rawSentiment =
    typeof raw.sentiment === "string" ? raw.sentiment.toLowerCase().trim() : "";
  const rawCategory =
    typeof raw.category === "string" ? raw.category.toLowerCase().trim() : "";
  const actionSummary =
    typeof raw.action_summary === "string" ? raw.action_summary.trim() : "";

  return {
    sentiment: SENTIMENT_MAP[rawSentiment] ?? FALLBACK_AI_FIELDS.sentiment,
    category: CATEGORY_MAP[rawCategory] ?? FALLBACK_AI_FIELDS.category,
    action_summary: actionSummary || FALLBACK_AI_FIELDS.action_summary,
  };
}

async function enrichFeedbackWithAI(text) {
  if (!ai) {
    return { ...FALLBACK_AI_FIELDS };
  }

  const prompt = `You are a strict JSON generator for product feedback triage.
Classify the feedback text and return ONLY valid JSON with this exact shape:
{
	"sentiment": "positive | negative | neutral",
	"category": "Bug | Feature | UX | Performance | Other",
	"action_summary": "one sentence recommended action"
}
Feedback text: ${JSON.stringify(text)}`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const responseText =
      typeof response?.text === "string"
        ? response.text
        : typeof response?.outputText === "string"
          ? response.outputText
          : "";

    const parsed = extractJsonObject(responseText);
    return normalizeAIFields(parsed);
  } catch (error) {
    console.error("AI enrichment failed:", error);
    return { ...FALLBACK_AI_FIELDS };
  }
}

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;

app.post("/feedback", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!text) {
      return res
        .status(400)
        .json({
          error: "Field 'text' is required and must be a non-empty string.",
        });
    }

    const [items, aiFields] = await Promise.all([
      readFeedbackItems(),
      enrichFeedbackWithAI(text),
    ]);

    const newItem = {
      id: randomUUID(),
      text,
      status: "open",
      sentiment: aiFields.sentiment,
      category: aiFields.category,
      action_summary: aiFields.action_summary,
    };

    items.push(newItem);
    await writeFeedbackItems(items);

    return res.status(201).json(newItem);
  } catch (error) {
    console.error("POST /feedback failed:", error);
    return res.status(500).json({ error: "Failed to create feedback item." });
  }
});

app.get("/feedback", async (_req, res) => {
  try {
    const items = await readFeedbackItems();
    return res.json(items);
  } catch (error) {
    console.error("GET /feedback failed:", error);
    return res.status(500).json({ error: "Failed to read feedback items." });
  }
});

app.patch("/feedback/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const status =
      typeof req.body?.status === "string"
        ? req.body.status.trim().toLowerCase()
        : "";

    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({
        error: "Field 'status' must be one of: open, in-progress, resolved.",
      });
    }

    const items = await readFeedbackItems();
    const item = items.find((feedback) => feedback.id === id);

    if (!item) {
      return res.status(404).json({ error: "Feedback item not found." });
    }

    item.status = status;
    await writeFeedbackItems(items);

    return res.json(item);
  } catch (error) {
    console.error("PATCH /feedback/:id failed:", error);
    return res.status(500).json({ error: "Failed to update feedback item." });
  }
});

app.delete("/feedback/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const items = await readFeedbackItems();
    const itemIndex = items.findIndex((feedback) => feedback.id === id);

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Feedback item not found." });
    }

    const [deletedItem] = items.splice(itemIndex, 1);
    await writeFeedbackItems(items);

    return res.json({
      message: "Feedback item deleted successfully.",
      item: deletedItem,
    });
  } catch (error) {
    console.error("DELETE /feedback/:id failed:", error);
    return res.status(500).json({ error: "Failed to delete feedback item." });
  }
});

ensureDataFile()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Server ready on http://localhost:${PORT}`),
    );
  })
  .catch((error) => {
    console.error("Failed to initialize data file:", error);
    process.exit(1);
  });
