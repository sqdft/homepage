// api/comments.js
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method } = req;
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  try {
    if (method === 'GET') {
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
      // bodyParser: true 已开启，req.body 直接是对象
      const { path = '/index', nickname, content } = req.body || {};

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
      const match = pathname.match(/\/api\/comments\/(\d+)$/);
      const id = match ? match[1] : null;

      if (!id) {
        return res.status(400).json({ error: 'Invalid comment ID' });
      }

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
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
}

export const config = {
  api: {
    bodyParser: true,  // 必须开启，让 Vercel 自动解析 JSON
  },
};