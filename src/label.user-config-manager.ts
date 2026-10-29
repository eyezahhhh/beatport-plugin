import {
	ConfigNode,
	UserConfigManager,
	UserConfigManagerApiContext,
} from "@pipe-bomb/plugin-sdk";

export class LabelUserConfigManager implements UserConfigManager {
	private ctx: UserConfigManagerApiContext | null = null;

	enable(ctx: UserConfigManagerApiContext): void | Promise<void> {
		this.ctx = ctx;
	}

	canUserAccess(_userUuid: string): boolean {
		return true;
	}

	async getLabelIds(userUuid: string) {
		if (!this.ctx) {
			throw new Error("Config manager is not enabled");
		}
		const values = await this.ctx?.getValue(
			userUuid,
			"label-ids",
			"string",
			true,
		);
		return values ?? [];
	}

	async getConfigOptions(userUuid: string): Promise<ConfigNode | null> {
		if (!this.ctx) {
			return null;
		}
		const labelIds =
			(await this.ctx.getValue(userUuid, "label-ids", "string", true)) ?? [];

		return {
			type: "section",
			children: [
				{
					type: "heading",
					size: "sm",
					content: "Label IDs",
				},
				{
					type: "paragraph",
					content:
						"Enter a comma-separated list of Beatport label IDs to create playlists for (e.g. 243457, 61898). Leave this empty to create no playlists.",
				},
				{
					type: "text",
					id: "labelids",
					placeholder: "243457, 61898",
					value: labelIds.join(", ") ?? "",
					name: "Label IDs",
				},
			],
		};
	}

	async update(
		userUuid: string,
		values: Record<string, any>,
	): Promise<ConfigNode | null> {
		if ("labelids" in values && typeof values.labelids == "string") {
			const labelIds = values.labelids
				.split(",")
				.map((id) => id.trim())
				.filter(Boolean);

			await this.ctx?.setValue(userUuid, "label-ids", "string", labelIds);
		}

		return this.getConfigOptions(userUuid);
	}
}
