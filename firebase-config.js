import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCxddo17qMN6PDO8WPFWcU4dPHrt5UIwQs",
  authDomain:        "fcu-health.firebaseapp.com",
  projectId:         "fcu-health",
  storageBucket:     "fcu-health.firebasestorage.app",
  messagingSenderId: "237679721411",
  appId:             "1:237679721411:web:2ae5262caf2e1025b75b76"
};

export const app = initializeApp(firebaseConfig);
