const express = require("express");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

// App setup

const app = express();
const PORT = 3000;

app.use(express.json());

// Swagger setup
const swaggerDocument = YAML.load("./api.yaml");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 🔥 Rich data (array + object + normal fields)
let users = [
  {
    id: 1,
    name: "Manoj",
    age: 25,
    isActive: true,
    skills: ["Node.js", "React"],
    address: {
      city: "Bangalore",
      pincode: 560001,
    },
  },
  {
    id: 2,
    name: "Kumar",
    age: 28,
    isActive: false,
    skills: ["Java", "Spring"],
    address: {
      city: "Mysore",
      pincode: 570001,
    },
  },
];

// ✅ GET all users
app.get("/users", (req, res) => {
  try {
    if (users.length === 0) {
      return res.status(404).json({
        status: 404,
        message: "No users found",
      });
    }

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Server error",
    });
  }
});

// ✅ POST user
app.post("/users", (req, res) => {
  try {
    const { name, age, isActive, skills, address } = req.body;

    if (!name) {
      return res.status(400).json({
        status: 400,
        message: "Name is required",
      });
    }

    const newUser = {
      id: users.length + 1,
      name,
      age,
      isActive,
      skills,
      address,
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

// Server start
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
