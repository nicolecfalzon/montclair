const Anthropic = require("@anthropic-ai/sdk");
 
// ─── Config ────────────────────────────────────────────────────────────────
const LOCATION = "Montclair, NJ";
const RADIUS_MILES = 10;
const TIMEFRAME = "the next 7 days";
const MAX_EVENTS = 15;
const CATEGORIES = [
  "Live Music",
  "Family & Kids",
  "Festivals",
  "Arts & Culture",
  "Community Events",
  "Food & Drink",
  "Outdoor & Nature",
  "Markets & Fairs",
];
 
// ─── Anthropic client ──────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 
// ─── Step 1: Scrape & extract events via web search ───────────────────────
async function scrapeEvents() {
  console.log("🔍 Searching for events in", LOCATION, "...");
 
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
 
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [
      {
        role: "user",
        content: `Today is ${today}. You are a local events scout for ${LOCATION}.
 
Search the web thoroughly and find upcoming events happening during ${TIMEFRAME} in and within ${RADIUS_MILES} miles of ${LOCATION}.
 
Search sources like: Montclair Local, Patch.com Montclair, Eventbrite Essex County NJ, Baristanet, NJ.com events, Essex County parks, and any local Facebook event pages or community calendars.
 
Focus on these categories: ${CATEGORIES.join(", ")}.
 
For each event, extract:
- name
- date (human-readable, e.g. "Saturday, May 10")
- time (e.g. "2:00 PM" or "All day")
- venue (name and/or address)
- category (pick the closest from the list above)
- description (1-2 sentences)
- url (source link if available)
- isFree (true/false if known, otherwise null)
- isKidFriendly (true/false if relevant)
 
Return ONLY a valid JSON array — no markdown, no explanation, no backticks.
Find up to ${MAX_EVENTS} events. Example format:
[{"name":"...","date":"...","time":"...","venue":"...","category":"...","description":"...","url":"...","isFree":true,"isKidFriendly":true}]`,
      },
    ],
  });
 
  // Extract the final text block
  const textBlocks = response.content.filter((b) => b.type === "text");
  const raw = textBlocks.map((b) => b.text).join("");
 
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Could not find JSON array in agent response:\n" + raw);
  }
 
  const events = JSON.parse(jsonMatch[0]);
  console.log(`✅ Found ${events.length} events`);
  return events;
}
 
// ─── Step 2: Compose the email digest ─────────────────────────────────────
async function composeEmail(events) {
  console.log("✍️  Composing email digest...");
 
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Write a warm, friendly weekly events email digest for someone who lives in ${LOCATION}.
 
Events this week:
${JSON.stringify(events, null, 2)}
 
Guidelines:
- Start with "Subject: " on the first line
- Write a short, upbeat intro (2-3 sentences)
- Highlight 2-3 "Editor's Picks" (best/most exciting events) at the top
- Then list remaining events grouped by category
- For each event include: name, date/time, venue, brief description, and URL if available
- Note if an event is free or kid-friendly where relevant
- End with a warm sign-off like "See you out there! 🎉"
- Use plain text with dashes for bullets — no HTML
- Keep it scannable, fun, and under 600 words`,
      },
    ],
  });
 
  const email = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  console.log("✅ Email composed");
  return email;
}
 
// ─── Step 3: Send via Resend ───────────────────────────────────────────────
async function sendEmail(emailText) {
  const subjectMatch = emailText.match(/^Subject:\s*(.+)/m);
  const subject = subjectMatch
    ? subjectMatch[1].trim()
    : "🗓️ Your Montclair Weekly Events Digest";
 
  // Strip the "Subject: ..." line from the body
  const body = emailText.replace(/^Subject:.*\n?/m, "").trim();
 
  console.log("📧 Sending email to", process.env.TO_EMAIL, "...");
  console.log("   Subject:", subject);
 
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL,
      to: process.env.TO_EMAIL,
      subject,
      text: body,
    }),
  });
 
  const data = await res.json();
  if (!res.ok) {
    throw new Error("Resend error: " + JSON.stringify(data));
  }
 
  console.log("✅ Email sent! Resend ID:", data.id);
  return data;
}
 
// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  try {
    const events = await scrapeEvents();
 
    if (events.length === 0) {
      console.log("⚠️  No events found this week — skipping email.");
      return;
    }
 
    const emailText = await composeEmail(events);
    await sendEmail(emailText);
 
    console.log("\n🎉 Weekly digest complete!");
  } catch (err) {
    console.error("❌ Agent failed:", err.message);
    process.exit(1);
  }
}
 
main();
