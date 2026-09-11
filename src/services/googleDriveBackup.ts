const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
const GOOGLE_CLIENT_ID_KEY = 'pharmalebanon_google_client_id';
const BACKUP_FILE_PREFIX = 'pharmalebanon-backup-';
const LEGACY_BACKUP_FILE_NAME = 'pharmalebanon-latest-backup.json';
const BACKUP_FOLDER_NAME = 'pharmabackup';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface GoogleAccountsIdentity {
  oauth2: {
    initTokenClient: (options: {
      client_id: string;
      scope: string;
      callback: (response: GoogleTokenResponse) => void;
      error_callback?: (error: { type?: string; message?: string }) => void;
    }) => GoogleTokenClient;
  };
}

declare global {
  interface Window {
    google?: { accounts?: { id?: unknown; oauth2?: GoogleAccountsIdentity['oauth2'] } };
  }
}

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(script);
  });
}

export function getCurrentAppOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

function requestGoogleAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(new Error('Google sign-in service is unavailable. Please check your internet connection.'));
      return;
    }

    const currentOrigin = getCurrentAppOrigin();

    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.access_token) {
          resolve(response.access_token);
        } else {
          const errCode = response.error || '';
          const errDesc = response.error_description || '';
          if (errCode === 'access_denied' || errDesc.includes('access_denied')) {
            reject(
              new Error(
                'Google Access Denied (Error 403): Your app is in "Testing" mode. Add your Google email address under "OAuth consent screen" > "Test users" in Google Cloud Console.'
              )
            );
          } else {
            reject(new Error(errDesc || errCode || 'Google authorization failed.'));
          }
        }
      },
      error_callback: (error) => {
        const message = error.message || error.type || '';
        if (message.includes('access_denied') || error.type === 'access_denied') {
          reject(
            new Error(
              'Google Access Denied (Error 403): Your app is in "Testing" mode. Add your Google email address under "OAuth consent screen" > "Test users" in Google Cloud Console.'
            )
          );
        } else if (message.includes('closed') || message.includes('cancel') || error.type === 'popup_closed') {
          reject(
            new Error(
              `Google sign-in popup was closed or cancelled. If you saw 'access_denied' or 'app has not completed verification', add your Google email to 'Test users' in Google Cloud Console.`
            )
          );
        } else {
          reject(
            new Error(
              `Google authorization error (${error.type || 'failed'}). Make sure "${currentOrigin}" is an Authorized JavaScript origin and your email is added to Test Users in Google Cloud Console.`
            )
          );
        }
      },
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

async function getOrCreateBackupFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent(
    `name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const listResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)&pageSize=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listResponse.ok) throw new Error('Could not find the Google Drive pharmabackup folder.');
  const folders = await listResponse.json() as { files?: Array<{ id: string; name: string }> };
  const existingFolder = folders.files?.find(folder => folder.name === BACKUP_FOLDER_NAME);
  if (existingFolder) return existingFolder.id;

  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!createResponse.ok) throw new Error('Could not create the Google Drive pharmabackup folder.');
  const folder = await createResponse.json() as { id?: string };
  if (!folder.id) throw new Error('Google Drive returned no folder ID.');
  return folder.id;
}

function verifyBackupJson(backupJson: string): BackupVerification {
  const data = JSON.parse(backupJson) as Record<string, unknown>;
  const requiredArrays = ['users', 'products', 'suppliers', 'customers', 'sales', 'purchases', 'logs'];
  const supported = data.schemaVersion === 2 || data.version === '1.0.0';
  if (!supported || !data.settings || requiredArrays.some((key) => !Array.isArray(data[key]))) {
    throw new Error('Backup verification failed: the backup is incomplete or unsupported.');
  }
  return {
    productCount: (data.products as unknown[]).length,
    salesCount: (data.sales as unknown[]).length,
    customerCount: (data.customers as unknown[]).length,
    byteCount: new TextEncoder().encode(backupJson).length,
  };
}

async function uploadBackup(accessToken: string, backupJson: string, retentionCount: number): Promise<GoogleDriveBackupResult> {
  const verification = verifyBackupJson(backupJson);
  const folderId = await getOrCreateBackupFolder(accessToken);
  const versionedName = `${BACKUP_FILE_PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

  const existingResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${encodeURIComponent(`name contains '${BACKUP_FILE_PREFIX}' and '${folderId}' in parents and trashed = false`)}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!existingResponse.ok) {
    let errMessage = 'Could not check Google Drive backup status.';
    try {
      const errObj = await existingResponse.json();
      if (errObj?.error?.message) errMessage = errObj.error.message;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }
  const existing = (await existingResponse.json()) as {
    files?: Array<{ id: string; modifiedTime?: string; size?: string }>;
  };
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size',
    {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'multipart/related; boundary=pharmalebanon-create',
    },
    body: [
          '--pharmalebanon-create',
          'Content-Type: application/json; charset=UTF-8',
          '',
          JSON.stringify({ name: versionedName, mimeType: 'application/json', parents: [folderId] }),
          '--pharmalebanon-create',
          'Content-Type: application/json',
          '',
          backupJson,
          '--pharmalebanon-create--',
          '',
        ].join('\r\n'),
    }
  );
  if (!response.ok) {
    let errorMsg = 'Google Drive backup upload failed.';
    try {
      const errObj = await response.json();
      if (errObj?.error?.message) {
        errorMsg = errObj.error.message;
      }
    } catch {
      const raw = await response.text().catch(() => '');
      if (raw) errorMsg = raw;
    }
    throw new Error(errorMsg);
  }

  const uploaded = await response.json() as { id?: string; modifiedTime?: string; size?: string };
  if (!uploaded.id || uploaded.size !== String(verification.byteCount)) {
    throw new Error('Google Drive did not confirm the complete backup content.');
  }

  // Keep the newest configured number of versioned backups.
  for (const duplicate of existing.files?.slice(Math.max(0, retentionCount - 1)) || []) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${duplicate.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  const verifyResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!verifyResponse.ok || await verifyResponse.text() !== backupJson) {
    throw new Error('Google Drive verification failed: downloaded backup does not match the upload.');
  }
  return { backupJson, name: versionedName, modifiedTime: uploaded.modifiedTime, ...verification };
}

export function getGoogleDriveClientId(): string {
  return localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || '';
}

export function saveGoogleDriveClientId(clientId: string): void {
  localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId.trim());
}

async function getDriveAccessToken(clientId: string, interactive = true): Promise<string> {
  const trimmedClientId = clientId.trim();
  if (!trimmedClientId) throw new Error('Enter a Google OAuth client ID first.');
  await loadGoogleIdentityServices();
  if (!interactive && !cachedAccessToken) {
    throw new Error('Automatic backup requires one successful manual Google Drive backup first.');
  }
  const accessToken = cachedAccessToken?.clientId === trimmedClientId
    ? cachedAccessToken.token
    : await requestGoogleAccessToken(trimmedClientId);
  cachedAccessToken = { clientId: trimmedClientId, token: accessToken };
  return accessToken;
}

export async function backupToGoogleDrive(clientId: string, backupJson: string, retentionCount = 5, interactive = true): Promise<GoogleDriveBackupResult> {
  const accessToken = await getDriveAccessToken(clientId, interactive);
  try {
    return await uploadBackup(accessToken, backupJson, retentionCount);
  } catch (error) {
    cachedAccessToken = null;
    throw error;
  }
}

export interface GoogleDriveBackupVersion {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

export async function listGoogleDriveBackups(clientId: string): Promise<GoogleDriveBackupVersion[]> {
  const accessToken = await getDriveAccessToken(clientId);
  const folderId = await getOrCreateBackupFolder(accessToken);
  const query = encodeURIComponent(`(name contains '${BACKUP_FILE_PREFIX}' or name = '${LEGACY_BACKUP_FILE_NAME}') and '${folderId}' in parents and trashed = false`);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error('Could not list Google Drive backup versions.');
  const data = await response.json() as { files?: GoogleDriveBackupVersion[] };
  return data.files || [];
}

export interface GoogleDriveBackupResult {
  backupJson: string;
  modifiedTime?: string;
  name: string;
  size?: string;
  productCount: number;
  salesCount: number;
  customerCount: number;
  byteCount: number;
}

export async function restoreFromGoogleDrive(clientId: string, backupId?: string): Promise<GoogleDriveBackupResult> {
  const accessToken = await getDriveAccessToken(clientId);

  const folderId = await getOrCreateBackupFolder(accessToken);
  const query = encodeURIComponent(`(name contains '${BACKUP_FILE_PREFIX}' or name = '${LEGACY_BACKUP_FILE_NAME}') and '${folderId}' in parents and trashed = false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`;
  const listResp = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResp.ok) {
    let errMessage = 'Could not search Google Drive for backup files.';
    try {
      const errObj = await listResp.json();
      if (errObj?.error?.message) errMessage = errObj.error.message;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  const listData = (await listResp.json()) as {
    files?: Array<{ id: string; name: string; modifiedTime?: string; size?: string }>;
  };

  const file = backupId
    ? listData.files?.find(candidate => candidate.id === backupId)
    : listData.files?.[0];
  if (!file || !file.id) {
    throw new Error('No pharmacy backup file was found in the Google Drive pharmabackup folder. Please back up your data first.');
  }

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  const downloadResp = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!downloadResp.ok) {
    let errMessage = 'Could not download the backup file from Google Drive.';
    try {
      const errObj = await downloadResp.json();
      if (errObj?.error?.message) errMessage = errObj.error.message;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  const backupJson = await downloadResp.text();
  const verification = verifyBackupJson(backupJson);
  return {
    backupJson,
    modifiedTime: file.modifiedTime,
    name: file.name,
    size: file.size,
    ...verification,
  };
}

export interface BackupVerification {
  productCount: number;
  salesCount: number;
  customerCount: number;
  byteCount: number;
}

let cachedAccessToken: { clientId: string; token: string } | null = null;