'use strict';
const { readSheet, normalizePeriod, safeStr } = require('../../../lib/sheets');

const PAYEES = 'Payees';
const DOCS   = 'Documents';
const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','bmp','svg']);

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { taxId } = req.body || {};
  if (!taxId) return res.json({ success: false, error: 'MISSING_TAX_ID' });
  try {
    const [payeeRows, docRows] = await Promise.all([readSheet(PAYEES), readSheet(DOCS)]);
    const payeeRow = payeeRows.slice(1).find(r => safeStr(r[0]) === safeStr(taxId));
    if (!payeeRow) return res.json({ success: false, error: 'NOT_FOUND' });
    const payee = {
      taxId:    safeStr(payeeRow[0]),
      pref:     safeStr(payeeRow[1]),
      name:     safeStr(payeeRow[2]),
      name_en:  safeStr(payeeRow[3]),
      codename: safeStr(payeeRow[4]),
    };
    const documents = [];
    for (const r of docRows.slice(1)) {
      if (safeStr(r[0]) !== safeStr(taxId)) continue;
      const vis = safeStr(r[10]) || 'payee';
      if (vis === 'admin') continue;
      const fileId   = safeStr(r[5]);
      const filename = safeStr(r[4]);
      const ext      = filename.split('.').pop().toLowerCase();
      const isImage  = IMAGE_EXTS.has(ext);
      documents.push({
        type:         safeStr(r[2]) || 'other',
        period:       normalizePeriod(r[3]),
        filename,     fileId,
        downloadUrl:  fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : '',
        viewUrl:      fileId ? `https://drive.google.com/file/d/${fileId}/view` : '',
        thumbnailUrl: isImage && fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w400` : '',
        isImage,      visibility: vis,
        project:      safeStr(r[9]),
        date:         safeStr(r[6]),
        size:         safeStr(r[7]),
      });
    }
    return res.json({ success: true, payee, documents });
  } catch (err) {
    console.error('portalLogin error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
export default handler;
