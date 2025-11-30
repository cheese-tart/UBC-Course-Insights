import type { InsightDataset, InsightResult } from "../../../src/controller/IInsightFacade.ts";
import { useEffect, useState } from "react";
import { TextField } from "@mui/material";
import { Bar } from "react-chartjs-2";
import { postQuery } from "../Service.tsx";

export default function Graph3(props: { dataset: InsightDataset }) {
	const id = props.dataset.id;
	const [data, setData] = useState<{ instructor: string; avg: number }[]>([]);
	const [course, setCourse] = useState<string>("");

	const getCourses = async () => {
		const query = await getCourseAvgsByProf(id, course);

		if (!query || query.length === 0) {
			setData([]);
			return;
		} else {
			setData(
				query!
					.map((x) => ({
						instructor: x[id + "_instructor"] as string,
						avg: x.avgMark as number,
					}))
					.filter((x) => x.instructor !== "")
			);
		}
	};

	useEffect(() => {
		getCourses();
	}, [props.dataset, props.dataset.id, course]);

	return (
		<>
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
				}}
				label={"Enter a Course:"}
				helperText={"e.g. CPSC 110"}
				onChange={(e) => setCourse(e.target.value)}
			/>
			<Bar
				data={{
					labels: data.map((x) => x.instructor),
					datasets: [
						{
							label: "Course Average of All Sections Taught by the Instructor",
							data: data.map((x) => x.avg),
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
								text: "Instructor",
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

async function getCourseAvgsByProf(id: string, course: string): Promise<InsightResult[] | undefined> {
	const [dept, num] = course.trim().toLowerCase().split(" ");

	try {
		return await postQuery({
			WHERE: {
				AND: [
					{
						IS: {
							[id + "_id"]: num,
						},
					},
					{
						IS: {
							[id + "_dept"]: dept,
						},
					},
				],
			},
			OPTIONS: {
				COLUMNS: [id + "_id", id + "_dept", "avgMark", id + "_instructor"],
				ORDER: {
					dir: "DOWN",
					keys: ["avgMark"],
				},
			},
			TRANSFORMATIONS: {
				GROUP: [id + "_id", id + "_dept", id + "_instructor"],
				APPLY: [
					{
						avgMark: {
							AVG: id + "_avg",
						},
					},
				],
			},
		});
	} catch (e) {
		console.error((e as any)?.message ?? e);
		return undefined;
	}
}
