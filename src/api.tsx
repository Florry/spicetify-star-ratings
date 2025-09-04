export function showNotification(text) {
    Spicetify.showNotification(text);
}

export function getLocalStorageData(key) {
    return Spicetify.LocalStorage.get(key);
}

export function setLocalStorageData(key, value) {
    Spicetify.LocalStorage.set(key, value);
}

function getLibraryAPI() {
    /** Hack fix for LibraryAPI not being available in Platform on some newer versions **/
    const libraryFromRegistry = Array.from(Spicetify.Platform.Registry._map?.values?.())?.[40] as any;
    return Spicetify.Platform.LibraryAPI ?? libraryFromRegistry?.instance;
}

function getRootlistAPI() {
    /** Hack fix for RootlistAPI not being available in Platform on some newer versions **/
    const rootListFromRegistry = Array.from(Spicetify.Platform.Registry._map?.values?.())?.[41] as any;
    return Spicetify.Platform.RootlistAPI ?? rootListFromRegistry?.instance;
}

function getPlaylistAPI() {
    /** Hack fix for PlaylistAPI not being available in Platform on some newer versions **/
    const playlistFromRegistry = Array.from(Spicetify.Platform.Registry._map?.values?.())?.[42] as any;
    return Spicetify.Platform.PlaylistAPI ?? playlistFromRegistry?.instance;
}

export async function createPlaylist(name, folderUri) {
    const options =
        navigator.platform.startsWith("Linux") && navigator.userAgent.includes("Spotify/1.1.84.716")
            ? { after: folderUri }
            : { after: { uri: folderUri } };

    const username = (Spicetify as any).User?.getUsername?.() ?? Spicetify.Platform.username;

    return await Spicetify.CosmosAsync.post(`https://api.spotify.com/v1/users/${username}/playlists`, {
        name: name,
        ...options,
    });
}

export async function makePlaylistPrivate(playlistUri) {
    setTimeout(async () => {
        await Spicetify.CosmosAsync.post(`sp://core-playlist/v1/playlist/${playlistUri}/set-base-permission`, {
            permission_level: "BLOCKED",
        });
    }, 1000);
}

export async function createFolder(name: string) {
    await getRootlistAPI().createFolder(name, { before: "" });
}

export async function getAlbum(uri: string) {
    const query = {
        offset: 0,
        limit: 450,
    };

    return await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/albums/${uri}`, query);
}

export async function getContents() {
    return await getRootlistAPI().getContents();
}

export async function addTrackToLikedSongs(trackUri: string) {
    // check if track is already liked
    const isLiked = await getLibraryAPI().contains(trackUri);
    if (isLiked[0]) {
        return;
    }

    // false refers to whether to silently add to liked songs (no notification)
    await getLibraryAPI().add({ uris: [trackUri], silent: 0 });
}

export async function removeTrackFromLikedSongs(trackUri: string) {
    // false refers to whether to silently add to liked songs (no notification)
    await getLibraryAPI().remove({ uris: [trackUri], silent: 0 });
}

export async function addTrackToPlaylist(playlistUri: string, trackUri: string) {
    await getPlaylistAPI().add(playlistUri, [trackUri], { after: 1, before: 0 });
}

export async function removeTrackFromPlaylist(playlistUri: string, trackUri: string) {
    await getPlaylistAPI().remove(playlistUri, [{ uri: trackUri, uid: "" }]);
}

export async function getPlaylistItems(uri: string) {
    const result = await Spicetify.CosmosAsync.get(`sp://core-playlist/v1/playlist/${uri}`);
    return result.items;
}

export async function isAppLaterThan(specifiedVersion: string) {
    let appInfo = await Spicetify.CosmosAsync.get("sp://desktop/v1/version");
    let result = appInfo.version.localeCompare(specifiedVersion, undefined, { numeric: true, sensitivity: "base" });
    return result === 1;
}

export async function moveTracksBefore(playlistUri: string, trackUids, beforeUid: string) {
    const isV2 = await isAppLaterThan("1.2.5.1006.g22820f93");
    await getPlaylistAPI().move(
        playlistUri,
        trackUids.map((uid) => ({ uid: uid })),
        { before: isV2 ? { uid: beforeUid } : beforeUid },
    );
}

export async function moveTracksAfter(playlistUri: string, trackUids, afterUid: string) {
    const isV2 = await isAppLaterThan("1.2.5.1006.g22820f93");
    await getPlaylistAPI().move(
        playlistUri,
        trackUids.map((uid) => ({ uid: uid })),
        { after: isV2 ? { uid: afterUid } : afterUid },
    );
}

export async function getTracksWithSameISRC(uri: string) {
    // Get ISRC code for the track
    const track = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${uri}`);
    const isrc = track.external_ids.isrc;

    // Search for tracks with the same ISRC code
    const query = {
        q: `isrc:${isrc}`,
        type: "track",
        limit: 50, // I don't think there will be more than 50 duplicate songs
    };

    const response = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/search`, query);
    return response.tracks.items;
}
