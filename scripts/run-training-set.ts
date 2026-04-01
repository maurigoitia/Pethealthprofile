/**
 * CI gate: Intelligence training set.
 * If ANY case fails, exit 1 → blocks deploy.
 *
 * Run: npx tsx scripts/run-training-set.ts
 */
import { runPessyIntelligenceTrainingSet } from "../src/domain/intelligence/pessyIntelligenceTrainingSet";

const result = runPessyIntelligenceTrainingSet();

console.log(`\nTraining Set: ${result.passed}/${result.total} (${result.scorePct}%)\n`);

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
  console.error(`\nBLOCKED: ${result.failed} case(s) failed. Deploy will not proceed.`);
  process.exit(1);
}

console.log("\nAll cases passed. Deploy gate open.");
