require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

const NODE_ENV = process.env.NODE_ENV || "development";
const mongoUri = process.env.MONGODB_URI?.trim() || "";

if (NODE_ENV === "production" && !mongoUri) {
  throw new Error("MONGODB_URI is required when NODE_ENV is production");
}

const useMongo = Boolean(mongoUri);

const app = express();
const PORT = process.env.PORT || 3000;

function sendError(res, statusCode, message, code) {
  return res.status(statusCode).json({
    success: false,
    error: {
      statusCode,
      message,
      ...(code ? { code } : {}),
    },
  });
}

class HttpError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const USER_FIELD_KEYS = [
  "name",
  "age",
  "isActive",
  "skills",
  "address",
  "image",
  "bio",
  "imageCredit",
];

/**
 * Validates user fields present on `body`.
 * @param {object} body
 * @param {{ requireName: boolean }} opts
 * @returns {{ ok: true, value: object } | { ok: false, message: string }}
 */
function validateUserPayload(body, { requireName }) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Request body must be a JSON object" };
  }

  const unknown = Object.keys(body).filter(
    (k) => k !== "_id" && !USER_FIELD_KEYS.includes(k),
  );
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `Unknown or unsupported fields: ${unknown.join(", ")}`,
    };
  }

  const issues = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (requireName && (!has("name") || body.name === null || body.name === "")) {
    issues.push("name is required");
  }

  if (has("name")) {
    if (typeof body.name !== "string") {
      issues.push("name must be a string");
    } else if (body.name.trim() === "") {
      issues.push("name must be a non-empty string");
    }
  }

  if (has("age")) {
    if (body.age === null) issues.push("age cannot be null");
    else if (typeof body.age !== "number" || !Number.isFinite(body.age)) {
      issues.push("age must be a finite number");
    }
  }

  if (has("isActive")) {
    if (typeof body.isActive !== "boolean") {
      issues.push("isActive must be a boolean");
    }
  }

  if (has("skills")) {
    if (body.skills === null) issues.push("skills cannot be null");
    else if (!Array.isArray(body.skills)) {
      issues.push("skills must be an array");
    } else if (body.skills.some((s) => typeof s !== "string")) {
      issues.push("skills must contain only strings");
    }
  }

  if (has("address")) {
    if (body.address === null) issues.push("address cannot be null");
    else if (typeof body.address !== "object" || Array.isArray(body.address)) {
      issues.push("address must be an object");
    } else {
      const extra = Object.keys(body.address).filter(
        (k) => !["city", "pincode"].includes(k),
      );
      if (extra.length) {
        issues.push("address only supports city and pincode");
      }
      if (
        Object.prototype.hasOwnProperty.call(body.address, "city") &&
        body.address.city !== null &&
        typeof body.address.city !== "string"
      ) {
        issues.push("address.city must be a string");
      }
      if (Object.prototype.hasOwnProperty.call(body.address, "pincode")) {
        const p = body.address.pincode;
        if (p === null) issues.push("address.pincode cannot be null");
        else if (typeof p !== "number" || !Number.isFinite(p)) {
          issues.push("address.pincode must be a finite number");
        }
      }
    }
  }

  for (const key of ["image", "bio", "imageCredit"]) {
    if (has(key) && body[key] !== null && typeof body[key] !== "string") {
      issues.push(`${key} must be a string`);
    }
  }

  if (issues.length) {
    return { ok: false, message: issues.join("; ") };
  }

  const value = {};
  for (const key of USER_FIELD_KEYS) {
    if (!has(key)) continue;
    if (key === "name") {
      value.name = String(body.name).trim();
      continue;
    }
    value[key] = body[key];
  }
  return { ok: true, value };
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    return sendError(res, err.statusCode, err.message, err.code);
  }

  if (err.name === "ValidationError" && err.errors) {
    const msg = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
    return sendError(res, 400, msg || err.message, "VALIDATION_ERROR");
  }

  if (err.name === "CastError") {
    return sendError(res, 400, "Invalid identifier", "CAST_ERROR");
  }

  console.error("Unhandled error:", err);
  const message =
    NODE_ENV === "production" ? "Internal server error" : err.message;
  return sendError(res, 500, message, "INTERNAL_ERROR");
}

// CORS: allow all origins by default; set CORS_ORIGINS (comma-separated) to restrict
const corsMiddleware = process.env.CORS_ORIGINS?.trim()
  ? cors({
      origin: process.env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    })
  : cors();

app.use(corsMiddleware);
app.use(express.json());

const swaggerDocument = YAML.load("./api.yaml");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/", (req, res) => {
  res.redirect(302, "/api-docs");
});

app.get("/health", (req, res) => {
  const database = useMongo ? "connected" : "memory";
  res.status(200).json({
    status: "ok",
    database,
    uptime: process.uptime(),
  });
});

const addressSubSchema = new mongoose.Schema(
  { city: String, pincode: Number },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    age: Number,
    isActive: Boolean,
    skills: [String],
    address: addressSubSchema,
    image: String,
    bio: String,
    imageCredit: String,
  },
  { versionKey: false },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

/** True if `value` is a 24-char hex string that round-trips as ObjectId */
function isObjectIdString(value) {
  return (
    typeof value === "string" &&
    mongoose.Types.ObjectId.isValid(value) &&
    new mongoose.Types.ObjectId(value).toString() === value
  );
}

/** Curated Unsplash CDN URLs (no API key). See https://unsplash.com/license */
const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=480&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=480&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=480&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=480&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=480&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=480&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=480&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=480&q=80",
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=480&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=480&q=80",
];

const USER_TEMPLATES = [
  {
    name: "Manoj",
    age: 25,
    isActive: true,
    skills: ["Node.js", "React"],
    address: { city: "Bangalore", pincode: 560001 },
    bio: "Full-stack engineer; APIs and React.",
  },
  {
    name: "Kumar",
    age: 28,
    isActive: false,
    skills: ["Java", "Spring"],
    address: { city: "Mysore", pincode: 570001 },
    bio: "Backend engineer on Spring and microservices.",
  },
  {
    name: "Jabez",
    age: 22,
    isActive: true,
    skills: ["Python", "Java"],
    address: { city: "Delhi", pincode: 110001 },
    bio: "Polyglot developer; data and services.",
  },
  {
    name: "Ananya",
    age: 27,
    isActive: true,
    skills: ["TypeScript", "GraphQL"],
    address: { city: "Hyderabad", pincode: 500001 },
    bio: "API design and typed clients.",
  },
  {
    name: "Ravi",
    age: 31,
    isActive: true,
    skills: ["Go", "Kubernetes"],
    address: { city: "Pune", pincode: 411001 },
    bio: "Platform engineer; containers and Go.",
  },
  {
    name: "Priya",
    age: 24,
    isActive: true,
    skills: ["Figma", "React"],
    address: { city: "Chennai", pincode: 600001 },
    bio: "UI engineer bridging design and code.",
  },
  {
    name: "Arun",
    age: 29,
    isActive: false,
    skills: ["AWS", "Terraform"],
    address: { city: "Mumbai", pincode: 400001 },
    bio: "Cloud infra and automation.",
  },
  {
    name: "Kavya",
    age: 26,
    isActive: true,
    skills: ["PostgreSQL", "Node.js"],
    address: { city: "Kochi", pincode: 682001 },
    bio: "Data modeling and Node APIs.",
  },
  {
    name: "Vikram",
    age: 33,
    isActive: true,
    skills: ["Rust", "WebAssembly"],
    address: { city: "Ahmedabad", pincode: 380001 },
    bio: "Systems and performance-focused tooling.",
  },
  {
    name: "Meera",
    age: 23,
    isActive: true,
    skills: ["Swift", "iOS"],
    address: { city: "Jaipur", pincode: 302001 },
    bio: "Mobile product engineer.",
  },
];

let users = [];

async function fetchUnsplashPortraits() {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const url =
    "https://api.unsplash.com/photos/random?count=10&query=people&orientation=portrait";
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unsplash ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

/** Plain user fields (no _id) for seeding */
async function buildResolvedSeedUsers() {
  let images = [...DEFAULT_IMAGES];
  let credits = new Array(10).fill(undefined);

  try {
    const photos = await fetchUnsplashPortraits();
    if (photos && photos.length > 0) {
      images = USER_TEMPLATES.map((_, i) => {
        const p = photos[i % photos.length];
        return (
          p?.urls?.small ||
          p?.urls?.regular ||
          DEFAULT_IMAGES[i % DEFAULT_IMAGES.length]
        );
      });
      credits = USER_TEMPLATES.map((_, i) => {
        const p = photos[i % photos.length];
        if (!p?.user?.name) return undefined;
        const link = p.links?.html || "https://unsplash.com";
        return `Photo by ${p.user.name} on Unsplash (${link})`;
      });
      console.log("Loaded profile images from Unsplash API.");
    }
  } catch (err) {
    console.warn("Using default Unsplash CDN URLs:", err.message);
  }

  return USER_TEMPLATES.map((t, i) => ({
    ...t,
    image: images[i] ?? DEFAULT_IMAGES[i % DEFAULT_IMAGES.length],
    ...(credits[i] ? { imageCredit: credits[i] } : {}),
  }));
}

async function buildUsersInMemory() {
  const base = await buildResolvedSeedUsers();
  users = base.map((u) => ({
    ...u,
    _id: new mongoose.Types.ObjectId(),
  }));
}

async function seedMongoIfEmpty() {
  const count = await User.countDocuments();
  if (count > 0) return;
  const docs = await buildResolvedSeedUsers();
  await User.insertMany(docs);
  console.log(`Seeded ${docs.length} users in MongoDB.`);
}

app.get("/users", async (req, res, next) => {
  try {
    const list = useMongo ? await User.find().sort({ _id: 1 }).lean() : users;

    if (list.length === 0) {
      return sendError(res, 404, "No users found", "NOT_FOUND");
    }

    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
});

app.post("/users", async (req, res, next) => {
  try {
    const parsed = validateUserPayload(req.body, { requireName: true });
    if (!parsed.ok) {
      return sendError(res, 400, parsed.message, "VALIDATION_ERROR");
    }

    const payload = parsed.value;

    if (useMongo) {
      const doc = await User.create(payload);
      return res.status(201).json(doc.toObject());
    }

    const newUser = {
      _id: new mongoose.Types.ObjectId(),
      ...payload,
    };
    users.push(newUser);
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});

app.put("/users/:id", async (req, res, next) => {
  try {
    const idHex = req.params.id;
    if (!isObjectIdString(idHex)) {
      return sendError(res, 400, "Invalid user id", "VALIDATION_ERROR");
    }

    const parsed = validateUserPayload(req.body, { requireName: true });
    if (!parsed.ok) {
      return sendError(res, 400, parsed.message, "VALIDATION_ERROR");
    }

    const update = { ...parsed.value };

    if (useMongo) {
      const doc = await User.findByIdAndUpdate(idHex, update, {
        new: true,
        runValidators: true,
      }).lean();

      if (!doc) {
        return sendError(res, 404, "User not found", "NOT_FOUND");
      }

      return res.status(200).json(doc);
    }

    const idx = users.findIndex((u) => String(u._id) === idHex);
    if (idx === -1) {
      return sendError(res, 404, "User not found", "NOT_FOUND");
    }

    users[idx] = {
      ...users[idx],
      ...update,
      _id: users[idx]._id,
    };
    res.status(200).json({
      ...users[idx],
      _id: users[idx]._id,
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/users/:id", async (req, res, next) => {
  try {
    const idHex = req.params.id;
    if (!isObjectIdString(idHex)) {
      return sendError(res, 400, "Invalid user id", "VALIDATION_ERROR");
    }

    if (useMongo) {
      const deleted = await User.findByIdAndDelete(idHex);
      if (!deleted) {
        return sendError(res, 404, "User not found", "NOT_FOUND");
      }
      return res.status(204).send();
    }

    const idx = users.findIndex((u) => String(u._id) === idHex);
    if (idx === -1) {
      return sendError(res, 404, "User not found", "NOT_FOUND");
    }

    users.splice(idx, 1);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  sendError(
    res,
    404,
    `Cannot ${req.method} ${req.originalUrl}`,
    "NOT_FOUND",
  );
});

app.use(errorHandler);

async function main() {
  if (useMongo) {
    console.log("[database] Storage mode: MongoDB (persistent data)");
    try {
      await mongoose.connect(mongoUri);
      console.log(
        "[database] MongoDB connection succeeded",
        JSON.stringify({ database: mongoose.connection.name }),
      );
    } catch (err) {
      console.error(
        "[database] MongoDB connection failed:",
        err?.message || err,
      );
      throw err;
    }
    await seedMongoIfEmpty();
  } else {
    console.log(
      "[database] Storage mode: in-memory (not persisted; for local development)",
    );
    await buildUsersInMemory();
  }

  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
    console.log(
      `[server] NODE_ENV=${NODE_ENV}; data store=${useMongo ? "MongoDB" : "in-memory"}`,
    );
    if (!process.env.UNSPLASH_ACCESS_KEY) {
      console.log(
        "Tip: set UNSPLASH_ACCESS_KEY to fetch fresh portraits from the Unsplash API on startup.",
      );
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
