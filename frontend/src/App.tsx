import { useState, useEffect } from 'react';
import './App.css';
import { postQuery, putDataset, deleteDataset, requestDatasets } from './Service';
import type { InsightResult, InsightDataset } from '../../src/controller/IInsightFacade.ts';
import { InsightDatasetKind } from '../../src/controller/IInsightFacade.ts';

function App() {
	// Query state
	const [queryInput, setQueryInput] = useState<string>('');
	const [results, setResults] = useState<InsightResult[]>([]);
	const [queryError, setQueryError] = useState<string | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [currentPage, setCurrentPage] = useState<number>(1);
	const resultsPerPage = 10;

	// Dataset management state
	const [datasets, setDatasets] = useState<InsightDataset[]>([]);
	const [datasetId, setDatasetId] = useState<string>('');
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
			if (err instanceof Error && err.message.includes('Cannot connect to backend server')) {
				setDatasetError('Backend server is not running. Please start the backend server with "npm start" in the root directory.');
			} else {
				console.error('Failed to load datasets:', err);
			}
		}
	};

	const handleExecuteQuery = async () => {
		if (!queryInput.trim()) {
			setQueryError('Please enter a query');
			return;
		}

		setLoading(true);
		setQueryError(null);
		setCurrentPage(1);

		try {
			const parsedQuery = JSON.parse(queryInput);
			const queryResults = await postQuery(parsedQuery);
			setResults(queryResults);
		} catch (err) {
			if (err instanceof SyntaxError) {
				setQueryError(`Invalid JSON: ${err.message}`);
			} else if (err instanceof Error) {
				setQueryError(`Query error: ${err.message}`);
			} else {
				setQueryError('An unknown error occurred');
			}
			setResults([]);
		} finally {
			setLoading(false);
		}
	};

	const handleAddDataset = async () => {
		if (!datasetId.trim()) {
			setDatasetError('Please enter a dataset ID');
			return;
		}

		if (!selectedFile) {
			setDatasetError('Please select a zip file to upload');
			return;
		}

		setDatasetLoading(true);
		setDatasetError(null);
		setDatasetSuccess(null);

		try {
			await putDataset(datasetId.trim(), InsightDatasetKind.Sections, selectedFile);
			setDatasetSuccess(`Dataset "${datasetId.trim()}" added successfully!`);
			setDatasetId('');
			setSelectedFile(null);
			// Reset file input
			const fileInput = document.getElementById('file-input') as HTMLInputElement;
			if (fileInput) {
				fileInput.value = '';
			}
			// Reload datasets to update UI without page refresh
			await loadDatasets();
		} catch (err) {
			if (err instanceof Error) {
				setDatasetError(`Failed to add dataset: ${err.message}`);
			} else {
				setDatasetError('An unknown error occurred while adding the dataset');
			}
		} finally {
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
				setDatasetError('An unknown error occurred while removing the dataset');
			}
		} finally {
			setDatasetLoading(false);
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			if (file.name.endsWith('.zip')) {
				setSelectedFile(file);
				setDatasetError(null);
			} else {
				setDatasetError('Please select a .zip file');
				setSelectedFile(null);
			}
		}
	};

	const totalPages = Math.ceil(results.length / resultsPerPage);
	const startIndex = (currentPage - 1) * resultsPerPage;
	const endIndex = startIndex + resultsPerPage;
	const currentResults = results.slice(startIndex, endIndex);

	// Extract column names from results
	const getColumns = (): string[] => {
		if (results.length === 0) return [];
		const allKeys = new Set<string>();
		results.forEach(result => {
			Object.keys(result).forEach(key => allKeys.add(key));
		});
		return Array.from(allKeys).sort();
	};

	const columns = getColumns();

	return (
		<div className="app-container">
			<h1>UBC Insights Query Interface</h1>
			
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
						{datasetLoading ? 'Adding...' : 'Add Dataset'}
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
								<div key={dataset.id} className="dataset-card">
									<div className="dataset-info">
										<div className="dataset-id">
											<strong>ID:</strong> {dataset.id}
										</div>
										<div className="dataset-details">
											<span className="dataset-kind">{dataset.kind}</span>
											<span className="dataset-rows">{dataset.numRows} rows</span>
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

					{/* Query Section */}
					<div className="query-section">
						<label htmlFor="query-input" className="query-label">
							Enter Query (JSON):
						</label>
						<textarea
							id="query-input"
							className="query-input"
							value={queryInput}
							onChange={(e) => setQueryInput(e.target.value)}
							placeholder='{"WHERE": {...}, "OPTIONS": {...}}'
							rows={10}
						/>
						<button 
							className="execute-button" 
							onClick={handleExecuteQuery}
							disabled={loading}
						>
							{loading ? 'Executing...' : 'Execute Query'}
						</button>
					</div>

					{queryError && (
						<div className="error-message">
							<strong>Error:</strong> {queryError}
						</div>
					)}
				</div>

				{/* Right Panel: Results Table */}
				<div className="right-panel">
					{results.length > 0 && (
						<div className="results-section">
							<div className="results-header">
								<h2>Query Results</h2>
								<p className="results-count">
									Total Results: <strong>{results.length}</strong>
									{results.length > resultsPerPage && (
										<span> (Showing {startIndex + 1}-{Math.min(endIndex, results.length)} of {results.length})</span>
									)}
								</p>
							</div>

							{totalPages > 1 && (
								<div className="pagination">
									<button
										onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
										disabled={currentPage === 1}
										className="page-button"
									>
										Previous
									</button>
									<span className="page-info">
										Page {currentPage} of {totalPages}
									</span>
									<button
										onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
										disabled={currentPage === totalPages}
										className="page-button"
									>
										Next
									</button>
								</div>
							)}

							<div className="table-container">
								<table className="results-table">
									<thead>
										<tr>
											{columns.map((column) => (
												<th key={column}>{column}</th>
											))}
										</tr>
									</thead>
									<tbody>
										{currentResults.map((result, index) => (
											<tr key={startIndex + index}>
												{columns.map((column) => (
													<td key={column}>
														{result[column] !== undefined ? String(result[column]) : ''}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{totalPages > 1 && (
								<div className="pagination pagination-bottom">
									<button
										onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
										disabled={currentPage === 1}
										className="page-button"
									>
										Previous
									</button>
									<span className="page-info">
										Page {currentPage} of {totalPages}
									</span>
									<button
										onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
										disabled={currentPage === totalPages}
										className="page-button"
									>
										Next
									</button>
								</div>
							)}
						</div>
					)}
					{results.length === 0 && !loading && (
						<div className="no-results">
							<p>No results to display. Execute a query to see results here.</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default App;
