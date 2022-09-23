
// https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#push
import { scrapeOrganisation } from "../index"
import { queryDependencyNpm } from "../packageAPI"
import { Configuration, writeFile , mapToObject } from "../utils"

// TODO: handle the possibility of race conditions
export async function handleGitHubWebhookPushes(accessToken: string, config: Configuration, payload: any, useCachedData: boolean = false){
	// payload = payload.json()
    // const org = payload?.organization
    // const repo = payload?.repository
    // const ref = repo.master_branch
    const ref = "t"
    let manifests: string[] = []

    // const defaultBranchName = getDefaultBranchName(repo)
    const defaultBranchName = ref

    // we only care about the default branch
    // TODO get default branch of repo

    const filterFunc = (x: string) => x.includes("n")
    if (ref == defaultBranchName ){

        let scrapeOrganisationCache = await scrapeOrganisation(config, accessToken, useCachedData)
        console.log(scrapeOrganisationCache)
        let object;
        for(let [key, value] of scrapeOrganisationCache){
            for(let dep of value){
                dep.dependencies = mapToObject(dep.dependencies)
            }
        }
        object = mapToObject(scrapeOrganisationCache)
        console.log(object)
	    writeFile("scrapeOrganisationCache.json", JSON.stringify(object));
    // mapToObject


    //     payload.commits.forEach((commit: any) => {
    //         manifests =  [].concat(
    //             commit.modified.filter(filterFunc),
    //             commit.added.filter(filterFunc),
    //             commit.removed.filter(filterFunc))
    //     });

	    // writeFile(`${scrapeOrganisationCache}.json`, JSON.stringify(scrapeOrganisationCache));

    }
    // get list of dependencies
    // let response = queryRepository(repo)
    // get list of npm repositories
    // response = queryRepoManifest(org, repo, ref, manifests)
    //
    // response = queryDependencyNpm()
    // update cached data
}

// TODO: handle the possibility of race conditions
async function handleGitHubWebhookRepoChanges(cachedData: any,payload: any): Promise<{ org: string; repo: string; manifests: string[]}> {
	payload = payload.json()
    const action = payload.action
    if (action === "created" || action === "unarchived") {
        // TODO crawle the repo
        // edit the cached in
    } else if (action === "deleted" || action === "transferred" ){
        // Assuming transferred out of organisation
        // remove repo from cachedData data
        // update other dependencies tha
    } else if (action === "renamed"){
        // TODO remove repo in cachedData
    } else {
        // do nothing edited, archived, publicized and privatized
        // Assumption is that the dashboard has access to all repositories(private and public)
        // so publicized and privatized make no difference to us
    }

    return cachedData
}
