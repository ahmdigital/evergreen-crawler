# RepoCrawler

This repo is a spike on how to use the GitHub API to
 - List repositories under an organization
 - Locating the package.json file for a repository
 - Downloading and Parsing the contents of the package.json file
 
Next steps:
 - For each dependency, find it's repository name and owner
 - Retrieve data from dependency's repositories as well, in order to create a dependency graph


## Usage
 - clone the repo and `cd` into it
 - [create a personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) on GitHub. If you are lazy and don't wanna do this you can skip this and the next step, but you will probably be ratelimited after a few requests.
 - create a file called `access_token.txt`, paste your access token there and hit save. This file is .gitignored. 
 - run `npm install` to install the necesary dependencies
 - run `tsc -w` to let typescript compile the code and whatch for changes. This will create the build folder
 - run `node ./build/index.js` in a new terminal tab to execute the code

If you want to play around, simply edit the code (tsc will compile it automatically as long as `tsc -w` is running), finally run `node ./build/index.js` again.


Sample output:
```
GitHub information:
Name: octokit.js
Description: The all-batteries-included GitHub SDK for Browsers, Node.js, and Deno.
Language: TypeScript
Last Updated: 2022-03-18T08:43:55Z

package.json information:
Name: octokit
Version: 0.0.0-development
Description: The all-batteries-included GitHub SDK for Browsers, Node.js, and Deno
Keywords: [ 'github', 'api', 'sdk', 'octokit' ]
dependencies: {
  '@octokit/app': '^12.0.4',
  '@octokit/core': '^3.5.1',
  '@octokit/oauth-app': '^3.5.1',
  '@octokit/plugin-paginate-rest': '^2.16.8',
  '@octokit/plugin-rest-endpoint-methods': '^5.12.0',
  '@octokit/plugin-retry': '^3.0.9',
  '@octokit/plugin-throttling': '^3.5.1',
  '@octokit/types': '^6.26.0'
}
devDependencies: {
  '@octokit/tsconfig': '^1.0.2',
  '@pika/pack': '^0.5.0',
  '@pika/plugin-build-node': '^0.9.2',
  '@pika/plugin-build-web': '^0.9.2',
  '@pika/plugin-ts-standard-pkg': '^0.9.2',
  '@types/jest': '^27.0.0',
  '@types/node': '^14.14.36',
  '@types/node-fetch': '^2.5.10',
  'fetch-mock': '^9.11.0',
  jest: '^27.0.0',
  mockdate: '^3.0.5',
  'node-fetch': '^2.6.7',
  prettier: '2.4.1',
  'semantic-release': '^18.0.0',
  'semantic-release-plugin-update-version-in-files': '^1.1.0',
  'ts-jest': '^27.0.0-next.12',
  typescript: '^4.2.3'
}

#############################################################################################

GitHub information:
Name: fixtures
Description: Fixtures for all the octokittens
Language: JavaScript
Last Updated: 2021-12-18T17:46:35Z

package.json information:
Name: @octokit/fixtures
Version: 0.0.0-development
Description: Fixtures for all the octokittens
Keywords: []
dependencies: {
  'json-diff': '^0.5.3',
  lodash: '^4.17.11',
  nock: '^13.0.0',
  'url-template': '^2.0.8'
}
devDependencies: {
  '@types/jest': '^27.0.0',
  axios: '^0.22.0',
  'axios-debug-log': '^0.8.0',
  bottleneck: '^2.12.0',
  chalk: '^4.0.0',
  envalid: '^7.0.0',
  'get-stream': '^6.0.0',
  glob: '^7.1.3',
  'gunzip-maybe': '^1.4.1',
  'humanize-string': '^2.0.0',
  'into-stream': '^7.0.0',
  jest: '^27.0.4',
  minimist: '^1.2.5',
  mkdirp: '^1.0.3',
  prettier: '2.4.1',
  proxyquire: '^2.1.0',
  'semantic-release': '^18.0.0',
  'tar-stream': '^2.0.1'
}

#############################################################################################

...


```