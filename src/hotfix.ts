import { Config, createBranch, getNextVersion, octokit } from "./shared";
import { Result } from "./types";

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

  if (!isDryRun) {
    console.log(`create_hotfix: Creating hotfix branch`);

    // create hotfix branch from latest sha of prod branch
    await createBranch(hotfixBranch, prodBranchSha);
  } else {
    console.log(`create_hotfix: Dry run: would have created hotfix branch ${hotfixBranch}`);
  }

  return {
    type: "hotfix",
    version,
    release_branch: hotfixBranch,
    latest_release_tag_name,
  };
}
