// Firebase project for Beyond the Protocols live polling.
// None of this is secret: it identifies the project to the browser. What votes
// can be written, and who can open and close polls, is set by database.rules.json.
// While apiKey is empty every page runs in demo mode (votes kept in this browser only).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA76yUHvQarJT1pY9zDlwui8HHf7b6307U",
  authDomain: "btp-polls.firebaseapp.com",
  databaseURL: "https://btp-polls-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "btp-polls",
  storageBucket: "btp-polls.firebasestorage.app",
  messagingSenderId: "131373496832",
  appId: "1:131373496832:web:ba1097dd7a581dffee36e5",
};

// The Google account allowed to open, close and reveal polls (must match the rules).
export const ADMIN_EMAIL = "kylecwhite@gmail.com";

// Session key used when the page address has no ?s=... (use ?s=hk1-test for dry runs).
export const DEFAULT_SESSION = "hk1";
