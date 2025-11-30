import { useState, useEffect } from "react";
import {Stack, FormControl, InputLabel, Select, MenuItem, TextField} from '@mui/material';
import {Chart as ChartJS, CategoryScale} from 'chart.js/auto';
import {Bar} from 'react-chartjs-2';

import "./App.css";
import { postQuery, putDataset, deleteDataset, requestDatasets } from "./Service";
import type { InsightResult, InsightDataset } from "../../src/controller/IInsightFacade.ts";
import { InsightDatasetKind } from "../../src/controller/IInsightFacade.ts";

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

	const Queries = (props: {
		dataset: InsightDataset;
	}) => {
		return (
			<Stack spacing={2}>
				<h3>Selected "{props.dataset.id}" to query</h3>
				<Graphs dataset={props.dataset}/>
			</Stack>
		);
	}

	enum Query {
		One,
		Two,
		Three,
		Four
	}

	const Graphs = (props: {
		dataset: InsightDataset;
	}) => {
		const id = props.dataset.id;
		const [query, setQuery] = useState<Query | null>(null);

		return (<>
			<FormControl>
				<InputLabel
					sx={{
					color: 'gray',
					'&.Mui-focused': {
						color: '#646cff'
					}}}>
					Select Insight
				</InputLabel>
				<Select
					sx={{
						backgroundColor: 'black',
						color: 'gray',
						'& .MuiOutlinedInput-notchedOutline': {
							borderColor: 'gray'
						},
						'&.Mui-focused .MuiOutlinedInput-notchedOutline': {
							borderColor: '#646cff'
						},
						'&:hover .MuiOutlinedInput-notchedOutline': {
							borderColor: '#646cff'
						}
					}}
					value={query}
					onChange={(e) => setQuery(e.target.value as any)}>
					<MenuItem
						value={Query.Three}>
						Compare Averages of a Course By Instructor
					</MenuItem>
				</Select>
			</FormControl>
			{query === Query.Three ?
			<Graph3 dataset={props.dataset}/> : <></>}
		</>);
	}

	const Graph1 = (props: {
		dataset: InsightDataset;
	}) => {
		const id = props.dataset.id;

		const getCourses = async () => {
			const query = gregorQuery(id);
		}
	}

	const gregorQuery = (id: string) => {

	}

	const Graph3 = (props: {
		dataset: InsightDataset;
	})=> {
		const id = props.dataset.id;
		const [data, setData] = useState<{instructor: string, avg: number}[]>([]);
		const [course, setCourse] = useState<string>("");

		const getCourses = async () => {
			const query = await getCourseAvgsByProf(id, course);
			if (query!.length !== 0) {
				setData(query!.map(x => ({
					instructor: x[id + "_instructor"] as string,
					avg: x.avgMark as number
				})).filter(x => x.instructor !== ""));
			} else {
				setData([]);
			}
		}

		useEffect(() => {
			getCourses();
		}, [props.dataset, course, props.dataset.id]);

		return (<>
			<TextField
				sx={{
					backgroundColor: 'transparent',
					// label color
					'& .MuiInputLabel-root': {
						color: 'gray',
					},
					'& .MuiInputLabel-root.Mui-focused': {
						color: '#646cff',
					},

					// actual input background
					'& .MuiOutlinedInput-root': {
						backgroundColor: 'black',
						color: 'gray',

						// default border
						'& .MuiOutlinedInput-notchedOutline': {
							borderColor: 'gray'
						},

						// hover border
						'&:hover .MuiOutlinedInput-notchedOutline': {
							borderColor: '#646cff'
						},

						// focused border
						'&.Mui-focused .MuiOutlinedInput-notchedOutline': {
							borderColor: '#646cff'
						}
					},

					// helper text color (e.g. "e.g. CPSC 110")
					'& .MuiFormHelperText-root': {
						color: 'gray'
					}
				}}
				label={"Enter a Course:"} helperText={"e.g. CPSC 110"}
				onChange={(e) => setCourse(e.target.value)}/>
			<Bar data={{
				labels: data.map(x => x.instructor),
				datasets: [
					{
						label: "Course Average of All Sections",
						data: data.map(x => x.avg),
						backgroundColor: '#646cff',
						borderColor: 'lightgray'
					}
				]
			}}
			 options={{
				 responsive: true,
				 scales: {
					 x: {
						 title: {
							 display: true,
							 text: 'Instructor',
							 color: 'gray',
							 font: {size: 14}
						 },
						 grid: {
							 color: "gray" // grid line color
						 },
						 ticks: {
							 color: "gray" // tick label color
						 }
					 },
					 y: {
						 title: {
							 display: true,
							 text: 'Average Grade in %',
							 color: 'gray',
							 font: {size: 14}
						 },
						 grid: {
							 color: "gray"
						 },
						 ticks: {
							 color: "gray"
						 }
					 }
				 }
			 }}/>
		</>);
	}

	const getCourseAvgsByProf = (id: string, course: string): Promise<InsightResult[] | undefined> => {
		const [dept, num] = course.trim().toLowerCase().split(" ");

		return postQuery({
			"WHERE": {
				"AND": [
					{
						"IS": {
							[id + "_id"]: num
						}
					},
					{
						"IS": {
							[id + "_dept"]: dept
						}
					}
				]
			},
			"OPTIONS": {
				"COLUMNS": [id + "_id", id + "_dept", "avgMark", id + "_instructor"],
				"ORDER": {
					"dir": "DOWN",
					"keys": ["avgMark"]
				}
			},
			"TRANSFORMATIONS": {
				"GROUP": [
					id + "_id", id + "_dept", id + "_instructor"
				],
				"APPLY": [
					{
						"avgMark": {
							"AVG": id + "_avg"
						}
					}
				]
			}
		}).then((res) => res).catch((e) => {
			console.error(e?.message ?? e);
			return undefined;
		});
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
													<span className="dataset-kind">{dataset.kind}</span>
													<span className="dataset-rows">{dataset.numRows} Courses</span>
												</div>
											</div>
											<button
												className="remove-button"
												onClick={() => handleRemoveDataset(dataset.id)}
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
						{datasets.length === 0 ? <h3>Upload a dataset!</h3> : selectedDataset === null ? <h3>Select a dataset to query</h3> : <Queries dataset={selectedDataset}/>}
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
