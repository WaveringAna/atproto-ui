/**
 * teal.fm record types for music listening history
 * Specification: fm.teal.alpha.actor.status and fm.teal.alpha.feed.play
 */

export interface TealArtist {
	artistName: string;
	artistMbId?: string;
}

export interface TealPlayItem {
	artists: TealArtist[];
	originUrl?: string;
	trackName: string;
	playedTime: string;
	releaseName?: string;
	recordingMbId?: string;
	releaseMbId?: string;
	submissionClientAgent?: string;
	musicServiceBaseDomain?: string;
	isrc?: string;
	duration?: number;
}

/**
 * fm.teal.alpha.actor.status - The last played song
 */
export interface TealActorStatusRecord {
	$type: "fm.teal.alpha.actor.status";
	item: TealPlayItem;
	time: string;
	expiry?: string;
}

/**
 * fm.teal.alpha.feed.play - A single play record
 */
export interface TealFeedPlayRecord extends TealPlayItem {
	$type: "fm.teal.alpha.feed.play";
}
