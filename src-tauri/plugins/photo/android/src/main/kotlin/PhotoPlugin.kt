package app.tauri.photo

import android.app.Activity
import android.Manifest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import app.tauri.annotation.Command
import app.tauri.annotation.Permission
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@Suppress("unused")
@TauriPlugin(
    permissions = [
        Permission(strings = [Manifest.permission.READ_MEDIA_IMAGES], alias = "read_media_images"),
        Permission(strings = [Manifest.permission.READ_EXTERNAL_STORAGE], alias = "read_external_storage")
    ]
)
class PhotoPlugin(private val activity: Activity) : Plugin(activity) {
    companion object {
        const val READ_EXTERNAL_STORAGE_PERMISSION = android.Manifest.permission.READ_EXTERNAL_STORAGE
        const val READ_MEDIA_IMAGES_PERMISSION = android.Manifest.permission.READ_MEDIA_IMAGES
        
        // 权限列表
        val PERMISSIONS = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            arrayOf(READ_MEDIA_IMAGES_PERMISSION)
        } else {
            arrayOf(READ_EXTERNAL_STORAGE_PERMISSION)
        }
    }

    /**
     * 获取相册中所有图片文件的路径列表
     * 使用 MediaStore API 查询所有图片，返回文件路径数组
     */
    @Suppress("unused")
    @Command
    fun getAlbumPaths(invoke: Invoke) {
        val paths = runBlocking(Dispatchers.IO) {
            val pathList = mutableListOf<String>()
            
            try {
                val projection = arrayOf(
                    android.provider.MediaStore.Images.Media._ID,
                    android.provider.MediaStore.Images.Media.DATA
                )

                val sortOrder = "${android.provider.MediaStore.Images.Media.DATE_ADDED} DESC"
                
                val cursor = activity.contentResolver.query(
                    android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    null,
                    null,
                    sortOrder
                )

                cursor?.use {
                    val dataIndex = it.getColumnIndexOrThrow(android.provider.MediaStore.Images.Media.DATA)

                    while (it.moveToNext()) {
                        val data = it.getString(dataIndex)
                        if (data != null && data.isNotEmpty()) {
                            pathList.add(data)
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("PhotoPlugin", "Error fetching album paths", e)
            }
            
            pathList
        }
        
        val result = JSObject()
        result.put("paths", paths.toTypedArray())
        invoke.resolve(result)
    }
}
