import type { InsightDataset, InsightResult } from "../../../src/controller/IInsightFacade.ts";
import { useEffect, useState } from "react";
import { Grid, TextField } from "@mui/material";
import { Bar } from "react-chartjs-2";
import { postQuery } from "../Service.tsx";

export default function Graph2(props: { dataset: InsightDataset }) {
	const id = props.dataset.id;
	const [data, setData] = useState<{ dept: string; id: string; avgMark: number }[]>([]);
	const [dept, setDept] = useState<string>("");
	const [avg, setAvg] = useState<number>(100);

	const getCourses = async () => {
		const query = await findDeptGpaBooster(id, dept);

		if (!query || query.length === 0) {
			setData([]);
		} else {
			setData(
				query!
					.filter((x) => Number(x.avgMark) > avg)
					.map((x) => ({
						dept: x[id + "_dept"] as string,
						id: x[id + "_id"] as string,
						avgMark: x.avgMark as number,
					}))
			);
		}
	};

	useEffect(() => {
		getCourses();
	}, [props.dataset, props.dataset.id, dept, avg]);

	return (
		<>
			<Grid>
				<TextField
					sx={{
						backgroundColor: "transparent",
						// label color
						"& .MuiInputLabel-root": {
							color: "gray",
						},
						"& .MuiInputLabel-root.Mui-focused": {
							color: "#646cff",
						},

						// actual input background
						"& .MuiOutlinedInput-root": {
							backgroundColor: "black",
							color: "gray",

							// default border
							"& .MuiOutlinedInput-notchedOutline": {
								borderColor: "gray",
							},

							// hover border
							"&:hover .MuiOutlinedInput-notchedOutline": {
								borderColor: "#646cff",
							},

							// focused border
							"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
								borderColor: "#646cff",
							},
						},

						// helper text color (e.g. "e.g. CPSC 110")
						"& .MuiFormHelperText-root": {
							color: "gray",
						},
						mx: 3,
					}}
					label={"Enter Course Code:"}
					helperText={"e.g. CPSC"}
					onChange={(e) => setDept(e.target.value)}
				/>
				<TextField
					sx={{
						backgroundColor: "transparent",
						// label color
						"& .MuiInputLabel-root": {
							color: "gray",
						},
						"& .MuiInputLabel-root.Mui-focused": {
							color: "#646cff",
						},

						// actual input background
						"& .MuiOutlinedInput-root": {
							backgroundColor: "black",
							color: "gray",

							// default border
							"& .MuiOutlinedInput-notchedOutline": {
								borderColor: "gray",
							},

							// hover border
							"&:hover .MuiOutlinedInput-notchedOutline": {
								borderColor: "#646cff",
							},

							// focused border
							"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
								borderColor: "#646cff",
							},
						},

						// helper text color (e.g. "e.g. CPSC 110")
						"& .MuiFormHelperText-root": {
							color: "gray",
						},
						mx: 3,
					}}
					label={"Enter Grade in %:"}
					helperText={"e.g. 67"}
					onChange={(e) => setAvg(Number(e.target.value))}
				/>
			</Grid>
			<Bar
				data={{
					labels: data.map((x) => x.dept + " " + x.id),
					datasets: [
						{
							label: "Course Average of All Sections",
							data: data.map((x) => x.avgMark),
							backgroundColor: "#646cff",
							borderColor: "lightgray",
						},
					],
				}}
				options={{
					responsive: true,
					scales: {
						x: {
							title: {
								display: true,
								text: "Course Code and Number",
								color: "gray",
								font: { size: 16 },
							},
							grid: {
								color: "gray", // grid line color
							},
							ticks: {
								color: "gray",
								autoSkip: false,
								maxRotation: 90,
								minRotation: 0,
							},
						},
						y: {
							title: {
								display: true,
								text: "Average Grade in %",
								color: "gray",
								font: { size: 14 },
							},
							grid: {
								color: "gray",
							},
							ticks: {
								color: "gray",
							},
						},
					},
				}}
			/>
		</>
	);
}

async function findDeptGpaBooster(id: string, dept: string): Promise<InsightResult[] | undefined> {
	const subj = dept.trim().toLowerCase();

	try {
		return await postQuery({
			WHERE: {
				IS: {
					[id + "_dept"]: subj,
				},
			},
			OPTIONS: {
				COLUMNS: [id + "_dept", id + "_id", "avgMark"],
				ORDER: {
					dir: "DOWN",
					keys: ["avgMark"],
				},
			},
			TRANSFORMATIONS: {
				GROUP: [id + "_dept", id + "_id"],
				APPLY: [
					{
						avgMark: { AVG: id + "_avg" },
					},
				],
			},
		});
	} catch (e) {
		console.error((e as any)?.message ?? e);
		return undefined;
	}
}
