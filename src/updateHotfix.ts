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

  console.log(`update_hotfix: Pull request found in payload.`);

  const hotfixBranch = pullRequest.head.ref;
  const hotfixVersion = hotfixBranch.substring(Config.hotfixBranchPrefix.length);
  const pullRequestNumber = pullRequest.number;
  const { data: latestRelease } = await octokit.rest.repos.getLatestRelease(Config.repo).catch(() => ({ data: null }));

  const latest_release_tag_name = latestRelease?.tag_name;

  console.log(
    `update_hotfix: Latest release tag name: ${latest_release_tag_name}. Hotfix branch: ${hotfixBranch}. Hotfix version: ${hotfixVersion}. Pull request number: ${pullRequestNumber}.`
  );

  const { data: releaseNotes } = await octokit.rest.repos.generateReleaseNotes({
    ...Config.repo,
    tag_name: hotfixVersion,
    target_commitish: hotfixBranch,
    previous_tag_name: latest_release_tag_name,
  });

  console.log(`update_hotfix: Release notes: ${releaseNotes.body}.`);

  const mergedPrNumbersWorking = (releaseNotes.body.match(/pull\/\d+/g) || []).map((prNumber) =>
    Number(prNumber.replace("pull/", ""))
  );

  console.log(`update_hotfix: Merged PR numbers: ${mergedPrNumbersWorking}.`);

  const pull_numbers_in_release = Array.from(new Set(mergedPrNumbersWorking)).sort().join(",");
  const mergedPrNumbers = Array.from(new Set(pull_numbers_in_release.split(",").map(Number)));
  // Get the PRs and parse the release summary
  const mergedPrs = await Promise.all(
    mergedPrNumbers.map(async (prNumber) => {
      const pr = await octokit.rest.pulls.get({
        ...Config.repo,
        pull_number: prNumber,
      });
      if (!pr.data.body) {
        return;
      }
      const regex = /\\#\\# What does this PR do\?([\s\S]*?)\n\\#\\#/gm;
      let match = regex.exec(pr.data.body)?.[1]?.trim();
      // try to remove empty lines
      match = match
        ?.split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.startsWith("-") || s.startsWith("*") ? s : `* ${s}`))
        .join("\n");

      return {
        summary: `${pr.data.title}\n${match}`,
      };
    })
  ).then((prs) => prs.filter(Boolean));

  if (mergedPrs.length === 0) {
    console.log("No merged pr found.");
  }

  let releasePrBody;
  if (mergedPrs.length === 0) {
    releasePrBody = releaseNotes.body;
  } else {
    const releaseSummary = mergedPrs.map((pr) => pr?.summary).join("\n\n");

    releasePrBody = `${releaseNotes.body}

## Release summary

${releaseSummary}
  `;
  }

  if (releasePrBody) {
    await octokit.rest.pulls.update({
      ...Config.repo,
      pull_number: pullRequestNumber,
      body: releasePrBody,
    });
  }

  return {
    type: "hotfix",
    pull_number: pullRequestNumber,
    pull_numbers_in_release: pull_numbers_in_release,
    version: hotfixVersion,
    release_branch: hotfixBranch,
    latest_release_tag_name,
  };
}
