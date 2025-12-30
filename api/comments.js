// api/comments.js
import { neon } from '@neondatabase/serverless';

// Neon 连接（Vercel 自动注入 DATABASE_URL）
const sql = neon(process.env.DATABASE_URL);

// 管理员口令（在 Vercel 环境变量中设置 ADMIN_TOKEN）
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export default async function handler(req, res) {
  // 允许跨域（你的前端是同域，但保险起见）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method } = req;

  // 解析 URL（Vercel 的 req.url 是完整路径，如 /api/comments/123 或 /api/comments?path=/index）
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname; // /api/comments 或 /api/comments/123
  const searchParams = url.searchParams;

  try {
    if (method === 'GET') {
      // GET /api/comments?path=/index&page=1&page_size=20
      const path = searchParams.get('path') || '/index';
      const page = parseInt(searchParams.get('page') || '1');
      const pageSize = parseInt(searchParams.get('page_size') || '20');

      const offset = (page - 1) * pageSize;

      const items = await sql`
        SELECT id, nickname, content, created_at
        FROM comments
        WHERE path = ${path}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;

      res.status(200).json({ items });
    }

    else if (method === 'POST') {
      // POST /api/comments  body: { path, nickname, content }
      let body;
      try {
        body = JSON.parse(req.body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }

      const { path = '/index', nickname, content } = body;

      if (!nickname?.trim() || !content?.trim()) {
        return res.status(400).json({ error: 'nickname 和 content 必填' });
      }

      await sql`
        INSERT INTO comments (path, nickname, content, created_at)
        VALUES (${path}, ${nickname.trim()}, ${content.trim()}, NOW())
      `;

      res.status(200).json({ success: true });
    }

    else if (method === 'DELETE') {
      // DELETE /api/comments/123  （你的前端就是这样调的：/api/comments/${id}）
      // 提取路径中的 id
      const match = pathname.match(/\/api\/comments\/(\d+)$/);
      const id = match ? match[1] : null;

      if (!id) {
        return res.status(400).json({ error: 'Invalid or missing comment ID' });
      }

      // 校验管理员 Token
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ') || auth.slice(7) !== ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const result = await sql`DELETE FROM comments WHERE id = ${id}`;

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      res.status(200).json({ success: true });
    }

    else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Vercel 需要这个配置来正确解析 POST body
export const config = {
  api: {
    bodyParser: true,  // 开启内置 body 解析（我们用 JSON.parse）
  },
};