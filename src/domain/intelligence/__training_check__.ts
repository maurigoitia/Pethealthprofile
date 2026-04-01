/**
 * CI training set check — exits with code 1 if any case fails.
 * Run with: npx tsx src/domain/intelligence/__training_check__.ts
 */
import { runPessyIntelligenceTrainingSet } from "./pessyIntelligenceTrainingSet";

const result = runPessyIntelligenceTrainingSet();

console.log(`Training Set: ${result.passed}/${result.total} (${result.scorePct}%)`);

for (const c of result.cases) {
  const icon = c.passed ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${c.label}`);
  if (!c.passed) {
    if (c.missingCodes.length > 0) console.log(`    Missing: ${c.missingCodes.join(", ")}`);
    if (c.expectedSegmentId !== c.producedSegmentId) {
      console.log(`    Segment: expected=${c.expectedSegmentId}, got=${c.producedSegmentId}`);
    }
  }
}

if (result.failed > 0) {
  console.error(`\nFAILED: ${result.failed} case(s) did not pass.`);
  process.exit(1);
}

console.log("\nAll cases passed.");
