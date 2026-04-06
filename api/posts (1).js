import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const rows = await sql`
        SELECT * FROM posts
        WHERE archived = false
        ORDER BY opened_date ASC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const { id, client, location, type, priority, openedDate, notes, schedule } = req.body;
      await sql`
        INSERT INTO posts (id, client, location, type, priority, opened_date, notes, schedule, filled_date, filled_by, archived)
        VALUES (
          ${id}, ${client}, ${location}, ${type}, ${priority},
          ${openedDate}, ${notes || ""}, ${schedule}, ${null}, ${""}, ${false}
        )
      `;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
