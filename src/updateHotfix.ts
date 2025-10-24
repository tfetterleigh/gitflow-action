import { addLabels, Config, octokit } from "./shared";
import { Result } from "./types";
import * as github from "@actions/github";

async function formatCommitsAsReleaseNotes(
  hotfixBranch: string,
  previousTagName: string | undefined,
  hotfixVersion: string
): Promise<string> {
  // Get the base ref (either the previous tag or main branch)
  const base = previousTagName || Config.prodBranch;

  console.log(`update_hotfix: Fetching commits between ${base} and ${hotfixBranch}`);

  // Get the comparison between base and hotfix branch
  const { data: comparison } = await octokit.rest.repos.compareCommits({
    ...Config.repo,
    base: base,
    head: hotfixBranch,
  });

  let body = "## What's Changed\n\n";

  body += "🐛 Bug Fixes\n\n";

  // Format each commit
  for (const commit of comparison.commits) {
    const message = commit.commit.message.split("\n")[0]; // First line only
    const sha = commit.sha.substring(0, 7); // Short SHA
    const author = commit.author?.login || commit.commit.author?.name || "unknown";

    body += `* ${message} (${sha}) by @${author}\n`;
  }

  // Add full changelog link
  body += `\n**Full Changelog**: https://github.com/${Config.repo.owner}/${Config.repo.repo}/compare/${base}...${hotfixVersion}`;

  return body;
}

export async function updateHotfixPR(): Promise<Result> {
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

  console.log(`update_hotfix: Formatting Commits as Release Notes.`);
  const releaseNotesBody = await formatCommitsAsReleaseNotes(hotfixBranch, latest_release_tag_name, hotfixVersion);

  console.log(`update_hotfix: Updating PR with release notes.`);

  await octokit.rest.pulls.update({
    ...Config.repo,
    pull_number: pullRequestNumber,
    body: releaseNotesBody,
  });

  console.log(`update_hotfix: PR Updated, adding "fix" label to PR.`);
  await addLabels(pullRequestNumber, ["fix"]);

  console.log(`update_hotfix: PR Update complete.`);
  return {
    type: "hotfix",
    pull_number: pullRequestNumber,
    version: hotfixVersion,
    release_branch: hotfixBranch,
    latest_release_tag_name,
  };
}
