import { Plugin, PluginApiContext } from "@pipe-bomb/plugin-sdk";
import { SublimatePlugin } from "sublimate";
import { ChartManager } from "./chart-manager.js";
import { BeatportApi } from "./beatport.api.js";
import { BeatportAttributeSource } from "./beatport.attribute-source.js";
import { BeatportConfigManager } from "./beatport.config-manager.js";
import { LabelUserConfigManager } from "./label.user-config-manager.js";
import { LabelManager } from "./label-manager.js";

export default class BeatportPlugin implements Plugin {
	private ctx: PluginApiContext | null = null;

	enable(ctx: PluginApiContext): void | Promise<void> {
		this.ctx = ctx;

		ctx.registerLanguageDirectory("lang");

		const attributeSource = new BeatportAttributeSource();
		ctx.registerAttributeSource(attributeSource);

		const config = new BeatportConfigManager();
		ctx.registerConfigManager(config);

		const api = new BeatportApi(() => config.getSolverUrl(), ctx.getLogger());

		const chartManager = new ChartManager(
			() => this.getClient(),
			ctx.getDataClient(),
			ctx.getPlaylistClient({
				id: ChartManager.PLAYLIST_BOT_ID,
				name: "Beatport Charts",
			}),
			ctx.getLogger(),
			config,
			api,
		);

		ctx.registerTask({
			id: "create-charts",
			resumable: false,
			run: (ctx) => chartManager.sync(ctx),
		});

		const labelConfigManager = new LabelUserConfigManager();
		ctx.registerUserConfigManager("labels", labelConfigManager);

		const labelManager = new LabelManager(
			() => this.getClient(),
			ctx.getDataClient(),
			ctx.getPlaylistClient({
				id: LabelManager.PLAYLIST_BOT_ID,
				name: "Beatport Label",
			}),
			ctx.getLogger(),
			labelConfigManager,
			api,
		);

		ctx.registerTask({
			id: "create-label-playlists",
			resumable: false,
			run: async (ctx) => labelManager.sync(ctx),
		});
	}
	disable(): void {
		this.ctx = null;
	}

	async getClient() {
		if (!this.ctx) {
			throw new Error("Plugin isn't enabled");
		}

		const plugin = await this.ctx.getPlugin<SublimatePlugin>("sublimate");
		if (plugin) {
			return plugin.getSearchClient();
		}
		return null;
	}
}
