import { InsightDataset, InsightError } from "./IInsightFacade";

import fs from "fs-extra";
import JSZip, { JSZipObject } from "jszip";

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

export interface Room {
	// i have a fat boner
}

export interface Dataset extends InsightDataset {
	content: Section[];
}

const directory: string = "data";
const file: string = directory + "/datasets.json";

export class DatasetPersistence {
	private datasets: Dataset[];
	private dataLoaded: boolean;

	constructor() {
		this.datasets = [];
		this.dataLoaded = false;
	}

	public addDataset(dataset: Dataset) {
		this.datasets.push(dataset);
	}

	public getDatasets(): Dataset[] {
		return this.datasets;
	}

	public setDatasets(datasets: Dataset[]) {
		this.datasets = datasets;
	}

	private static async ensurePersistence(): Promise<void> {
		try {
			await fs.ensureDir(directory);
			await fs.ensureFile(file);
			const stats = await fs.stat(file);
			if (stats.size === 0) {
				await fs.writeJson(file, []);
			}
		} catch (error) {
			console.error("penis");
		}
	}

	public async loadData(): Promise<void> {
		await DatasetPersistence.ensurePersistence();

		if (!this.dataLoaded) {
			try {
				this.datasets = await fs.readJson(file);
				this.dataLoaded = true;
			} catch (error) {
				console.error("penis");
			}
		}
	}

	public async saveData(): Promise<void> {
		try {
			await fs.writeJson(file, this.datasets);
		} catch {
			console.error("penis");
		}
	}

	public async getSectionsById(id: string): Promise<Section[]> {
		await this.loadData();
		for (const dataset of this.datasets) {
			if (dataset.id === id) {
				return dataset.content;
			}
		}
		throw new InsightError(`Dataset with id '${id}' not found`);
	}
}

export class DataProcessor {
	private static async unzipData(content: string): Promise<JSZip> {
		const unzipped = new JSZip();
		try {
			await unzipped.loadAsync(content, { base64: true });
		} catch (error) {
			throw new InsightError("content is not base64 encoded string");
		}
		return unzipped;
	}

	private static extractCourseFiles(unzipped: JSZip): JSZipObject[] {
		return Object.values(unzipped.files).filter((file) => !file.dir && file.name.startsWith("courses/"));
	}

	private static async processFiles(files: JSZipObject[]): Promise<any[]> {
		// stringify JSZip objects and convert string to JS object
		const parsed_sections = [];
		for (const file of files) {
			const text = await file.async("text");

			let parsed: any;
			try {
				parsed = JSON.parse(text);
			} catch {
				continue;
			}
			if (!parsed || !Array.isArray(parsed.result)) {
				continue;
			}
			for (const res of parsed.result) {
				parsed_sections.push(res);
			}
		}

		return parsed_sections;
	}

	public static validateSections(parsed_sections: any[]): any[] {
		const sections: any[] = [];
		for (const section of parsed_sections) {
			sections.push({
				uuid: String(section.id),
				id: section.Course,
				title: section.Title,
				instructor: section.Professor,
				dept: section.Subject,
				year: section.Section === "overall" ? 1900 : Number(section.Year),
				avg: section.Avg,
				pass: section.Pass,
				fail: section.Fail,
				audit: section.Audit,
			});
		}

		if (sections.length === 0) {
			throw new InsightError("Dataset has no valid sections");
		}
		return sections;
	}

	public static async getSections(content: string) {
		const unzipped = await DataProcessor.unzipData(content);
		const files = DataProcessor.extractCourseFiles(unzipped);
		const sections = await DataProcessor.processFiles(files);
		return DataProcessor.validateSections(sections);
	}
}
