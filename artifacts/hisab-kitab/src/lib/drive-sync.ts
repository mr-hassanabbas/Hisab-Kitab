const TOKEN_KEY = "hk_drive_token";
const FILE_NAME = "hisab-kitab-chat-history.json";
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { error?: string; access_token?: string }) => void;
          }) => { requestAccessToken: (overridableParams?: { prompt?: string }) => void };
        };
      };
    };
  }
}

export function driveClientId(): string {
  return (import.meta.env as Record<string, string>).VITE_GOOGLE_CLIENT_ID ?? "";
}

export function isDriveConfigured(): boolean {
  return driveClientId().trim() !== "";
}

export function getDriveToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setDriveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearDriveToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.getElementById("gsi-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS script failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.id = "gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GIS script failed to load"));
    document.body.appendChild(script);
  });
}

export function authorizeDrive(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGis();
    } catch (e) {
      reject(e);
      return;
    }
    const clientId = driveClientId();
    if (!clientId) {
      reject(new Error("VITE_GOOGLE_CLIENT_ID not configured"));
      return;
    }
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES.join(" "),
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? "Authorization failed"));
          return;
        }
        setDriveToken(resp.access_token);
        resolve(resp.access_token);
      },
    });
    tokenClient.requestAccessToken();
  });
}

async function findFile(token: string): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${FILE_NAME}' and trashed=false`)}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const files: { id: string }[] = data?.files ?? [];
  return files.length > 0 ? files[0].id : null;
}

async function uploadNew(token: string, content: string): Promise<void> {
  const boundary = "hk_sync_boundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `{"name":"${FILE_NAME}","mimeType":"application/json"}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;
  await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
}

async function overwrite(token: string, fileId: string, content: string): Promise<void> {
  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: content,
  });
}

export async function drivePush(historyJson: string): Promise<void> {
  const token = getDriveToken();
  if (!token) throw new Error("Not authorized. Call authorizeDrive() first.");
  const fileId = await findFile(token);
  if (fileId) {
    await overwrite(token, fileId, historyJson);
  } else {
    await uploadNew(token, historyJson);
  }
}

export async function drivePull(): Promise<string | null> {
  const token = getDriveToken();
  if (!token) return null;
  const fileId = await findFile(token);
  if (!fileId) return null;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  return res.text();
}