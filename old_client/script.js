const socket = io();

// fake username
const username = "User-" + Math.floor(Math.random() * 1000);

const chatBody = document.getElementById("chat-body");
const chatInput = document.getElementById("chat-input");

// =====================
// PAGE + PROFILE
// =====================
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p =>
    p.classList.remove("active")
  );
  document.getElementById(pageId).classList.add("active");
}

function toggleProfile() {
  document.getElementById("profile-popup").classList.toggle("active");
}

// =====================
// MESSAGE LOGIC
// =====================
let lastMessage = {
  user: null,
  time: null
};
let lastMessageDate = null;
const typingUsers = new Set();
let typingTimeout = null;

const GROUP_TIME = 2 * 60 * 1000; // 2 phút

function createDateDivider(timestamp) {
  const div = document.createElement("div");
  div.className = "date-divider";
  div.textContent = formatDate(timestamp);
  return div;
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  socket.emit("send-message", {
    user: username,
    text: text,
    timestamp: Date.now()
  });

  chatInput.value = "";
}

document.addEventListener("click", () => {
  document
    .querySelectorAll(".message.show-time")
    .forEach(m => m.classList.remove("show-time"));
});

chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

chatInput.addEventListener("input", () => {
  socket.emit("typing", { user: username });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stop-typing", { user: username });
  }, 1000);
});

// =====================
// RECEIVE MESSAGE
// =====================
socket.on("receive-message", msg => {
  renderMessage(msg);
  if (msg.user !== username) {
    socket.emit("message-seen", { id: msg.id });
  }
  console.log(msg);
});

function renderMessage(msg) {
  const isMe = msg.user === username;
  const isContinuous =
    lastMessage.user === msg.user &&
    msg.timestamp - lastMessage.time < GROUP_TIME;

  const messageEl = document.createElement("div");
  messageEl.classList.add("message");
  messageEl.classList.add(isMe ? "me" : "other");

  if (isContinuous) {
    messageEl.classList.add("continuous");
  }

  // username (only if NOT continuous)
  if (!isContinuous) {
    const usernameEl = document.createElement("div");
    usernameEl.className = "username";
    usernameEl.textContent = msg.user;
    messageEl.appendChild(usernameEl);
  }

// Create a wrapper for the bubble and time
  const bubbleWrapper = document.createElement("div");
  bubbleWrapper.className = "bubble-wrapper";

  // bubble
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = msg.text;
  bubbleWrapper.appendChild(bubble); // Append bubble to the wrapper

  // time
  const timeEl = document.createElement("div");
  timeEl.className = "time";
  timeEl.textContent = formatTime(msg.timestamp);
  bubbleWrapper.appendChild(timeEl); // Append time to the wrapper

  messageEl.appendChild(bubbleWrapper); // Append the wrapper to the main message element

  if (isMe) {
    const status = document.createElement("div");
    status.className = "status";
    status.textContent = "Sent";
    messageEl.appendChild(status);

    socket.on("message-seen", () => {
      status.textContent = "Seen";
    });
  }

  const msgDate = new Date(msg.timestamp);
  const msgDateKey = msgDate.toDateString();

  if (lastMessageDate !== msgDateKey) {
    chatBody.appendChild(createDateDivider(msg.timestamp));
    lastMessageDate = msgDateKey;
  }

  if (
    lastMessage.user === msg.user &&
    msg.timestamp - lastMessage.time < GROUP_TIME
  ) {
    const status = chatBody.querySelector(
      ".message:last-child .status"
    );
    if (status) status.style.display = "none";
  }

  messageEl.addEventListener("click", e => {
    e.stopPropagation();
    messageEl.classList.toggle("show-time");
  });

  chatBody.appendChild(messageEl);
  chatBody.scrollTop = chatBody.scrollHeight;

  lastMessage = {
    user: msg.user,
    time: msg.timestamp
  };
}

const typingEl = document.getElementById("typing-indicator");

socket.on("user-typing", data => {
  if (data.user === username) return;

  typingUsers.add(data.user);
  updateTypingIndicator();
});

socket.on("user-stop-typing", data => {
  typingUsers.delete(data.user);
  updateTypingIndicator();
});

function updateTypingIndicator() {
  if (typingUsers.size === 0) {
    typingEl.style.display = "none";
    return;
  }

  const users = [...typingUsers];
  const MAX_NAMES = 3;

  let text = "";

  if (users.length <= MAX_NAMES) {
    text = users.join(", ") + " is typing...";
  } else {
    text =
      users.slice(0, MAX_NAMES).join(", ") +
      ", ... are typing...";
  }

  typingEl.textContent = text;
  typingEl.style.display = "block";
}

// =====================
// UTILS
// =====================
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

