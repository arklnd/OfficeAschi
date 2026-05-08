import { Database } from "bun:sqlite";

const db = new Database("app.db");

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
  )
`);

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    // GET /users - list all users
    if (url.pathname === "/users" && req.method === "GET") {
      const users = db.query("SELECT * FROM users").all();
      return Response.json(users);
    }

    // GET /users/:id - get a single user
    if (url.pathname.startsWith("/users/") && req.method === "GET") {
      const id = url.pathname.split("/")[2];
      const user = db.query("SELECT * FROM users WHERE id = ?").get(id);
      if (!user) return Response.json({ error: "User not found" }, { status: 404 });
      return Response.json(user);
    }

    // POST /users - create a user
    if (url.pathname === "/users" && req.method === "POST") {
      const body = await req.json();
      const { name, email } = body;
      if (!name || !email) {
        return Response.json({ error: "name and email are required" }, { status: 400 });
      }
      try {
        const result = db.run("INSERT INTO users (name, email) VALUES (?, ?)", [name, email]);
        return Response.json({ id: result.lastInsertRowid, name, email }, { status: 201 });
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 409 });
      }
    }

    // PUT /users/:id - update a user
    if (url.pathname.startsWith("/users/") && req.method === "PUT") {
      const id = url.pathname.split("/")[2];
      const body = await req.json();
      const { name, email } = body;
      const result = db.run("UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?", [name, email, id]);
      if (result.changes === 0) return Response.json({ error: "User not found" }, { status: 404 });
      const user = db.query("SELECT * FROM users WHERE id = ?").get(id);
      return Response.json(user);
    }

    // DELETE /users/:id - delete a user
    if (url.pathname.startsWith("/users/") && req.method === "DELETE") {
      const id = url.pathname.split("/")[2];
      const result = db.run("DELETE FROM users WHERE id = ?", [id]);
      if (result.changes === 0) return Response.json({ error: "User not found" }, { status: 404 });
      return Response.json({ message: "User deleted" });
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
