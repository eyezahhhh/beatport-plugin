import { AttributeValue } from "@pipe-bomb/plugin-sdk";
import { BeatportTrack } from "./chart/chart.js";
import { SearchAttribute } from "ephemeral-import/src/attribute-entry.js";

export function getTrackTitle(track: BeatportTrack) {
	let title = track.name;
	if (track.mix_name) {
		title += ` (${track.mix_name})`;
	}

	let artistName = "";
	for (let [index, artist] of track.artists.entries()) {
		if (index) {
			artistName += ", ";
		}
		artistName += artist.name;
	}
	if (artistName) {
		return `${artistName} - ${title}`;
	}
	return title;
}

export function extractAttributes(track: BeatportTrack): SearchAttribute[] {
	let title = track.name;
	if (track.mix_name) {
		title += ` (${track.mix_name})`;
	}

	const attributes: SearchAttribute[] = [
		{
			key: "duration",
			type: "decimal",
			value: track.length_ms / 1_000,
		},
		{
			key: "bpm",
			type: "decimal",
			value: track.bpm,
		},
		{
			key: "title",
			type: "string",
			value: title,
		},
	];

	if (track.isrc) {
		attributes.push({
			key: "isrc",
			type: "string",
			value: track.isrc,
		});
	}

	let artistName = "";
	for (let [index, artist] of track.artists.entries()) {
		if (index) {
			artistName += ", ";
		}
		artistName += artist.name;
	}
	if (artistName) {
		attributes.push({
			key: "artist",
			type: "string",
			value: artistName,
		});
	}

	return attributes;
}
