import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { agentAPI } from "../lib/api";
import ReactMarkdown from "react-markdown";

export default function AgentChat() {
  const { isAuthenticated, user } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [agentStatus, setAgentStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load suggestions and agent status on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadSuggestions();
      loadAgentStatus();
    }
  }, [isAuthenticated]);

  // Add welcome message when opening chat
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: `👋 Hi ${
            user?.name || "there"
          }! I'm the **Database Agent**.\n\nAsk me anything about the voter data!\n\nTry: *"How many voters are there?"* or type **help** for more options.`,
          type: "welcome",
        },
      ]);
    }
  }, [isOpen, messages.length, user?.name]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadSuggestions = async () => {
    try {
      const data = await agentAPI.getSuggestions();
      setSuggestions(data.suggestions || []);
    } catch (e) {
      console.error("Failed to load suggestions:", e);
      setSuggestions([
        "How many voters are in the database?",
        "Show voter count by assembly",
        "What's the gender distribution?",
        "Help",
      ]);
    }
  };

  const loadAgentStatus = async () => {
    try {
      const data = await agentAPI.getStatus();
      setAgentStatus(data);
    } catch (e) {
      console.error("Failed to load agent status:", e);
    }
  };

  const sendMessage = useCallback(
    async (text, isConfirmation = false) => {
      if (!text.trim() || loading) return;
      const userMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);

      try {
        let data;
        if (isConfirmation) {
          const confirm = text.toLowerCase().match(/^(yes|confirm|ok|sure|y)/)
            ? true
            : false;
          data = await agentAPI.confirm(confirm);
        } else {
          data = await agentAPI.query(text, pendingConfirmation);
        }

        let content = "";
        let showData = null;
        let queryInfo = null;

        if (data.success) {
          switch (data.type) {
            case "help":
              setPendingConfirmation(false);
              content = data.message;
              break;
            case "confirmation_required":
              setPendingConfirmation(true);
              content = data.response;
              break;
            case "query_result":
              setPendingConfirmation(false);
              content = data.response;
              showData = data.data;
              queryInfo = data.query;
              break;
            default:
              setPendingConfirmation(false);
              content = data.response || data.message || "Done!";
          }
        } else {
          content = `❌ ${data.error || "Something went wrong"}`;
          if (data.suggestions && data.suggestions.length > 0) {
            content +=
              "\n\n**Try these:**\n" +
              data.suggestions.map((s) => `- ${s}`).join("\n");
          }
          setPendingConfirmation(false);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content,
            data: showData,
            queryInfo,
            type: data.type,
            executionTime: data.executionTime,
            rowCount: data.rowCount,
          },
        ]);
      } catch (error) {
        console.error("Agent query error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "❌ " + (error.message || "Network error. Please try again."),
            type: "error",
          },
        ]);
        setPendingConfirmation(false);
      } finally {
        setLoading(false);
      }
    },
    [loading, pendingConfirmation]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input, pendingConfirmation);
  };

  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: `👋 Chat cleared! Ask me anything about the voter data.`,
        type: "welcome",
      },
    ]);
    setPendingConfirmation(false);
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-indigo-600
                   text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105
                   transition-all z-50 flex items-center justify-center text-2xl
                   border-2 border-purple-400/30"
        title="AI Database Agent"
        aria-label="Toggle AI Database Agent"
      >
        {isOpen ? "✕" : "🤖"}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className="fixed bottom-40 right-6 w-[400px] max-w-[calc(100vw-3rem)] h-[500px]
                     bg-ink-200 rounded-xl shadow-2xl flex flex-col z-50
                     border border-ink-400 overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div
            className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600
                       text-white flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <div className="font-semibold">Database Agent</div>
                <div className="text-xs opacity-80">
                  {agentStatus?.model || "AI-powered queries"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Clear chat"
              >
                🗑️
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-ink-100/50">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} t={t} />
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-ink-200 px-4 py-3 rounded-2xl border border-ink-400 rounded-bl-sm">
                  <span className="animate-pulse flex items-center gap-2">
                    <span className="text-lg">🤔</span>
                    <span className="text-slate-300">Thinking...</span>
                  </span>
                </div>
              </div>
            )}
            {pendingConfirmation && !loading && (
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => sendMessage("yes", true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg
                             hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <span>✓</span> Yes, proceed
                </button>
                <button
                  onClick={() => sendMessage("no", true)}
                  className="px-4 py-2 bg-ink-300 text-slate-200 rounded-lg
                             hover:bg-ink-400 transition-colors flex items-center gap-2"
                >
                  <span>✕</span> Cancel
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && suggestions.length > 0 && (
            <div className="px-4 py-2 border-t border-ink-400 bg-ink-200">
              <div className="text-xs text-slate-400 mb-2">Try asking:</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 4).map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(sug)}
                    className="px-3 py-1 bg-ink-300 rounded-full text-xs text-slate-200
                               hover:bg-purple-600/30 hover:text-purple-200 transition-colors
                               border border-ink-400"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-ink-400 bg-ink-200 flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                pendingConfirmation
                  ? "Type yes or no..."
                  : "Ask about voter data..."
              }
              disabled={loading}
              className="flex-1 px-4 py-2 bg-ink-100 border border-ink-400 rounded-full
                         text-slate-100 placeholder-slate-500
                         focus:ring-2 focus:ring-purple-500 focus:border-purple-500
                         focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-full
                         hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function MessageBubble({ message, t }) {
  const { role, content, data, queryInfo, executionTime, rowCount, type } =
    message;
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] px-4 py-3 rounded-2xl ${
          isUser
            ? "bg-purple-600 text-white rounded-br-sm"
            : "bg-ink-200 text-slate-100 border border-ink-400 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <span>{content}</span>
        ) : (
          <div className="space-y-3">
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full text-xs border border-ink-400 rounded">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-ink-300">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-2 py-1 text-left font-medium text-slate-200 border-b border-ink-400">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-2 py-1 text-slate-300 border-b border-ink-400/50">
                      {children}
                    </td>
                  ),
                  code: ({ inline, children }) =>
                    inline ? (
                      <code className="px-1 py-0.5 bg-ink-300 rounded text-purple-300">
                        {children}
                      </code>
                    ) : (
                      <pre className="p-2 bg-ink-300 rounded overflow-x-auto">
                        <code>{children}</code>
                      </pre>
                    ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline"
                    >
                      {children}
                    </a>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-slate-100 font-semibold">
                      {children}
                    </strong>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>

            {data && data.length > 0 && <DataTable data={data} maxRows={10} />}

            {(queryInfo || executionTime || rowCount !== undefined) && (
              <div className="flex flex-wrap gap-3 text-xs text-slate-400 pt-2 border-t border-ink-400/50">
                {rowCount !== undefined && (
                  <span className="flex items-center gap-1">
                    📊 {rowCount} row{rowCount !== 1 ? "s" : ""}
                  </span>
                )}
                {executionTime && (
                  <span className="flex items-center gap-1">
                    ⚡ {executionTime}ms
                  </span>
                )}
                {queryInfo?.intent && (
                  <span
                    className="text-purple-400 truncate max-w-[200px]"
                    title={queryInfo.intent}
                  >
                    🎯 {queryInfo.intent}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DataTable({ data, maxRows = 10 }) {
  if (!data || data.length === 0) return null;
  const columns = Object.keys(data[0]);
  const displayData = data.slice(0, maxRows);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border border-ink-400 rounded">
        <thead className="bg-ink-300">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-2 py-1.5 text-left font-medium text-slate-200 border-b border-ink-400"
              >
                {col.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, idx) => (
            <tr key={idx} className="hover:bg-ink-300/50 transition-colors">
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-2 py-1.5 text-slate-300 border-b border-ink-400/30"
                >
                  {formatCellValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > maxRows && (
        <div className="text-xs text-slate-400 mt-1 text-center">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
}

function formatCellValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "✓" : "✕";
  return String(value);
}
