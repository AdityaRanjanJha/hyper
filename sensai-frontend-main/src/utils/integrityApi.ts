// src/utils/integrityApi.ts

const BASE_URL = process.env.NEXT_PUBLIC_INTEGRITY_API_URL || "http://localhost:8000/integrity";

export async function submitAnswer(data: {
  user_id: string;
  session_id: string;
  answer: string;
  previous_answers: string[];
}) {
  const res = await fetch(`${BASE_URL}/submit-answer/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to submit answer");
  return res.json();
}

export async function submitProctoring(data: {
  user_id: string;
  session_id: string;
  frame?: string;
  audio_chunk?: string;
}) {
  const res = await fetch(`${BASE_URL}/submit-proctoring/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to submit proctoring data");
  return res.json();
}

export async function getTimeline(session_id: string) {
  const res = await fetch(`${BASE_URL}/timeline/${session_id}`);
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export async function followUp(data: {
  event_id: number;
  outcome: string;
  reviewer_id: string;
}) {
  const res = await fetch(`${BASE_URL}/follow-up/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to record follow-up");
  return res.json();
}
