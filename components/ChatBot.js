import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { userAPI } from "../lib/api";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export default function ChatBot() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I'm your Voter List Assistant. I can help you search for voters, get statistics, or answer questions about the system. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions] = useState([
    "Search for voters named Kumar",
    "How many voters are there?",
    "Show me voters from Assembly 1",
    "Find voter with ID ABC123",
  ]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const parseVoterSearchIntent = (text) => {
    const lowerText = text.toLowerCase();
    const searchParams = {};

    // Check for name search
    const nameMatch = text.match(
      /(?:named?|name is|search for|find)\s+([A-Za-z\s]+?)(?:\s+(?:in|from|with)|$)/i
    );
    if (nameMatch) {
      searchParams.name = nameMatch[1].trim();
    }

    // Check for voter ID
    const voterIdMatch = text.match(
      /(?:voter\s*id|id)\s*(?:is|:)?\s*([A-Za-z0-9]+)/i
    );
    if (voterIdMatch) {
      searchParams.voterId = voterIdMatch[1].trim();
    }

    // Check for assembly
    const assemblyMatch = text.match(
      /(?:assembly|assemblies?)\s*(?:\d+|named?)?\s*([A-Za-z0-9\s]+?)(?:\s+(?:part|section|with)|$)/i
    );
    if (assemblyMatch) {
      searchParams.assembly = assemblyMatch[1].trim();
    }

    // Check for part number
    const partMatch = text.match(/(?:part\s*(?:number|#|no)?)\s*(\d+)/i);
    if (partMatch) {
      searchParams.partNumber = partMatch[1];
    }

    // Check for section
    const sectionMatch = text.match(
      /(?:section)\s*([A-Za-z0-9\s]+?)(?:\s+|$)/i
    );
    if (sectionMatch) {
      searchParams.section = sectionMatch[1].trim();
    }

    return Object.keys(searchParams).length > 0 ? searchParams : null;
  };

  const executeVoterSearch = async (params) => {
    try {
      const result = await userAPI.searchVoters({ ...params, limit: 10 });
      const voters = result.voters || [];

      if (voters.length === 0) {
        return `I couldn't find any voters matching your criteria. Try different search terms.`;
      }

      let response = `Found ${
        result.pagination?.total || voters.length
      } voter(s). Here are the results:\n\n`;

      voters.slice(0, 5).forEach((v, i) => {
        response += `**${i + 1}. ${v.name || "N/A"}**\n`;
        response += `   • Voter ID: ${v.voter_id || "N/A"}\n`;
        response += `   • Age: ${v.age || "N/A"} | Gender: ${
          v.gender || "N/A"
        }\n`;
        response += `   • Assembly: ${v.assembly || "N/A"}\n\n`;
      });

      if (voters.length > 5) {
        response += `\n...and ${
          voters.length - 5
        } more. Use the Search page for full results.`;
      }

      return response;
    } catch (err) {
      return `Sorry, I encountered an error while searching: ${err.message}`;
    }
  };

  const callGeminiAPI = async (userMessage, conversationHistory) => {
    // Fetch real stats to give AI context
    let statsContext = "";
    try {
      const sessions = (await userAPI.getSessions?.()) || [];
      const sessionList = Array.isArray(sessions)
        ? sessions
        : sessions?.sessions || [];
      const totalVoters = sessionList.reduce(
        (acc, s) => acc + (parseInt(s.voter_count, 10) || 0),
        0
      );
      statsContext = `\n\nCurrent System Stats:
- Total Sessions: ${sessionList.length}
- Total Voters in System: ${totalVoters}
- Recent uploads: ${
        sessionList
          .slice(0, 3)
          .map((s) => s.filename || s.name)
          .join(", ") || "None"
      }`;
    } catch (e) {
      // Stats unavailable, continue without them
    }

    const systemPrompt = `You are an intelligent, friendly AI assistant for the Voter List Console application - a powerful OCR-based voter management system. You're knowledgeable, helpful, and can assist with anything related to the app.

## Your Capabilities:
1. **Voter Search Help** - Guide users to search for voters by name, ID, assembly, part number, section
2. **Application Navigation** - Explain features and how to use them
3. **Statistics & Insights** - Provide information about voter data
4. **Technical Support** - Help with any issues users face
5. **General Assistance** - Answer questions conversationally

## Application Features:
### For Regular Users:
- **Search Voters**: Find voters by name, voter ID, assembly, part number, section
- **View Voter Details**: See complete voter information including photo
- **Print Voter Slips**: Generate printable voter identification slips
- **Profile Management**: Update personal information

### For Administrators:
- **Upload PDFs**: OCR processing of voter list PDF documents
- **Session Management**: View, manage, and delete upload sessions
- **User Management**: Create, edit, delete users and assign roles
- **Statistics Dashboard**: View comprehensive analytics
- **API Keys**: Monitor API usage and status

## Response Style:
- Be conversational and friendly, use emojis occasionally 😊
- Keep responses concise but informative
- Proactively suggest next steps
- If user wants to search, guide them to use the Search page or extract their intent
- For stats questions, use the real data provided below

Current User: ${user?.name || user?.email || "Guest"} (Role: ${
      user?.role || "not logged in"
    })
${statsContext}

Remember: Be helpful, accurate, and make the user's experience delightful!`;

    const contents = [
      {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
      {
        role: "model",
        parts: [
          {
            text: "Got it! I'm your Voter List Assistant, ready to help with searches, navigation, stats, and any questions. Let's make this easy for you! 🎯",
          },
        ],
      },
      ...conversationHistory.slice(-10).map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ];

    try {
      if (!GEMINI_API_KEY) {
        return "⚠️ Gemini API key not configured. Please add NEXT_PUBLIC_GEMINI_API_KEY to your .env file.";
      }

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE",
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Gemini API error response:", data);
        // Check for specific error messages
        if (data.error?.message) {
          if (data.error.message.includes("API key")) {
            return "API key issue. Please check the configuration.";
          }
          if (data.error.message.includes("quota")) {
            return "API quota exceeded. Please try again later.";
          }
        }
        throw new Error(
          data.error?.message || "Failed to get response from AI"
        );
      }

      return (
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I couldn't generate a response."
      );
    } catch (err) {
      console.error("Gemini API error:", err);
      return (
        "Sorry, I'm having trouble connecting. Error: " +
        (err.message || "Unknown error")
      );
    }
  };

  // Fallback responses when API is unavailable
  const getFallbackResponse = (userMessage) => {
    const lowerMsg = userMessage.toLowerCase();

    // Greetings
    if (/^(hi|hello|hey|greetings)/i.test(lowerMsg)) {
      return "Hello! 👋 I'm your Voter List Assistant. While my AI brain is taking a break, I can still help with basic questions about the app. Try asking about searching voters or navigating the application!";
    }

    // Stats questions
    if (
      lowerMsg.includes("how many") &&
      (lowerMsg.includes("voter") || lowerMsg.includes("total"))
    ) {
      return "📊 To see the total number of voters, check the Admin Dashboard or the Statistics page. You can also search for voters using the Search page!";
    }

    // Search help
    if (lowerMsg.includes("search") || lowerMsg.includes("find")) {
      return "🔍 **To search for voters:**\n\n1. Go to the **Search** page\n2. Use filters like Assembly, Part Number, Name, or Voter ID\n3. Click **Search** to find voters\n4. Click on any voter to see details and print their slip";
    }

    // Print help
    if (lowerMsg.includes("print") || lowerMsg.includes("pdf")) {
      return "🖨️ **To print a voter slip:**\n\n1. Search for the voter\n2. Click on their row to open details\n3. Click **Print as PDF**\n4. In the print dialog, select **Save as PDF**\n5. Choose A5 paper size for best results";
    }

    // Upload help
    if (lowerMsg.includes("upload") || lowerMsg.includes("pdf")) {
      return "📤 **To upload a voter list PDF (Admin only):**\n\n1. Go to **Upload** page\n2. Select your PDF file\n3. Wait for OCR processing\n4. View extracted voters in Sessions";
    }

    // Navigation help
    if (
      lowerMsg.includes("help") ||
      lowerMsg.includes("how to") ||
      lowerMsg.includes("what can")
    ) {
      return "🎯 **I can help you with:**\n\n• **Search Voters** - Find voters by name, ID, assembly\n• **Print Slips** - Generate voter information slips\n• **Upload PDFs** - OCR processing (Admin)\n• **View Statistics** - Demographics & analytics\n\nWhat would you like to do?";
    }

    // Default
    return "I'm having trouble connecting to my AI brain right now 🧠 But I can still help!\n\n**Quick links:**\n• 🔍 Search voters → /search\n• 📊 View stats → /admin/stats\n• 📤 Upload PDF → /upload\n\nOr try asking about specific features!";
  };

  const handleSend = async (text = input) => {
    if (!text.trim() || loading) return;

    const userMessage = text.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      // Check if this is a voter search intent
      const searchParams = parseVoterSearchIntent(userMessage);

      if (searchParams && isAuthenticated) {
        // Execute the search
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "🔍 Searching for voters..." },
        ]);

        const searchResult = await executeVoterSearch(searchParams);
        setMessages((prev) => [
          ...prev.slice(0, -1), // Remove "Searching..." message
          { role: "assistant", content: searchResult },
        ]);
      } else {
        // Try Gemini first, fallback to local responses
        let aiResponse = await callGeminiAPI(userMessage, messages);

        // If API failed with quota or connection error, use fallback
        if (
          aiResponse.includes("quota") ||
          aiResponse.includes("trouble connecting") ||
          aiResponse.includes("API key")
        ) {
          aiResponse = getFallbackResponse(userMessage);
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: aiResponse },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSend(suggestion);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-neon-500 to-neon-600 text-white shadow-lg hover:shadow-neon-500/30 hover:scale-105 transition-all flex items-center justify-center"
        aria-label="Open chat assistant"
      >
        <span className="text-2xl">💬</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl bg-ink-200 border border-ink-400 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-ink-400/50 bg-gradient-to-r from-neon-500/20 to-neon-400/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-neon-500/30 flex items-center justify-center text-xl border border-neon-400/50">
            🤖
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Voter Assistant</h3>
            <p className="text-xs text-slate-400">Powered by Gemini AI</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-100 p-1"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                msg.role === "user"
                  ? "bg-neon-500/30 text-slate-100 border border-neon-400/30"
                  : "bg-ink-100/50 text-slate-200 border border-ink-400/30"
              }`}
            >
              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-ink-100/50 text-slate-200 border border-ink-400/30 rounded-2xl px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 bg-neon-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-neon-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-neon-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></span>
                </div>
                <span className="text-xs text-slate-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-slate-400 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 3).map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full bg-ink-100/50 border border-ink-400/30 text-slate-300 hover:border-neon-400/50 hover:text-slate-100 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-ink-400/50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1 bg-ink-100 border border-ink-400 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-400"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-xl bg-neon-500 text-white font-semibold hover:bg-neon-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
