const socket = io();

// fake username tạm thời
const username = "Guest-" + Math.floor(Math.random() * 1000);
let lastMessage = null;
const GROUP_TIME_LIMIT = 2 * 60 * 1000;

const chatBody = document.getElementById("chat-body");
const chatInput = document.getElementById("chat-input");

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => {
    p.classList.remove("active");
  });
  document.getElementById(pageId).classList.add("active");
}

function toggleProfile() {
  document.getElementById("profile-popup")
    .classList.toggle("active");
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  socket.emit("send-message", {
    user: username,
    text: text
  });

  chatInput.value = "";
}

socket.on("receive-message", msg => {
  const isMe = msg.user === username;

  const wrapper = document.createElement("div");
  wrapper.className = `message ${isMe ? "me" : "other"}`;

  // username nằm ngoài bubble
  if (!isMe) {
    const name = document.createElement("div");
    name.className = "username";
    name.textContent = msg.user;
    wrapper.appendChild(name);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = msg.text;

  wrapper.appendChild(bubble);
  chatBody.appendChild(wrapper);
  chatBody.scrollTop = chatBody.scrollHeight;
});

chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});
