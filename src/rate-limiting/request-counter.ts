/**
 * Prints a summary of requests per second every once in a while.
 */
export class RequestCounter{

	private requests:number
	private totalRequests:number
	private timer:NodeJS.Timer
	private interval:number
	private name:string

	constructor(interval:number, name:string=""){
		if (interval <= 0) {
			throw new Error("interval must be greater than 0");
		}
		this.interval = interval
		this.name = name
		this.totalRequests = 0
		this.resume()
	}

	resume(){

		this.requests = 0
		this.timer = setInterval(() => {
			const speed = this.requests/(this.interval/1000)
			console.log(`${new Date().toISOString()} - ${this.name} counter ${speed.toFixed(2)} req/s`)
			this.requests = 0
		}, this.interval)
	}

	pause(){
		clearInterval(this.timer)
	}

	addRequest(){
		this.requests++
		this.totalRequests++
	}

	getTotalRequests(){
		return this.totalRequests
	}
}
