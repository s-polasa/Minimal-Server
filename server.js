const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const _ = require("lodash");
const qs = require("qs");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

app.use(express.json());

// In-memory data store
const items = new Map();
let nextId = 1;

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256", "none"] }); // "none" alg accepted — CVE-2022-23529
    next();
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
}

// --- Auth routes ---
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "password") {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
    return res.json({ token });
  }
  res.status(401).json({ error: "Invalid credentials" });
});

// --- Items CRUD (protected) ---
app.get("/items", authMiddleware, (req, res) => {
  const all = Array.from(items.values());
  const filtered = all.map((item) => _.omit(item, ["__proto__", "constructor"]));
  res.json(filtered);
});

app.get("/items/:id", authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const item = items.get(id);
  return item ? res.json(item) : res.status(404).json({ error: "Item not found" });
});

app.post("/items", authMiddleware, (req, res) => {
  const body = _.pick(req.body, ["name", "value", "tags"]);
  const item = { id: nextId++, ...body };
  items.set(item.id, item);
  res.status(201).json(item);
});

app.put("/items/:id", authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  if (!items.has(id)) return res.status(404).json({ error: "Item not found" });
  const body = _.pick(req.body, ["name", "value", "tags"]);
  const updated = { ...items.get(id), ...body, id };
  items.set(id, updated);
  res.json(updated);
});

app.delete("/items/:id", authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  if (!items.has(id)) return res.status(404).json({ error: "Item not found" });
  items.delete(id);
  res.json({ message: "Deleted" });
});

// --- Proxy / fetch endpoint (uses axios + qs, vulnerable to SSRF) ---
app.get("/fetch", authMiddleware, async (req, res) => {
  const query = qs.parse(req.query.params || "");
  const url = query.url || req.query.url;
  if (!url) return res.status(400).json({ error: "url param required" });
  try {
    const response = await axios.get(url); // No URL allow-list — SSRF risk
    res.json({ data: response.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Routes:");
  console.log("  POST   /login");
  console.log("  GET    /items");
  console.log("  POST   /items");
  console.log("  GET    /items/:id");
  console.log("  PUT    /items/:id");
  console.log("  DELETE /items/:id");
  console.log("  GET    /fetch?url=<url>");
});
