// ─── TEST MODE ────────────────────────────────────────────────────────────
// This version uses mock data so you can test email sending without an API key.
// Once email is working, swap back to the real agent.js
 
// ─── Step 1: Mock events (no API call) ────────────────────────────────────
async function scrapeEvents() {
  console.log("🔍 Using mock events for test run...");
 
  const events = [
    {
      name: "Montclair Jazz Festival",
      date: "Saturday, May 10",
      time: "2:00 PM",
      venue: "Nishuane Park, Montclair NJ",
      category: "Live Music",
      description: "Annual outdoor jazz festival featuring local and regional artists.",
      url: "https://montclairjazz.com",
      isFree: true,
      isKidFriendly: true,
    },
    {
      name: "Montclair Farmers Market",
      date: "Saturday, May 10",
      time: "8:00 AM – 1:00 PM",
      venue: "Lackawanna Plaza, Montclair NJ",
      category: "Markets & Fairs",
      description: "Fresh local produce, artisan goods, baked goods, and live acoustic music.",
      url: "https://montclairfarmersmarket.org",
      isFree: true,
      isKidFriendly: true,
    },
    {
      name: "Kids Coding Workshop",
      date: "Sunday, May 11",
      time: "10:00 AM",
      venue: "Montclair Public Library",
      category: "Family & Kids",
      description: "Free introductory coding class for ages 6–12. No experience needed!",
      url: "https://montclairlibrary.org",
      isFree: true,
      isKidFriendly: true,
    },
    {
      name: "Spring Art Walk",
      date: "Saturday, May 10",
      time: "12:00 PM – 5:00 PM",
      venue: "Downtown Montclair",
      category: "Arts & Culture",
      description: "Self-guided tour of local galleries and pop-up art installations.",
      url: null,
      isFree: true,
      isKidFriendly: true,
    },
    {
      name: "Watchung Reservation Nature Hike",
      date: "Sunday, May 11",
      time: "9:00 AM",
      venue: "Watchung Reservation, Mountainside NJ",
      category: "Outdoor & Nature",
      description: "Guided family-friendly hike exploring local flora and wildlife.",
      url: "https://ucnj.org/parks",
      isFree: true,
      isKidFriendly: true,
    },
  ];
 
  console.log(`✅ Loaded ${events.length} mock events`);
  return events;
}
 
// ─── Step 2: Mock email compose (no API call) ─────────────────────────────
async function composeEmail(events) {
  console.log("✍️  Composing mock email digest...");
 
  const lines = [
    "Subject: 🗓️ Your Montclair Weekly Events Digest — May 10–11",
    "",
    "Hey neighbor!",
    "",
    "Another great weekend ahead in Montclair. Here's what's happening around town:",
    "",
    "── EDITOR'S PICKS ──────────────────────────────",
    "",
    `⭐ ${events[0].name}`,
    `   ${events[0].date} at ${events[0].time}`,
    `   📍 ${events[0].venue}`,
    `   ${events[0].description}`,
    events[0].url ? `   🔗 ${events[0].url}` : "",
    "",
    `⭐ ${events[1].name}`,
    `   ${events[1].date} at ${events[1].time}`,
    `   📍 ${events[1].venue}`,
    `   ${events[1].description}`,
    "",
    "── ALL EVENTS THIS WEEK ────────────────────────",
    "",
    ...events.slice(2).map(e => [
      `• ${e.name}`,
      `  ${e.date} at ${e.time}`,
      `  📍 ${e.venue}`,
      `  ${e.description}`,
      e.isFree ? "  ✅ Free" : "",
      e.isKidFriendly ? "  👨‍👩‍👧 Kid-friendly" : "",
      e.url ? `  🔗 ${e.url}` : "",
      "",
    ].filter(Boolean).join("\n")),
    "────────────────────────────────────────────────",
    "",
    "See you out there! 🎉",
    "— Your Montclair Events Agent",
  ];
 
  const email = lines.join("\n");
  console.log("✅ Email composed");
  return email;
}
 
// ─── Step 3: Send via Resend ───────────────────────────────────────────────
async function sendEmail(emailText) {
  const subjectMatch = emailText.match(/^Subject:\s*(.+)/m);
  const subject = subjectMatch
    ? subjectMatch[1].trim()
    : "🗓️ Your Montclair Weekly Events Digest";
 
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
    const emailText = await composeEmail(events);
    await sendEmail(emailText);
    console.log("\n🎉 Test run complete!");
  } catch (err) {
    console.error("❌ Agent failed:", err.message);
    process.exit(1);
  }
}
 
main();
