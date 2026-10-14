import {
	ConfigNode,
	UserConfigManager,
	UserConfigManagerApiContext,
} from "@pipe-bomb/plugin-sdk";

export class LabelUserConfigManager implements UserConfigManager {
	private ctx: UserConfigManagerApiContext | null = null;

	enable(ctx: UserConfigManagerApiContext): void | Promise<void> {
		throw new Error("Method not implemented.");
	}

	canUserAccess(userUuid: string): boolean {
		throw new Error("Method not implemented.");
	}
	getConfigOptions(userUuid: string): Promise<ConfigNode | null> {
		throw new Error("Method not implemented.");
	}
	update(
		userUuid: string,
		values: Record<string, any>,
	): Promise<ConfigNode | null> {
		throw new Error("Method not implemented.");
	}
}
