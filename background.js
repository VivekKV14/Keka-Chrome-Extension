// Listener for the extension icon click
// chrome.action.onClicked.addListener((tab) => {
//   // Inject the content script into the current tab
//   chrome.scripting.executeScript({
//     target: { tabId: tab.id },
//     files: ["content.js"],
//   });
// });

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.type === "keka-data") {
//     chrome.storage.local.set({ hourData: message.data });
//     sendResponse({ success: true, data: message.data });
//   }
// });