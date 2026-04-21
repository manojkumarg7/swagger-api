require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

const app = express();
const PORT = process.env.PORT || 3000;
const useMongo = Boolean(process.env.MONGODB_URI?.trim());

console.log("ENV MONGODB_URI:", process.env.MONGODB_URI ? "EXISTS" : "MISSING");

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

app.get("/users", async (req, res) => {
  try {
    const list = useMongo ? await User.find().sort({ _id: 1 }).lean() : users;

    if (list.length === 0) {
      return res.status(404).json({
        status: 404,
        message: "No users found",
      });
    }

    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Server error",
    });
  }
});

app.post("/users", async (req, res) => {
  try {
    const { name, age, isActive, skills, address, image, bio, imageCredit } =
      req.body;

    if (!name) {
      return res.status(400).json({
        status: 400,
        message: "Name is required",
      });
    }

    const payload = {
      name,
      age,
      isActive,
      skills,
      address,
      image,
      bio,
      imageCredit,
    };

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
    res.status(500).json({
      status: 500,
      message: "Server error",
    });
  }
});

app.put("/users/:id", async (req, res) => {
  try {
    const idHex = req.params.id;
    if (!isObjectIdString(idHex)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid user id",
      });
    }

    if (!req.body.name) {
      return res.status(400).json({
        status: 400,
        message: "Name is required",
      });
    }

    const update = { ...req.body };
    delete update._id;

    if (useMongo) {
      const doc = await User.findByIdAndUpdate(idHex, update, {
        new: true,
        runValidators: true,
      }).lean();

      if (!doc) {
        return res.status(404).json({
          status: 404,
          message: "User not found",
        });
      }

      return res.status(200).json(doc);
    }

    const idx = users.findIndex((u) => String(u._id) === idHex);
    if (idx === -1) {
      return res.status(404).json({
        status: 404,
        message: "User not found",
      });
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
    res.status(500).json({
      status: 500,
      message: "Server error",
    });
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    const idHex = req.params.id;
    if (!isObjectIdString(idHex)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid user id",
      });
    }

    if (useMongo) {
      const deleted = await User.findByIdAndDelete(idHex);
      if (!deleted) {
        return res.status(404).json({
          status: 404,
          message: "User not found",
        });
      }
      return res.status(204).send();
    }

    const idx = users.findIndex((u) => String(u._id) === idHex);
    if (idx === -1) {
      return res.status(404).json({
        status: 404,
        message: "User not found",
      });
    }

    users.splice(idx, 1);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Server error",
    });
  }
});

async function main() {
  if (useMongo) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("DB Name:", mongoose.connection.name);
    console.log("Connected to MongoDB.");
    await seedMongoIfEmpty();
  } else {
    await buildUsersInMemory();
    console.log(
      "Running without MONGODB_URI: users are kept in memory (not persisted).",
    );
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
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
