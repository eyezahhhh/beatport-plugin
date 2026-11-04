import {
	ConfigManager,
	ConfigManagerApiContext,
	ConfigNode,
	SectionConfigNode,
} from "@pipe-bomb/plugin-sdk";
import { BeatportApi, BeatportGenre } from "./cache/beatport.api.js";

export class BeatportConfigManager implements ConfigManager {
	private api!: ConfigManagerApiContext;

	private solverUrl: string | null = null;
	private genreIds: string | null = null;

	constructor(private readonly beatport: BeatportApi) {}

	async enable(configManagerApiContext: ConfigManagerApiContext) {
		this.api = configManagerApiContext;

		const solverUrl = await this.api.getValue("solverurl", "string", false);
		this.solverUrl = solverUrl?.trim() || null;

		const genreIds = await this.api.getValue("genreids", "string", false);
		this.genreIds = genreIds?.trim() || null;
	}

	getSolverUrl() {
		return this.solverUrl;
	}

	getGenreIds(): number[] {
		if (!this.genreIds) {
			return [];
		}

		const seen = new Set<number>();
		for (const value of this.genreIds.split(",")) {
			const id = Number(value.trim());
			if (Number.isInteger(id) && id > 0) {
				seen.add(id);
			}
		}

		return [...seen];
	}

	async getConfigOptions(): Promise<ConfigNode> {
		const allGenres = await this.beatport.getGenres();

		const enabledChartGenres = allGenres.filter((genre) =>
			this.genreIds?.includes(genre.id.toString()),
		);

		return {
			type: "section",
			children: [
				{
					type: "heading",
					size: "sm",
					content: "Charts",
				},
				{
					type: "search",
					id: "genreSearch",
					name: "Add a new genre",
					value: "",
					placeholder: "House",

					results: enabledChartGenres.length
						? {
								type: "section",
								children: enabledChartGenres.map((genre) =>
									this.createGenreSection(genre),
								),
							}
						: {
								type: "markdown",
								content:
									"No genres are selected. Search for one to enable the Top 100 chart",
							},
				},
				{
					type: "heading",
					size: "sm",
					content: "Cloudflare",
				},
				{
					type: "paragraph",
					content:
						"Beatport is protected by Cloudflare. A running FlareSolverr or Byparr instance is required to obtain the anonymous session token used to talk to Beatport's API.",
				},
				{
					type: "text",
					id: "solverurl",
					placeholder: "http://localhost:8191",
					value: this.solverUrl ?? "",
					name: "Solver URL",
				},
			],
		};

		// return {
		// 	type: "section",
		// 	children: [
		// 		{
		// 			type: "heading",
		// 			size: "sm",
		// 			content: "Charts",
		// 		},
		// 		{
		// 			type: "paragraph",
		// 			content:
		// 				"Enter a comma-separated list of Beatport genre IDs to create charts for (e.g. 1, 5, 11). Leave this empty to create no charts. The available genre IDs are logged when the create-charts task runs.",
		// 		},
		// 		{
		// 			type: "text",
		// 			id: "genreids",
		// 			placeholder: "1, 5, 11",
		// 			value: this.genreIds ?? "",
		// 			name: "Genre IDs",
		// 		},
		// 		{
		// 			type: "heading",
		// 			size: "sm",
		// 			content: "Cloudflare",
		// 		},
		// 		{
		// 			type: "paragraph",
		// 			content:
		// 				"Beatport is protected by Cloudflare. A running FlareSolverr or Byparr instance is required to obtain the anonymous session token used to talk to Beatport's API.",
		// 		},
		// 		{
		// 			type: "text",
		// 			id: "solverurl",
		// 			placeholder: "http://localhost:8191",
		// 			value: this.solverUrl ?? "",
		// 			name: "Solver URL",
		// 		},
		// 	],
		// };
	}

	async update(values: Record<string, any>): Promise<ConfigNode> {
		const { solverurl, genreids } = values;

		if (typeof solverurl == "string") {
			if (solverurl.trim()) {
				this.solverUrl = solverurl.trim();
				await this.api.setValue("solverurl", "string", this.solverUrl);
			} else {
				this.solverUrl = null;
				await this.api.delete("solverurl");
			}
		}

		if (typeof genreids == "string") {
			if (genreids.trim()) {
				this.genreIds = genreids.trim();
				await this.api.setValue("genreids", "string", this.genreIds);
			} else {
				this.genreIds = null;
				await this.api.delete("genreids");
			}
		}

		return this.getConfigOptions();
	}

	private createGenreSection(genre: BeatportGenre): SectionConfigNode {
		const included = !!this.genreIds?.includes(genre.id.toString());

		return {
			type: "section",
			background: "surface",
			horizontal: true,
			children: [
				{
					type: "button",
					id: `genre.${genre.id}.${included ? "remove" : "add"}`,
					content: included ? "Remove" : "Add",
				},
				{
					type: "markdown",
					content: genre.name,
				},
			],
		};
	}

	async search(id: string, query: string): Promise<ConfigNode> {
		if (id == "genreSearch") {
			query = query.toLowerCase();

			const allGenres = await this.beatport.getGenres();

			const genres = allGenres.filter(
				(genre) =>
					genre.name.toLowerCase().includes(query) ||
					genre.slug.toLowerCase().includes(query) ||
					genre.id.toString().includes(query),
			);

			if (!genres.length) {
				return {
					type: "markdown",
					content:
						"No genres matched your query. Browse genres on [Beatport.com](https://www.beatport.com)",
				};
			}

			return {
				type: "section",
				children: genres.map((genre) => this.createGenreSection(genre)),
			};
		}

		throw new Error("Unknown ID");
	}

	async onButtonPress(id: string): Promise<ConfigNode> {
		console.log({ id });

		const parts = id.split(".");
		if (
			parts.length == 3 &&
			parts[0] == "genre" &&
			(parts[2] == "add" || parts[2] == "remove")
		) {
		}

		return {
			type: "markdown",
			content: "Hello!",
		};
	}
}
