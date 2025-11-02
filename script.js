/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

const WORKER_URL =
  window.WORKER_URL || "https://wanderbot-worker.boudyaziz3.workers.dev/";

const messages = [
  {
    role: "system",
    content:
      "You are a helpful product advisor. Recommend skincare and beauty products and routines when asked. Keep answers friendly and concise. Politely refuse to answer questions unrelated to L’Oréal products, routines, recommendations, beauty-related topics, etc. Track the context of the conversation, including details like the user's name and past questions, to support natural, multi-turn interactions.",
  },
];

// Helper: Convert Markdown to HTML
function markdownToHtml(markdown) {
  return (
    markdown
      // Bold **text**
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      // Italic *text* or _text_
      .replace(/(\*|_)(.*?)\1/g, "<em>$2</em>")
      // Bullet points
      .replace(/^- (.*$)/gim, "<li>$1</li>")
      // Numbered lists
      .replace(/^\d+\. (.*$)/gim, "<li>$1</li>")
      // Line breaks
      .replace(/\n/g, "<br>")
      // Wrap lists in <ul>
      .replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>")
  );
}

// Helper: append a message to the chat window with Markdown support
function appendMessage(text, sender = "ai") {
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  div.innerHTML = sender === "user" ? `${text}` : markdownToHtml(text); // Use markdownToHtml to parse Markdown
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Initial greeting from the assistant
appendMessage("👋 Hello! How can I help you today?", "ai");

// Send messages to the Cloudflare Worker, which proxies to OpenAI
async function sendToWorker(messagesPayload) {
  if (!WORKER_URL) {
    throw new Error(
      "Missing WORKER_URL. Set the Cloudflare Worker URL in script.js or provide window.WORKER_URL via secrets.js"
    );
  }

  const resp = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages: messagesPayload }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Worker request failed: ${resp.status} ${resp.statusText} ${text}`
    );
  }

  const data = await resp.json();
  return data;
}

// Handle form submit
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Clear the chat window for each new question
  chatWindow.innerHTML = "";

  // Append user message locally and add to conversation
  appendMessage(text, "user");
  messages.push({ role: "user", content: text });

  // Clear input and disable while awaiting response
  userInput.value = "";
  userInput.disabled = true;

  // Show a typing indicator
  const typingId = `typing-${Date.now()}`;
  const typingElem = document.createElement("div");
  typingElem.className = "msg ai";
  typingElem.id = typingId;
  typingElem.textContent = "…";
  chatWindow.appendChild(typingElem);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const data = await sendToWorker(messages);

    // The Cloudflare Worker returns the OpenAI response JSON. Extract safe content.
    const reply =
      data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : data && data.answer
        ? data.answer
        : "(No response)";

    // Remove typing indicator and append actual reply
    const t = document.getElementById(typingId);
    if (t) t.remove();

    appendMessage(reply, "ai");
    messages.push({ role: "assistant", content: reply });
  } catch (err) {
    // Remove typing indicator
    const t = document.getElementById(typingId);
    if (t) t.remove();

    console.error(err);
    appendMessage(
      "Sorry — there was an error fetching a response. Check the console.",
      "ai"
    );
  } finally {
    userInput.disabled = false;
    userInput.focus();
  }
});

/* Add focus and blur event listeners to toggle chat window highlight */
userInput.addEventListener("focus", () => {
  chatWindow.classList.add("active");
});

userInput.addEventListener("blur", () => {
  chatWindow.classList.remove("active");
});
