// Guest JS code for photo plugin
export const getAlbumPaths = async () => {
  return await window.__TAURI_INTERNALS__.invoke("plugin:photo|get_album_paths");
};