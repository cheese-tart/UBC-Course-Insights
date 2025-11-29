import { Log } from "@ubccpsc310/project-support";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import * as http from "http";

import {
	InsightDatasetKind,
	InsightDataset,
	NotFoundError,
	InsightError
} from "../controller/IInsightFacade";
import InsightFacade from "../controller/InsightFacade";

export default class Server {
	private readonly port: number;
	private express: Application;
	private server: http.Server | undefined;
	private facade: InsightFacade;

	constructor(port: number) {
		Log.info();
		this.port = port;
		this.express = express();
		this.facade = new InsightFacade();

		this.registerMiddleware();
		this.registerRoutes();
	}

	private registerMiddleware(): void {
		// JSON parser must be place before raw parser because of wildcard matching done by raw parser below
		this.express.use(express.json());
		this.express.use(express.raw({ type: "application/*", limit: "10mb" }));

		// enable cors in request headers to allow cross-origin HTTP requests
		this.express.use(cors());
	}

	private registerRoutes(): void {
		this.express.put("/dataset/:id/:kind", this.putDataset.bind(this));
		this.express.delete("/dataset/:id", this.deleteDataset.bind(this));
		this.express.get("/datasets", this.getDatasets.bind(this));
		this.express.post("/query", this.postQuery.bind(this));
	}

	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			Log.info();
			if (this.server) {
				Log.error();
				reject();
			} else {
				this.server = this.express.listen(this.port, () => {
					Log.info();
					resolve();
				}).on("error", (err: Error) => {
					Log.error();
					reject(err);
				});
			}
		});
	}

	public async stop(): Promise<void> {
		Log.info();
		return new Promise((resolve, reject) => {
			if (!this.server) {
				Log.error();
				reject();
			} else {
				this.server.close(() => {
					Log.info();
					resolve();
				});
			}
		});
	}

	private async putDataset(req: Request, res: Response): Promise<void> {
		if (req.params.kind !== InsightDatasetKind.Rooms && req.params.kind !== InsightDatasetKind.Sections) {
			throw new InsightError("Invalid dataset kind");
		}
		try {
			const content: string = req.body.toString("base64");
			const response = await this.facade.addDataset(req.params.id, content, req.params.kind as InsightDatasetKind);
			res.status(StatusCodes.OK).json({result: response});
		} catch (err) {
			Log.error();
			res.status(StatusCodes.BAD_REQUEST).json({error: (err as any)?.message ?? err});
		}
	}

	private async deleteDataset(req: Request, res: Response): Promise<void> {
		try {
			Log.info();
			const response = await this.facade.removeDataset(req.params.id);
			res.status(StatusCodes.OK).json({result: response});
		} catch (err) {
			if (err instanceof NotFoundError) {
				res.status(StatusCodes.NOT_FOUND).json({error: (err as any)?.message ?? err});
			} else {
				res.status(StatusCodes.BAD_REQUEST).json({error: (err as any)?.message ?? err});
			}
		}
	}

	private async getDatasets(_req: Request, res: Response): Promise<void> {
		try {
			Log.info();
			const response: InsightDataset[] = await this.facade.listDatasets();
			res.status(StatusCodes.OK).json({result: response});
		} catch (err) {
			res.status(StatusCodes.BAD_REQUEST).json({error: (err as any)?.message ?? err});
		}
	}

	private async postQuery(req: Request, res: Response): Promise<void> {
		try {
			Log.info();
			const response = await this.facade.performQuery(req.body);
			res.status(StatusCodes.OK).json({result: response});
		} catch (err) {
			Log.error();
			res.status(StatusCodes.BAD_REQUEST).json({error: (err as any)?.message ?? err});
		}
	}
}
