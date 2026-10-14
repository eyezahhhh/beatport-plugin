import { randomUUID } from "node:crypto";
import { Logger } from "@pipe-bomb/plugin-sdk";

const BEATPORT_WEB_URL = "https://www.beatport.com";
const BEATPORT_API_URL = "https://api.beatport.com";

export interface BeatportImage {
	id: number;
	uri: string;
	dynamic_uri: string;
}

export interface BeatportReference {
	id: number;
	name: string;
	url: string;
}

export interface BeatportCategory {
	id: number;
	name: string;
}

export interface BeatportSubGenre {
	id: number;
	name: string;
	slug: string;
	url: string;
	enabled: boolean;
}

export interface BeatportGenre {
	id: number;
	name: string;
	slug: string;
	enabled: boolean;
	category?: BeatportCategory | null;
	sub_genres?: BeatportSubGenre[];
	is_included_in_hype?: boolean;
}

export interface BeatportArtist {
	id: number;
	name: string;
	slug: string;
	url: string;
	image: BeatportImage | null;
}

export interface BeatportLabel {
	id: number;
	name: string;
	slug: string;
	image: BeatportImage | null;
}

export interface BeatportRelease {
	id: number;
	name: string;
	slug: string;
	image: BeatportImage | null;
	label: BeatportLabel | null;
}

export interface BeatportChordType {
	id: number;
	name: string;
	url: string;
}

export interface BeatportKey {
	id: number;
	name: string;
	letter: string;
	camelot_number: number;
	camelot_letter: string;
	is_sharp: boolean;
	is_flat: boolean;
	chord_type: BeatportChordType;
	url: string;
}

export interface BeatportPrice {
	code: string;
	symbol: string;
	value: number;
	display: string;
}

export interface BeatportTrack {
	id: number;
	name: string;
	mix_name: string | null;
	slug: string;
	url: string;
	bpm: number;
	length: string;
	length_ms: number;
	is_explicit: boolean;
	is_hype: boolean;
	is_available_for_streaming: boolean;
	is_ugc_remix: boolean;
	is_dj_edit: boolean;
	is_dj_version: boolean;
	exclusive: boolean;
	available_worldwide: boolean;
	pre_order: boolean;
	pre_order_date: string | null;
	publish_status: string;
	publish_date: string;
	encoded_date: string;
	new_release_date: string;
	catalog_number: string;
	label_track_identifier: string | null;
	isrc?: string;
	sample_url: string;
	sample_start_ms: number;
	sample_end_ms: number;
	free_download_start_date: string | null;
	free_download_end_date: string | null;
	artists: BeatportArtist[];
	remixers: BeatportArtist[];
	bsrc_remixer: BeatportArtist[];
	free_downloads: BeatportTrack[];
	genre: BeatportGenre | null;
	sub_genre: BeatportGenre | null;
	image: BeatportImage | null;
	key: BeatportKey | null;
	release: BeatportRelease | null;
	current_status: BeatportReference | null;
	sale_type: BeatportReference | null;
	price: BeatportPrice | null;
}

export interface BeatportPaginated<T> {
	next: string | null;
	previous: string | null;
	count: number;
	page: string;
	per_page: number;
	results: T[];
}

interface AnonSession {
	access_token: string;
	expires_in: number;
	token_type: string;
	scope: string;
	create_date: string;
	expirationTime: number;
}

interface NextData {
	props?: {
		pageProps?: {
			anonSession?: AnonSession;
		};
	};
}

interface SolverSolution {
	url: string;
	status: number;
	response: string;
}

interface SolverResponse {
	status: string;
	message?: string;
	solution?: SolverSolution;
}

export class BeatportApi {
	private session: AnonSession | null = null;
	private tokenPromise: Promise<string> | null = null;

	constructor(
		private readonly getSolverUrl: () => string | null,
		private readonly logger: Logger,
	) {}

	async getGenres(): Promise<BeatportGenre[]> {
		const data = await this.get<BeatportPaginated<BeatportGenre>>(
			"/v4/catalog/genres/",
			{ per_page: "100" },
		);
		return data.results;
	}

	async getGenre(genreId: number): Promise<BeatportGenre> {
		return this.get<BeatportGenre>(`/v4/catalog/genres/${genreId}/`);
	}

	async getTop100(genreId: number, hype = false): Promise<BeatportTrack[]> {
		const data = await this.get<BeatportPaginated<BeatportTrack>>(
			`/v4/catalog/genres/${genreId}/top/100/`,
			{ per_page: "100", hype: String(hype) },
		);
		return data.results;
	}

	private async get<T>(
		path: string,
		query?: Record<string, string>,
	): Promise<T> {
		const url = new URL(`${BEATPORT_API_URL}${path}`);
		for (const [key, value] of Object.entries(query ?? {})) {
			url.searchParams.set(key, value);
		}

		const token = await this.getAnonToken();
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
			},
		});

		if (response.status === 401) {
			this.session = null;
			const refreshed = await this.getAnonToken();
			const retry = await fetch(url, {
				headers: {
					Authorization: `Bearer ${refreshed}`,
					Accept: "application/json",
				},
			});
			if (!retry.ok) {
				throw new Error(
					`Beatport API request to ${path} failed with HTTP ${retry.status}`,
				);
			}
			return (await retry.json()) as T;
		}

		if (!response.ok) {
			throw new Error(
				`Beatport API request to ${path} failed with HTTP ${response.status}`,
			);
		}

		return (await response.json()) as T;
	}

	private async getAnonToken(): Promise<string> {
		const session = this.session;
		if (session && session.expirationTime - 30_000 > Date.now()) {
			return session.access_token;
		}

		if (!this.tokenPromise) {
			this.tokenPromise = this.refreshAnonToken().finally(() => {
				this.tokenPromise = null;
			});
		}
		return this.tokenPromise;
	}

	private async refreshAnonToken(): Promise<string> {
		const solverUrl = this.getSolverUrl();
		if (!solverUrl) {
			throw new Error(
				"Beatport's API requires an anonymous session token which can only be retrieved through the Cloudflare solver. Configure a Solver URL in the Beatport plugin settings.",
			);
		}

		const url = `${BEATPORT_WEB_URL}/genre/drum-bass/1/top-100?cb=${randomUUID()}`;
		this.logger.debug("Fetching a fresh Beatport anonymous API token...");
		const html = await this.fetchViaSolver(solverUrl, url);
		const session = this.parseAnonSession(html);
		if (!session) {
			throw new Error(
				"Could not find the Beatport anonymous session token in the response.",
			);
		}

		this.session = session;
		this.logger.debug(
			`Obtained Beatport anonymous token (expires in ${session.expires_in}s)`,
		);
		return session.access_token;
	}

	private parseAnonSession(html: string): AnonSession | null {
		const match = html.match(
			/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
		);
		if (!match?.[1]) {
			return null;
		}

		try {
			const data = JSON.parse(match[1]) as NextData;
			return data.props?.pageProps?.anonSession ?? null;
		} catch (error) {
			this.logger.debug("Failed to parse Beatport __NEXT_DATA__:", error);
			return null;
		}
	}

	private async fetchViaSolver(
		solverUrl: string,
		url: string,
	): Promise<string> {
		const endpoint = `${solverUrl.replace(/\/+$/, "")}/v1`;

		let response: Response;
		try {
			response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					cmd: "request.get",
					url,
					maxTimeout: 60_000,
				}),
			});
		} catch (error) {
			throw new Error(
				`Failed to reach the Cloudflare solver at ${endpoint}: ${error}`,
			);
		}

		if (!response.ok) {
			throw new Error(
				`The Cloudflare solver at ${endpoint} returned HTTP ${response.status}`,
			);
		}

		const payload = (await response.json()) as SolverResponse;
		const solution = payload.solution;
		if (payload.status !== "ok" || !solution) {
			throw new Error(
				`The Cloudflare solver failed to fetch ${url}: ${payload.message ?? "unknown error"}`,
			);
		}
		if (solution.status >= 400) {
			throw new Error(
				`The Cloudflare solver received HTTP ${solution.status} for ${url}`,
			);
		}
		if (!solution.response) {
			throw new Error(
				`The Cloudflare solver returned an empty response for ${url}`,
			);
		}

		return solution.response;
	}
}
