import { sql } from "@vercel/postgres";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { id } = req.query;

  try {
    // PUT — full update of a post (edit, fill, reopen)
    if (req.method === "PUT") {
      const { client, location, type, priority, openedDate, notes, schedule, filledDate, filledBy } = req.body;
      await sql`
        UPDATE posts SET
          client      = ${client},
          location    = ${location},
          type        = ${type},
          priority    = ${priority},
          opened_date = ${openedDate},
          notes       = ${notes || ""},
          schedule    = ${schedule},
          filled_date = ${filledDate || null},
          filled_by   = ${filledBy || ""}
        WHERE id = ${id}
      `;
      return res.status(200).json({ success: true });
    }

    // DELETE — soft delete (archive)
    if (req.method === "DELETE") {
      await sql`
        UPDATE posts SET archived = true WHERE id = ${id}
      `;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
