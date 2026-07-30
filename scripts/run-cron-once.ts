import { runDueAutomations } from "../src/lib/service";

async function main() {
  const results = await runDueAutomations();
  console.log(`Processed ${results.length} due automation(s).`);
}

void main();
