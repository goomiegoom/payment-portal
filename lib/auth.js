'use strict';
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function signAdminToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '30m' });
}

function requireAdmin(req, res) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.role === 'admin';
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
}

module.exports = { signAdminToken, requireAdmin };
