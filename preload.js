const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  openDroppedFile: (fileData) => ipcRenderer.invoke("dialog:droppedFile", fileData),

  // Communication bridge (IPC) for advanced features
  onHighlight: (callback) => ipcRenderer.on("pdf:highlight", callback),
  onAddText: (callback) => ipcRenderer.on("pdf:addText", callback),
  requestSearch: (query) => ipcRenderer.send("pdf:search", query),
  requestBookmarks: () => ipcRenderer.send("pdf:getBookmarks"),
  
  // Sidecar annotations ( refer the annotation folder) 
  readAnnotations: (filePath, kind) => ipcRenderer.invoke("annotations:read", { filePath, kind }),
  writeAnnotations: (filePath, kind, data) => ipcRenderer.invoke("annotations:write", { filePath, kind, data }),
  initAllAnnotations: (filePath) => ipcRenderer.invoke("annotations:initAll", { filePath }),
});
