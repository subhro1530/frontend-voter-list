import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { agentAPI } from "../lib/api";
import ReactMarkdown from "react-markdown";

export default function AgentPage() {
  const { isAuthenticated, isAdmin, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
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
      <AgentChatInterface isAdmin={isAdmin} user={user} />
    </>
  );
}

function AgentChatInterface({ isAdmin, user }) {
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
          // Pass user context for role-based filtering on backend
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

  // Role-based prompts
  const adminPrompts = [
    { icon: "📊", text: "How many voters are in the database?" },
    { icon: "👥", text: "Show gender distribution across all sessions" },
    { icon: "🗳️", text: "List all sessions with voter counts" },
    { icon: "🛕", text: "Show religion breakdown" },
    { icon: "📈", text: "What are the overall statistics?" },
    { icon: "🔍", text: "Find top 10 assemblies by voter count" },
  ];

  const userPrompts = [
    { icon: "🔍", text: "Search voters by name" },
    { icon: "📍", text: "Find voters in my assigned area" },
    { icon: "👥", text: "Show voter details by voter ID" },
    { icon: "📊", text: "How many voters can I access?" },
    { icon: "🏠", text: "Search voters by address" },
    { icon: "❓", text: "What can I search for?" },
  ];

  const defaultPrompts = isAdmin ? adminPrompts : userPrompts;

  const promptsToShow =
    suggestions.length > 0
      ? suggestions.slice(0, 6).map((s, i) => ({
          icon: ["📊", "👥", "🗳️", "🛕", "🔍", "📈"][i] || "💡",
          text: typeof s === "string" ? s : s.text || s,
        }))
      : defaultPrompts;

  const showWelcome = messages.length === 0;

  // Navigate back based on role
  const handleBack = () => {
    router.push(isAdmin ? "/admin/dashboard" : "/search");
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-[#0a0e1a] via-[#0f1528] to-[#151d35]">
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white group"
          >
            <svg
              className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform"
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
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 flex items-center justify-center text-xl shadow-lg shadow-purple-500/25">
                🤖
              </div>
              {agentStatus && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f1528]"></span>
              )}
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">
                AI Database Agent
              </h1>
              <div className="flex items-center gap-2 text-xs">
                {agentStatus ? (
                  <>
                    <span className="text-emerald-400">●</span>
                    <span className="text-slate-400">
                      {agentStatus.model || "Gemini"} •{" "}
                      {isAdmin ? "Admin" : "User"} Mode
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500">Connecting...</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Role badge */}
          <span
            className={`hidden sm:inline-flex px-3 py-1 rounded-lg text-xs font-medium ${
              isAdmin
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
            }`}
          >
            {isAdmin ? "👑 Admin Access" : "👤 User Access"}
          </span>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all flex items-center gap-2"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="hidden sm:inline">New Chat</span>
            </button>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
        {showWelcome ? (
          /* Welcome Screen */
          <div className="h-full flex flex-col items-center justify-center px-4 py-8">
            <div className="relative mb-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 flex items-center justify-center text-4xl shadow-2xl shadow-purple-500/30">
                🤖
              </div>
              <div className="absolute -inset-2 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-3xl blur-xl opacity-20 animate-pulse"></div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-3 text-center">
              {isAdmin ? "Admin Database Assistant" : "Voter Search Assistant"}
            </h2>
            <p className="text-slate-400 text-center max-w-lg mb-2 text-base">
              {isAdmin
                ? "Full database access. Ask anything about voters, sessions, and statistics."
                : "Search and explore voter data within your assigned permissions."}
            </p>
            <p className="text-slate-500 text-sm mb-10">
              Powered by AI • Natural language queries
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full px-4">
              {promptsToShow.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt.text)}
                  className="group p-5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-purple-500/40 rounded-2xl text-left transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/5 hover:-translate-y-0.5"
                >
                  <span className="text-2xl mb-3 block group-hover:scale-110 transition-transform inline-block">
                    {prompt.icon}
                  </span>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors leading-relaxed block">
                    {prompt.text}
                  </span>
                </button>
              ))}
            </div>

            {!isAdmin && (
              <p className="mt-10 text-xs text-slate-500 text-center max-w-md">
                💡 Your searches are limited to your assigned regions and
                permissions. Contact an admin for extended access.
              </p>
            )}
          </div>
        ) : (
          /* Messages */
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} isAdmin={isAdmin} />
            ))}

            {loading && (
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-lg flex-shrink-0 shadow-lg shadow-purple-500/20">
                  🤖
                </div>
                <div className="flex items-center gap-2 pt-3">
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
                  <span className="text-xs text-slate-500 ml-2">
                    Thinking...
                  </span>
                </div>
              </div>
            )}

            {pendingConfirmation && !loading && (
              <div className="flex justify-center gap-3 py-4">
                <button
                  onClick={() => sendMessage("yes")}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all text-sm font-medium shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5"
                >
                  ✓ Confirm
                </button>
                <button
                  onClick={() => sendMessage("no")}
                  className="px-6 py-2.5 bg-white/5 text-slate-200 rounded-xl hover:bg-white/10 transition-all text-sm font-medium border border-white/10 hover:border-white/20"
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
      <div className="flex-shrink-0 border-t border-white/5 bg-black/30 backdrop-blur-xl p-4 md:p-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
          <div className="relative group">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                pendingConfirmation
                  ? "Type yes to confirm or no to cancel..."
                  : isAdmin
                  ? "Ask anything about the voter database..."
                  : "Search for voters or ask a question..."
              }
              disabled={loading}
              className="w-full px-5 py-4 pr-14 bg-white/[0.05] border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:outline-none focus:bg-white/[0.07] disabled:opacity-50 transition-all text-sm"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-xl transition-all flex items-center justify-center shadow-lg shadow-purple-500/20 disabled:shadow-none"
            >
              <svg
                className={`w-5 h-5 ${loading ? "animate-pulse" : ""}`}
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
          </div>
          <p className="text-center text-xs text-slate-600 mt-3">
            AI can make mistakes. Verify important information.
          </p>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message, isAdmin }) {
  const { role, content, data, queryInfo, executionTime, rowCount, type } =
    message;
  const isUser = role === "user";
  const isError = type === "error";

  return (
    <div className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-lg ${
          isUser
            ? "bg-gradient-to-br from-slate-600 to-slate-700"
            : isError
            ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20"
            : "bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/20"
        }`}
      >
        {isUser ? "👤" : isError ? "⚠️" : "🤖"}
      </div>

      <div className={`flex-1 min-w-0 ${isUser ? "flex justify-end" : ""}`}>
        <div
          className={`inline-block max-w-full ${
            isUser
              ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white px-5 py-3 rounded-2xl rounded-tr-md shadow-lg shadow-purple-500/10"
              : isError
              ? "bg-red-500/10 border border-red-500/20 px-5 py-3 rounded-2xl"
              : ""
          }`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed">{content}</p>
          ) : (
            <div className="space-y-4">
              <div
                className={`prose prose-sm prose-invert max-w-none ${
                  isError ? "text-red-300" : ""
                }`}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p
                        className={`text-sm leading-relaxed mb-2 last:mb-0 ${
                          isError ? "text-red-300" : "text-slate-200"
                        }`}
                      >
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
                      <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm my-2">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-1 text-slate-300 text-sm my-2">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-slate-300">{children}</li>
                    ),
                    code: ({ inline, children }) =>
                      inline ? (
                        <code className="px-1.5 py-0.5 bg-white/10 rounded text-purple-300 text-xs font-mono">
                          {children}
                        </code>
                      ) : (
                        <pre className="p-4 bg-black/30 rounded-xl overflow-x-auto my-3 border border-white/5">
                          <code className="text-xs text-slate-200 font-mono">
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
                <div className="flex gap-4 text-xs text-slate-500 pt-1">
                  {rowCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <span>📊</span> {rowCount.toLocaleString()} rows
                    </span>
                  )}
                  {executionTime && (
                    <span className="flex items-center gap-1">
                      <span>⚡</span> {executionTime}ms
                    </span>
                  )}
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
    <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-white/5">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left font-medium text-slate-300 whitespace-nowrap uppercase tracking-wider text-[10px]"
                >
                  {col.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayData.map((row, idx) => (
              <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
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
      {data.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-xs text-purple-400 hover:text-purple-300 bg-white/[0.02] hover:bg-white/[0.05] transition-all font-medium"
        >
          {expanded ? "↑ Show less" : `↓ Show all ${data.length} rows`}
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

// Override layout for this page - full screen experience
AgentPage.getLayout = (page) => page;
