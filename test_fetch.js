async function run() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000); // 180s timeout
  console.log("Fetching AI generation (this may take 1-2 minutes)...");
  try {
    const res = await fetch(
      "https://bifrost.sotatek.works/anthropic/v1/messages",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": "sk-bf-ea5b34bf-2610-4cc3-9258-34e6e22f5467",
          "anthropic-version": "2023-06-01",
          "X-Git-Remote": Buffer.from(
            "git@github.com:sota-labs/notex-interface.git",
          ).toString("base64"),
        },
        body: JSON.stringify({
          model: "fridayaix/claude-sonnet-4-6",
          max_tokens: 4000,
          messages: [
            { role: "user", content: "Hello, what is the model you are?" },
          ],
        }),
      },
    );
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch (e) {
    console.error("Error:", e);
  } finally {
    clearTimeout(timer);
  }
}
run();
