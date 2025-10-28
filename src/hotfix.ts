import { Config, createBranch, getNextVersion, octokit } from "./shared";
import { Result } from "./types";

async function branchExistsOnRemote(branchName: string): Promise<boolean> {
  try {
    await octokit.rest.repos.getBranch({
      ...Config.repo,
      branch: branchName,
    });
    return true;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) {
      return false;
    }
    // Re-throw if it's not a 404 error
    throw error;
  }
}

async function findAvailableHotfixVersion(baseVersion: string): Promise<string> {
  let version = getNextVersion(baseVersion, "patch");
  let hotfixBranch = `${Config.hotfixBranchPrefix}${version}`;

  console.log(`create_hotfix: Checking if ${hotfixBranch} exists on remote...`);

  while (await branchExistsOnRemote(hotfixBranch)) {
    console.log(`create_hotfix: Branch ${hotfixBranch} already exists, incrementing patch version...`);
    version = getNextVersion(version, "patch");
    hotfixBranch = `${Config.hotfixBranchPrefix}${version}`;
    console.log(`create_hotfix: Checking if ${hotfixBranch} exists on remote...`);
  }

  console.log(`create_hotfix: Found available version: ${version}`);
  return version;
}

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

  // Find an available hotfix version by checking if branches exist on remote
  const version = await findAvailableHotfixVersion(latest_release_tag_name || "0.0.0");

  const hotfixBranch = `${Config.hotfixBranchPrefix}${version}`;

  if (!isDryRun) {
    console.log(`create_hotfix: Creating hotfix branch ${hotfixBranch}`);

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
