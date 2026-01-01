const socket = io("http://localhost:8000");

const messages = document.getElementById("messages");
const input = document.getElementById("input");

function send() {
    if (!input.value) return;
    socket.emit("chat-message", input.value);
    input.value = "";
}

socket.on("chat-message", msg => {
    const li = document.createElement("li");
    li.textContent = msg;
    messages.appendChild(li);
});
