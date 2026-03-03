// Netlify Functions
// 访问路径: /.netlify/functions/comments

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

exports.handler = async (event, context) => {
  // CORS 头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json'
  };

  // 处理 OPTIONS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const method = event.httpMethod;
    const params = event.queryStringParameters || {};
    
    // GET - 获取评论列表
    if (method === 'GET') {
      const path = params.path || '/index';
      const page = parseInt(params.page || '1');
      const pageSize = parseInt(params.page_size || '20');
      const offset = (page - 1) * pageSize;

      const items = await sql`
        SELECT id, nickname, content, created_at
        FROM comments
        WHERE path = ${path}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ items })
      };
    }

    // POST - 创建新评论
    else if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { path = '/index', nickname, content } = body;

      if (!nickname?.trim() || !content?.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'nickname 和 content 必填' })
        };
      }

      await sql`
        INSERT INTO comments (path, nickname, content, created_at)
        VALUES (${path}, ${nickname.trim()}, ${content.trim()}, NOW())
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // DELETE - 删除评论（管理员）
    else if (method === 'DELETE') {
      const id = params.id;

      if (!id || isNaN(id)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid or missing comment ID' })
        };
      }

      // 校验管理员 Token
      const auth = event.headers.authorization || event.headers.Authorization || '';
      if (!auth.startsWith('Bearer ') || auth.slice(7) !== ADMIN_TOKEN) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid token' })
        };
      }

      const result = await sql`DELETE FROM comments WHERE id = ${id}`;

      if (result.rowCount === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Comment not found' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message 
      })
    };
  }
};