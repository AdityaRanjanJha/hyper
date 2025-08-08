"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type VoiceConversation = {
  id: string;
  session_uuid: string;
  user_transcript: string;
  agent_response: string;
  intent: string;
  timestamp: string;
  session_id?: string;
};

type GroupedConversation = {
  session_uuid: string;
  session_date: string;
  conversations: VoiceConversation[];
};

export default function ChatHistoryPage() {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<GroupedConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchChatHistory = async () => {
    if (!session?.user?.id) {
      console.log("❌ No user session found");
      return;
    }

    console.log("🔍 Fetching chat history for user:", session.user.id);
    setLoading(true);
    setError(null);
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'}/voice/history/${session.user.id}`;
      console.log("📡 Making request to:", url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
      });
      console.log("📦 Response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("✅ Chat history data received:", data);
        setConversations(data.conversations || []);
      } else {
        console.error("❌ Failed to fetch chat history. Status:", response.status);
        const errorText = await response.text();
        console.error("❌ Error response:", errorText);
        setError(`Failed to fetch chat history: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("❌ Error fetching chat history:", error);
      setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChatHistory();
  }, [session?.user?.id]);

  const filteredConversations = conversations.filter(group =>
    searchTerm === "" || 
    group.conversations.some(conv => 
      conv.user_transcript.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.agent_response.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.intent.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getIntentColor = (intent: string) => {
    const colors: Record<string, string> = {
      'read_page': 'bg-blue-100 text-blue-800',
      'find_element': 'bg-green-100 text-green-800',
      'signup': 'bg-purple-100 text-purple-800',
      'join_course': 'bg-orange-100 text-orange-800',
      'help': 'bg-gray-100 text-gray-800',
      'unknown': 'bg-red-100 text-red-800',
    };
    return colors[intent] || 'bg-gray-100 text-gray-800';
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Voice Chat History
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please sign in to view your conversation history.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Voice Chat History
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View all your conversations with the voice assistant
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 pl-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <svg 
            className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={fetchChatHistory}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Loading...
            </>
          ) : (
            <>
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
        
        <button
          onClick={async () => {
            try {
              console.log("🧪 Creating test conversation...");
              console.log("🔗 API URL:", process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002');
              console.log("👤 User ID:", session?.user?.id || 'test-user');
              
              const requestBody = {
                session_uuid: session?.user?.id || 'test-user',
                user_message: "Test: Can you explain this page?",
                ai_response: "Test: This is a sample response from the voice assistant.",
                intent: "read_page",
                action_taken: "{}"
              };
              
              console.log("📤 Request body:", requestBody);
              
              const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'}/voice/log-interaction`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              });
              
              console.log("📦 Test response status:", response.status);
              console.log("📦 Test response headers:", response.headers);
              
              if (response.ok) {
                const responseData = await response.json();
                console.log("✅ Success response:", responseData);
                alert("✅ Test conversation added! Click Refresh to see it.");
              } else {
                const errorText = await response.text();
                console.error("❌ Error response:", errorText);
                alert(`❌ Failed to add test conversation: ${response.status} - ${errorText}`);
              }
            } catch (error) {
              console.error("❌ Network error:", error);
              alert("❌ Network Error: " + (error as Error).message + ". Make sure backend is running on port 8001.");
            }
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Add Test Data
        </button>
      </div>

      {/* Content */}
      {error ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
            Connection Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <button
            onClick={() => {
              setError(null);
              fetchChatHistory();
            }}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : loading && conversations.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading chat history...</p>
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchTerm ? "No matching conversations" : "No conversations yet"}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm 
              ? "Try adjusting your search terms or clear the search to see all conversations."
              : "Start using the voice assistant to see your conversation history here."
            }
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-purple-600 hover:text-purple-700 font-medium"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Conversation Sessions */}
          {filteredConversations.map((group) => (
            <div
              key={group.session_uuid}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Session Header */}
              <div 
                className="px-6 py-4 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setSelectedSession(selectedSession === group.session_uuid ? null : group.session_uuid)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white dark:text-neutral-500">
                      Session: {group.session_date}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {group.conversations.length} interaction{group.conversations.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {group.session_uuid.substring(0, 8)}...
                    </span>
                    <svg 
                      className={`h-5 w-5 text-gray-400 transition-transform ${selectedSession === group.session_uuid ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Session Conversations */}
              {selectedSession === group.session_uuid && (
                <div className="p-6">
                  <div className="space-y-4">
                    {group.conversations.map((conversation, index) => (
                      <div key={`${conversation.session_uuid}-${index}`} className="border-l-4 border-purple-200 dark:border-purple-800 pl-4">
                        {/* User Message */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">You</span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getIntentColor(conversation.intent)}`}>
                                {conversation.intent}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTimestamp(conversation.timestamp)}
                            </span>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p className="text-gray-900 dark:text-white">
                              {conversation.user_transcript}
                            </p>
                          </div>
                        </div>

                        {/* Agent Response */}
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Voice Assistant</span>
                          </div>
                          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                            <p className="text-gray-900 dark:text-white">
                              {conversation.agent_response}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
