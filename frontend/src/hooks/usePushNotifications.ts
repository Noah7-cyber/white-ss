import { useEffect } from "react";
import { getToken, onMessage, messaging } from "../lib/firebase";
import { authServices } from "../services/auth.service";

export const usePushNotifications = () => {
  useEffect(() => {
    const setupFirebase = async () => {
      try {
        const msg = await messaging();
        if (!msg) {
          console.log("Firebase messaging not supported");
          return;
        }

        // Check if permission is already granted
        const permission = Notification.permission;

        if (permission === 'granted') {
          await registerToken(msg);
        } else if (permission !== 'denied') {
          // Request permission
          const newPermission = await Notification.requestPermission();
          if (newPermission === 'granted') {
             await registerToken(msg);
          }
        }
      } catch (error) {
        console.error("Error setting up push notifications", error);
      }
    };

    // Check if we are in the browser
    if (typeof window !== "undefined" && "Notification" in window) {
      setupFirebase();
    }
  }, []);

  const registerToken = async (msg: any) => {
    try {
      const fcmToken = await getToken(msg, {
         // Optionally you can provide vapidKey here if you use web push certificates
      });

      if (fcmToken) {
        // Send token to backend
        const { default: client } = await import("../utils/client");
        await client.request({
          ...authServices.updateFcmToken,
          data: {
            fcmToken,
            action: "add"
          }
        });
        console.log("FCM Token registered with backend");
      }

      // Handle foreground messages
      onMessage(msg, (payload) => {
         console.log("Received foreground message:", payload);
         // The service worker handles background notifications.
         // For foreground, you might want to show a toast or update UI
      });

    } catch (error) {
      console.error("Failed to register FCM token", error);
    }
  }
};
