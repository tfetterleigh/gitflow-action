import { Config, octokit } from "./shared";
import { Result } from "./types";
import * as github from "@actions/github";

export async function updateHotfixPR(): Promise<Result> {
  // const isDryRun = Config.isDryRun;
  const pullRequest = github.context.payload.pull_request;

  if (!pullRequest) {
    console.log(`update_hotfix: Pull request not found in payload.`);
    return {
      type: "none",
    };
  }

  const hotfixBranch = pullRequest.head.ref;
  const hotfixVersion = hotfixBranch.substring(Config.hotfixBranchPrefix.length);
  const pullRequestNumber = pullRequest.number;
  const { data: latestRelease } = await octokit.rest.repos.getLatestRelease(Config.repo).catch(() => ({ data: null }));

  const latest_release_tag_name = latestRelease?.tag_name;

  console.log(
    `Generating release notes for ${hotfixBranch}. Latest release tag name: ${latest_release_tag_name}. Pull request number: ${pullRequestNumber}.`
  );
  const { data: releaseNotes } = await octokit.rest.repos.generateReleaseNotes({
    ...Config.repo,
    tag_name: hotfixVersion,
    target_commitish: hotfixBranch,
    previous_tag_name: latest_release_tag_name,
  });

  if (!releaseNotes.body) {
    console.log(`update_hotfix: No release notes found. Exiting.`);
    return {
      type: "none",
    };
  }

  console.log(`update_hotfix: Updating PR with Release notes: ${releaseNotes.body}.`);

  await octokit.rest.pulls.update({
    ...Config.repo,
    pull_number: pullRequestNumber,
    body: releaseNotes.body,
  });

  return {
    type: "hotfix",
    pull_number: pullRequestNumber,
    version: hotfixVersion,
    release_branch: hotfixBranch,
    latest_release_tag_name,
  };
}
