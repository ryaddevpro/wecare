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
        queries: [query], // Backend expects a queries array
      };

      // Send POST request to the Flask backend
      const res = await axios.post("http://127.0.0.1:5000/query", payload);

      // Append the bot response to the history
      const botResponse = res.data.responses[0]; // Backend returns responses array
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
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#121212",
        color: "#E0E0E0",
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        overflow: "hidden", // Prevent scrolling
      }}
    >
      <header
        style={{
          width: "100%",
          padding: "0 0",
          textAlign: "center",
          backgroundColor: "#1E1E1E",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h1 style={{ margin: 0, color: "#8BE8A3", fontWeight: "bold" }}>
          WeCare
        </h1>
        <p style={{ margin: "5px 0 0", color: "#A0A0A0" }}>
          Your personal skincare assistant
        </p>
      </header>
      <div
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "10px",
          padding: "20px",
          backgroundColor: "#181818",
        }}
      >
        {/* Render the message history */}
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              width: "90%",
              display: "flex",
              justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "70%",
                padding: "12px 16px",
                borderRadius: "12px",
                backgroundColor: msg.sender === "user" ? "#8BE8A3" : "#333333",
                color: msg.sender === "user" ? "#1E1E1E" : "#E0E0E0",
                fontSize: "15px",
                lineHeight: "1.6",
              }}
            >
              <strong>{msg.sender === "user" ? "You" : "WeCare"}:</strong>{" "}
              <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          display: "flex",
          padding: "20px",
          backgroundColor: "#1E1E1E",
          borderTop: "1px solid #333333",
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type your query here..."
          rows="2"
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid #333333",
            backgroundColor: "#242424",
            color: "#E0E0E0",
            fontSize: "15px",
            marginRight: "10px",
            resize: "none",
          }}
          required
        />
        <button
          type="submit"
          style={{
            padding: "12px 20px",
            backgroundColor: "#8BE8A3",
            color: "#1E1E1E",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "15px",
            fontWeight: "bold",
          }}
          disabled={loading}
        >
          {loading ? "Loading..." : "Send"}
        </button>
      </form>
      {error && (
        <div
          style={{
            padding: "10px",
            textAlign: "center",
            color: "red",
            backgroundColor: "#2A2A2A",
            borderTop: "1px solid #333333",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
};

export default SkinCareRoutineChat;