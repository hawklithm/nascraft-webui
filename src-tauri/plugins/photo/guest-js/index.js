// Guest JS code for photo plugin
export const getAlbumPhotos = async () => {
  return await window.__TAURI_INTERNALS__.invoke("plugin:photo|get_album_photos");
};

export const readPhotoData = async (uri) => {
  return await window.__TAURI_INTERNALS__.invoke("plugin:photo|read_photo_data", { uri });
};

export const getPhotoThumbnail = async (uri, width, height) => {
  return await window.__TAURI_INTERNALS__.invoke("plugin:photo|get_photo_thumbnail", { 
    uri, 
    width: width || 200, 
    height: height || 200 
  });
};