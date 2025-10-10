const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    } 
  });

  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Open File dialog
ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    properties: ["openFile"]
  });
  if (canceled) return null;
  return filePaths[0];
});

// Handle dropped file
ipcMain.handle("dialog:droppedFile", async (event, fileData) => {
  if (!fileData || !fileData.path) return null;

  // Only check extension
  if (!fileData.name.toLowerCase().endsWith(".pdf")) return null;

  return fileData.path;
});

// ---- Sidecar Annotations (bookmarks/highlights) ----
function getAnnotationsRoot() {
  const root = path.join(app.getPath("userData"), "annotations");
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

function hashFile(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    return hash.slice(0, 16); // shorten for folder name
  } catch (e) {
    return null;
  }
}

ipcMain.handle("annotations:read", async (event, { filePath, kind }) => {
  try {
    const hash = hashFile(filePath);
    if (!hash) return null;
    const dir = path.join(getAnnotationsRoot(), hash);
    const file = path.join(dir, `${kind}.json`);
    if (!fs.existsSync(file)) return null;
    const text = fs.readFileSync(file, "utf-8");
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
});

ipcMain.handle("annotations:write", async (event, { filePath, kind, data }) => {
  try {
    const hash = hashFile(filePath);
    if (!hash) return false;
    const dir = path.join(getAnnotationsRoot(), hash);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${kind}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (e) {
    return false;
  }
});

function ensureFile(dir, name) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify([], null, 2), "utf-8");
  }
}

ipcMain.handle("annotations:initAll", async (event, { filePath }) => {
  try {
    const hash = hashFile(filePath);
    if (!hash) return false;
    const dir = path.join(getAnnotationsRoot(), hash);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    ensureFile(dir, "bookmarks.json");
    ensureFile(dir, "highlights.json");
    ensureFile(dir, "underlines.json");
    ensureFile(dir, "stickynotes.json");
    return true;
  } catch (e) {
    return false;
  }
});
