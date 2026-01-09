import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import { agentAPI } from "../../lib/api";
import ReactMarkdown from "react-markdown";

export default function AgentPage() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/unauthorized");
    }
  }, [isAuthenticated, isAdmin, isLoading, router]);

  if (isLoading || !isAuthenticated || !isAdmin) {
    return (
      <div className="fixed inset-0 bg-ink-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>AI Agent | Voter List Console</title>
      </Head>
      <AgentChatInterface />
    </>
  );
}

function AgentChatInterface() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [agentStatus, setAgentStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    loadSuggestions();
    loadAgentStatus();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadSuggestions = async () => {
    try {
      const data = await agentAPI.getSuggestions();
      setSuggestions(data.suggestions || []);
    } catch (e) {
      setSuggestions([]);
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
          content = data.error || "Something went wrong";
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

  const clearChat = () => {
    setMessages([]);
    setPendingConfirmation(false);
  };

  const defaultPrompts = [
    { icon: "📊", text: "How many voters are in the database?" },
    { icon: "👥", text: "Show gender distribution" },
    { icon: "🗳️", text: "List all sessions with voter counts" },
    { icon: "🛕", text: "Show religion breakdown" },
    { icon: "🔍", text: "Find voters from a specific assembly" },
    { icon: "📈", text: "What are the print statistics?" },
  ];

  const promptsToShow =
    suggestions.length > 0
      ? suggestions.slice(0, 6).map((s, i) => ({
          icon: ["📊", "👥", "🗳️", "🛕", "🔍", "📈"][i] || "💡",
          text: typeof s === "string" ? s : s.text || s,
        }))
      : defaultPrompts;

  const showWelcome = messages.length === 0;

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-ink-100 via-ink-100 to-ink-200">
      {/* Header */}
      <header className="flex-shrink-0 h-14 border-b border-ink-400/50 bg-ink-100/95 backdrop-blur-sm flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="p-2 hover:bg-ink-300 rounded-lg transition-colors text-slate-400 hover:text-white"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-lg">
              🤖
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">
                AI Database Agent
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                {agentStatus ? (
                  <>
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span>{agentStatus.model || "Gemini"}</span>
                  </>
                ) : (
                  <span>Connecting...</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-ink-300 rounded-lg transition-colors"
            >
              New chat
            </button>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
        {showWelcome ? (
          /* Welcome Screen */
          <div className="h-full flex flex-col items-center justify-center px-4 py-8">
            <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-3xl shadow-xl shadow-purple-500/20">
              🤖
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              How can I help you today?
            </h2>
            <p className="text-slate-400 text-center max-w-md mb-8">
              Ask questions about your voter database using natural language
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full">
              {promptsToShow.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt.text)}
                  className="group p-4 bg-ink-200/60 hover:bg-ink-200 border border-ink-400/50 hover:border-purple-500/50 rounded-xl text-left transition-all hover:shadow-lg hover:shadow-purple-500/5"
                >
                  <span className="text-xl mb-2 block">{prompt.icon}</span>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors leading-snug">
                    {prompt.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-sm flex-shrink-0">
                  🤖
                </div>
                <div className="flex items-center gap-1.5 pt-2">
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
              </div>
            )}

            {pendingConfirmation && !loading && (
              <div className="flex justify-center gap-3 py-2">
                <button
                  onClick={() => sendMessage("yes")}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-sm font-medium"
                >
                  ✓ Confirm
                </button>
                <button
                  onClick={() => sendMessage("no")}
                  className="px-5 py-2 bg-ink-300 text-slate-200 rounded-lg hover:bg-ink-400 transition-all text-sm font-medium border border-ink-400"
                >
                  ✕ Cancel
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 border-t border-ink-400/50 bg-ink-100/95 backdrop-blur-sm p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingConfirmation ? "Type yes or no..." : "Message AI Agent..."
            }
            disabled={loading}
            className="w-full px-4 py-3.5 pr-12 bg-ink-200 border border-ink-400 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-all text-sm"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-purple-600 hover:bg-purple-700 disabled:bg-ink-400 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center justify-center"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14M12 5l7 7-7 7"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const { role, content, data, queryInfo, executionTime, rowCount } = message;
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
          isUser
            ? "bg-gradient-to-br from-slate-500 to-slate-600"
            : "bg-gradient-to-br from-purple-500 to-indigo-600"
        }`}
      >
        {isUser ? "👤" : "🤖"}
      </div>

      <div className={`flex-1 min-w-0 ${isUser ? "flex justify-end" : ""}`}>
        <div
          className={`inline-block max-w-full ${
            isUser
              ? "bg-purple-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-md"
              : ""
          }`}
        >
          {isUser ? (
            <p className="text-sm">{content}</p>
          ) : (
            <div className="space-y-3">
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="text-slate-200 text-sm leading-relaxed mb-2 last:mb-0">
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong className="text-white font-semibold">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="text-purple-300">{children}</em>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-1 text-slate-300 text-sm">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-slate-300">{children}</li>
                    ),
                    code: ({ inline, children }) =>
                      inline ? (
                        <code className="px-1 py-0.5 bg-ink-300 rounded text-purple-300 text-xs">
                          {children}
                        </code>
                      ) : (
                        <pre className="p-3 bg-ink-300 rounded-lg overflow-x-auto my-2">
                          <code className="text-xs text-slate-200">
                            {children}
                          </code>
                        </pre>
                      ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>

              {data && data.length > 0 && <DataTable data={data} />}

              {(executionTime || rowCount !== undefined) && (
                <div className="flex gap-4 text-xs text-slate-500 pt-2">
                  {rowCount !== undefined && <span>📊 {rowCount} rows</span>}
                  {executionTime && <span>⚡ {executionTime}ms</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DataTable({ data }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);
  const displayData = expanded ? data : data.slice(0, 5);

  return (
    <div className="rounded-lg border border-ink-400 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-ink-300">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-medium text-slate-200 whitespace-nowrap"
                >
                  {col.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-400/30 bg-ink-200/50">
            {displayData.map((row, idx) => (
              <tr key={idx} className="hover:bg-ink-300/30">
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-2 text-slate-300 whitespace-nowrap"
                  >
                    {formatValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 text-xs text-purple-400 hover:text-purple-300 bg-ink-300/50 transition-colors"
        >
          {expanded ? "Show less" : `Show all ${data.length} rows`}
        </button>
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

// Override layout for this page
AgentPage.getLayout = (page) => page;
