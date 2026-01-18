package app.tauri.photo

import android.app.Activity
import android.Manifest
import android.content.ContentUris
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
     * Get all photo paths from the device's album
     */
    @Command
    fun getAlbumPaths(invoke: Invoke) {
        Log.i(TAG, "get_album_paths command invoked")
        
        try {
            val paths = mutableListOf<String>()
            val uris = mutableListOf<String>()
            
            // Define projection for MediaStore query
            val projection = arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DATA,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.RELATIVE_PATH
            )
            
            val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC"
            
            // 修改点4：使用正确的 URI
            val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
            } else {
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            }
            
            Log.d(TAG, "Querying MediaStore for images... URI: $collection")
            Log.d(TAG, "Android SDK: ${Build.VERSION.SDK_INT}")
            
            val selection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ 的查询条件
                "${MediaStore.Images.Media.RELATIVE_PATH} LIKE ?"
            } else {
                // Android 9 及以下的查询条件
                null
            }
            
            val selectionArgs = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // 修改点5：放宽查询条件，查询所有图片
                arrayOf("%DCIM%")
            } else {
                null
            }
            
            val cursor = activity.contentResolver.query(
                collection,
                projection,
                selection,  // 修改点6：使用更宽松的查询条件
                selectionArgs,
                sortOrder
            )
            
            if (cursor == null) {
                Log.e(TAG, "Failed to query MediaStore - cursor is null")
                invoke.reject("Failed to access photo gallery: cursor is null")
                return
            }
            
            cursor.use { cursor ->
                Log.d(TAG, "Cursor column count: ${cursor.columnCount}")
                Log.d(TAG, "Cursor column names: ${cursor.columnNames.joinToString(", ")}")
                
                val idIndex = cursor.getColumnIndex(MediaStore.Images.Media._ID)
                val dataIndex = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    -1
                } else {
                    cursor.getColumnIndex(MediaStore.Images.Media.DATA)
                }
                val nameIndex = cursor.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME)
                val relativePathIndex = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    cursor.getColumnIndex(MediaStore.Images.Media.RELATIVE_PATH)
                } else {
                    -1
                }
                
                Log.d(TAG, "Column indices - ID: $idIndex, DATA: $dataIndex, NAME: $nameIndex, REL_PATH: $relativePathIndex")
                
                var photoCount = 0
                while (cursor.moveToNext()) {
                    val id = cursor.getLong(idIndex)
                    
                    // 修改点7：构建 Content URI
                    val contentUri = ContentUris.withAppendedId(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        id
                    )
                    
                    val uriString = contentUri.toString()
                    uris.add(uriString)
                    
                    // 尝试获取文件路径（兼容 Android 10 以下）
                    var filePath: String? = null
                    if (dataIndex >= 0) {
                        filePath = cursor.getString(dataIndex)
                    } else if (relativePathIndex >= 0 && nameIndex >= 0) {
                        // Android 10+ 构建路径
                        val relativePath = cursor.getString(relativePathIndex)
                        val fileName = cursor.getString(nameIndex)
                        if (relativePath != null && fileName != null) {
                            filePath = "$relativePath/$fileName"
                        }
                    }
                    
                    if (!filePath.isNullOrEmpty()) {
                        paths.add(filePath)
                    } else {
                        paths.add(uriString) // 如果路径不可用，使用 URI
                    }
                    
                    photoCount++
                    
                    // Log first few photos for debugging
                    if (photoCount <= 5) {
                        Log.d(TAG, "Photo $photoCount - URI: $uriString, Path: ${paths.last()}")
                    }
                }
                
                Log.i(TAG, "Found ${paths.size} photos in album")
            }
            
            val result = JSObject()
            result.put("paths", paths.toTypedArray())
            result.put("uris", uris.toTypedArray())
            result.put("count", paths.size)
            result.put("androidVersion", Build.VERSION.SDK_INT)
            
            Log.i(TAG, "Successfully returning ${paths.size} photo paths")
            invoke.resolve(result)
            
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for accessing photos", e)
            invoke.reject("Permission denied: ${e.message}. Please grant storage permission.")
        } catch (e: Exception) {
            Log.e(TAG, "Error accessing photo gallery", e)
            invoke.reject("Error accessing photos: ${e.message}")
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
