package app.tauri.photo

import android.app.Activity
import android.Manifest
import android.content.ContentUris
import android.provider.MediaStore
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.Permission
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@TauriPlugin(
    permissions = [
        Permission(strings = [Manifest.permission.READ_MEDIA_IMAGES], alias = "read_media_images"),
        Permission(strings = [Manifest.permission.READ_EXTERNAL_STORAGE], alias = "read_external_storage")
    ]
)
class PhotoPlugin(private val activity: Activity) : Plugin(activity) {

    companion object {
        private const val TAG = "PhotoPlugin"
    }

    /**
     * Get all photo paths from the device's album
     */
    @Command
    fun get_album_paths(invoke: Invoke) {
        Log.i(TAG, "get_album_paths command invoked")
        
        try {
            val paths = mutableListOf<String>()
            
            // Define projection for MediaStore query
            val projection = arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DATA,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.RELATIVE_PATH
            )
            
            val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC"
            
            Log.d(TAG, "Querying MediaStore for images...")
            
            val cursor = activity.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                sortOrder
            )
            
            cursor?.use { cursor ->
                Log.d(TAG, "Cursor column count: ${cursor.columnCount}")
                Log.d(TAG, "Cursor column names: ${cursor.columnNames.joinToString(", ")}")
                
                val idIndex = cursor.getColumnIndex(MediaStore.Images.Media._ID)
                val dataIndex = cursor.getColumnIndex(MediaStore.Images.Media.DATA)
                val nameIndex = cursor.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME)
                
                Log.d(TAG, "Column indices - ID: $idIndex, DATA: $dataIndex, NAME: $nameIndex")
                
                var photoCount = 0
                while (cursor.moveToNext()) {
                    val id = cursor.getLong(idIndex)
                    
                    // Try to get file path from DATA column first
                    val filePath = if (dataIndex >= 0) {
                        cursor.getString(dataIndex)
                    } else {
                        null
                    }
                    
                    val fileName = if (nameIndex >= 0) {
                        cursor.getString(nameIndex)
                    } else {
                        null
                    }
                    
                    val path = if (!filePath.isNullOrEmpty()) {
                        filePath
                    } else {
                        // Fallback to content URI
                        val contentUri = ContentUris.withAppendedId(
                            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                            id
                        )
                        contentUri.toString()
                    }
                    
                    paths.add(path)
                    photoCount++
                    
                    // Log first few photos for debugging
                    if (photoCount <= 5) {
                        Log.d(TAG, "Photo $photoCount: $path (File: $fileName)")
                    }
                }
                
                Log.i(TAG, "Found ${paths.size} photos in album")
            }
            
            if (cursor == null) {
                Log.e(TAG, "Failed to query MediaStore - cursor is null")
                invoke.reject("Failed to access photo gallery")
                return
            }
            
            val result = JSObject()
            result.put("paths", paths.toTypedArray())
            result.put("count", paths.size)
            
            Log.i(TAG, "Successfully returning ${paths.size} photo paths")
            invoke.resolve(result)
            
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for accessing photos", e)
            invoke.reject("Permission denied: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error accessing photo gallery", e)
            invoke.reject("Error accessing photos: ${e.message}")
        }
    }
}