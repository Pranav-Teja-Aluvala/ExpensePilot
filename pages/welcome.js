import { connectGmail } from "../utils/gmailConnection.js";

const connect = document.getElementById("connect");
const status = document.getElementById("connectionStatus");

connect.addEventListener("click", async () => {
  connect.disabled = true;
  status.textContent = "Connecting to Gmail and scanning bank alerts…";
  try {
    await connectGmail();
    location.href = "dashboard.html";
  } catch (error) {
    status.textContent = error.message;
    connect.disabled = false;
  }
});
