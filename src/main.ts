import { Plugin, PluginApiContext } from "@pipe-bomb/plugin-sdk";
import type EphemeralImportPlugin from "ephemeral-import/src/main.js";
import { ChartManager } from "./chart-manager.js";

export default class BeatportPlugin implements Plugin {
	private ctx: PluginApiContext | null = null;

	enable(ctx: PluginApiContext): void | Promise<void> {
		this.ctx = ctx;

		const chartManager = new ChartManager(
			() => this.getClient(),
			ctx.getLogger(),
		);

		ctx.registerTask({
			id: "create-charts",
			resumable: false,
			run: (ctx) => chartManager.sync(ctx),
		});
	}
	disable(): void {
		this.ctx = null;
	}

	async getClient() {
		if (!this.ctx) {
			throw new Error("Plugin isn't enabled");
		}

		const plugin =
			await this.ctx.getPlugin<EphemeralImportPlugin>("ephemeral-import");
		if (plugin) {
			return plugin.getSearchClient();
		}
		return null;
	}
}
