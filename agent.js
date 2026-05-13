// Montclair Events Agent — powered by Google Gemini + Gmail

const LOCATION = "Montclair, NJ";
const RADIUS_MILES = 25;
const TIMEFRAME = "the upcoming Friday, Saturday, and Sunday";
const MAX_EVENTS = 55;
const CATEGORIES = [
  "Music & Nightlife",
  "Family & Kids",
  "Food, Drinks & Markets",
  "Arts, Culture & Community",
  "Outdoor & Nature",
];

// ─── Step 1: Search for events using Gemini + Google Search grounding ─────
async function scrapeEvents() {
  console.log("🔍 Searching for events in", LOCATION, "...");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const prompt = `Today is ${today}. You are a local events scout for ${LOCATION}.

Search for upcoming events happening ${TIMEFRAME} in and within ${RADIUS_MILES} miles of ${LOCATION}.

Look at sources like Patch.com Montclair, Eventbrite Essex County NJ, Baristanet, NJ.com, Montclair Local, Essex County parks calendar, and local community sites.

Focus on these categories: ${CATEGORIES.join(", ")}.

For each event extract:
- name
- date (e.g. "Friday, May 9" or "Saturday, May 10")
- time (e.g. "2:00 PM" or "All day")
- venue (name and/or address)
- category (pick the closest from: ${CATEGORIES.join(", ")})
- description (1-2 sentences)
- url (source link if available, otherwise null)
- isFree (true/false if known, otherwise null)
- isKidFriendly (true/false if relevant, otherwise null)

IMPORTANT: Do not include duplicate events. Each real-world event should appear only once.
Return ONLY a valid JSON array — no markdown, no explanation, no backticks.
Find up to ${MAX_EVENTS} unique events. Example:
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

// ─── Step 1b: Deduplicate events ──────────────────────────────────────────
function deduplicateEvents(events) {
  const seen = new Set();
  const unique = [];

  for (const event of events) {
    // Normalize name: lowercase, strip punctuation, collapse spaces
    const normalizedName = event.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Secondary key: venue + date (catches same event listed under slightly different names)
    const venueKey = (event.venue || "").toLowerCase().replace(/\s+/g, "").slice(0, 20);
    const dateKey = (event.date || "").toLowerCase().replace(/\s+/g, "");
    const nameDateKey = `${normalizedName}|${dateKey}`;
    const venueDateKey = `${venueKey}|${dateKey}`;

    if (!seen.has(nameDateKey) && !seen.has(venueDateKey)) {
      seen.add(nameDateKey);
      seen.add(venueDateKey);
      unique.push(event);
    }
  }

  const removed = events.length - unique.length;
  if (removed > 0) {
    console.log(`🧹 Removed ${removed} duplicate(s) — ${unique.length} unique events remaining`);
  } else {
    console.log(`✅ No duplicates found — ${unique.length} events`);
  }
  return unique;
}

// ─── Step 2: Compose the email as HTML for proper bold/bullet formatting ──
async function composeEmail(events) {
  console.log("✍️  Composing email digest...");

  const prompt = `Write a warm, friendly weekend events email digest for people who live in ${LOCATION}.

Events this weekend:
${JSON.stringify(events, null, 2)}

FORMAT RULES — follow these exactly:
- First line must be: Subject: [your subject line here]
- After the subject line, write the entire email body as clean HTML
- Start the body with: <p>Hey Falzons! 👋</p>
- Write a short 2-sentence upbeat intro in a <p> tag
- Then a section: <h2>⭐ Editor's Picks</h2> with the 3 most exciting events as <ul><li> bullet points
- Then group ALL remaining events by category using <h2>Category Name</h2> and <ul><li> bullet points
- Use fewer, broader categories — aim for 4-5 groups max with multiple events each
- For each event in a list item include: event name in <strong> tags, then date/time, venue, one sentence description, and URL as a clickable link if available
- Note Free 🆓 or Kid-friendly 👨‍👩‍👧 where relevant
- Each event should appear ONCE only — do not repeat any event
- End with: <p>See you out there! 🎉</p>
- Do NOT use markdown. Only output the Subject line and then clean HTML.`;

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
    : "🗓️ Your Montclair Weekend Events Digest";

  const htmlBody = emailText.replace(/^Subject:.*\n?/m, "").trim();

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
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: `"Montclair Events Agent" <${process.env.GMAIL_USER}>`,
    to: recipients.join(", "),
    subject,
    html: htmlBody,
  });

  console.log("✅ Email sent! Message ID:", info.messageId);
  return info;
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  try {
    const rawEvents = await scrapeEvents();
    const events = deduplicateEvents(rawEvents);

    if (events.length === 0) {
      console.log("⚠️  No events found this weekend — skipping email.");
      return;
    }

    const emailText = await composeEmail(events);
    await sendEmail(emailText);
    console.log("\n🎉 Weekend digest complete!");
  } catch (err) {
    console.error("❌ Agent failed:", err.message);
    process.exit(1);
  }
}

main();
