'use strict';
const { google } = require('googleapis');
const { getAuth } = require('./google');
const { Readable } = require('stream');

const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;

async function driveApi() {
  const auth = getAuth();
  return google.drive({ version: 'v3', auth });
}

async function getOrCreateFolder(api, parentId, name) {
  const res = await api.files.list({
    q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  if (res.data.files.length > 0) return res.data.files[0].id;
  const created = await api.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return created.data.id;
}

async function uploadFile({ taxId, project, visibility }, base64Data, mimeType, fileName) {
  const api = await driveApi();
  let parentId = DRIVE_FOLDER_ID;
  if (taxId) {
    parentId = await getOrCreateFolder(api, DRIVE_FOLDER_ID, taxId);
    if (project) parentId = await getOrCreateFolder(api, parentId, project);
    if (visibility === 'admin') parentId = await getOrCreateFolder(api, parentId, 'admin_only');
  }
  const buffer = Buffer.from(base64Data, 'base64');
  const stream = Readable.from(buffer);
  const res = await api.files.create({
    requestBody: { name: fileName, parents: [parentId] },
    media: { mimeType, body: stream },
    fields: 'id,name,size',
  });
  return { fileId: res.data.id, fileName: res.data.name, size: res.data.size };
}

// Recursively list all image/pdf files in a folder
async function listAllFiles() {
  const api = await driveApi();
  const results = [];
  await scanFolder(api, DRIVE_FOLDER_ID, '', results);
  return results;
}

async function scanFolder(api, folderId, folderPath, results) {
  let pageToken = null;
  do {
    const res = await api.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType,size)',
      pageToken: pageToken || undefined,
      spaces: 'drive',
    });
    for (const file of res.data.files || []) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        await scanFolder(api, file.id, folderPath ? `${folderPath}/${file.name}` : file.name, results);
      } else if (file.mimeType && (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf')) {
        results.push({ ...file, path: folderPath });
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
}

module.exports = { uploadFile, listAllFiles };
