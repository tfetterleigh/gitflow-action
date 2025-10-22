import * as github from "@actions/github";

export async function run() {
  const isPullRequest =
    github.context.eventName === "pull_request" || github.context.eventName === "pull_request_target";
  const prIsClosed = isPullRequest && github.context.payload.action === "closed";

  if (prIsClosed) {
    console.log("gitflow-action: is PR event and PR is closed");
  } else if (github.context.eventName === "workflow_dispatch") {
    console.log("gitflow-action: is workflow_dispatch");
  } else {
    console.log("gitflow-action: no conditions matched");
  }
}

/* istanbul ignore next */
if (!process.env.JEST_WORKER_ID) {
  run();
}
