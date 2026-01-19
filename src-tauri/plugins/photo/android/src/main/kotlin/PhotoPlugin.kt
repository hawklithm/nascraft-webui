package app.tauri.photo

import android.app.Activity
import android.Manifest
import android.content.ContentUris
import android.content.ContentResolver
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import android.widget.Toast
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.Permission
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.InputStream

@TauriPlugin(
    permissions = [
        Permission(strings = [Manifest.permission.READ_MEDIA_IMAGES], alias = "read_media_images"),
        Permission(strings = [Manifest.permission.READ_EXTERNAL_STORAGE], alias = "read_external_storage")
    ]
)
class PhotoPlugin(private val activity: Activity) : Plugin(activity) {

    companion object {
        private const val TAG = "PhotoPlugin"
        private const val PERMISSION_REQUEST_CODE = 1001
    }

    /**
     * Get all photos from the device's album with detailed metadata
     */
    @Command
    fun getAlbumPhotos(invoke: Invoke) {
        Log.i(TAG, "get_album_photos command invoked")
        
        if (!hasRequiredPermissions()) {
            invoke.reject("Permission required to access photos")
            return
        }
        
        try {
            val photos = mutableListOf<JSObject>()
            
            // Define projection for MediaStore query
            val projection = arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.MIME_TYPE,
                MediaStore.Images.Media.SIZE,
                MediaStore.Images.Media.DATE_ADDED,
                MediaStore.Images.Media.DATE_MODIFIED,
                MediaStore.Images.Media.WIDTH,
                MediaStore.Images.Media.HEIGHT,
                MediaStore.Images.Media.ORIENTATION
            )
            
            val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC"
            
            // Use external content URI
            val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            
            Log.d(TAG, "Querying MediaStore for images... URI: $collection")
            
            // No selection criteria - get all images
            val cursor = activity.contentResolver.query(
                collection,
                projection,
                null,
                null,
                sortOrder
            )
            
            if (cursor == null) {
                Log.e(TAG, "Failed to query MediaStore - cursor is null")
                invoke.reject("Failed to access photo gallery: cursor is null")
                return
            }
            
            cursor.use { cursor ->
                Log.d(TAG, "Cursor column count: ${cursor.columnCount}")
                Log.d(TAG, "Found ${cursor.count} photos in MediaStore")
                
                val idIndex = cursor.getColumnIndex(MediaStore.Images.Media._ID)
                val nameIndex = cursor.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME)
                val mimeTypeIndex = cursor.getColumnIndex(MediaStore.Images.Media.MIME_TYPE)
                val sizeIndex = cursor.getColumnIndex(MediaStore.Images.Media.SIZE)
                val dateAddedIndex = cursor.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)
                val dateModifiedIndex = cursor.getColumnIndex(MediaStore.Images.Media.DATE_MODIFIED)
                val widthIndex = cursor.getColumnIndex(MediaStore.Images.Media.WIDTH)
                val heightIndex = cursor.getColumnIndex(MediaStore.Images.Media.HEIGHT)
                val orientationIndex = cursor.getColumnIndex(MediaStore.Images.Media.ORIENTATION)
                
                var photoCount = 0
                while (cursor.moveToNext()) {
                    val id = cursor.getLong(idIndex)
                    
                    // Build Content URI
                    val contentUri = ContentUris.withAppendedId(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        id
                    )
                    
                    val photo = JSObject()
                    photo.put("id", id)
                    photo.put("uri", contentUri.toString())
                    photo.put("name", cursor.getString(nameIndex) ?: "")
                    photo.put("mimeType", cursor.getString(mimeTypeIndex) ?: "image/jpeg")
                    photo.put("size", cursor.getLong(sizeIndex))
                    photo.put("dateAdded", cursor.getLong(dateAddedIndex))
                    photo.put("dateModified", cursor.getLong(dateModifiedIndex))
                    photo.put("width", cursor.getInt(widthIndex))
                    photo.put("height", cursor.getInt(heightIndex))
                    photo.put("orientation", cursor.getInt(orientationIndex))
                    
                    photos.add(photo)
                    photoCount++
                    
                    // Log first few photos for debugging
                    if (photoCount <= 5) {
                        Log.d(TAG, "Photo $photoCount - Name: ${photo.getString("name")}, Size: ${photo.getLong("size")}, URI: ${photo.getString("uri")}")
                    }
                }
                
                Log.i(TAG, "Successfully processed $photoCount photos")
            }
            
            val result = JSObject()
            result.put("photos", photos.toTypedArray())
            result.put("count", photos.size)
            result.put("androidVersion", Build.VERSION.SDK_INT)
            
            Log.i(TAG, "Returning ${photos.size} photo details")
            invoke.resolve(result)
            
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for accessing photos", e)
            invoke.reject("Permission denied: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error accessing photo gallery", e)
            invoke.reject("Error accessing photos: ${e.message}")
        }
    }
    
    /**
     * Read photo file content as base64 string
     */
    @Command
    fun readPhotoData(invoke: Invoke, uri: String) {
        Log.i(TAG, "read_photo_data command invoked for URI: $uri")
        
        if (!hasRequiredPermissions()) {
            invoke.reject("Permission required to read photo data")
            return
        }
        
        try {
            val contentUri = Uri.parse(uri)
            
            // Open input stream from content URI
            val inputStream: InputStream? = activity.contentResolver.openInputStream(contentUri)
            if (inputStream == null) {
                invoke.reject("Failed to open input stream for URI: $uri")
                return
            }
            
            inputStream.use { stream ->
                // Read file content into byte array
                val buffer = ByteArrayOutputStream()
                val data = ByteArray(8192)
                var bytesRead: Int
                
                while (stream.read(data).also { bytesRead = it } != -1) {
                    buffer.write(data, 0, bytesRead)
                }
                
                val fileData = buffer.toByteArray()
                
                // Convert to base64
                val base64Data = android.util.Base64.encodeToString(fileData, android.util.Base64.DEFAULT)
                
                val result = JSObject()
                result.put("uri", uri)
                result.put("data", base64Data)
                result.put("size", fileData.size)
                
                Log.i(TAG, "Successfully read ${fileData.size} bytes from photo")
                invoke.resolve(result)
            }
            
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for reading photo data", e)
            invoke.reject("Permission denied: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error reading photo data", e)
            invoke.reject("Error reading photo data: ${e.message}")
        }
    }
    
    /**
     * Get photo thumbnail as base64
     */
    @Command
    fun getPhotoThumbnail(invoke: Invoke, uri: String, width: Int = 200, height: Int = 200) {
        Log.i(TAG, "get_photo_thumbnail command invoked for URI: $uri")
        
        if (!hasRequiredPermissions()) {
            invoke.reject("Permission required to get photo thumbnail")
            return
        }
        
        try {
            val contentUri = Uri.parse(uri)
            
            // Get thumbnail bitmap
            val thumbnail = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Use ContentResolver to load thumbnail
                activity.contentResolver.loadThumbnail(contentUri, android.util.Size(width, height), null)
            } else {
                // For older versions, use MediaStore.Images.Thumbnails
                MediaStore.Images.Thumbnails.getThumbnail(
                    activity.contentResolver,
                    ContentUris.parseId(contentUri),
                    MediaStore.Images.Thumbnails.MINI_KIND,
                    null
                )
            }
            
            if (thumbnail == null) {
                invoke.reject("Failed to generate thumbnail for URI: $uri")
                return
            }
            
            // Convert bitmap to base64
            val byteArrayOutputStream = ByteArrayOutputStream()
            thumbnail.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, byteArrayOutputStream)
            val thumbnailData = byteArrayOutputStream.toByteArray()
            val base64Data = android.util.Base64.encodeToString(thumbnailData, android.util.Base64.DEFAULT)
            
            val result = JSObject()
            result.put("uri", uri)
            result.put("thumbnail", base64Data)
            result.put("width", thumbnail.width)
            result.put("height", thumbnail.height)
            result.put("format", "image/jpeg")
            
            Log.i(TAG, "Successfully generated thumbnail ${thumbnail.width}x${thumbnail.height}")
            invoke.resolve(result)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error generating photo thumbnail", e)
            invoke.reject("Error generating thumbnail: ${e.message}")
        }
    }
    
    /**
     * 修改点8：检查运行时权限
     */
    private fun hasRequiredPermissions(): Boolean {
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+
            arrayOf(Manifest.permission.READ_MEDIA_IMAGES)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11-12
            arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        } else {
            // Android 10 及以下
            arrayOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            )
        }
        
        return permissions.all { permission ->
            ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED
        }
    }
    
    /**
     * 修改点9：添加辅助方法获取特定相册
     */
    @Command
    fun getPhotosByAlbum(invoke: Invoke, albumName: String) {
        Log.i(TAG, "get_photos_by_album command invoked for album: $albumName")
        
        if (!hasRequiredPermissions()) {
            invoke.reject("Permission required")
            return
        }
        
        try {
            val projection = arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.DATE_ADDED
            )
            
            val selection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                "${MediaStore.Images.Media.RELATIVE_PATH} LIKE ?"
            } else {
                "${MediaStore.Images.Media.DATA} LIKE ?"
            }
            
            val selectionArgs = arrayOf("%$albumName%")
            
            val cursor = activity.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                "${MediaStore.Images.Media.DATE_ADDED} DESC"
            )
            
            val results = mutableListOf<JSObject>()
            
            cursor?.use { cursor ->
                val idIndex = cursor.getColumnIndex(MediaStore.Images.Media._ID)
                val nameIndex = cursor.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME)
                
                while (cursor.moveToNext()) {
                    val id = cursor.getLong(idIndex)
                    val name = cursor.getString(nameIndex)
                    
                    val contentUri = ContentUris.withAppendedId(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        id
                    )
                    
                    val item = JSObject()
                    item.put("id", id)
                    item.put("name", name)
                    item.put("uri", contentUri.toString())
                    
                    results.add(item)
                }
            }
            
            val result = JSObject()
            result.put("album", albumName)
            result.put("photos", results.toTypedArray())
            result.put("count", results.size)
            
            invoke.resolve(result)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error getting photos by album", e)
            invoke.reject("Error: ${e.message}")
        }
    }
}
