chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "scanArticle") {
    chrome.storage.local.set({ scannedText: message.content }, () => {
      chrome.windows.create({
        url: chrome.runtime.getURL("scan.html"),
        type: "popup",
        width: 350,
        height: 350
      });
    });
  }
});
