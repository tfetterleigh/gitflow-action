import {
  addLabels,
  Config,
  createBranch,
  createPullRequest,
  generateReleaseNotes,
  getLatestRelease,
  getNextVersion,
  octokit,
} from "./shared";
import { Result } from "./types";
import { createExplainComment } from "./utils";

export async function createReleasePR(): Promise<Result> {
  const isDryRun = Config.isDryRun;

  const developBranchSha = (
    await octokit.rest.repos.getBranch({
      ...Config.repo,
      branch: Config.developBranch,
    })
  ).data.commit.sha;

  console.log(`create_release: Generating release notes for ${developBranchSha}`);

  // developBranch and mainBranch are almost identical
  // so we can use developBranch for ahead-of-time release note
  const latestRelease = await getLatestRelease();

  const latest_release_tag_name = latestRelease?.tag_name;

  let version: string;
  if (Config.version) {
    version = Config.version;
  } else if (Config.versionIncrement) {
    version = getNextVersion(latest_release_tag_name || "0.0.0", Config.versionIncrement);
  } else {
    version = developBranchSha;
  }

  const releaseNotes = await generateReleaseNotes(Config.developBranch, version, latest_release_tag_name);

  // compare dev commit to latest release commit
  console.log(
    `create_release: Comparing dev commit ${developBranchSha} to latest release commit ${latest_release_tag_name}`
  );

  const releasePrBody = `${releaseNotes.body}
    
## Release summary

${Config.releaseSummary}
  `;

  const releaseBranch = `${Config.releaseBranchPrefix}${version}`;
  let pullRequestNumber;

  if (!isDryRun) {
    console.log(`create_release: Creating release branch`);

    // create release branch from latest sha of develop branch
    await createBranch(releaseBranch, developBranchSha);

    const { data: pullRequest } = await createPullRequest(
      `Release ${releaseNotes.name || version}`,
      releasePrBody,
      releaseBranch,
      Config.prodBranch
    );

    pullRequestNumber = pullRequest.number;

    await addLabels(pullRequestNumber, ["release"]);

    await createExplainComment(pullRequestNumber);

    console.log(`create_release: Pull request has been created at ${pullRequest.html_url}`);
  } else {
    console.log(
      `create_release: Dry run: would have created release branch ${releaseBranch} and PR with body:\n${releasePrBody}`
    );
  }

  // Parse the PR body for PR numbers
  let mergedPrNumbers = (releaseNotes.body.match(/pull\/\d+/g) || []).map((prNumber) =>
    Number(prNumber.replace("pull/", ""))
  );
  // remove duplicates due to the "New contributors" section
  mergedPrNumbers = Array.from(new Set(mergedPrNumbers)).sort();

  return {
    type: "release",
    pull_number: pullRequestNumber,
    pull_numbers_in_release: mergedPrNumbers.join(","),
    version,
    release_branch: releaseBranch,
    latest_release_tag_name,
  };
}
