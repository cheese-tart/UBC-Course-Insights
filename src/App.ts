import { Log } from "@ubccpsc310/project-support";
import Server from "./rest/Server";

export class App {
	public async initServer(port: number): Promise<void> {
		Log.info();
		const server = new Server(port);
		return server.start().then(() => {
			Log.info();
		}).catch((err: Error) => {
			Log.error(err);
		});
	}
}

Log.info("App - starting");
const app = new App();
(async (): Promise<void> => {
	const port = 67;
	await app.initServer(port);
})();
