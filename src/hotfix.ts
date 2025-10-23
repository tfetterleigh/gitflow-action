import { addLabels, Config, createBranch, createPullRequest, getNextVersion, octokit } from "./shared";
import { Result } from "./types";
import { createExplainComment } from "./utils";

export async function createHotfix(): Promise<Result> {
  const isDryRun = Config.isDryRun;

  const prodBranchSha = (
    await octokit.rest.repos.getBranch({
      ...Config.repo,
      branch: Config.prodBranch,
    })
  ).data.commit.sha;

  const { data: latestRelease } = await octokit.rest.repos.getLatestRelease(Config.repo).catch(() => ({ data: null }));

  const latest_release_tag_name = latestRelease?.tag_name;

  // version will always be patch for hotfix
  const version = getNextVersion(latest_release_tag_name || "0.0.0", "patch");

  const hotfixBranch = `${Config.hotfixBranchPrefix}${version}`;
  let pullRequestNumber;

  if (!isDryRun) {
    console.log(`create_hotfix: Creating hotfix branch`);

    // create hotfix branch from latest sha of prod branch
    await createBranch(hotfixBranch, prodBranchSha);

    const { data: pullRequest } = await createPullRequest(
      `Hotfix ${version}`,
      `Hotfix ${version} draft`,
      hotfixBranch,
      Config.prodBranch
    );

    pullRequestNumber = pullRequest.number;

    await addLabels(pullRequestNumber, ["hotfix"]);

    await createExplainComment(pullRequestNumber);

    console.log(`create_hotfix: Pull request has been created at ${pullRequest.html_url}`);
  } else {
    console.log(`create_hotfix: Dry run: would have created hotfix branch ${hotfixBranch}`);
  }

  return {
    type: "hotfix",
    pull_number: pullRequestNumber,
    pull_numbers_in_release: "",
    version,
    release_branch: hotfixBranch,
    latest_release_tag_name,
  };
}
