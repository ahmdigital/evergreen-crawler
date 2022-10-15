
// https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#push
import { scrapeOrganisation, scrapeOrgCacheFilename } from "../index"
import { Configuration, writeFile, mapToObject } from "../utils"

// Race condition will occur if they are not called(and awaited) sequentially.
export async function handleGitHubWebhookPushEvents(accessToken: string, config: Configuration, payload: any, useCachedData: boolean = false) {

    // we only care about the default branch
    if (payload.ref == "refs/heads/" + payload.repository.default_branch) {
        await updateCache(accessToken, config, useCachedData)
    }
    else {
        console.log(`Push event ref doesn't match the default ${payload.repository.default_branch} /= ${payload.ref}`)
    }
}

export async function handleGitHubWebhookRepositoryEvents(accessToken: string, config: Configuration, payload: any, useCachedData: boolean = false) {
    await updateCache(accessToken, config, useCachedData)
}

async function updateCache(accessToken: string, config: Configuration, useCachedData: boolean = false) {
    let scrapeOrganisationCache = await scrapeOrganisation(config, accessToken, useCachedData)
    console.log(scrapeOrganisationCache)

    for (let [key, value] of scrapeOrganisationCache) {
        for (let dep of value) {
            dep.dependencies = mapToObject(dep.dependencies)
        }
    }

    const object = mapToObject(scrapeOrganisationCache)
    console.log(object)

    writeFile(scrapeOrgCacheFilename, JSON.stringify(object));
}
