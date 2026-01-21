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
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
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
        private const val REQUEST_CODE_PERMISSION = 1001
    }

    /**
     * 检查并请求相册访问权限
     */
    @Command
    fun checkAndRequestPermissions(invoke: Invoke) {
        Log.i(TAG, "检查相册访问权限")
        
        val requiredPermissions = getRequiredPermissions()
        val permissionsToRequest = mutableListOf<String>()
        
        // 检查哪些权限尚未授予
        for (permission in requiredPermissions) {
            if (ContextCompat.checkSelfPermission(activity, permission) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(permission)
            }
        }
        
        if (permissionsToRequest.isEmpty()) {
            // 所有权限都已授予
            val result = JSObject()
            result.put("granted", true)
            result.put("message", "所有必要权限已授予")
            Log.i(TAG, "所有必要权限已授予")
            invoke.resolve(result)
        } else {
            // 需要请求权限
            Log.i(TAG, "需要请求权限: $permissionsToRequest")
            
            // 在Tauri插件中，通常需要在前端请求权限
            // 这里返回一个消息告诉前端需要请求权限
            val result = JSObject()
            result.put("granted", false)
            result.put("requiredPermissions", requiredPermissions.toList().toTypedArray())
            result.put("message", "需要在应用中请求权限")
            
            // 注意：在Android插件中，我们不能直接触发系统的权限请求对话框
            // 这通常由前端JavaScript通过Tauri的权限API来完成
            invoke.resolve(result)
        }
    }

    /**
     * 获取相册中所有照片
     */
    @Command
    fun getAlbumPhotos(invoke: Invoke) {
        Log.i(TAG, "get_album_photos 命令被调用")
        
        if (!hasRequiredPermissions()) {
            Log.e(TAG, "权限不足，无法访问相册")
            invoke.reject("PERMISSION_DENIED", "需要相册访问权限，请先调用 checkAndRequestPermissions 检查权限")
            return
        }
        
        try {
            val photos = mutableListOf<JSObject>()
            
            // MediaStore查询的列
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
            
            // 使用外部存储的内容URI
            val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
            } else {
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            }
            
            Log.d(TAG, "查询 MediaStore 中的图片... URI: $collection")
            
            // 查询MediaStore获取所有图片
            val cursor = activity.contentResolver.query(
                collection,
                projection,
                null,
                null,
                sortOrder
            )
            
            if (cursor == null) {
                Log.e(TAG, "查询 MediaStore 失败 - cursor 为 null")
                invoke.reject("QUERY_FAILED", "无法访问相册: cursor 为 null")
                return
            }
            
            cursor.use { cursor ->
                Log.d(TAG, "Cursor 列数: ${cursor.columnCount}")
                Log.d(TAG, "在 MediaStore 中找到 ${cursor.count} 张照片")
                
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
                    
                    // 构建内容URI
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
                    
                    // 调试：记录前几张照片
                    if (photoCount <= 3) {
                        Log.d(TAG, "照片 $photoCount - 名称: ${photo.getString("name")}, 大小: ${photo.getLong("size")}")
                    }
                }
                
                Log.i(TAG, "成功处理 $photoCount 张照片")
            }
            
            val result = JSObject()
            result.put("photos", photos)
            result.put("count", photos.size)
            result.put("androidVersion", Build.VERSION.SDK_INT)
            
            Log.i(TAG, "返回 ${photos.size} 张照片的详细信息")
            invoke.resolve(result)
            
        } catch (e: SecurityException) {
            Log.e(TAG, "访问照片时权限被拒绝", e)
            invoke.reject("SECURITY_EXCEPTION", "权限被拒绝: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "访问相册时出错", e)
            invoke.reject("QUERY_ERROR", "访问相册时出错: ${e.message}")
        }
    }
    
    /**
     * 读取照片文件内容为base64字符串
     */
    @Command
    fun readPhotoData(invoke: Invoke) {
        @InvokeArg
        class Args {
            lateinit var uri: String
        }

        Log.i(TAG, "read_photo_data 命令被调用")
        val args = invoke.parseArgs(Args::class.java)
        Log.i(TAG, "read_photo_data 命令被调用，URI: ${args.uri}")
        var uri = args.uri
        
        if (!hasRequiredPermissions()) {
            invoke.reject("PERMISSION_DENIED", "需要相册访问权限")
            return
        }
        
        try {
            val contentUri = Uri.parse(uri)
            
            // 从内容URI打开输入流
            val inputStream: InputStream? = activity.contentResolver.openInputStream(contentUri)
            if (inputStream == null) {
                invoke.reject("IO_ERROR", "无法为 URI 打开输入流: $uri")
                return
            }
            
            inputStream.use { stream ->
                // 将文件内容读入字节数组
                val buffer = ByteArrayOutputStream()
                val data = ByteArray(8192)
                var bytesRead: Int
                
                while (stream.read(data).also { bytesRead = it } != -1) {
                    buffer.write(data, 0, bytesRead)
                }
                
                val fileData = buffer.toByteArray()
                
                // 转换为base64
                val base64Data = android.util.Base64.encodeToString(fileData, android.util.Base64.DEFAULT)
                
                val result = JSObject()
                result.put("uri", uri)
                result.put("data", base64Data)
                result.put("size", fileData.size)
                
                Log.i(TAG, "成功从照片读取 ${fileData.size} 字节")
                invoke.resolve(result)
            }
            
        } catch (e: SecurityException) {
            Log.e(TAG, "读取照片数据时权限被拒绝", e)
            invoke.reject("SECURITY_EXCEPTION", "权限被拒绝: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "读取照片数据时出错", e)
            invoke.reject("READ_ERROR", "读取照片数据时出错: ${e.message}")
        }
    }
    
    /**
     * 获取照片缩略图
     */
    @Command
    fun getPhotoThumbnail(invoke: Invoke, uri: String, width: Int = 200, height: Int = 200) {
        Log.i(TAG, "get_photo_thumbnail 命令被调用，URI: $uri")
        
        if (!hasRequiredPermissions()) {
            invoke.reject("PERMISSION_DENIED", "需要相册访问权限")
            return
        }
        
        try {
            val contentUri = Uri.parse(uri)
            
            // 获取缩略图
            val thumbnail = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // 使用 ContentResolver 加载缩略图
                activity.contentResolver.loadThumbnail(contentUri, android.util.Size(width, height), null)
            } else {
                // 旧版本使用 MediaStore.Images.Thumbnails
                MediaStore.Images.Thumbnails.getThumbnail(
                    activity.contentResolver,
                    ContentUris.parseId(contentUri),
                    MediaStore.Images.Thumbnails.MINI_KIND,
                    null
                )
            }
            
            if (thumbnail == null) {
                invoke.reject("THUMBNAIL_ERROR", "无法为 URI 生成缩略图: $uri")
                return
            }
            
            // 将bitmap转换为base64
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
            
            Log.i(TAG, "成功生成缩略图 ${thumbnail.width}x${thumbnail.height}")
            invoke.resolve(result)
            
        } catch (e: Exception) {
            Log.e(TAG, "生成照片缩略图时出错", e)
            invoke.reject("THUMBNAIL_ERROR", "生成缩略图时出错: ${e.message}")
        }
    }
    
    /**
     * 检查运行时的必要权限
     */
    private fun hasRequiredPermissions(): Boolean {
        val permissions = getRequiredPermissions()
        
        return permissions.all { permission ->
            ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED
        }
    }
    
    /**
     * 根据Android版本获取所需的权限
     */
    private fun getRequiredPermissions(): Array<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ (API 33+)
            arrayOf(Manifest.permission.READ_MEDIA_IMAGES)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11-12 (API 30-32)
            arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        } else {
            // Android 10 及以下 (API 29 及以下)
            // 注意：在Android 10及以下，有时也需要WRITE_EXTERNAL_STORAGE权限来读取媒体文件
            arrayOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            )
        }
    }
    
    /**
     * 获取指定相册的照片
     */
    @Command
    fun getPhotosByAlbum(invoke: Invoke, albumName: String) {
        Log.i(TAG, "get_photos_by_album 命令被调用，相册: $albumName")
        
        if (!hasRequiredPermissions()) {
            invoke.reject("PERMISSION_DENIED", "需要相册访问权限")
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
                    val name = cursor.getString(nameIndex) ?: ""
                    
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
      Log.e(TAG, "按相册获取照片时出错", e)
      invoke.reject("ALBUM_ERROR", "按相册获取照片时出错: ${e.message}")
    }
  }

  /**
   * 打开应用设置页面
   */
  @Command
  fun openAppSettings(invoke: Invoke) {
    Log.i(TAG, "打开应用设置页面")
    
    try {
      // 创建Intent打开应用的设置页面
      val intent = android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      val uri = android.net.Uri.fromParts("package", activity.packageName, null)
      intent.data = uri
      
      // 添加标志以在新任务中启动
      intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
      
      // 启动设置页面
      activity.startActivity(intent)
      
      Log.i(TAG, "成功启动应用设置页面")
      invoke.resolve()
      
    } catch (e: android.content.ActivityNotFoundException) {
      Log.e(TAG, "无法找到设置应用", e)
      
      // 尝试使用通用设置页面
      try {
        val fallbackIntent = android.content.Intent(android.provider.Settings.ACTION_SETTINGS)
        fallbackIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(fallbackIntent)
        
        Log.i(TAG, "使用通用设置页面作为备选方案")
        invoke.resolve()
        
      } catch (fallbackError: Exception) {
        Log.e(TAG, "备选方案也失败", fallbackError)
        invoke.reject("SETTINGS_ERROR", "无法打开设置页面: ${fallbackError.message}")
      }
      
    } catch (e: Exception) {
      Log.e(TAG, "打开应用设置页面时出错", e)
      invoke.reject("SETTINGS_ERROR", "打开设置页面时出错: ${e.message}")
    }
  }
}
