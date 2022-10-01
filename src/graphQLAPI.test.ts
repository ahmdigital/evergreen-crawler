import {
  queryRepoManifestRest,
  queryRepositories,
  queryDependencies,
} from "./graphQLAPI";
import { getAccessToken } from "./utils";
import { scrapeOrganisation, mergeDependenciesLists, getJsonStructure} from "./index";
import { TokenBucket } from "./rate-limiting/token-bucket";

jest.setTimeout(3*60*1000)
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

  expect(res.organization.repositories.totalCount).toBe(9);
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
    // console.log(res.organization.repositories.edges[0].node)

    expect(res.organization.repositories.edges[0].node.dependencyGraphManifests.totalCount).toBe(6);
  });
});

test("test language-specific dependency gathering from an organisation", async () => {
	let organisation = "evergreen-test-environment";

	const allDeps = await scrapeOrganisation({targetOrganisation: organisation}, accessToken)
	const packageDeps = mergeDependenciesLists(allDeps);
	console.log(packageDeps)
	expect(packageDeps.get("NPM")?.length).toBe(270);
	expect(packageDeps.get("PYPI")?.length).toBe(75);
	expect(packageDeps.get("RUBYGEMS")?.length).toBe(56);
});

test("test overall output of the crawler library", async () => {
	let organisation = "evergreen-test-environment";

	const data = JSON.parse(await getJsonStructure(accessToken, {targetOrganisation: organisation}))
  if (data.npm.length > 0){
    expect(Object.keys(data.npm[0]).length).toBe(282);
    expect(data.npm[1].length).toBe(19);

  }
  if (data.PyPI.length > 0){
    expect(Object.keys(data.PyPI[0]).length).toBe(77);
	  expect(data.PyPI[1].length).toBe(2);
  }
  if (data.RubyGems.length > 0){
    expect(Object.keys(data.RubyGems[0]).length).toBe(61);
	  expect(data.RubyGems[1].length).toBe(5);
  }
});
