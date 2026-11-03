// The renderer only needs three tiny controls; keep Node out of the page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("talentDesktop", {
  setUpdateUrl: (url) => ipcRenderer.send("talent:set-update-url", String(url || "")),
  checkForUpdates: () => ipcRenderer.send("talent:check-updates"),
  setTutorialOpen: (open) => ipcRenderer.send("talent:tutorial-open", !!open),
});
