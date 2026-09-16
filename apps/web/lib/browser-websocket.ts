// Midnight indexer 4.1.1 imports both named and default WebSocket exports.
// isomorphic-ws' browser entry only provides default; normalize the browser API.
const BrowserWebSocket = globalThis.WebSocket;
export { BrowserWebSocket as WebSocket };
export default BrowserWebSocket;
