import { Log } from "@ubccpsc310/project-support";
import Server from "./rest/Server";
import fs from "fs";

const envVars = loadEnvFile(".env");
export function loadEnvFile(filePath: string) {
	if (fs.existsSync(filePath)) {
			return fs.readFileSync(filePath, 'utf8').split('\n').reduce((acc: Record<string, any>, line: string) => {
				const [key, value] = line.split('=');
				acc[key] = value;
				return acc;
			}, {});
	} else {
			console.error(`.env file not found at ${filePath}`);
			return {};
	}
}

export class App {
	public async initServer(port: number): Promise<void> {
		Log.info(`App.initServer(${port}) - start`);
		const server = new Server(port);
		return server.start().then(() => {
			Log.info(`App.initServer(${port}) - started`);
		}).catch((err: Error) => {
			Log.error(`App.initServer(${port}) - ERROR: ${err.message}`);
		});
	}
}

Log.info("App - starting");
const app = new App();
(async (): Promise<void> => {
	const port = envVars.MAIN_PORT ? Number(envVars.MAIN_PORT) : 50067;
	if (!port || isNaN(port)) {
		console.error("Invalid port number. Using default port 50067.");
		await app.initServer(50067);
	} else {
		await app.initServer(port);
	}
})();
