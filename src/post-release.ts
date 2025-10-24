import * as github from "@actions/github";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import assert from "assert";
import { Config, getMergeUserOctokit, octokit } from "./shared";
import { Result } from "./types";
import { isReleaseCandidate, tryMerge } from "./utils";

async function executeOnRelease(): Promise<Result> {
  if (Config.isDryRun) {
    console.log(`on-release: dry run. Exiting...`);
    return {
      type: "none",
    };
  }

  const pullRequest = github.context.payload
    .pull_request as RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];

  if (!pullRequest) {
    console.log(`on-release: pull request is not defined. Exiting...`);
    return {
      type: "none",
    };
  }

  if (!pullRequest.merged) {
    console.log(`on-release: pull request is not merged. Exiting...`);
    return {
      type: "none",
    };
  }

  /**
   * Precheck
   * Check if the pull request has a release label, targeting main branch, and if it was merged
   */
  const pullRequestNumber = pullRequest.number;
  assert(pullRequestNumber, `github.context.payload.pull_request?.number is not defined`);

  const releaseCandidateType = isReleaseCandidate(pullRequest, true);
  if (!releaseCandidateType)
    return {
      type: "none",
    };

  const currentBranch = pullRequest.head.ref;

  let version = "";

  if (releaseCandidateType === "release") {
    version = currentBranch.substring(Config.releaseBranchPrefix.length);
  } else if (releaseCandidateType === "hotfix") {
    version = currentBranch.substring(Config.hotfixBranchPrefix.length);
  }

  if (version === "") {
    console.log(`on-release: ${releaseCandidateType}(${version}): No version found`);
    return {
      type: "none",
    };
  }

  console.log(`on-release: ${releaseCandidateType}(${version}): Generating release`);

  const pullRequestBody = pullRequest.body;

  assert(pullRequestBody, `pull request body is not defined`);

  const updatedOctokit = getMergeUserOctokit();
  const { data: release } = await updatedOctokit.rest.repos.createRelease({
    ...Config.repo,
    tag_name: version,
    target_commitish: Config.prodBranch,
    name: version,
    body: pullRequestBody,
  });

  /**
   * Merging the release or hotfix branch back to the develop branch if needed
   */
  console.log(`on-release: ${releaseCandidateType}(${version}): Execute merge workflow`);

  await tryMerge(Config.mergeBackFromProd ? Config.prodBranch : currentBranch, Config.developBranch);

  // delete release/hotfix branch after back merging
  await octokit.rest.git.deleteRef({
    ...Config.repo,
    ref: `heads/${currentBranch}`,
  });

  console.log(`on-release: success`);

  // console.log(`post-release: process release ${release.name}`);
  // if (Config.slackOptionsStr) {
  //     let slackOpts: SlackIntegrationOptions;
  //     try {
  //         slackOpts = JSON.parse(Config.slackOptionsStr);
  //     } catch {
  //         throw new Error(
  //             `integration(slack): Could not parse ${Config.slackOptionsStr}`,
  //         );
  //     }
  //     /**
  //      * Slack integration
  //      */
  //     await sendToSlack(slackOpts, release);
  // }
  // console.log(`post-release: success`);

  return {
    type: releaseCandidateType,
    version,
    release_url: release.html_url,
  };
}

export { executeOnRelease };
