// socket.ts
import io from "socket.io-client";
import { getAccessTokenFromCookie } from "@/utils/helper";

const apiUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "https://whitepenguin-api.heimdallprodev.com/";

export const socket = io(apiUrl, {
  transports: ["websocket"],
  autoConnect: false,
  auth: (cb) => {
    cb({ token: getAccessTokenFromCookie() });
  },
});
