const http = require("http");

const PORT = process.env.PORT || 3000;

// In-memory data store
const items = new Map();
let nextId = 1;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

// Route: /items or /items/:id
function parseRoute(url) {
  const match = url.match(/^\/items(?:\/(\d+))?$/);
  if (!match) return null;
  return { id: match[1] ? parseInt(match[1]) : null };
}

const server = http.createServer(async (req, res) => {
  const route = parseRoute(req.url);

  if (!route) {
    return send(res, 404, { error: "Not Found" });
  }

  try {
    if (req.method === "GET") {
      if (route.id !== null) {
        const item = items.get(route.id);
        return item
          ? send(res, 200, item)
          : send(res, 404, { error: "Item not found" });
      }
      return send(res, 200, Array.from(items.values()));
    }

    if (req.method === "POST") {
      const body = await parseBody(req);
      const item = { id: nextId++, ...body };
      items.set(item.id, item);
      return send(res, 201, item);
    }

    if (req.method === "PUT") {
      if (route.id === null) return send(res, 400, { error: "ID required" });
      if (!items.has(route.id)) return send(res, 404, { error: "Item not found" });
      const body = await parseBody(req);
      const updated = { ...items.get(route.id), ...body, id: route.id };
      items.set(route.id, updated);
      return send(res, 200, updated);
    }

    if (req.method === "DELETE") {
      if (route.id === null) return send(res, 400, { error: "ID required" });
      if (!items.has(route.id)) return send(res, 404, { error: "Item not found" });
      items.delete(route.id);
      return send(res, 200, { message: "Deleted" });
    }

    send(res, 405, { error: "Method Not Allowed" });
  } catch (err) {
    send(res, 400, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Routes: GET|POST /items  |  GET|PUT|DELETE /items/:id");
});
