const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  openDroppedFile: (fileData) => ipcRenderer.invoke("dialog:droppedFile", fileData),

  // Communication bridge for advanced features
  onHighlight: (callback) => ipcRenderer.on("pdf:highlight", callback),
  onAddText: (callback) => ipcRenderer.on("pdf:addText", callback),
  requestSearch: (query) => ipcRenderer.send("pdf:search", query),
  requestBookmarks: () => ipcRenderer.send("pdf:getBookmarks"),
});
