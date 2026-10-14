import {
	ConfigManager,
	ConfigManagerApiContext,
	ConfigNode,
} from "@pipe-bomb/plugin-sdk";

export class BeatportConfigManager implements ConfigManager {
	private api!: ConfigManagerApiContext;

	private solverUrl: string | null = null;
	private genreIds: string | null = null;

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
		return {
			type: "section",
			children: [
				{
					type: "heading",
					size: "sm",
					content: "Charts",
				},
				{
					type: "paragraph",
					content:
						"Enter a comma-separated list of Beatport genre IDs to create charts for (e.g. 1, 5, 11). Leave this empty to create no charts. The available genre IDs are logged when the create-charts task runs.",
				},
				{
					type: "text",
					id: "genreids",
					placeholder: "1, 5, 11",
					value: this.genreIds ?? "",
					name: "Genre IDs",
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
}
