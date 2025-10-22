import * as github from "@actions/github";
import * as core from "@actions/core";
import { Config } from "./shared";
import { Result } from "./types";
import { executeOnRelease } from "./post-release";
import { createReleasePR } from "./release";

export async function run() {
  console.log("gitflow-action: running with config", Config);
  const isPullRequest =
    github.context.eventName === "pull_request" || github.context.eventName === "pull_request_target";
  const prIsClosed = isPullRequest && github.context.payload.action === "closed";

  let res;

  if (prIsClosed) {
    console.log("gitflow-action: is PR event and PR is closed. Running executeOnRelease");
    res = await executeOnRelease();
  } else if (github.context.eventName === "workflow_dispatch") {
    console.log("gitflow-action: is workflow_dispatch.  Running createReleasePR");
    res = await createReleasePR();
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
