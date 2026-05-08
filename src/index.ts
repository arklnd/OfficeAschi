import { Database } from "bun:sqlite";

const db = new Database("app.db");

// --- Schema ---
db.run(`
  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('regular', 'adhoc'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    person_id INTEGER NOT NULL,
    seat_id INTEGER NOT NULL,
    FOREIGN KEY (person_id) REFERENCES people(id),
    FOREIGN KEY (seat_id) REFERENCES seats(id),
    UNIQUE(date, person_id),
    UNIQUE(date, seat_id)
  )
`);

// --- Seed people ---
const people = [
  "Pooja Banerjee",
  "Susubhan Das",
  "Sayan Das",
  "Umashankar Singh",
  "Purbita Sur",
  "Rupsa Roy",
  "Arijit Kundu",
  "Arindam Dutta",
  "Dipendu Paul",
  "Arka De",
  "Nabanita Paul",
  "Shreyashi Choudhuri",
];

const insertPerson = db.prepare("INSERT OR IGNORE INTO people (name) VALUES (?)");
for (const name of people) {
  insertPerson.run(name);
}

// --- Seed seats ---
const existingSeats = db.query("SELECT COUNT(*) as count FROM seats").get() as { count: number };
if (existingSeats.count === 0) {
  const insertSeat = db.prepare("INSERT INTO seats (label, type) VALUES (?, ?)");
  for (let i = 1; i <= 7; i++) {
    insertSeat.run(`Seat ${i}`, "regular");
  }
  for (let i = 1; i <= 3; i++) {
    insertSeat.run(`Adhoc ${i}`, "adhoc");
  }
}

// --- API ---
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    // GET /people - list all people
    if (url.pathname === "/people" && req.method === "GET") {
      const rows = db.query("SELECT * FROM people ORDER BY name").all();
      return Response.json(rows);
    }

    // GET /seats - list all seats
    if (url.pathname === "/seats" && req.method === "GET") {
      const rows = db.query("SELECT * FROM seats ORDER BY type, id").all();
      return Response.json(rows);
    }

    // GET /bookings?date=YYYY-MM-DD - get bookings for a date
    if (url.pathname === "/bookings" && req.method === "GET") {
      const date = url.searchParams.get("date");
      if (!date) {
        return Response.json({ error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
      }
      const rows = db.query(`
        SELECT b.id, b.date, p.id as person_id, p.name as person_name,
               s.id as seat_id, s.label as seat_label, s.type as seat_type
        FROM bookings b
        JOIN people p ON b.person_id = p.id
        JOIN seats s ON b.seat_id = s.id
        WHERE b.date = ?
        ORDER BY s.id
      `).all(date);
      return Response.json(rows);
    }

    // POST /bookings - book a seat { date, person_id, seat_id }
    if (url.pathname === "/bookings" && req.method === "POST") {
      const body = await req.json();
      const { date, person_id, seat_id } = body;
      if (!date || !person_id || !seat_id) {
        return Response.json({ error: "date, person_id, and seat_id are required" }, { status: 400 });
      }
      try {
        const result = db.run(
          "INSERT INTO bookings (date, person_id, seat_id) VALUES (?, ?, ?)",
          [date, person_id, seat_id]
        );
        return Response.json({ id: result.lastInsertRowid, date, person_id, seat_id }, { status: 201 });
      } catch (e: any) {
        if (e.message.includes("UNIQUE")) {
          return Response.json({ error: "Person already booked or seat already taken for this date" }, { status: 409 });
        }
        return Response.json({ error: e.message }, { status: 400 });
      }
    }

    // DELETE /bookings/:id - cancel a booking
    if (url.pathname.startsWith("/bookings/") && req.method === "DELETE") {
      const id = url.pathname.split("/")[2];
      const result = db.run("DELETE FROM bookings WHERE id = ?", [id]);
      if (result.changes === 0) return Response.json({ error: "Booking not found" }, { status: 404 });
      return Response.json({ message: "Booking cancelled" });
    }

    // GET /availability?date=YYYY-MM-DD - see who's coming and available seats
    if (url.pathname === "/availability" && req.method === "GET") {
      const date = url.searchParams.get("date");
      if (!date) {
        return Response.json({ error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
      }

      const booked = db.query(`
        SELECT s.id as seat_id, s.label, s.type, p.id as person_id, p.name as person_name
        FROM bookings b
        JOIN people p ON b.person_id = p.id
        JOIN seats s ON b.seat_id = s.id
        WHERE b.date = ?
      `).all(date);

      const availableSeats = db.query(`
        SELECT * FROM seats WHERE id NOT IN (SELECT seat_id FROM bookings WHERE date = ?)
      `).all(date);

      const peopleNotBooked = db.query(`
        SELECT * FROM people WHERE id NOT IN (SELECT person_id FROM bookings WHERE date = ?)
      `).all(date);

      return Response.json({
        date,
        total_seats: 10,
        booked_count: booked.length,
        available_count: availableSeats.length,
        booked,
        available_seats: availableSeats,
        people_not_coming: peopleNotBooked,
      });
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
