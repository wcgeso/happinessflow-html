// Backend deadlines use the server's clock; never initialize the browser RTDB SDK.
export const serverNow = () => Date.now();
