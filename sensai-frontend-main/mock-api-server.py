#!/usr/bin/env python3
"""
Simple mock API server for testing chat history feature
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse
from datetime import datetime
import uuid

# In-memory storage for conversations
conversations_store = {}

class MockAPIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/voice/history/'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.end_headers()
            
            # Extract user_id from path
            user_id = self.path.split('/')[-1]
            
            # Get conversations for this user, or return empty if none
            user_conversations = conversations_store.get(user_id, [])
            
            # Group conversations by session (day)
            grouped_conversations = {}
            for conv in user_conversations:
                session_date = conv['session_date']
                if session_date not in grouped_conversations:
                    grouped_conversations[session_date] = {
                        "session_uuid": conv['session_uuid'],
                        "session_date": session_date,
                        "conversations": []
                    }
                grouped_conversations[session_date]["conversations"].append(conv)
            
            response_data = {
                "user_id": user_id,
                "conversations": list(grouped_conversations.values()),
                "total_sessions": len(grouped_conversations),
                "total_interactions": len(user_conversations)
            }
            
            print(f"📋 Returning {len(user_conversations)} conversations for user {user_id}")
            self.wfile.write(json.dumps(response_data).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        if self.path == '/voice/log-interaction':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.end_headers()
            
            # Read the request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode())
                print(f"📝 Received conversation log: {data}")
                
                # Store the conversation
                user_id = data.get('session_uuid', 'anonymous')
                
                # Create conversation record
                timestamp = datetime.now().isoformat() + 'Z'
                session_date = datetime.now().strftime("%B %d, %Y at %-I:%M %p")
                
                conversation = {
                    "id": str(uuid.uuid4()),
                    "session_uuid": user_id,
                    "user_transcript": data.get('user_message', ''),
                    "agent_response": data.get('ai_response', ''),
                    "intent": data.get('intent', 'unknown'),
                    "timestamp": timestamp,
                    "session_date": session_date
                }
                
                # Add to store
                if user_id not in conversations_store:
                    conversations_store[user_id] = []
                conversations_store[user_id].append(conversation)
                
                print(f"✅ Stored conversation for user {user_id}. Total: {len(conversations_store[user_id])}")
                
                response = {"status": "success", "message": "Interaction logged successfully"}
                self.wfile.write(json.dumps(response).encode())
                
            except json.JSONDecodeError as e:
                print(f"❌ JSON decode error: {e}")
                response = {"status": "error", "message": f"Invalid JSON: {e}"}
                self.wfile.write(json.dumps(response).encode())
                
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def log_message(self, format, *args):
        # Override to add more detailed logging
        print(f"🌐 {self.address_string()} - {format % args}")

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8002), MockAPIHandler)
    print("🚀 Mock API server running on http://localhost:8002")
    print("📋 Available endpoints:")
    print("  GET /voice/history/{user_id} - Get conversation history")
    print("  POST /voice/log-interaction - Log a conversation")
    server.serve_forever()
