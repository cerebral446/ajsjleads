const base = process.env.DISCOVERY_APP_URL || "http://localhost:3000";
if (!process.env.CRON_SECRET) throw new Error("Set CRON_SECRET in the application's environment file.");

const response = await fetch(new URL("/api/discovery/cron", base), {
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  redirect: "error",
  signal: AbortSignal.timeout(315000),
});
console.log(new Date().toISOString(), response.status, await response.text());
if (!response.ok) process.exitCode = 1;
