import { runDueAutomations } from "../src/lib/service";

const intervalMs = 10_000;

console.log("Local Five Minute Bitcoin worker started.");

async function tick() {
  try {
    const results = await runDueAutomations();
    if (results.length) console.log(`Processed ${results.length} due automation(s).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}

async function main() {
  await tick();
  setInterval(tick, intervalMs);
}

void main();
