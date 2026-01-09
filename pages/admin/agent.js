import { useState, useEffect, useCallback, useRef } from "react";
import ProtectedRoute from "../../components/ProtectedRoute";
import { agentAPI } from "../../lib/api";
import ReactMarkdown from "react-markdown";

export default function AgentPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AgentChatInterface />
    </ProtectedRoute>
  );
}

function AgentChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [agentStatus, setAgentStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadSuggestions();
    loadAgentStatus();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSuggestions = async () => {
    try {
      const data = await agentAPI.getSuggestions();
      setSuggestions(data.suggestions || getDefaultSuggestions());
    } catch (e) {
      setSuggestions(getDefaultSuggestions());
    }
  };

  const getDefaultSuggestions = () => [
    {
      icon: "📊",
      text: "How many voters are in the database?",
      category: "stats",
    },
    { icon: "👥", text: "Show gender distribution", category: "demographics" },
    {
      icon: "🗳️",
      text: "List all sessions with voter counts",
      category: "sessions",
    },
    { icon: "🔍", text: "Find voters by assembly name", category: "search" },
  ];

  const loadAgentStatus = async () => {
    try {
      const data = await agentAPI.getStatus();
      setAgentStatus(data);
    } catch (e) {
      console.error("Failed to load agent status:", e);
    }
  };

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || loading) return;

      const userMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);

      try {
        let data;
        if (pendingConfirmation) {
          const confirm = text.toLowerCase().match(/^(yes|confirm|ok|sure|y)/)
            ? true
            : false;
          data = await agentAPI.confirm(confirm);
        } else {
          data = await agentAPI.query(text, false);
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
          content = `${data.error || "Something went wrong"}`;
          if (data.suggestions?.length > 0) {
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
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: error.message || "Network error. Please try again.",
            type: "error",
          },
        ]);
        setPendingConfirmation(false);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [loading, pendingConfirmation]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (text) => {
    sendMessage(text);
  };

  const clearChat = () => {
    setMessages([]);
    setPendingConfirmation(false);
  };

  const formattedSuggestions = Array.isArray(suggestions)
    ? suggestions.map((s) =>
        typeof s === "string" ? { icon: "💡", text: s } : s
      )
    : getDefaultSuggestions();

  const showWelcome = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] -mt-4">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <WelcomeScreen
            suggestions={formattedSuggestions}
            onSuggestionClick={handleSuggestionClick}
            agentStatus={agentStatus}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {loading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm flex-shrink-0">
                  🤖
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="flex gap-1">
                      <span
                        className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></span>
                      <span
                        className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      ></span>
                      <span
                        className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      ></span>
                    </div>
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {pendingConfirmation && !loading && (
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => sendMessage("yes")}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium"
                >
                  ✓ Yes, proceed
                </button>
                <button
                  onClick={() => sendMessage("no")}
                  className="px-6 py-2.5 bg-ink-300 text-slate-200 rounded-xl hover:bg-ink-400 transition-all font-medium border border-ink-400"
                >
                  ✕ Cancel
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-ink-400/50 bg-ink-100/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {messages.length > 0 && (
            <div className="flex justify-center mb-3">
              <button
                onClick={clearChat}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Clear conversation
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                pendingConfirmation
                  ? "Type yes or no..."
                  : "Ask anything about your voter data..."
              }
              disabled={loading}
              className="w-full px-5 py-4 pr-14 bg-ink-200 border border-ink-400 rounded-2xl
                         text-slate-100 placeholder-slate-500 text-base
                         focus:ring-2 focus:ring-purple-500 focus:border-purple-500
                         focus:outline-none disabled:opacity-50 transition-all
                         shadow-lg"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 
                         bg-purple-600 text-white rounded-xl
                         hover:bg-purple-700 disabled:opacity-30 disabled:cursor-not-allowed
                         transition-all flex items-center justify-center"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-3">
            AI Database Agent powered by {agentStatus?.model || "Gemini"} • Ask
            natural language questions about voter data
          </p>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ suggestions, onSuggestionClick, agentStatus }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4">
      <div className="text-center mb-10">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-4xl shadow-2xl shadow-purple-500/30">
          🤖
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-3">
          AI Database Agent
        </h1>
        <p className="text-slate-400 text-lg max-w-md">
          Ask questions about your voter database in natural language
        </p>
        {agentStatus && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-900/30 text-emerald-300 rounded-full text-sm border border-emerald-700/50">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            Online • {agentStatus.model || "Gemini"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
        {suggestions.slice(0, 4).map((sug, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick(sug.text || sug)}
            className="group p-4 bg-ink-200/80 hover:bg-ink-200 border border-ink-400 hover:border-purple-500/50
                       rounded-xl text-left transition-all hover:shadow-lg hover:shadow-purple-500/10"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{sug.icon || "💡"}</span>
              <span className="text-slate-200 group-hover:text-white transition-colors">
                {sug.text || sug}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-2">
        {[
          "Total voters",
          "Gender stats",
          "Religion breakdown",
          "Session list",
          "Help",
        ].map((quick) => (
          <button
            key={quick}
            onClick={() => onSuggestionClick(quick)}
            className="px-4 py-2 bg-ink-300/50 hover:bg-purple-600/30 text-slate-400 hover:text-purple-200
                       rounded-full text-sm transition-all border border-ink-400 hover:border-purple-500/50"
          >
            {quick}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const { role, content, data, queryInfo, executionTime, rowCount } = message;
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex gap-4 justify-end">
        <div className="max-w-[80%] px-5 py-3 bg-purple-600 text-white rounded-2xl rounded-br-md">
          <p>{content}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm flex-shrink-0">
          👤
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm flex-shrink-0">
        🤖
      </div>
      <div className="flex-1 min-w-0">
        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p className="text-slate-200 mb-3 leading-relaxed">
                  {children}
                </p>
              ),
              strong: ({ children }) => (
                <strong className="text-white font-semibold">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="text-purple-300">{children}</em>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  {children}
                </ol>
              ),
              code: ({ inline, children }) =>
                inline ? (
                  <code className="px-1.5 py-0.5 bg-ink-300 rounded text-purple-300 text-sm">
                    {children}
                  </code>
                ) : (
                  <pre className="p-3 bg-ink-300 rounded-lg overflow-x-auto my-3">
                    <code className="text-sm text-slate-200">{children}</code>
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
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {data && data.length > 0 && <DataTable data={data} />}

        {(queryInfo || executionTime || rowCount !== undefined) && (
          <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-4 pt-3 border-t border-ink-400/30">
            {rowCount !== undefined && (
              <span>
                📊 {rowCount} row{rowCount !== 1 ? "s" : ""}
              </span>
            )}
            {executionTime && <span>⚡ {executionTime}ms</span>}
            {queryInfo?.intent && (
              <span className="text-purple-400">🎯 {queryInfo.intent}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DataTable({ data }) {
  const [showAll, setShowAll] = useState(false);
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);
  const displayData = showAll ? data : data.slice(0, 10);

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-ink-400">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-ink-300">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left font-medium text-slate-200 whitespace-nowrap"
                >
                  {col.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-400/30">
            {displayData.map((row, idx) => (
              <tr key={idx} className="hover:bg-ink-300/30 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-3 text-slate-300 whitespace-nowrap"
                  >
                    {formatValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 10 && (
        <div className="px-4 py-2 bg-ink-300/50 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            {showAll ? "Show less" : `Show all ${data.length} rows`}
          </button>
        </div>
      )}
    </div>
  );
}

function formatValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "✓" : "✕";
  return String(value);
}
