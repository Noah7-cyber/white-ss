import { useEffect } from "react";
import { getToken, onMessage, messaging } from "../lib/firebase";
import { authServices } from "../services/auth.service";
import { showToast } from "../modules/shared/component/Toast/toast";

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
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      });

      if (fcmToken) {
        // Send token to backend
        await authServices.updateFcmToken({
          data: {
            fcmToken,
            action: "add"
          }
        });
        console.log("FCM Token registered with backend");
      }

      // Handle foreground messages (tab is open)
      onMessage(msg, (payload) => {
        const title = payload.notification?.title || "New Notification";
        const body = payload.notification?.body;
        showToast({
          message: title,
          description: body,
          severity: "info",
          duration: 6000,
        });
      });

    } catch (error) {
      console.error("Failed to register FCM token", error);
    }
  }
};
