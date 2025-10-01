import { InsightDatasetKind } from "./IInsightFacade";

import fs from "fs-extra";

export interface Section {
	uuid: string;
	id: string;
	title: string;
	instructor: string;
	dept: string;
	year: number;
	avg: number;
	pass: number;
	fail: number;
	audit: number;
}

export interface Dataset {
	id: string;
	kind: InsightDatasetKind;
	content: Section[];
}

const directory: string = "data";
const file: string = directory + "/datasets.json";

export default class DatasetPersistence {
	private datasets: Dataset[];

	constructor() {
		this.datasets = [];
	}

	public async addDataset(dataset: Dataset): Promise<void> {
		this.datasets.push(dataset);
	}

	public async ensurePersistance(): Promise<void> {
		try {
			await fs.ensureDir(directory);
			await fs.ensureFile(file);
		} catch (error) {
			// idk what to do lol
		}
	}
}
