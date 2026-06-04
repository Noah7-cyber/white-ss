import type { Messaging } from "firebase/messaging";
import { useEffect } from "react";
import { getToken, onMessage, messaging } from "../lib/firebase";
import { authServices } from "../services/auth.service";
import { showPushNotificationToast } from "../modules/shared/component/Toast/PushNotificationToast";
import client, { ApiMethods } from "../utils/client";

export const usePushNotifications = () => {
  useEffect(() => {
    const setupFirebase = async () => {
      try {
        const msg = await messaging();
        if (!msg) {
          console.log("Firebase messaging not supported");
          return;
        }

        // Initialize the service worker and pass the config
        if ("serviceWorker" in navigator) {
          try {
            const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

            const firebaseConfig = {
              apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
              authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
              storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
              messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
              appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
              measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
            };

            // Wait until service worker is active before sending message
            if (registration.active) {
              registration.active.postMessage({
                type: 'INIT_FIREBASE_SW',
                firebaseConfig
              });
            } else {
              registration.installing?.addEventListener('statechange', (e: any) => {
                if (e.target.state === 'activated') {
                  registration.active?.postMessage({
                    type: 'INIT_FIREBASE_SW',
                    firebaseConfig
                  });
                }
              });
            }
          } catch (err) {
            console.error("Service worker registration failed", err);
          }
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

  const registerToken = async (msg: Messaging) => {
    try {
      const fcmToken = await getToken(msg, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      });

      if (fcmToken) {
        await client.request({
          ...authServices.updateFcmToken,
          method: authServices.updateFcmToken.method ?? ApiMethods.POST,
          data: { fcmToken, action: "add" },
        });
        console.log("FCM Token registered with backend");
      }

      // Handle foreground messages (tab is open)
      onMessage(msg, (payload) => {
        console.log("Received foreground message: ", payload);
        const title = payload.notification?.title || "New Notification";
        const body = payload.notification?.body;
        const url = payload.data?.url || "/";
        showPushNotificationToast({
          title,
          body,
          duration: 6000,
          url,
        });
      });

    } catch (error) {
      console.error("Failed to register FCM token", error);
    }
  }
};
