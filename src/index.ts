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
  "Susobhan Das",
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
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OfficeAschi - Seat Booking</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f5; color: #333; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 8px; color: #1a1a2e; }
    .subtitle { text-align: center; color: #666; margin-bottom: 24px; }
    .date-picker { text-align: center; margin-bottom: 24px; }
    .date-picker input { font-size: 18px; padding: 8px 16px; border: 2px solid #ddd; border-radius: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .card h2 { margin-bottom: 12px; font-size: 16px; color: #555; text-transform: uppercase; letter-spacing: 1px; }
    .seat { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; margin-bottom: 6px; border-radius: 8px; font-size: 14px; }
    .seat.booked { background: #fee2e2; border: 1px solid #fca5a5; }
    .seat.available { background: #d1fae5; border: 1px solid #6ee7b7; }
    .seat .label { font-weight: 600; }
    .seat .person { color: #dc2626; font-weight: 500; }
    .seat .free { color: #059669; font-weight: 500; }
    .seat button { background: #ef4444; color: #fff; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
    .seat button:hover { background: #dc2626; }
    .booking-form { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 24px; }
    .booking-form h2 { margin-bottom: 12px; font-size: 16px; color: #555; text-transform: uppercase; letter-spacing: 1px; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; }
    .form-row select, .form-row button { font-size: 14px; padding: 10px 14px; border-radius: 8px; border: 1px solid #ddd; }
    .form-row button { background: #2563eb; color: #fff; border: none; cursor: pointer; font-weight: 600; }
    .form-row button:hover { background: #1d4ed8; }
    .stats { display: flex; gap: 16px; justify-content: center; margin-bottom: 20px; flex-wrap: wrap; }
    .stat { background: #fff; border-radius: 10px; padding: 12px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
    .stat .num { font-size: 24px; font-weight: 700; color: #2563eb; }
    .stat .lbl { font-size: 12px; color: #666; text-transform: uppercase; }
    .toast { position: fixed; top: 20px; right: 20px; background: #333; color: #fff; padding: 12px 20px; border-radius: 8px; display: none; z-index: 999; }
    .toast.error { background: #dc2626; }
    .people-list { columns: 2; }
    .people-list .person-item { padding: 4px 0; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>OfficeAschi</h1>
    <p class="subtitle">Seat Booking Tracker</p>

    <div class="date-picker">
      <input type="date" id="dateInput" />
    </div>

    <div class="stats" id="stats"></div>

    <div class="booking-form">
      <h2>Book a Seat</h2>
      <div class="form-row">
        <select id="personSelect"><option value="">Select Person</option></select>
        <select id="seatSelect"><option value="">Select Seat</option></select>
        <button onclick="bookSeat()">Book</button>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Seats</h2>
        <div id="seatsList"></div>
      </div>
      <div class="card">
        <h2>Not Coming</h2>
        <div class="people-list" id="notComingList"></div>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const dateInput = document.getElementById('dateInput');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

    dateInput.addEventListener('change', load);
    load();

    function showToast(msg, isError) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast' + (isError ? ' error' : '');
      t.style.display = 'block';
      setTimeout(() => t.style.display = 'none', 3000);
    }

    async function load() {
      const date = dateInput.value;
      const res = await fetch('/availability?date=' + date);
      const data = await res.json();

      document.getElementById('stats').innerHTML =
        '<div class="stat"><div class="num">' + data.booked_count + '</div><div class="lbl">Booked</div></div>' +
        '<div class="stat"><div class="num">' + data.available_count + '</div><div class="lbl">Available</div></div>' +
        '<div class="stat"><div class="num">10</div><div class="lbl">Total Seats</div></div>';

      let seatsHtml = '';
      for (const b of data.booked) {
        seatsHtml += '<div class="seat booked"><span><span class="label">' + b.label + '</span> (' + b.type + ')</span><span class="person">' + b.person_name + ' <button onclick="cancelBooking(' + b.seat_id + ',\\'' + date + '\\')">✕</button></span></div>';
      }
      for (const s of data.available_seats) {
        seatsHtml += '<div class="seat available"><span><span class="label">' + s.label + '</span> (' + s.type + ')</span><span class="free">Available</span></div>';
      }
      document.getElementById('seatsList').innerHTML = seatsHtml;

      let notHtml = '';
      for (const p of data.people_not_coming) {
        notHtml += '<div class="person-item">• ' + p.name + '</div>';
      }
      document.getElementById('notComingList').innerHTML = notHtml || '<p style="color:#999">Everyone is coming!</p>';

      // populate dropdowns
      const personSel = document.getElementById('personSelect');
      personSel.innerHTML = '<option value="">Select Person</option>';
      for (const p of data.people_not_coming) {
        personSel.innerHTML += '<option value="' + p.id + '">' + p.name + '</option>';
      }

      const seatSel = document.getElementById('seatSelect');
      seatSel.innerHTML = '<option value="">Select Seat</option>';
      for (const s of data.available_seats) {
        seatSel.innerHTML += '<option value="' + s.id + '">' + s.label + ' (' + s.type + ')</option>';
      }
    }

    async function bookSeat() {
      const date = dateInput.value;
      const person_id = document.getElementById('personSelect').value;
      const seat_id = document.getElementById('seatSelect').value;
      if (!person_id || !seat_id) { showToast('Select a person and seat', true); return; }

      const res = await fetch('/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, person_id: +person_id, seat_id: +seat_id })
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, true); return; }
      showToast('Seat booked!');
      load();
    }

    async function cancelBooking(seatId, date) {
      const res = await fetch('/bookings?date=' + date);
      const bookings = await res.json();
      const booking = bookings.find(b => b.seat_id === seatId);
      if (!booking) { showToast('Booking not found', true); return; }

      const del = await fetch('/bookings/' + booking.id, { method: 'DELETE' });
      if (del.ok) { showToast('Booking cancelled'); load(); }
      else { showToast('Failed to cancel', true); }
    }
  </script>
</body>
</html>`;

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Serve frontend
    if (url.pathname === "/" && req.method === "GET") {
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

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
