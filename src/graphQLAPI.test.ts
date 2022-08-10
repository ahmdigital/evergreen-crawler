import {
  queryRepoManifestRest,
  queryRepositories,
  queryDependencies,
} from "./graphQLAPI";
import { getAccessToken } from "./utils";
import { scrapeOrganisation, mergeDependenciesLists, getJsonStructure} from "./index";
import { TokenBucket } from "./rate-limiting/token-bucket";

const accessToken = getAccessToken();


// beforeEach(async () => accessToken())

test("test the content of a repository javascript manifest", async () => {
  let orgName = "evergreen-test-environment";
  let repoName = "test-dependencies";
  let pathStrings = "package.json";

  const tokenBucket = new TokenBucket(1000, 60.0 / 60.0, 1);
  let res = await queryRepoManifestRest(
    orgName,
    repoName,

    pathStrings,
    accessToken,
    tokenBucket
  );

  expect(res.name).toBe("test-dependencies");
  expect(res.version).toBe("1.0.0");
});

test("test fetching repositories from an organisation", async () => {
  let organisation = "evergreen-test-environment";
  let numOfPages = 100;
  let repoCursor = null;

  let res = await queryRepositories(
    organisation,
    numOfPages,
    repoCursor,
    accessToken
  );

  expect(res.organization.repositories.totalCount).toBe(10);
});


describe("Dependencies", () => {
  jest.retryTimes(2);
  test("test fetching dependencies of a repository", async () => {

    let organisation = "evergreen-test-environment";
    let numOfPages = 1;
    let repoCursor = null;

    let res = await queryDependencies(
      organisation,
      numOfPages,
      repoCursor,
      accessToken
      );
      // console.log(res.organization.repositories.edges[0].node.mainBranch.repository)

      expect(res.organization.repositories.edges[0].node.mainBranch.repository.dependencyGraphManifests.totalCount).toBe(6);
    });
});

test("test fetching repositories from an organisation", async () => {
	let organisation = "evergreen-test-environment";

	const allDeps = await scrapeOrganisation({targetOrganisation: organisation}, accessToken)
	const packageDeps = mergeDependenciesLists(allDeps);
	console.log(packageDeps)
	expect(packageDeps.get("NPM")?.length).toBe(11);
	expect(packageDeps.get("PYPI")?.length).toBe(18);
	// expect(packageDeps.get("RUBYGEMS")?.length).toBe(0);
});

test("test overall output of the crawler library", async () => {
	let organisation = "evergreen-test-environment";

	const data = JSON.parse(await getJsonStructure(accessToken, {targetOrganisation: organisation}))
  if (data.npm.length > 0){
    expect(Object.keys(data.npm[0]).length).toBe(15);
    expect(data.npm[1].length).toBe(4);

  }
  if (data.PyPI.length > 0){
    expect(Object.keys(data.PyPI[0]).length).toBe(19);
	  expect(data.PyPI[1].length).toBe(1);
  }
  if (data.RubyGems.length > 0){
    expect(Object.keys(data.RubyGems[0]).length).toBe(0);
	  expect(data.RubyGems[1].length).toBe(0);
  }
});
