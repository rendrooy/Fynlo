// Sends bank emails from Gmail to Fynlo. Setup steps are in gmail-ingest.md.
// Fynlo ignores a message it has already seen, so sending one twice is safe.

const SEARCH = "from:(noreply@jago.com OR wondr@bni.co.id) newer_than:2d";
const SENT_FOR_SECONDS = 6 * 60 * 60;

function sendBankEmails() {
  const properties = PropertiesService.getScriptProperties();
  const apiUrl = properties.getProperty("FYNLO_API_URL");
  const token = properties.getProperty("FYNLO_TOKEN");
  if (!apiUrl || !token) {
    throw new Error("Set FYNLO_API_URL and FYNLO_TOKEN in Script Properties");
  }
  const sent = CacheService.getScriptCache();

  GmailApp.search(SEARCH, 0, 50).forEach((thread) => {
    thread.getMessages().forEach((message) => {
      const id = message.getId();
      if (sent.get(id)) return;
      const response = UrlFetchApp.fetch(`${apiUrl}/ingest`, {
        contentType: "application/json",
        headers: { Authorization: `Bearer ${token}` },
        method: "post",
        muteHttpExceptions: true,
        payload: JSON.stringify({
          body: message.getBody(),
          externalId: id,
          receivedAt: message.getDate().toISOString(),
          sender: message.getFrom(),
          source: "email",
          subject: message.getSubject(),
        }),
      });
      // Anything else is tried again on the next run.
      if (response.getResponseCode() === 200) {
        sent.put(id, "1", SENT_FOR_SECONDS);
      } else {
        console.warn(`Fynlo answered ${response.getResponseCode()}`);
      }
    });
  });
}
