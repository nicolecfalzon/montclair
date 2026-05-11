// Montclair Events Agent — powered by Google Gemini + Gmail

const LOCATION = "Montclair, NJ";
const RADIUS_MILES = 35;
const TIMEFRAME = "the upcoming weekend (Friday, Saturday and Sunday)";
const MAX_EVENTS = 45;
const CATEGORIES = [
  "Live Music", "Family & Kids", "Festivals, Markets & Fairs",
];

// ─── Step 1: Search for events using Gemini + Google Search grounding ─────
async function scrapeEvents() {
  console.log("🔍 Searching for events in", LOCATION, "...");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const prompt = `Today is ${today}. You are a local events scout for ${LOCATION}.

Search for upcoming events happening during ${TIMEFRAME} in and within ${RADIUS_MILES} miles of ${LOCATION}.

Look at sources like Patch.com Montclair, Eventbrite Essex County NJ, Baristanet, NJ.com, Montclair Local, Essex County parks calendar, and local community sites.

Focus on these categories: ${CATEGORIES.join(", ")}.

For each event extract:
- name
- date (e.g. "Saturday, May 10")
- time (e.g. "2:00 PM" or "All day")
- venue (name and/or address)
- category (pick the closest from the list above)
- description (1-2 sentences)
- url (source link if available, otherwise null)
- isFree (true/false if known, otherwise null)
- isKidFriendly (true/false if relevant, otherwise null)

Return ONLY a valid JSON array — no markdown, no explanation, no backticks.
Find up to ${MAX_EVENTS} events. Example:
[{"name":"...","date":"...","time":"...","venue":"...","category":"...","description":"...","url":"...","isFree":true,"isKidFriendly":true}]`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error("Gemini API error: " + JSON.stringify(data));

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in response:\n" + raw);

  const events = JSON.parse(jsonMatch[0]);
  console.log(`✅ Found ${events.length} events`);
  return events;
}

// ─── Step 2: Compose the email digest using Gemini ────────────────────────
async function composeEmail(events) {
  console.log("✍️  Composing email digest...");

  const prompt = `Write a warm, friendly weekly events email digest for someone who lives in ${LOCATION}.

Events this week:
${JSON.stringify(events, null, 2)}

Guidelines:
- Start with "Subject: " on the first line
- Write a short upbeat intro (1-2 sentences)
- Highlight 2-3 "Editor's Picks" at the top (best/most exciting events)
- Then list remaining events grouped by category
- For each event include: name, date/time, venue, brief description, and URL if available
- Note if an event is free or kid-friendly where relevant
- End with a warm sign-off like "See you out there! 🎉"
- IMPORTANT: Use ONLY plain text. Do NOT use markdown — no asterisks, no pound signs, no double asterisks for bold. Use ALL CAPS for section headers and dashes (-) for bullets.
- Keep it scannable and fun, under 600 words`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error("Gemini API error: " + JSON.stringify(data));

  const email = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  console.log("✅ Email composed");
  return email;
}

// ─── Step 3: Send via Gmail (Nodemailer) ──────────────────────────────────
async function sendEmail(emailText) {
  const nodemailer = require("nodemailer");

  const subjectMatch = emailText.match(/^Subject:\s*(.+)/m);
  const subject = subjectMatch
    ? subjectMatch[1].trim()
    : "🗓️ Your Montclair Weekly Events Digest";

  // Strip any stray markdown symbols
  const body = emailText
    .replace(/^Subject:.*\n?/m, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")  // remove **bold**
    .replace(/\*(.*?)\*/g, "$1")       // remove *italic*
    .replace(/^#+\s*/gm, "")           // remove ## headers
    .trim();

  const recipients = [
    process.env.TO_EMAIL,
    "patrickfalzon@gmail.com",
  ].filter(Boolean);

  console.log("📧 Sending email to:", recipients.join(", "));
  console.log("   Subject:", subject);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // 16-char App Password, not your real password
    },
  });

  const info = await transporter.sendMail({
    from: `"Montclair Events Agent" <${process.env.GMAIL_USER}>`,
    to: recipients.join(", "),
    subject,
    text: body,
  });

  console.log("✅ Email sent! Message ID:", info.messageId);
  return info;
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
