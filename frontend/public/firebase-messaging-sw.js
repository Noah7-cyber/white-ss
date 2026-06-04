importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const firebaseConfig = {
  // Use URL params or defaults if necessary, though ideally they are hardcoded or passed via query params during SW registration
  // For simplicity, we can rely on standard message payload which FCM handles automatically if standard structure is used.
};

try {
  // Initialize Firebase using the provided frontend config
  firebase.initializeApp({
    apiKey: "AIzaSyBByPSo4yrC_7qpVA_dDs8oJJtfnt1n9pM",
    authDomain: "heimdall-projects.firebaseapp.com",
    projectId: "heimdall-projects",
    storageBucket: "heimdall-projects.firebasestorage.app",
    messagingSenderId: "978325430492",
    appId: "1:978325430492:web:037321ae9f414c925c1419",
    measurementId: "G-3P7N3J6Y0W"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw.js] Received background message ", payload);
    const notificationTitle = payload.notification?.title || "New Notification";
    const notificationOptions = {
      body: payload.notification?.body,
      icon: "/favicon.ico",
      data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (error) {
  console.log("Firebase SW initialization failed:", error);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});