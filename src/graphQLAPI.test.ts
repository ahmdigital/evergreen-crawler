import {
  queryRepoManifestRest,
  queryRepositories,
  queryDependencies,
} from "./graphQLAPI";
import { getAccessToken } from "./utils";
import { TokenBucket } from "./rate-limiting/token-bucket";

const accessToken = getAccessToken();

// TODO: update this page once the mock organisation card is completed

// beforeEach(async () => accessToken())

// one test to check if token is valid

test("test the content of a repository javascript manifest", async () => {
  let orgName = "ahm-monash";
  let repoName = "crawler";
  let pathStrings = "package.json";
  let token = accessToken;

  const tokenBucket = new TokenBucket(1000, 60.0 / 60.0, 1);
  let res = await queryRepoManifestRest(
    orgName,
    repoName,
    pathStrings,
    token,
    tokenBucket
  );

  expect(res.name).toBe("evergreen-org-crawler");
  expect(res.version).toBe("0.0.4");
});

test("test fetching repositories from an organisation", async () => {
  let organisation = "ahm-monash";
  let numOfPages = 100;
  let repoCursor = null;
  let token = accessToken;

  let res = await queryRepositories(
    organisation,
    numOfPages,
    repoCursor,
    token
  );

  expect(res.organization.repositories.totalCount).toBe(4);
});

describe("Dependencies", () => {
  jest.retryTimes(2);
  test("test fetching dependencies of a repository", async () => {

    let organisation = "ahm-monash";
    let numOfPages = 1;
    let repoCursor = null;
    let token = accessToken;

    let res = await queryDependencies(
      organisation,
      numOfPages,
      repoCursor,
      token
    );

    expect(res.organization.repositories.edges[0].node.mainBranch.repository.dependencyGraphManifests.totalCount).toBe(7);
  });
});
