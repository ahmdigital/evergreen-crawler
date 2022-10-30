# Organisation Crawler

[![Main](https://github.com/ahm-monash/crawler/actions/workflows/main.yml/badge.svg)](https://github.com/ahm-monash/crawler/actions/workflows/main.yml)

This library helps you track how outdated your organisation repositories are.

The organisation Crawler uses the [GitHub GraphQL API](https://docs.GitHub.com/en/GraphQL) to extract all of a GitHub organisation's repositories and their internal and external dependencies. The current version of dependencies of the crawled repositories are found using [DependencyGraphManifest](https://docs.github.com/en/graphql/reference/objects#dependencygraphmanifest) GraphQL object.
The latest versions of the dependencies are requested from npm/rubygem/pypi API, it uses client side rate limiter when querying these APIs.

These information are aggregated and returned as a json object which has a [schema](#output-schema), this object can then be used to present the data.

- [Organisation Crawler](#organisation-crawler)
  - [Package Managers support](#package-managers-support)
  - [Output schema](#output-schema)
  - [Example usage](#example-usage)
  - [Setup Instructions](#setup-instructions)
    - [Running pre-commit hooks manually](#running-pre-commit-hooks-manually)
    - [Skipping pre-commit hooks](#skipping-pre-commit-hooks)
    - [ENV](#env)
    - [Configuration](#configuration)
    - [Running](#running)
    - [Execute jest test faster](#execute-jest-test-faster)
  - [Future work](#future-work)
  - [Limitations](#limitations)
  - [Contributing](#contributing)

## Package Managers support

* JavaScript
* Python
* Ruby

## Output schema

```
RepoMap: Map<ID, Object> = {
    ID: {
        name: ID= "NAME",
        version: SemVer = VERSION,
        link: string = "LINK",
        internal: bool = IS_INTERNAL,
        archived: bool = IS_ARCHIVED,
        lastUpdated: string = DATE
        languageVersion?: string = "LANGUAGE_VERSION",
		oldName?: string = "OLD_NAME"
    },
    ...
}
DependencyList: Object[] = [
    {
        dep: ID = ID,
        dependencies: [int, SemVer] = [
            [ID, VERSION],
            ...
        ]
    },
    ...
]

```

## Example usage

The only function that is needed to generate the json data is `getJsonStructure`:

```TypeScript

import { getJsonStructure } from "evergreen-org-crawler"

// function getJsonStructure(accessToken: string, targetOrganisation: string, config: Configuration, { toUse, crawlStart, useCachedData }?: {
//     toUse?: string[];
//     crawlStart?: string | null;
//     useCachedData?: boolean;
// }): Promise<string>;

let res: any = getJsonStructure(
    accessToken,
		target_organisation,
    config, {
      toUse: ["NPM"],
      useCachedData: false
	  })

console.log(res)

```

If Github webhooks is enabled for the target organisation, these two functions are available:


```TypeScript
import { handleGitHubWebhookPushEvents, handleGitHubWebhookRepositoryEvents } from "evergreen-org-crawler/build/webhooks/github";

// handleGitHubWebhookPushEvents(accessToken: string, targetOrganisation: string, payload: any, useCachedData?: boolean): Promise<void>;
// handleGitHubWebhookRepositoryEvents(accessToken: string, targetOrganisation: string, payload: any, useCachedData?: boolean): Promise<void>;

await handleGitHubWebhookRepositoryEvents(
  accessToken,
  target_organisation,
  {},
  false
);

```

When called these functions update the cache internally.

## Setup Instructions

Before you commit, please configure pre-commit with:

`pre-commit install`

Now, every time you commit, it will run hooks to fix various styling and linting problem.

### Running pre-commit hooks manually

`pre-commit run --all-files`

### Skipping pre-commit hooks

Please avoid doing this at all cost.

`git commit -n -m "Your commit message"`

The `-n` allows you to skip git hooks.


### ENV

`.env` file

```
GH_TOKEN= Github token that has full repo scope and admin:org-read:org
targetOrganisation= The target GitHub organisation to track
```

The token is needed to query GitHub API and access private repositories

### Configuration

Optional `config.json` file

```json
{
	npmURL: optional, the URL to a specific npm host
	pipURL: optional, the URL to a specific pip host
	rubygemsURL: optional, the URL to a specific RubyGems host
}
```


### Running

Clone the repository with:

```bash
git clone https://github.com/ahm-monash/crawler
```

In the root directory for the project, run the following to install the necessary dependencies:

```bash
npm install
```

Setup a `.env` file with the environment variables populated, the run the crawler with.

```bash
npm start
```

This will generate [cachedData.json](./cachedData.json) file which has a [schema](#output-schema).

### Execute jest test faster

Run a single file only `npm run test <PATHTOFILE>`

Use the flag `--onlyFailures` to only run failed tests in the previous execution `npm run test --onlyFailures`


## Future work

- [ ] Dedicated GraphQL files fro graphql query schemas
- [ ] Improve retry mechanism for asynchronous requests

## Limitations
* Each manifest file doesn't contain more that 250 dependencies
* The dashboard depends on [Dependency Graph manifest](https://docs.github.com/en/graphql/reference/objects#dependencygraphmanifest), which has some limitations, for example it cannot detect dependencies which:
  * Javascript:
    * use `"foo": "github:user/repo`
    * use `"foo": "user/repo"`
    * use `"foo": "fileSystemPath"`
  * Python
    * use `foo fileSystemPath`
* There is a [limit](https://github.community/t/dependency-graph-manifest-files-limit/133284/77?page=3) on the number of manifest files that can be fetched (link is dead)
* [Other dependency graph limits](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/troubleshooting-the-dependency-graph)
* `repository_import` events do not trigger update cache `https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#repository_import`


## Contributing

Contributions are most welcome!

Before opening a PR:

- Make sure that there isn't an active PR already open which makes the same changes
- Make sure to check if there are issues related to your PR
- Make sure that your branch name follows `{name}/{description}`
