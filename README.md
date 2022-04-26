# RepoCrawler

This repository is a spike on how to use the GitHub API to
 - List repositories under an organization
 - Locating the package.json file for a repository
 - Downloading and Parsing the contents of the package.json file
 - Finding the current version of the dependencies listend in the package.json file using npm API

Next steps:
 - Send an alert to slack once a dependency is two majors behind
 - Retrieve data from dependency's repositories as well, in order to create a dependency graph
 - Store the dependency graph into a database


## Repository Setup

Before you commit, please configure pre-commit with:

`pre-commit install`

Now, every time you commit, it will run hooks to fix various styling and linting problem.

### Running pre-commit hooks manually

`pre-commit run --all-files`

### Skipping pre-commit hooks

Please avoid doing this at all cost.

`git commit -n -m "Your commit message"`

The `-n` allows you to skip git hooks.
## Usage
 - clone the repository and `cd` into it
 - [create a personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) on GitHub. If you are lazy and don't wanna do this you can skip this and the next step, but you will probably be ratelimited after a few requests.
 - create a file called `access_token.txt`, paste your access token there and hit save. This file is .gitignored.
 - run `npm install` to install the necesary dependencies
 - run `tsc -w` to let TypeScript compile the code and whatch for changes. This will create the build folder
 - run `node ./build/index.js` in a new terminal tab to execute the code

If you want to play around, simply edit the code (tsc will compile it automatically as long as `tsc -w` is running), finally run `node ./build/index.js` again.


## Sample output:
```
Waiting for all requests to finish
2022-03-31T01:16:43.982Z - GitHub counter 1.30 req/s
2022-03-31T01:16:43.982Z - npm counter 0.00 req/s
2022-03-31T01:16:53.988Z - GitHub counter 1.40 req/s
2022-03-31T01:16:53.989Z - npm counter 0.00 req/s
2022-03-31T01:17:03.995Z - GitHub counter 1.40 req/s
2022-03-31T01:17:03.995Z - npm counter 0.10 req/s
2022-03-31T01:17:14.000Z - GitHub counter 1.40 req/s
2022-03-31T01:17:14.000Z - npm counter 0.70 req/s
#############################################################################################
GitHub information:
Name: request-action
Description: A GitHub Action to send arbitrary requests to GitHub's REST API
Language: JavaScript
Last Updated: 2022-03-30T01:51:07Z

package.json information:
Name: @octokit/request-action
Version: 0.0.0-development
Description: A GitHub Action to send arbitrary requests to GitHub's REST API
Keywords: [ 'github-action' ]


Dependencies:
         @actions/core  - Used version: ^1.2.6 | Latest version: 1.6.0
         @octokit/action  - Used version: ^3.1.6 | Latest version: 3.18.0
         js-yaml  - Used version: ^4.0.0 | Latest version: 4.1.0
#############################################################################################

#############################################################################################
GitHub information:
Name: auth-app.js
Description: GitHub App authentication for JavaScript
Language: TypeScript
Last Updated: 2022-03-18T12:01:05Z

package.json information:
Name: @octokit/auth-app
Version: 0.0.0-development
Description: GitHub App authentication for JavaScript
Keywords: [ 'github', 'octokit', 'authentication', 'api' ]


Dependencies:
         @octokit/auth-oauth-app  - Used version: ^4.3.0 | Latest version: 4.3.0
         @octokit/auth-oauth-user  - Used version: ^1.2.3 | Latest version: 1.3.0
         @octokit/request  - Used version: ^5.6.0 | Latest version: 5.6.3
         @octokit/request-error  - Used version: ^2.1.0 | Latest version: 2.1.0
         @octokit/types  - Used version: ^6.0.3 | Latest version: 6.34.0
         @types/lru-cache  - Used version: ^5.1.0 | Latest version: 7.6.1
         deprecation  - Used version: ^2.3.1 | Latest version: 2.3.1
         lru-cache  - Used version: ^6.0.0 | Latest version: 7.7.3
         universal-github-app-jwt  - Used version: ^1.0.1 | Latest version: 1.1.0
         universal-user-agent  - Used version: ^6.0.0 | Latest version: 7.0.0
#############################################################################################

#############################################################################################
GitHub information:
Name: auth-callback.js
Description: GitHub API authentication using a callback method
Language: TypeScript
Last Updated: 2022-03-16T19:08:19Z

package.json information:
Name: @octokit/auth-callback
Version: 0.0.0-development
Description: GitHub API authentication using a callback method
Keywords: [ 'github', 'api', 'sdk', 'toolkit' ]


Dependencies:
         None found
#############################################################################################

2022-03-31T01:17:24.006Z - GitHub counter 1.40 req/s
2022-03-31T01:17:24.007Z - npm counter 0.50 req/s
#############################################################################################
GitHub information:
Name: auth-oauth-app.js
Description: GitHub OAuth App authentication for JavaScript
Language: TypeScript
Last Updated: 2022-02-26T06:27:37Z

package.json information:
Name: @octokit/auth-oauth-app
Version: 0.0.0-development
Description: GitHub OAuth App authentication for JavaScript
Keywords: [ 'github', 'octokit', 'authentication', 'oauth', 'api' ]


Dependencies:
         @octokit/auth-oauth-device  - Used version: ^3.1.1 | Latest version: 3.1.2
         @octokit/auth-oauth-user  - Used version: ^1.2.1 | Latest version: 1.3.0
         @octokit/request  - Used version: ^5.3.0 | Latest version: 5.6.3
         @octokit/types  - Used version: ^6.0.3 | Latest version: 6.34.0
         @types/btoa-lite  - Used version: ^1.0.0 | Latest version: 1.0.0
         btoa-lite  - Used version: ^1.0.0 | Latest version: 1.0.0
         universal-user-agent  - Used version: ^6.0.0 | Latest version: 7.0.0
#############################################################################################

...

==============================================================

Elapsed time: 2.21 minutes
Github requests:
         Total: 184 Average: 1.39 reqs/s
npm requests:
         Total: 146 Average: 1.10 reqs/s
Total requests:
         Total: 330 Average: 2.49 reqs/s

```
