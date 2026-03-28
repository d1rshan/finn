import {
  refreshUserAnalyticsState,
  runBehaviorPatternRefresh,
  runDailyMorningBriefing,
  runHourlyInsightSweep,
  runInsightStalenessCleanup,
  runMonthlyWrapped,
  runWeeklyReportGenerator,
} from "../lib/jobs";

type CronCommand =
  | "hourly"
  | "briefing"
  | "weekly"
  | "monthly"
  | "cleanup"
  | "behavior"
  | "refresh-user";

const commands = new Set<CronCommand>([
  "hourly",
  "briefing",
  "weekly",
  "monthly",
  "cleanup",
  "behavior",
  "refresh-user",
]);

function printUsage() {
  console.error(
    [
      "Usage:",
      "  pnpm --filter server run cron:run hourly",
      "  pnpm --filter server run cron:run briefing",
      "  pnpm --filter server run cron:run weekly",
      "  pnpm --filter server run cron:run monthly",
      "  pnpm --filter server run cron:run cleanup",
      "  pnpm --filter server run cron:run behavior",
      "  pnpm --filter server run cron:run refresh-user <userId>",
    ].join("\n"),
  );
}

async function main() {
  const [commandArg, maybeUserId] = process.argv.slice(2);
  const command = commandArg as CronCommand | undefined;

  if (!command || !commands.has(command)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  switch (command) {
    case "hourly":
      await runHourlyInsightSweep();
      break;
    case "briefing":
      await runDailyMorningBriefing();
      break;
    case "weekly":
      await runWeeklyReportGenerator();
      break;
    case "monthly":
      await runMonthlyWrapped();
      break;
    case "cleanup":
      await runInsightStalenessCleanup();
      break;
    case "behavior":
      await runBehaviorPatternRefresh();
      break;
    case "refresh-user":
      if (!maybeUserId) {
        printUsage();
        process.exitCode = 1;
        return;
      }
      await refreshUserAnalyticsState(maybeUserId);
      break;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
