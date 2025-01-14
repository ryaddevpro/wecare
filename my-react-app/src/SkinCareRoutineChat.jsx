import { useState } from "react";
import axios from "axios";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SkinCareRoutineChat = () => {
  const [query, setQuery] = useState(""); // User input
  const [messages, setMessages] = useState([]); // To store message history
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Append the user message to the history
    const userMessage = { sender: "user", text: query };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setQuery(""); // Reset query input

    try {
      // Prepare the payload for the backend
      const payload = {
        queries: [query], // Backend expects a `queries` array
      };

      // Send POST request to the Flask backend
      const res = await axios.post("http://127.0.0.1:5000/query", payload);

      // Append the bot response to the history
      const botResponse = res.data.responses[0]; // Backend returns `responses` array
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: "bot", text: botResponse },
      ]);
    } catch (err) {
      setError(err.response?.data?.error || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>ChatBot</h1>
      <div
        style={{
          height: "300px",
          overflowY: "scroll",
          border: "1px solid #ddd",
          padding: "10px",
          marginBottom: "20px",
        }}
      >
        {/* Render the message history */}
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              textAlign: msg.sender === "user" ? "right" : "left",
              marginBottom: "10px",
            }}
          >
            <strong>{msg.sender === "user" ? "You" : "Bot"}:</strong>
            <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type your query here..."
          rows="4"
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "10px",
            fontSize: "16px",
          }}
          required
        />
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            backgroundColor: "#007BFF",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
          }}
          disabled={loading}
        >
          {loading ? "Loading..." : "Submit"}
        </button>
      </form>
      <div style={{ marginTop: "20px", fontSize: "16px" }}>
        {error && (
          <div style={{ color: "red" }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default SkinCareRoutineChat;
