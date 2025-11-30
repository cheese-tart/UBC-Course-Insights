import { Log } from "@ubccpsc310/project-support";
import Server from "./rest/Server";
import fs from "fs";

const envVars = loadEnvFile(".env");
export function loadEnvFile(filePath: string) {
	if (fs.existsSync(filePath)) {
			const envFile = fs.readFileSync(filePath, 'utf8');

			const envVars = envFile.split('\n').reduce((acc: Record<string, any>, line: string) => {
					const [key, value] = line.split('=');
					acc[key] = value;
					return acc;
			}, {});

			return envVars;
	} else {
			console.error(`.env file not found at ${filePath}`);
			return {};
	}
}

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
	const port = envVars.MAIN_PORT;
	await app.initServer(port);
})();
