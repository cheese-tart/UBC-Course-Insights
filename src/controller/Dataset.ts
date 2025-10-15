import {InsightDataset, InsightError} from "./IInsightFacade";

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
	content: Section[] | Room[];
}

const directory: string = "data";
const file: string = directory + "/datasets.json";

export class DatasetPersistence {
	private datasets: Dataset[];

	constructor() {
		this.datasets = [];
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

	public async ensurePersistence(): Promise<void> {
		try {
			await fs.ensureDir(directory);
			await fs.ensureFile(file);
			const stats = await fs.stat(file);
			if (stats.size === 0) {
				await fs.writeJson(file, []);
			}
		} catch (error) {
			console.error('penis');
		}
	}

	public async loadData(): Promise<void> {
		try {
			this.datasets = await fs.readJson(file);
		} catch (error) {
			console.error('penis');
		}
	}

	public async saveData(): Promise<void> {
		try {
			await fs.writeJson(file, this.datasets);
		} catch {
			console.error('penis');
		}
	}
}

export class DataProcessor {
	private static async unzipData(content: string): Promise<JSZip> {
		const unzipped = new JSZip();
		await unzipped.loadAsync(content, { base64: true });
		return unzipped;
	}

	private static extractCourseFiles(unzipped: JSZip): JSZipObject[] {
		return Object.values(unzipped.files).filter(file => {
			if (file.dir) return false;
			if (!file.name.startsWith('courses/')) return false;
			if (!file.name.endsWith('.json')) return false;

			// check that course file isnt within another folder e.g. courses/lucas_ragebait/cpsc310.json
			const pathParts = file.name.split('/');
			return pathParts.length === 2;
		});
	}

	private static async processFiles(files: JSZipObject[]): Promise<any[]> {
		// stringify JSZip objects and convert string to JS object
		const unparsed_sections = [];
		for (const file of files) {
			const text = await file.async('text');
			unparsed_sections.push(text);
		}
		const parsed_sections = [];
		for (const section of unparsed_sections) {
			parsed_sections.push(JSON.parse(section).result);
		}
		return parsed_sections;
	}

	public static validateSections(parsed_sections: any[]): Section[] {
		const sections: Section[] = [];
		for (const section of parsed_sections) {
			sections.push({
				uuid: section.id,
				id: section.Course,
				title: section.Title,
				instructor: section.Professor,
				dept: section.Subject,
				year: section.Section === "overall" ? 1900 : section.Year,
				avg: section.Avg,
				pass: section.Pass,
				fail: section.Fail,
				audit: section.Audit
			})
		}

		if (sections.length === 0) {
			throw new InsightError('Dataset has no valid sections');
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
