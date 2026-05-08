const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    if (url.pathname === "/api" && req.method === "GET") {
      return Response.json({ message: "Hello from Bun API" });
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
