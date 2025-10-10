import type { ProfileRecord } from '../types/bluesky';

interface LegacyBlobRef {
	ref?: { $link?: string };
	cid?: string;
}

export function getAvatarCid(record: ProfileRecord | undefined): string | undefined {
	const avatar = record?.avatar as LegacyBlobRef | undefined;
	if (!avatar) return undefined;
	if (typeof avatar.cid === 'string') return avatar.cid;
	return avatar.ref?.$link;
}
