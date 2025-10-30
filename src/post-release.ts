import * as github from "@actions/github";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import assert from "assert";
import { Config, getMergeUserOctokit, getNextVersion, octokit } from "./shared";
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
    // Get the latest release and increment patch version
    console.log(`on-release: hotfix: Getting latest release from remote`);
    const { data: latestRelease } = await octokit.rest.repos
      .getLatestRelease(Config.repo)
      .catch(() => ({ data: null }));
    const latest_release_tag_name = latestRelease?.tag_name || "0.0.0";
    version = getNextVersion(latest_release_tag_name, "patch");
    console.log(`on-release: hotfix: Latest release: ${latest_release_tag_name}, New version: ${version}`);
  }

  if (version === "") {
    console.log(`on-release: ${releaseCandidateType}(${version}): No version found`);
    return {
      type: "none",
    };
  }

  console.log(`on-release: ${releaseCandidateType}(${version}): Generating release`);

  let pullRequestBody = pullRequest.body;

  assert(pullRequestBody, `pull request body is not defined`);

  // For hotfixes, update the Full Changelog link to use the actual version instead of branch name
  if (releaseCandidateType === "hotfix") {
    console.log(`on-release: hotfix: Updating PR body changelog link to use version ${version}`);
    // Replace the hotfix branch name in the Full Changelog link with the actual version
    const changelogRegex = new RegExp(
      `(\\*\\*Full Changelog\\*\\*: https:\\/\\/github\\.com\\/${Config.repo.owner}\\/${Config.repo.repo}\\/compare\\/[0-9]+\\.[0-9]+\\.[0-9]+\\.\\.\\.)${currentBranch.substring(Config.hotfixBranchPrefix.length)}`,
      "g"
    );
    pullRequestBody = pullRequestBody.replace(changelogRegex, `$1${version}`);
  }

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
