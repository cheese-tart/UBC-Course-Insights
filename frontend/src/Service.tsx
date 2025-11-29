import type { InsightDataset, InsightResult } from "../../src/controller/IInsightFacade.ts";

const BASE_URL = "http://localhost:67";

export async function putDataset(id: string, kind: string, file: File) {

}

export async function deleteDataset(id: string): Promise<string> {
	const res = await fetch(`${BASE_URL}/dataset/` + id, {
		method: `DELETE`
	});

	const json = await res.json();
	if (json.error) {
		throw new Error(json.error);
	} else if (json.result !== id) {
		throw new Error();
	}

	return json.result;
}

export async function requestDatasets(): Promise<InsightDataset[]> {
	const res = await fetch(`${BASE_URL}/datasets`, {
		method: `GET`
	});

	const json = await res.json();
	if (json.error) {
		throw new Error(json.error);
	}

	return json.result as InsightDataset[];
}
