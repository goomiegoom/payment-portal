'use strict';
const { requireAdmin } = require('../../lib/auth');
const { readSheet, normalizePeriod, safeStr } = require('../../lib/sheets');

const PAYEES   = 'Payees';
const DOCS     = 'Documents';
const PROJECTS = 'Project list';

const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','bmp','svg']);

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  try {
    const [payeeRows, docRows, projRows] = await Promise.all([
      readSheet(PAYEES),
      readSheet(DOCS),
      readSheet(PROJECTS),
    ]);

    // Build payee name map
    const nameMap = {};
    for (const r of payeeRows.slice(1)) {
      const tid = safeStr(r[0]);
      if (tid) nameMap[tid] = safeStr(r[2]);
    }

    // Build doc counts & latest periods
    const docCounts = {};
    const latestPeriods = {};
    const documents = [];

    for (let i = 1; i < docRows.length; i++) {
      const r = docRows[i];
      const tid = safeStr(r[0]);
      if (!tid) continue;
      const fileId   = safeStr(r[5]);
      const filename = safeStr(r[4]);
      const ext      = filename.split('.').pop().toLowerCase();
      const isImage  = IMAGE_EXTS.has(ext);
      const period   = normalizePeriod(r[3]);

      docCounts[tid] = (docCounts[tid] || 0) + 1;
      if (!latestPeriods[tid] || period > latestPeriods[tid]) latestPeriods[tid] = period;

      documents.push({
        rowIndex:     i + 1,
        taxId:        tid,
        payeeName:    safeStr(r[1]),
        type:         safeStr(r[2]) || 'other',
        period,
        filename,
        fileId,
        downloadUrl:  fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : '',
        viewUrl:      fileId ? `https://drive.google.com/file/d/${fileId}/view` : '',
        thumbnailUrl: isImage && fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w400` : '',
        isImage,
        visibility:   safeStr(r[10]) || 'payee',
        project:      safeStr(r[9]),
        date:         safeStr(r[6]),
        size:         safeStr(r[7]),
        notes:        safeStr(r[8]),
      });
    }

    const payees = payeeRows.slice(1)
      .filter(r => safeStr(r[0]))
      .map(r => {
        const tid = safeStr(r[0]);
        return {
          taxId:        tid,
          pref:         safeStr(r[1]),
          name:         safeStr(r[2]),
          name_en:      safeStr(r[3]),
          codename:     safeStr(r[4]),
          address:      safeStr(r[5]),
          bank:         safeStr(r[6]),
          branch:       safeStr(r[7]),
          accountNo:    safeStr(r[8]),
          docCount:     docCounts[tid] || 0,
          latestPeriod: latestPeriods[tid] || '',
        };
      });

    const projects = projRows.slice(1)
      .filter(r => safeStr(r[0]))
      .map(r => ({
        name:          safeStr(r[0]),
        date:          safeStr(r[1]),
        billingClient: safeStr(r[2]),
        endClient:     safeStr(r[3]),
      }));

    return res.json({ payees, documents, projects });
  } catch (err) {
    console.error('loadAllData error:', err);
    return res.status(500).json({ error: err.message });
  }
}
export default handler;
