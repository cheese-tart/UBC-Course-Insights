import React, { useState, useEffect } from "react";
import { Stack, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { Chart as ChartJS, CategoryScale } from "chart.js/auto";

import "./App.css";
import { putDataset, deleteDataset, requestDatasets } from "./Service";
import type { InsightDataset } from "../../src/controller/IInsightFacade.ts";
import { InsightDatasetKind } from "../../src/controller/IInsightFacade.ts";
import Graph1 from "../../frontend/src/components/Graph1.tsx";
import Graph2 from "../../frontend/src/components/Graph2.tsx";
import Graph3 from "../../frontend/src/components/Graph3.tsx";
import Graph4 from "../../frontend/src/components/Graph4.tsx";
import Graph5 from "../../frontend/src/components/Graph5.tsx";

ChartJS.register(CategoryScale);

function App() {
	// Dataset management state
	const [datasets, setDatasets] = useState<InsightDataset[]>([]);
	const [datasetId, setDatasetId] = useState<string>("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [selectedDataset, setSelectedDataset] = useState<InsightDataset | null>(null);
	const [datasetError, setDatasetError] = useState<string | null>(null);
	const [datasetSuccess, setDatasetSuccess] = useState<string | null>(null);
	const [datasetLoading, setDatasetLoading] = useState<boolean>(false);

	// Load datasets on component mount
	useEffect(() => {
		loadDatasets();
	}, []);

	const loadDatasets = async () => {
		try {
			const loadedDatasets = await requestDatasets();
			setDatasets(loadedDatasets);
		} catch (err) {
			if (err instanceof Error && err.message.includes("Cannot connect to backend server")) {
				setDatasetError(
					'Backend server is not running. Please start the backend server with "npm start" in the root directory.'
				);
			} else {
				console.error("Failed to load datasets:", err);
			}
		}
	};

	const handleAddDataset = async () => {
		if (!datasetId.trim()) {
			setDatasetError("Please enter a dataset ID");
			return;
		}

		if (!selectedFile) {
			setDatasetError("Please select a zip file to upload");
			return;
		}

		setDatasetLoading(true);
		setDatasetError(null);
		setDatasetSuccess(null);

		try {
			await putDataset(datasetId.trim(), InsightDatasetKind.Sections, selectedFile);
			setDatasetSuccess(`Dataset "${datasetId.trim()}" added successfully!`);
			setDatasetId("");
			setSelectedFile(null);
			// Reset file input
			const fileInput = document.getElementById("file-input") as HTMLInputElement;
			if (fileInput) {
				fileInput.value = "";
			}
			// Reload datasets to update UI without page refresh
			await loadDatasets();
		} catch (err) {
			if (err instanceof Error) {
				setDatasetError(`Failed to add dataset: ${err.message}`);
			} else {
				setDatasetError("An unknown error occurred while adding the dataset");
			}
		} finally {
			setSelectedDataset(null);
			setDatasetLoading(false);
		}
	};

	const handleRemoveDataset = async (id: string) => {
		setDatasetLoading(true);
		setDatasetError(null);
		setDatasetSuccess(null);

		try {
			await deleteDataset(id);
			setDatasetSuccess(`Dataset "${id}" removed successfully!`);
			// Reload datasets to update UI without page refresh
			await loadDatasets();
		} catch (err) {
			if (err instanceof Error) {
				setDatasetError(`Failed to remove dataset: ${err.message}`);
			} else {
				setDatasetError("An unknown error occurred while removing the dataset");
			}
		} finally {
			setSelectedDataset(null);
			setDatasetLoading(false);
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			if (file.name.endsWith(".zip")) {
				setSelectedFile(file);
				setDatasetError(null);
			} else {
				setDatasetError("Please select a .zip file");
				setSelectedFile(null);
			}
		}
	};

	const Queries = (props: { dataset: InsightDataset }) => {
		return (
			<Stack spacing={2}>
				<h3>Selected "{props.dataset.id}" to query</h3>
				<Graphs dataset={props.dataset} />
			</Stack>
		);
	};

	type Query = 1 | 2 | 3 | 4 | 5;

	const Graphs = (props: { dataset: InsightDataset }) => {
		const [query, setQuery] = useState<Query | null>(null);

		return (
			<>
				<FormControl
					sx={{
						"&:hover .MuiInputLabel-root": {
							color: "#646cff",
						},
					}}
				>
					<InputLabel
						sx={{
							color: "gray",
							"&.Mui-focused": {
								color: "#646cff",
							},
						}}
					>
						Select Insight
					</InputLabel>
					<Select
						label="Select Insight"
						sx={{
							backgroundColor: "black",
							color: "gray",
							"& .MuiOutlinedInput-notchedOutline": {
								borderColor: "gray",
							},
							"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
								borderColor: "#646cff",
							},
							"&:hover .MuiOutlinedInput-notchedOutline": {
								borderColor: "#646cff",
							},
						}}
						value={query}
						onChange={(e) => setQuery(e.target.value as any)}
					>
						<MenuItem value={1}>Gregor</MenuItem>
						<MenuItem value={2}>Find Courses With Average Exceeding Grade Threshold by Department</MenuItem>
						<MenuItem value={3}>Compare Averages of a Course by Instructor</MenuItem>
						<MenuItem value={4}>Is Computer Science Getting Oversaturated?</MenuItem>
						<MenuItem value={5}>Are We Getting Dumber Each Year?</MenuItem>
					</Select>
				</FormControl>
				{query === 1 ? (
					<Graph1 dataset={props.dataset} />
				) : query === 2 ? (
					<Graph2 dataset={props.dataset} />
				) : query === 3 ? (
					<Graph3 dataset={props.dataset} />
				) : query === 4 ? (
					<Graph4 dataset={props.dataset} />
				) : query === 5 ? (
					<Graph5 dataset={props.dataset} />
				) : (
					<></>
				)}
			</>
		);
	};

	return (
		<div className="app-container">
			<h1>UBC Course Insights</h1>

			<div className="main-layout">
				{/* Left Panel: Dataset Management and Query Input */}
				<div className="left-panel">
					{/* Dataset Management Section */}
					<div className="dataset-section">
						<h2>Dataset Management</h2>

						<div className="dataset-form">
							<div className="form-group">
								<label htmlFor="dataset-id" className="form-label">
									Dataset ID:
								</label>
								<input
									id="dataset-id"
									type="text"
									className="form-input"
									value={datasetId}
									onChange={(e) => setDatasetId(e.target.value)}
									placeholder="Enter dataset ID (no underscores allowed)"
									disabled={datasetLoading}
								/>
							</div>

							<div className="form-group">
								<label htmlFor="file-input" className="form-label">
									Select Zip File:
								</label>
								<input
									id="file-input"
									type="file"
									accept=".zip"
									className="file-input"
									onChange={handleFileChange}
									disabled={datasetLoading}
								/>
								{selectedFile && (
									<div className="file-info">
										Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
									</div>
								)}
							</div>

							<button
								className="add-dataset-button"
								onClick={handleAddDataset}
								disabled={datasetLoading || !datasetId.trim() || !selectedFile}
							>
								{datasetLoading ? "Adding..." : "Add Dataset"}
							</button>
						</div>

						{datasetError && (
							<div className="error-message">
								<strong>Error:</strong> {datasetError}
							</div>
						)}

						{datasetSuccess && (
							<div className="success-message">
								<strong>Success:</strong> {datasetSuccess}
							</div>
						)}

						<div className="datasets-list">
							<h3>Current Datasets</h3>
							{datasets.length === 0 ? (
								<p className="no-datasets">No datasets added yet.</p>
							) : (
								<div className="datasets-grid">
									{datasets.map((dataset) => (
										<div
											key={dataset.id}
											className={`dataset-card ${selectedDataset === dataset ? "active" : ""}`}
											onClick={() => setSelectedDataset(dataset)}
										>
											<div className="dataset-info">
												<div className="dataset-id">
													<strong>ID:</strong> {dataset.id}
												</div>
												<div className="dataset-details">
													<span className="dataset-rows">{dataset.numRows} Sections</span>
												</div>
											</div>
											<button
												className="remove-button"
												onClick={(e) => {
													e.stopPropagation();
													handleRemoveDataset(dataset.id);
												}}
												disabled={datasetLoading}
											>
												Remove
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Right Panel: Results Table */}
				<div className="right-panel">
					<div>
						{datasets.length === 0 ? (
							<h3>Upload a dataset!</h3>
						) : selectedDataset === null ? (
							<h3>Select a dataset to query</h3>
						) : (
							<Queries dataset={selectedDataset} />
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
