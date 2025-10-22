import { run } from "../index";
import { context } from "@actions/github";

// Mock getInput and setFailed functions
jest.mock("@actions/core", () => ({
  getInput: jest.fn(),
  setFailed: jest.fn(),
}));

// Mock context and getOctokit functions
jest.mock("@actions/github", () => ({
  context: {
    eventName: "pull_request",
    payload: {
      pull_request: {
        number: 1,
      },
      action: "closed",
    },
    repo: {
      owner: "owner",
      repo: "repo",
    },
  },
  getOctokit: jest.fn(),
}));

describe("run", () => {
  const logSpy = jest.spyOn(console, "log");
  beforeEach(() => {
    // Clear all mock function calls and reset mock implementation
    jest.clearAllMocks();
  });

  it("should run on pull_request", async () => {
    (context as any).eventName = "pull_request";
    (context as any).payload.action = "closed";

    await run();

    // check output
    expect(logSpy).toHaveBeenCalledWith("gitflow-action: is PR event and PR is closed");
  });

  it("should run on workflow_dispatch", async () => {
    (context as any).eventName = "workflow_dispatch";

    await run();

    expect(logSpy).toHaveBeenCalledWith("gitflow-action: is workflow_dispatch");
  });

  it("should not run on other events", async () => {
    (context as any).eventName = "push";

    await run();

    expect(logSpy).toHaveBeenCalledWith("gitflow-action: no conditions matched");
  });

  // it("should add label to the pull request", async () => {
  //   // Mock the return values for getInput
  //   (getInput as jest.Mock).mockReturnValueOnce("gh-token-value");
  //   (getInput as jest.Mock).mockReturnValueOnce("label-value");
  //   (context as any).payload.pull_request = {
  //     number: 1,
  //   };
  //
  //   // Mock the Octokit instance and the addLabels method
  //   const mockAddLabels = jest.fn();
  //   const mockOctokit = {
  //     rest: {
  //       issues: {
  //         addLabels: mockAddLabels,
  //       },
  //     },
  //   };
  //   (getOctokit as jest.Mock).mockReturnValueOnce(mockOctokit);
  //
  //   // Run the function
  //   await run();
  //
  //   // Assertions
  //   expect(getInput).toHaveBeenCalledWith("gh-token");
  //   expect(getInput).toHaveBeenCalledWith("label");
  //   expect(getOctokit).toHaveBeenCalledWith("gh-token-value");
  //   expect(mockAddLabels).toHaveBeenCalledWith({
  //     owner: "owner",
  //     repo: "repo",
  //     issue_number: 1,
  //     labels: ["label-value"],
  //   });
  //   expect(setFailed).not.toHaveBeenCalled();
  // });
});
