import * as github from "@actions/github";
import * as core from "@actions/core";
import { Config } from "./shared";
import { Result } from "./types";
import { executeOnRelease } from "./post-release";
import { createReleasePR } from "./release";
import { createHotfix } from "./hotfix";
import { updateHotfixPR } from "./updateHotfix";

export async function run() {
  console.log("gitflow-action: running with config", Config);
  const isPullRequest =
    github.context.eventName === "pull_request" || github.context.eventName === "pull_request_target";
  const prIsClosed = isPullRequest && github.context.payload.action === "closed";

  const pullRequest = github.context.payload.pull_request;
  const hotfixUpdateActions = ["opened", "reopened", "ready_for_review", "synchronize", "edited"];
  const isHotfixAndOpen =
    isPullRequest &&
    pullRequest?.head?.ref?.startsWith(Config.hotfixBranchPrefix) &&
    pullRequest?.base?.ref === Config.prodBranch &&
    hotfixUpdateActions.includes(github.context.payload.action || "");

  let res;

  if (prIsClosed) {
    console.log("gitflow-action: is PR event and PR is closed. Running executeOnRelease");
    res = await executeOnRelease();
  } else if (isHotfixAndOpen) {
    console.log("gitflow-action: is PR event for hotfix targeting main. Running updateHotfixPR");
    res = await updateHotfixPR();
  } else if (github.context.eventName === "workflow_dispatch" && !Config.isHotfix) {
    console.log("gitflow-action: is workflow_dispatch and not a hotfix.  Running createReleasePR");
    res = await createReleasePR();
  } else if (github.context.eventName === "workflow_dispatch" && Config.isHotfix) {
    console.log("gitflow-action: is workflow_dispatch and is a hotfix.  Running createHotfix");
    res = await createHotfix();
  } else {
    console.log("gitflow-action: no conditions matched");
  }

  if (res) {
    console.log(`gitflow-workflow-action: Setting output: ${JSON.stringify(res)}`);
    for (const key of Object.keys(res)) {
      core.setOutput(key, res[key as keyof Result]);
    }
  }
}

/* istanbul ignore next */
if (!process.env.JEST_WORKER_ID) {
  run()
    .then(() => {
      process.exitCode = 0;
    })
    .catch((err) => {
      core.setFailed(err.message);
      process.exitCode = 1;
    });
}
