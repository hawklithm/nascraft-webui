import Foundation
import PhotosUI
import Tauri

@objc(PhotoPlugin)
class PhotoPlugin: Plugin {
    /**
     * 获取相册中所有图片的路径列表
     * 使用 PhotoKit 框架查询所有图片资源
     */
    @objc public func get_album_paths(_ invoke: Invoke) {
        DispatchQueue.global(qos: .userInitiated).async {
            let fetchOptions = PHFetchOptions()
            fetchOptions.sortDescriptors = [
                NSSortDescriptor(key: "creationDate", ascending: false)
            ]
            
            let assets: PHFetchResult<PHAsset> = PHAsset.fetchAssets(
                with: .image,
                options: fetchOptions
            )

            var paths: [String] = []
            assets.enumerateObjects({ asset, _, _ in
                let resources = PHAssetResource.assetResources(for: asset, options: nil)
                if let resource = resources.first {
                    paths.append(resource.originalFilename)
                }
            })

            invoke.resolve(paths)
        }
    }

    /**
     * 获取 PHImageManager 实例
     * 用于获取图片资源的文件名
     */
    private func getPHImageManager() -> PHImageManager {
        return PHImageManager.default()
    }
}
