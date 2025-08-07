// src/app/integrity-timeline/page.tsx

"use client";

import { useState } from "react";
import { getTimeline, followUp } from "@/utils/integrityApi";

type Event = {
  id: number;
  user_id: string;
  session_id: string;
  event_type: string;
  evidence: string;
  confidence: number;
  timestamp: string;
};

export default function IntegrityTimelinePage() {
  const [sessionId, setSessionId] = useState("");
  const [timeline, setTimeline] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const data = await getTimeline(sessionId);
      setTimeline(data.timeline);
    } catch (e) {
      alert("Failed to fetch timeline");
    }
    setLoading(false);
  };

  const handleFollowUp = async () => {
    if (!selectedEvent) return;
    try {
      await followUp({
        event_id: selectedEvent,
        outcome,
        reviewer_id: "reviewer1", // Replace with actual reviewer ID
      });
      alert("Outcome recorded!");
      setOutcome("");
      setSelectedEvent(null);
      fetchTimeline();
    } catch (e) {
      alert("Failed to record outcome");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Integrity Timeline</h1>
      <div className="mb-4 flex gap-2">
        <input
          className="border px-2 py-1"
          placeholder="Session ID"
          value={sessionId}
          onChange={e => setSessionId(e.target.value)}
        />
        <button
          className="bg-blue-500 text-white px-4 py-1 rounded"
          onClick={fetchTimeline}
          disabled={loading}
        >
          {loading ? "Loading..." : "Fetch Timeline"}
        </button>
      </div>
      <ul>
        {timeline.map(event => (
          <li key={event.id} className="border-b py-2">
            <div>
              <b>Type:</b> {event.event_type} | <b>Confidence:</b> {event.confidence}
            </div>
            <div>
              <b>Evidence:</b> {event.evidence}
            </div>
            <div>
              <b>Timestamp:</b> {new Date(event.timestamp).toLocaleString()}
            </div>
            <button
              className="mt-2 text-sm text-blue-600 underline"
              onClick={() => setSelectedEvent(event.id)}
            >
              Record Follow-up
            </button>
            {selectedEvent === event.id && (
              <div className="mt-2">
                <textarea
                  className="border w-full p-1"
                  placeholder="Enter outcome"
                  value={outcome}
                  onChange={e => setOutcome(e.target.value)}
                />
                <button
                  className="bg-green-500 text-white px-2 py-1 rounded mt-1"
                  onClick={handleFollowUp}
                >
                  Submit Outcome
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
