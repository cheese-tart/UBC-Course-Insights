import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightResult,
	InsightError,
	NotFoundError
} from "./IInsightFacade";
import DatasetPersistence from "./Dataset";

import fs from "fs-extra";

const directory: string = "data";
const file: string = directory + "/datasets.json";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private data: DatasetPersistence;

	constructor() {
		this.data = new DatasetPersistence();
		this.data.ensurePersistance();
	}

	private static checkId(id: string): boolean {
		return !id || id.trim() === "" || id.includes("_");
	}

	private static checkContent(content: string): boolean {
		// placeholder
		if (content != "base-64 string") {
			return true;
		} else {
			return false;
		}
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (InsightFacade.checkId(id)) {
			throw new InsightError('Invalid ID');
		}

		if (InsightFacade.checkContent(content)) {
			throw new InsightError('Invalid content');
		}
	}

	public async removeDataset(id: string): Promise<string> {
		if (InsightFacade.checkId(id)) {
			throw new InsightError('Invalid ID');
		// placeholder
		} else if ("id not found") {
			throw new NotFoundError();
		} else {
			await fs.remove(file);
			return id;
		}
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::listDatasets is unimplemented!`);
	}
}
