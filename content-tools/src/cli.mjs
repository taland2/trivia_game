// Content pipeline CLI skeleton (doc 03; built out in Phase 10, parallel track).
// Planned subcommands: generate · import-opentdb · review · publish · lint · daily-queue.

const [command] = process.argv.slice(2);

const commands = {
  generate: "AI question generation per category×difficulty×language (doc 03 §2)",
  "import-opentdb": "OpenTDB importer with re-review queue (doc 03 §3)",
  review: "Approve/edit/reject CLI, throughput-optimized (doc 03 §4)",
  publish: "Draft→live publisher (doc 03 §6)",
  lint: "Bank linter: dupes, lengths, concept_id pairs (doc 12 §6)",
  "daily-queue": "Daily-set curation queue (doc 03 §6)",
};

if (command && command in commands) {
  console.error(`'${command}' is not implemented yet (Phase 10): ${commands[command]}`);
  process.exit(1);
}

console.log("trivia-content — content pipeline CLI (skeleton, Phase 10)\n");
console.log("Planned commands:");
for (const [name, desc] of Object.entries(commands)) {
  console.log(`  ${name.padEnd(16)} ${desc}`);
}
