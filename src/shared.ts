import * as core from "@actions/core";
import * as github from "@actions/github";
import { ReleaseType } from "semver";
import semverInc from "semver/functions/inc";

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) throw new Error(`process.env.GITHUB_TOKEN is not defined`);

export const octokit = github.getOctokit(githubToken);

export const Config = {
  developBranch: core.getInput("develop_branch") || process.env.DEVELOP_BRANCH || "",
  prodBranch: core.getInput("main_branch") || process.env.MAIN_BRANCH || "",
  mergeBackFromProd: (core.getInput("merge_back_from_main") || process.env.MERGE_BACK_FROM_MAIN) == "true",
  repo: {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
  },
  version: core.getInput("version") || process.env.VERSION || "",
  versionIncrement: (core.getInput("version_increment") || process.env.VERSION_INCREMENT || "") as ReleaseType,
  isDryRun: (core.getInput("dry_run") || process.env.DRY_RUN) == "true",
  releaseSummary: core.getInput("release_summary") || process.env.RELEASE_SUMMARY || "",
  releaseBranchPrefix: "release/",
  hotfixBranchPrefix: "hotfix/",
  slackOptionsStr: core.getInput("slack") || process.env.SLACK_OPTIONS,
  isHotfix: (core.getInput("is_hotfix") || process.env.IS_HOTFIX) == "true",
  mergeUserToken: core.getInput("merge_user_token") || "",
};

export async function createBranch(branch: string, sha: string) {
  console.log(`create_branch: Creating branch ${branch} from ${sha}`);
  return await octokit.rest.git.createRef({
    ...Config.repo,
    ref: `refs/heads/${branch}`,
    sha: sha,
  });
}

export async function createPullRequest(
  title: string,
  body: string,
  head: string,
  base: string,
  draft: boolean = true
) {
  console.log(`create_release: Creating Pull Request with title ${title} and body: \n${body}`);
  return await octokit.rest.pulls.create({
    ...Config.repo,
    title: title,
    body: body,
    head: head,
    base: base,
    maintainer_can_modify: false,
    draft: draft,
  });
}

export async function addLabels(pull_number: number, labels: string[]) {
  // validate
  if (labels.length === 0) {
    console.log(`add_labels: No labels to add`);
    return;
  }

  if (pull_number === undefined) {
    console.log(`add_labels: No PR number to add labels to`);
    return;
  }

  console.log(`add_labels: Adding labels ${labels} to PR ${pull_number}`);

  return await octokit.rest.issues.addLabels({
    ...Config.repo,
    issue_number: pull_number,
    labels: labels,
  });
}

export function getNextVersion(currentVersion: string, versionIncrement: ReleaseType) {
  const increasedVersion = semverInc(currentVersion || "0.0.0", versionIncrement, { loose: true });

  if (!increasedVersion) {
    throw new Error(`get_next_version: Could not increment version ${currentVersion} with ${versionIncrement}`);
  }

  return increasedVersion;
}
