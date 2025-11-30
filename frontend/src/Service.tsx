import type { InsightDataset, InsightResult } from "../../src/controller/IInsightFacade.ts";

const BASE_URL = "http://localhost:50067";

export async function putDataset(id: string, kind: string, file: File): Promise<string[]> {
	try {
		const res = await fetch(`${BASE_URL}/dataset/${id}/${kind}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/zip"
			},
			body: await file.arrayBuffer()
		});

		if (!res.ok) {
			const errorText = await res.text();
			let errorMessage;
			try {
				const errorJson = JSON.parse(errorText);
				errorMessage = errorJson.error || `Server error: ${res.status} ${res.statusText}`;
			} catch {
				errorMessage = `Server error: ${res.status} ${res.statusText}`;
			}
			throw new Error(errorMessage);
		}

		const json = await res.json();
		if (json.error) {
			throw new Error(json.error);
		}
		return json.result as string[];
	} catch (err) {
		if (err instanceof TypeError && err.message.includes('fetch')) {
			throw new Error(`Cannot connect to backend server at ${BASE_URL}. Please ensure the backend server is running on port 50067.`);
		}
		throw err;
	}
}

export async function deleteDataset(id: string): Promise<string> {
	const res = await fetch(`${BASE_URL}/dataset/` + id, {
		method: `DELETE`
	});

	const json = await res.json();
	if (json.error) {
		throw new Error(json.error);
	} else if (json.result !== id) {
		throw new Error("Removed id did not match expected id");
	}

	return json.result as string;
}

export async function requestDatasets(): Promise<InsightDataset[]> {
	try {
		const res = await fetch(`${BASE_URL}/datasets`, {
			method: `GET`
		});

		if (!res.ok) {
			const errorText = await res.text();
			let errorMessage;
			try {
				const errorJson = JSON.parse(errorText);
				errorMessage = errorJson.error || `Server error: ${res.status} ${res.statusText}`;
			} catch {
				errorMessage = `Server error: ${res.status} ${res.statusText}`;
			}
			throw new Error(errorMessage);
		}

		const json = await res.json();
		if (json.error) {
			throw new Error(json.error);
		}

		return json.result as InsightDataset[];
	} catch (err) {
		if (err instanceof TypeError && err.message.includes('fetch')) {
			throw new Error(`Cannot connect to backend server at ${BASE_URL}. Please ensure the backend server is running on port 50067.`);
		}
		throw err;
	}
}

export async function postQuery(query: unknown): Promise<InsightResult[]> {
	const res = await fetch(`${BASE_URL}/query`, {
		method: `POST`,
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(query)
	});

	const json = await res.json();
	if (json.error) {
		throw new Error(json.error);
	}

	return json.result as InsightResult[];
}
