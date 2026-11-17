import { getDatabase } from "@netlify/database";

export default async (req) => {
  const db = getDatabase();

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const postId = (url.searchParams.get("postId") || "").trim().slice(0, 120);

      if (!postId) {
        const allLikes = await db.sql`SELECT post_id, likes_count FROM post_likes`;
        const likesMap = {};
        for (const row of allLikes) {
          likesMap[row.post_id] = Number(row.likes_count) || 0;
        }
        return Response.json({ likes: likesMap });
      }

      const likeRows = await db.sql`
        SELECT likes_count FROM post_likes WHERE post_id = ${postId}
      `;
      const comments = await db.sql`
        SELECT id, author, body, created_at
        FROM post_comments
        WHERE post_id = ${postId}
        ORDER BY created_at DESC
        LIMIT 100
      `;

      return Response.json({
        postId,
        likesCount: Number(likeRows[0]?.likes_count) || 0,
        comments
      });
    }

    if (req.method === "POST") {
      const payload = await req.json();
      const postId = String(payload?.postId || "").trim().slice(0, 120);
      const action = payload?.action;

      if (!postId) {
        return Response.json({ error: "postId requerido" }, { status: 400 });
      }

      if (action === "like") {
        const delta = payload?.delta === -1 ? -1 : 1;
        const [row] = await db.sql`
          INSERT INTO post_likes (post_id, likes_count, updated_at)
          VALUES (${postId}, ${delta > 0 ? 1 : 0}, NOW())
          ON CONFLICT (post_id) DO UPDATE
          SET likes_count = GREATEST(0, post_likes.likes_count + ${delta}),
              updated_at = NOW()
          RETURNING likes_count
        `;
        return Response.json({ postId, likesCount: Number(row?.likes_count) || 0 });
      }

      if (action === "comment") {
        const author = String(payload?.author || "").trim().slice(0, 60);
        const body = String(payload?.body || "").trim().slice(0, 1000);

        if (!author || !body) {
          return Response.json({ error: "Nombre y comentario son obligatorios" }, { status: 400 });
        }

        const [comment] = await db.sql`
          INSERT INTO post_comments (post_id, author, body)
          VALUES (${postId}, ${author}, ${body})
          RETURNING id, author, body, created_at
        `;
        return Response.json({ comment }, { status: 201 });
      }

      return Response.json({ error: "Acción no válida" }, { status: 400 });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    return Response.json({ error: "Error en base de datos" }, { status: 500 });
  }
};

export const config = {
  path: "/api/engagement"
};
